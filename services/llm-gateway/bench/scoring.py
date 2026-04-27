from __future__ import annotations

import ast
import json
import re
import shutil
import subprocess
from typing import Any

from bench.models import BenchTask, ScoreResult


def assistant_content(response: dict[str, Any]) -> tuple[str | None, list[dict[str, Any]] | None, str | None, dict[str, int]]:
    choices = response.get("choices") if isinstance(response, dict) else None
    if not isinstance(choices, list) or not choices:
        return None, None, None, {}
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first, dict) else {}
    if not isinstance(message, dict):
        message = {}
    usage = response.get("usage") if isinstance(response, dict) else {}
    if not isinstance(usage, dict):
        usage = {}
    return (
        message.get("content") if isinstance(message.get("content"), str) else None,
        message.get("tool_calls") if isinstance(message.get("tool_calls"), list) else None,
        first.get("finish_reason") if isinstance(first.get("finish_reason"), str) else None,
        {
            "prompt": int(usage.get("prompt_tokens") or 0),
            "completion": int(usage.get("completion_tokens") or 0),
        },
    )


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def final_answer_text(content: str | None) -> str:
    """Return answer text after an optional Qwen thinking block.

    vLLM with a Qwen reasoning parser normally exposes only the final answer in
    `message.content`. Some deployments or gateway paths may still include the
    raw `<think>...</think>` block in content, so scorers normalize to the text
    after the last completed thinking block. If generation stops inside an
    unfinished thinking block, the final answer is intentionally empty.
    """
    text = _normalize_text(content)
    if not text:
        return ""
    if "</think>" in text:
        return text.rsplit("</think>", 1)[1].strip()
    if text.startswith("<think>"):
        return ""
    return text


def _json_from_content(content: str | None) -> tuple[dict[str, Any] | None, str | None]:
    final_text = final_answer_text(content)
    if not final_text:
        return None, "empty content"
    try:
        parsed = json.loads(final_text)
    except json.JSONDecodeError as exc:
        return None, f"invalid JSON: {exc.msg}"
    if not isinstance(parsed, dict):
        return None, "JSON content is not an object"
    return parsed, None


