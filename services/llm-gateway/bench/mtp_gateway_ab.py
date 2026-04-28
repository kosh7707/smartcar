from __future__ import annotations

import argparse
import ast
import asyncio
import json
import re
import shutil
import statistics
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

MODEL = "Qwen/Qwen3.6-27B"
MIN_CONTEXT_LIMIT = 131072
BASE_URL = "http://localhost:8000"

TASKS: list[dict[str, Any]] = [
    {
        "id": "latency_pong",
        "kind": "short",
        "messages": [{"role": "user", "content": "Return exactly: PONG"}],
        "max_tokens": 32,
        "validator": "exact",
        "expected": "PONG",
    },
    {
        "id": "gen_120_words",
        "kind": "generation",
        "messages": [{"role": "user", "content": "Write about deterministic GPU inference in 120 to 150 words. Do not use bullets."}],
        "max_tokens": 220,
        "validator": "word_count_no_bullets",
        "min_words": 100,
        "max_words": 180,
    },
    {
        "id": "code_utility",
        "kind": "code",
        "messages": [{"role": "user", "content": "Write a Python function parse_latency_ms(line: str) -> int | None that extracts the integer after 'latency_ms=' from a log line. Return code only."}],
        "max_tokens": 320,
        "validator": "python_function",
        "function_name": "parse_latency_ms",
        "cases": [
            ["info latency_ms=123 done", 123],
            ["latency_ms=0", 0],
            ["no latency here", None],
            ["latency_ms=42 extra latency_ms=99", 42],
        ],
    },
    {
        "id": "tool_call_risk",
        "kind": "tool_call",
        "messages": [{"role": "user", "content": "Call classify_risk with severity high and confidence 0.9."}],
        "tools": [{
            "type": "function",
            "function": {
                "name": "classify_risk",
                "description": "Classify a security finding risk level.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "severity": {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["severity", "confidence"],
                },
            },
        }],
        "tool_choice": "auto",
        "max_tokens": 128,
        "validator": "tool_call",
        "expected_tool": {"name": "classify_risk", "arguments": {"severity": "high", "confidence": 0.9}},
    },
]


def pct(values: list[float], p: float) -> float | None:
    if not values:
        return None
    values = sorted(values)
    return values[min(round((len(values) - 1) * p), len(values) - 1)]


def stats(values: list[float]) -> dict[str, Any]:
    if not values:
        return {"count": 0}
    return {
        "count": len(values),
        "mean": round(statistics.mean(values), 3),
        "p50": round(pct(values, 0.5), 3),
        "p95": round(pct(values, 0.95), 3),
        "max": round(max(values), 3),
    }


def extract_model_profile(models: dict[str, Any]) -> tuple[str | None, int | None]:
    data = models.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0].get("id") or data[0].get("modelName"), data[0].get("max_model_len")
    profiles = models.get("profiles")
    if isinstance(profiles, list) and profiles and isinstance(profiles[0], dict):
        profile = profiles[0]
        return profile.get("modelName") or profile.get("profileId"), profile.get("contextLimit")
    return None, None


def verify_model(models: dict[str, Any]) -> dict[str, Any]:
    served, context = extract_model_profile(models)
    ok = served == MODEL and isinstance(context, int) and context >= MIN_CONTEXT_LIMIT
    return {"ok": ok, "servedModel": served, "contextLimit": context, "expectedModel": MODEL, "minContextLimit": MIN_CONTEXT_LIMIT}