def score_response(task: BenchTask, response: dict[str, Any]) -> ScoreResult:
    content, tool_calls, _finish_reason, _usage = assistant_content(response)
    scorer = task.scorer
    expected = task.expected

    if scorer == "exact":
        expected_text = str(expected.get("text", "")).strip()
        actual = final_answer_text(content)
        if not actual:
            return ScoreResult(
                score=0.0,
                passed=False,
                malformed=True,
                reason=f"expected exact {expected_text!r}, got empty final answer",
            )
        return ScoreResult(
            score=1.0 if actual == expected_text else 0.0,
            passed=actual == expected_text,
            reason=f"expected exact {expected_text!r}, got {actual!r}",
        )

    if scorer == "contains_all":
        actual = final_answer_text(content)
        if not actual:
            return ScoreResult(score=0.0, passed=False, malformed=True, reason="empty final answer")
        missing = [s for s in expected.get("substrings", []) if s not in actual]
        score = 1.0 - (len(missing) / max(len(expected.get("substrings", [])), 1))
        return ScoreResult(score=score, passed=not missing, reason=f"missing substrings: {missing}")

    if scorer == "json_fields":
        parsed, err = _json_from_content(content)
        if parsed is None:
            return ScoreResult(score=0.0, passed=False, malformed=True, reason=err or "malformed JSON")
        fields = expected.get("fields", {})
        mismatches = {k: {"expected": v, "actual": parsed.get(k)} for k, v in fields.items() if parsed.get(k) != v}
        extra = sorted(set(parsed) - set(fields)) if expected.get("allowExtra") is False else []
        passed = not mismatches and not extra
        return ScoreResult(
            score=1.0 if passed else 0.0,
            passed=passed,
            reason=f"mismatches={mismatches}, extra={extra}",
            details={"parsed": parsed},
        )

    if scorer == "tool_call":
        if not tool_calls:
            return ScoreResult(score=0.0, passed=False, malformed=True, reason="missing tool_calls")
        call = tool_calls[0]
        function = call.get("function", {}) if isinstance(call, dict) else {}
        name_ok = function.get("name") == expected.get("name")
        raw_args = function.get("arguments", "{}")
        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
        except json.JSONDecodeError as exc:
            return ScoreResult(score=0.0, passed=False, malformed=True, reason=f"invalid tool arguments JSON: {exc.msg}")
        expected_args = expected.get("arguments", {})
        args_ok = isinstance(args, dict) and all(args.get(k) == v for k, v in expected_args.items())
        score = (0.5 if name_ok else 0.0) + (0.5 if args_ok else 0.0)
        return ScoreResult(score=score, passed=name_ok and args_ok, reason=f"name_ok={name_ok}, args_ok={args_ok}", details={"arguments": args})

    if scorer == "evidence_json":
        parsed, err = _json_from_content(content)
        if parsed is None:
            return ScoreResult(score=0.0, passed=False, malformed=True, reason=err or "malformed JSON")
        missing_fields = [f for f in expected.get("requiredFields", []) if f not in parsed]
        used = parsed.get("usedEvidenceRefs", [])
        allowed = set(expected.get("allowedRefs", []))
        required = set(expected.get("requiredRefs", []))
        used_set = set(used) if isinstance(used, list) else set()
        unknown = sorted(used_set - allowed)
        missing_refs = sorted(required - used_set)
        passed = not missing_fields and not unknown and not missing_refs
        components = [not missing_fields, not unknown, not missing_refs]
        score = sum(1 for ok in components if ok) / len(components)
        return ScoreResult(
            score=score,
            passed=passed,
            malformed=False,
            reason=f"missing_fields={missing_fields}, unknown_refs={unknown}, missing_refs={missing_refs}",
            details={"parsed": parsed},
        )

    if scorer == "multiple_choice":
        actual = final_answer_text(content)
        match = re.search(r"\b([A-D])\b", actual.upper())
        if not match:
            return ScoreResult(score=0.0, passed=False, malformed=True, reason=f"missing A-D answer in {actual!r}")
        expected_choice = str(expected.get("choice", "")).upper()
        got = match.group(1)
        return ScoreResult(score=1.0 if got == expected_choice else 0.0, passed=got == expected_choice, reason=f"expected {expected_choice}, got {got}")

    if scorer == "python_function_bwrap":
        return _score_python_function_bwrap(final_answer_text(content), expected)

    if scorer == "python_static":
        return _score_python_static(final_answer_text(content), expected)

    if scorer == "csv_constraints":
        return _score_csv_constraints(final_answer_text(content), expected)

    return ScoreResult(score=0.0, passed=False, reason=f"unknown scorer: {scorer}")