def parse_tool_calls(response: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not response:
        return []
    choices = response.get("choices") or []
    if not choices:
        return []
    msg = choices[0].get("message") or {}
    calls = msg.get("tool_calls") or []
    out = []
    for call in calls:
        fn = call.get("function") or {}
        args = fn.get("arguments") or "{}"
        try:
            parsed_args = json.loads(args) if isinstance(args, str) else args
        except Exception as exc:
            parsed_args = {"__parse_error__": str(exc), "raw": args}
        out.append({"name": fn.get("name"), "arguments": parsed_args})
    return out


def final_text(response: dict[str, Any] | None) -> str:
    if not response:
        return ""
    choice = (response.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    content = msg.get("content") or ""
    if "</think>" in content:
        content = content.rsplit("</think>", 1)[1]
    return content.strip()


def strip_code(text: str) -> str:
    match = re.search(r"```(?:python)?\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return re.sub(r"^```(?:python)?\s*|```$", "", text.strip(), flags=re.IGNORECASE).strip()


def validate_python_function(task: dict[str, Any], text: str) -> tuple[bool, str, dict[str, Any]]:
    code = strip_code(text)
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return False, f"invalid Python syntax: {exc.msg}", {"code": code[:1000]}
    fn_name = task["function_name"]
    if not any(isinstance(node, ast.FunctionDef) and node.name == fn_name for node in tree.body):
        return False, f"missing function {fn_name}", {"code": code[:1000]}
    if not shutil.which("bwrap"):
        return False, "bubblewrap (bwrap) is not available; fail closed", {"code": code[:1000]}

    payload = json.dumps({"code": code, "function": fn_name, "cases": task["cases"]})
    runner = r'''
import json
import sys

data = json.loads(sys.stdin.read())
ns = {}
try:
    exec(data["code"], ns)
except Exception as exc:
    print(json.dumps({"error": "exec_failed", "type": type(exc).__name__, "message": str(exc)}))
    raise SystemExit(0)
fn = ns.get(data["function"])
if not callable(fn):
    print(json.dumps({"error": "missing function"}))
    raise SystemExit(0)
results = []
passed = 0
for arg, expected in data["cases"]:
    try:
        actual = fn(arg)
        ok = actual == expected
        results.append({"ok": ok, "input": arg, "expected": expected, "actual": actual})
        passed += 1 if ok else 0
    except Exception as exc:
        results.append({"ok": False, "input": arg, "expected": expected, "error": type(exc).__name__, "message": str(exc)})
print(json.dumps({"passed": passed, "total": len(data["cases"]), "results": results}, ensure_ascii=False))
'''
    cmd = [
        "bwrap",
        "--unshare-all",
        "--die-with-parent",
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/lib", "/lib",
        "--ro-bind", "/lib64", "/lib64",
        "--ro-bind", "/bin", "/bin",
        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
        "/usr/bin/python3", "-I", "-c", runner,
    ]
    try:
        proc = subprocess.run(cmd, input=payload, text=True, capture_output=True, timeout=3.0, check=False)
    except subprocess.TimeoutExpired:
        return False, "sandbox timeout", {"code": code[:1000]}
    if proc.returncode != 0:
        return False, f"sandbox failed rc={proc.returncode}: {proc.stderr[:500]}", {"code": code[:1000]}
    try:
        result = json.loads(proc.stdout.strip() or "{}")
    except json.JSONDecodeError as exc:
        return False, f"invalid sandbox JSON: {exc.msg}", {"code": code[:1000], "stdout": proc.stdout[:500]}
    if "error" in result:
        return False, f"sandbox {result.get('error')}: {result.get('type', '')} {result.get('message', '')}".strip(), {"code": code[:1000], "sandbox": result}
    total = int(result.get("total") or 0)
    passed = int(result.get("passed") or 0)
    ok = total > 0 and passed == total
    return ok, f"sandboxed tests passed {passed}/{total}", {"code": code[:1000], "sandbox": result}


def score(task: dict[str, Any], response: dict[str, Any] | None) -> tuple[bool, str, dict[str, Any]]:
    validator = task.get("validator")
    text = final_text(response)
    if validator == "exact":
        expected = task["expected"]
        return text == expected, f"expected exact {expected!r}, got {text!r}", {"content": text[:1000]}
    if validator == "word_count_no_bullets":
        words = re.findall(r"\b[\w'-]+\b", text)
        bullet_lines = [line for line in text.splitlines() if line.strip().startswith(("-", "*", "•"))]
        ok = task["min_words"] <= len(words) <= task["max_words"] and not bullet_lines
        return ok, f"word_count={len(words)}, bullet_lines={len(bullet_lines)}", {"content": text[:1000], "wordCount": len(words)}
    if validator == "python_function":
        return validate_python_function(task, text)
    if validator == "tool_call":
        calls = parse_tool_calls(response)
        if not calls:
            return False, "missing tool_calls", {"content": text[:1000]}
        exp = task["expected_tool"]
        got = calls[0]
        if got.get("name") != exp["name"]:
            return False, f"tool name got {got.get('name')}", {"toolCalls": calls}
        args = got.get("arguments") if isinstance(got.get("arguments"), dict) else {}
        for key, val in exp["arguments"].items():
            actual = args.get(key)
            try:
                if isinstance(val, float):
                    if abs(float(actual) - val) > 1e-6:
                        return False, f"arg {key} got {actual}", {"toolCalls": calls}
                elif actual != val:
                    return False, f"arg {key} got {actual}", {"toolCalls": calls}
            except Exception as exc:
                return False, f"arg {key} invalid: {type(exc).__name__}: {exc}", {"toolCalls": calls}
        return True, "ok", {"toolCalls": calls}
    return False, f"unknown validator {validator}", {}


async def run_one(client: httpx.AsyncClient, task: dict[str, Any], label: str, repeat: int) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": MODEL,
        "messages": task["messages"],
        "max_tokens": task["max_tokens"],
        "temperature": 0.001,
        "top_p": 0.95,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    if task.get("tools"):
        body["tools"] = task["tools"]
        body["tool_choice"] = task.get("tool_choice", "auto")
    rid = f"s7-mtp-{label}-{task['id']}-{repeat}"
    start = time.monotonic()
    status = None
    response = None
    error = None
    try:
        resp = await client.post(f"{BASE_URL}/v1/chat", json=body, headers={"X-Request-Id": rid, "Content-Type": "application/json"})
        status = resp.status_code
        if resp.status_code >= 400:
            error = resp.text[:1000]
        else:
            response = resp.json()
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    latency_ms = int((time.monotonic() - start) * 1000)
    ok, reason, details = score(task, response) if not error else (False, error, {})
    usage = (response or {}).get("usage") or {}
    choice = ((response or {}).get("choices") or [{}])[0]
    completion = usage.get("completion_tokens") or 0
    return {
        "label": label,
        "taskId": task["id"],
        "kind": task["kind"],
        "validator": task.get("validator"),
        "repeat": repeat,
        "status": status,
        "latencyMs": latency_ms,
        "promptTokens": usage.get("prompt_tokens"),
        "completionTokens": completion,
        "completionTokensPerSecond": round(completion / (latency_ms / 1000), 3) if latency_ms and completion else None,
        "finishReason": choice.get("finish_reason") if isinstance(choice, dict) else None,
        "toolCalls": parse_tool_calls(response),
        "contentPreview": final_text(response)[:500],
        "passed": ok,
        "reason": reason,
        "details": details,
        "error": error,
    }


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--repeats", type=int, default=2)
    parser.add_argument("--concurrency", type=int, default=2)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(args.concurrency)
    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10, read=300, write=10, pool=10)) as client:
        health = (await client.get(f"{BASE_URL}/v1/health")).json()
        models = (await client.get(f"{BASE_URL}/v1/models")).json()
        model_verification = verify_model(models)
        if not model_verification["ok"]:
            raise SystemExit(f"model verification failed: {model_verification}")
        started = time.monotonic()
        async def guarded(task: dict[str, Any], repeat: int) -> dict[str, Any]:
            async with sem:
                return await run_one(client, task, args.label, repeat)
        records = await asyncio.gather(*(guarded(task, r) for task in TASKS for r in range(args.repeats)), return_exceptions=True)
        normalized: list[dict[str, Any]] = []
        for idx, record in enumerate(records):
            if isinstance(record, Exception):
                normalized.append({"label": args.label, "taskId": "unknown", "kind": "unknown", "repeat": idx, "passed": False, "error": f"{type(record).__name__}: {record}", "latencyMs": None, "completionTokens": 0, "completionTokensPerSecond": None})
            else:
                normalized.append(record)
        wall_ms = int((time.monotonic() - started) * 1000)

    by_kind: dict[str, dict[str, Any]] = {}
    for kind in sorted({r["kind"] for r in normalized}):
        rows = [r for r in normalized if r["kind"] == kind]
        by_kind[kind] = {
            "count": len(rows),
            "passed": sum(1 for r in rows if r["passed"]),
            "latencyMs": stats([r["latencyMs"] for r in rows if r.get("latencyMs") is not None]),
            "completionTokensPerSecond": stats([r["completionTokensPerSecond"] for r in rows if r.get("completionTokensPerSecond") is not None]),
        }
    all_tps = [r["completionTokensPerSecond"] for r in normalized if r.get("completionTokensPerSecond") is not None]
    total_completion = sum(r.get("completionTokens") or 0 for r in normalized)
    summary = {
        "label": args.label,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "modelVerification": model_verification,
        "gatewayBaseUrl": BASE_URL,
        "concurrency": args.concurrency,
        "repeats": args.repeats,
        "wallMs": wall_ms,
        "counts": {"total": len(normalized), "passed": sum(1 for r in normalized if r["passed"]), "failed": sum(1 for r in normalized if not r["passed"])},
        "latencyMs": stats([r["latencyMs"] for r in normalized if r.get("latencyMs") is not None]),
        "completionTokensPerSecond": stats(all_tps),
        "aggregateCompletionTokensPerSecond": round(total_completion / (wall_ms / 1000), 3) if wall_ms else None,
        "byKind": by_kind,
        "health": health,
        "models": models,
    }
    (args.output_dir / f"{args.label}-raw.json").write_text(json.dumps({"summary": summary, "records": normalized}, ensure_ascii=False, indent=2))
    (args.output_dir / f"{args.label}-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    lines = [
        f"# Gateway benchmark — {args.label}", "",
        f"- Model verified: {model_verification['ok']} served={model_verification['servedModel']} context={model_verification['contextLimit']}",
        f"- Requests: {summary['counts']['total']} / passed {summary['counts']['passed']}",
        f"- Wall ms: {wall_ms}",
        f"- Latency mean/p50/p95 ms: {summary['latencyMs'].get('mean')} / {summary['latencyMs'].get('p50')} / {summary['latencyMs'].get('p95')}",
        f"- Per-request completion tok/s mean: {summary['completionTokensPerSecond'].get('mean')}",
        f"- Aggregate completion tok/s: {summary['aggregateCompletionTokensPerSecond']}",
        "", "| kind | n | pass | latency mean ms | p95 ms | tok/s mean |", "|---|---:|---:|---:|---:|---:|",
    ]
    for kind, data in by_kind.items():
        lines.append(f"| {kind} | {data['count']} | {data['passed']} | {data['latencyMs'].get('mean')} | {data['latencyMs'].get('p95')} | {data['completionTokensPerSecond'].get('mean')} |")
    failures = [r for r in normalized if not r["passed"]]
    if failures:
        lines.extend(["", "## Failures"])
        lines.extend(f"- {r.get('taskId')}#{r.get('repeat')}: {r.get('reason') or r.get('error')}" for r in failures)
    (args.output_dir / f"{args.label}-summary.md").write_text("\n".join(lines) + "\n")
    print(json.dumps(summary, indent=2)[:4000])
    return 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