def _extract_python_code(text: str) -> str:
    match = re.search(r"```(?:python)?\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if match:
        code = match.group(1)
    else:
        code = re.sub(r"^\s*```(?:python)?\s*", "", text.strip(), flags=re.IGNORECASE)
    lines = []
    for line in code.strip().splitlines():
        if line.strip().startswith(("from typing import", "import typing")):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def _score_python_static(content: str, expected: dict[str, Any]) -> ScoreResult:
    code = _extract_python_code(content)
    if not code:
        return ScoreResult(score=0.0, passed=False, malformed=True, reason="empty Python code")
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return ScoreResult(score=0.0, passed=False, malformed=True, reason=f"invalid Python syntax: {exc.msg}")

    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    function_name = expected.get("function")
    checks: list[tuple[str, bool]] = [
        ("has_target_function", any(fn.name == function_name for fn in functions)),
        ("no_imports", not any(isinstance(node, (ast.Import, ast.ImportFrom)) for node in ast.walk(tree))),
        ("has_return", any(isinstance(node, ast.Return) for node in ast.walk(tree))),
    ]
    for item in expected.get("contains", []):
        checks.append((f"contains:{item}", item in code))
    for group in expected.get("anyContains", []):
        checks.append((f"any:{'|'.join(group)}", any(item in code for item in group)))
    for item in expected.get("forbidden", []):
        checks.append((f"forbidden:{item}", item not in code))

    failed = [name for name, ok in checks if not ok]
    score = sum(1 for _name, ok in checks if ok) / len(checks)
    return ScoreResult(
        score=score,
        passed=not failed,
        malformed=False,
        reason=f"failed={failed}",
        details={"code": code, "failed": failed},
    )


def _score_python_function_bwrap(content: str, expected: dict[str, Any]) -> ScoreResult:
    code = _extract_python_code(content)
    if not code:
        return ScoreResult(score=0.0, passed=False, malformed=True, reason="empty Python code")
    try:
        ast.parse(code)
    except SyntaxError as exc:
        return ScoreResult(score=0.0, passed=False, malformed=True, reason=f"invalid Python syntax: {exc.msg}")
    if not shutil.which("bwrap"):
        return ScoreResult(score=0.0, passed=False, malformed=True, reason="bubblewrap (bwrap) is not available")

    payload = json.dumps({"code": code, "function": expected.get("function"), "tests": expected.get("tests", [])})
    runner = r"""
import json
import sys

data = json.loads(sys.stdin.read())
ns = {}
exec(data["code"], ns)
fn = ns.get(data["function"])
if not callable(fn):
    print(json.dumps({"error": "missing function"}))
    raise SystemExit(0)
passed = 0
results = []
for case in data["tests"]:
    args = case.get("args", [])
    kwargs = case.get("kwargs", {})
    expected = case.get("expected")
    try:
        actual = fn(*args, **kwargs)
        ok = actual == expected
        results.append({"ok": ok, "actual": actual, "expected": expected})
        passed += 1 if ok else 0
    except Exception as exc:
        results.append({"ok": False, "error": type(exc).__name__, "message": str(exc)})
print(json.dumps({"passed": passed, "total": len(data["tests"]), "results": results}, ensure_ascii=False))
"""
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
        return ScoreResult(score=0.0, passed=False, malformed=True, reason="sandbox timeout")

    if proc.returncode != 0:
        return ScoreResult(
            score=0.0,
            passed=False,
            malformed=True,
            reason=f"sandbox failed rc={proc.returncode}: {proc.stderr[:500]}",
            details={"code": code},
        )
    try:
        result = json.loads(proc.stdout.strip() or "{}")
    except json.JSONDecodeError as exc:
        return ScoreResult(score=0.0, passed=False, malformed=True, reason=f"invalid sandbox JSON: {exc.msg}")
    if "error" in result:
        return ScoreResult(score=0.0, passed=False, malformed=True, reason=str(result["error"]), details={"code": code})
    total = int(result.get("total") or 0)
    passed = int(result.get("passed") or 0)
    score = passed / total if total else 0.0
    return ScoreResult(
        score=score,
        passed=passed == total and total > 0,
        malformed=False,
        reason=f"passed {passed}/{total} sandboxed tests",
        details={"code": code, "results": result.get("results", [])},
    )


def _score_csv_constraints(content: str, expected: dict[str, Any]) -> ScoreResult:
    words = [part.strip().lower() for part in content.strip().split(",") if part.strip()]
    allowed = set(expected.get("allowedWords", []))
    checks: list[tuple[str, bool]] = [
        ("count", len(words) == expected.get("count")),
        ("starts", "".join(word[:1] for word in words) == expected.get("starts")),
        ("sorted", words == sorted(words) if expected.get("sorted") else True),
        ("third_len", len(words[2]) == expected.get("thirdLen") if len(words) >= 3 and expected.get("thirdLen") else False),
        ("allowed", all(word in allowed for word in words) if allowed else True),
    ]
    failed = [name for name, ok in checks if not ok]
    score = sum(1 for _name, ok in checks if ok) / len(checks)
    return ScoreResult(
        score=score,
        passed=not failed,
        malformed=not words,
        reason=f"failed={failed}, words={words}",
        details={"words": words},
    )
