"""tool_choice=required failure rate probe.

- Loads the captured baseline request body (from a real failing dump).
- Applies a named variant transformation.
- Fires N requests in parallel against S7 /v1/chat.
- Summarises per-attempt: tool_calls len, finish_reason, content len, reasoning len, completion_tokens.
- Writes per-attempt JSON dump and a summary CSV.
"""
from __future__ import annotations

import argparse
import asyncio
import copy
import json
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path

import httpx


PROBE_DIR = Path(__file__).resolve().parent
BASELINE_SOURCE = PROBE_DIR / "baseline-request-source.json"
S7_URL = "http://localhost:8000/v1/chat"


def load_baseline_body() -> dict:
    raw = json.loads(BASELINE_SOURCE.read_text())
    body = copy.deepcopy(raw["request"])
    return body


# ---- Variants ------------------------------------------------------------

def variant_baseline(body: dict) -> dict:
    return body


def variant_auto(body: dict) -> dict:
    body["tool_choice"] = "auto"
    return body


def variant_temp_03(body: dict) -> dict:
    body["temperature"] = 0.3
    return body


def variant_no_thinking(body: dict) -> dict:
    body.setdefault("chat_template_kwargs", {})["enable_thinking"] = False
    return body


def variant_single_tool(body: dict) -> dict:
    tools = body.get("tools", [])
    list_files = [t for t in tools if t.get("function", {}).get("name") == "list_files"]
    body["tools"] = list_files
    return body


MINIMAL_SYSTEM = (
    "You are AEGIS Build Agent. Your first action MUST be a tool call to list_files "
    "to inspect the project structure. Do not output text or JSON content on the first turn."
)
MINIMAL_USER = (
    "Inspect the project at /home/kosh/AEGIS/uploads/proj-probe to begin building it."
)


def variant_min_prompt(body: dict) -> dict:
    body["messages"] = [
        {"role": "system", "content": MINIMAL_SYSTEM},
        {"role": "user", "content": MINIMAL_USER},
    ]
    return body


def variant_small_max(body: dict) -> dict:
    body["max_tokens"] = 2048
    return body


VARIANTS = {
    "v0_baseline": variant_baseline,
    "v1_auto": variant_auto,
    "v2_temp03": variant_temp_03,
    "v3_no_thinking": variant_no_thinking,
    "v4_single_tool": variant_single_tool,
    "v5_min_prompt": variant_min_prompt,
    "v6_small_max": variant_small_max,
}


# ---- Probe execution -----------------------------------------------------

@dataclass
class AttemptResult:
    variant: str
    attempt_idx: int
    request_id: str
    http_status: int
    elapsed_ms: int
    finish_reason: str
    tool_calls_len: int
    content_len: int
    reasoning_len: int
    completion_tokens: int
    error: str | None
    dump_path: str

    @property
    def is_failure(self) -> bool:
        # P10 intent: first turn must produce a tool call. failure = 0 tool calls.
        return self.tool_calls_len == 0


async def fire_one(client: httpx.AsyncClient, variant_name: str, body: dict, idx: int, out_dir: Path) -> AttemptResult:
    request_id = f"probe-{variant_name}-{int(time.time()*1000)}-{idx:02d}"
    headers = {
        "Content-Type": "application/json",
        "X-Request-Id": request_id,
        "X-Timeout-Seconds": "300",
    }
    start = time.monotonic()
    err: str | None = None
    finish_reason = "?"
    tool_calls_len = 0
    content_len = 0
    reasoning_len = 0
    completion_tokens = 0
    http_status = 0
    resp_data: dict | None = None
    try:
        resp = await client.post(S7_URL, json=body, headers=headers, timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0))
        http_status = resp.status_code
        try:
            resp_data = resp.json()
        except Exception:
            err = "invalid json"
        if resp_data is not None:
            choices = resp_data.get("choices") or [{}]
            ch0 = choices[0] if choices else {}
            msg = ch0.get("message") or {}
            finish_reason = ch0.get("finish_reason") or "?"
            tcs = msg.get("tool_calls") or []
            tool_calls_len = len(tcs)
            content = msg.get("content") or ""
            content_len = len(content)
            reasoning = msg.get("reasoning") or ""
            reasoning_len = len(reasoning)
            usage = resp_data.get("usage") or {}
            completion_tokens = int(usage.get("completion_tokens") or 0)
    except Exception as e:
        err = str(e)[:200]

    elapsed_ms = int((time.monotonic() - start) * 1000)
    dump_path = out_dir / f"{variant_name}_{idx:02d}_{request_id}.json"
    dump_payload = {
        "variant": variant_name,
        "attempt_idx": idx,
        "request_id": request_id,
        "request": body,
        "response": resp_data,
        "http_status": http_status,
        "elapsed_ms": elapsed_ms,
        "error": err,
    }
    dump_path.write_text(json.dumps(dump_payload, ensure_ascii=False))

    return AttemptResult(
        variant=variant_name,
        attempt_idx=idx,
        request_id=request_id,
        http_status=http_status,
        elapsed_ms=elapsed_ms,
        finish_reason=finish_reason,
        tool_calls_len=tool_calls_len,
        content_len=content_len,
        reasoning_len=reasoning_len,
        completion_tokens=completion_tokens,
        error=err,
        dump_path=str(dump_path.relative_to(PROBE_DIR)),
    )


async def run_variant(variant_name: str, n: int, parallelism: int, out_dir: Path) -> list[AttemptResult]:
    if variant_name not in VARIANTS:
        raise SystemExit(f"unknown variant: {variant_name}")
    body_template = load_baseline_body()
    transformed = VARIANTS[variant_name](copy.deepcopy(body_template))
    out_dir.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(parallelism)
    results: list[AttemptResult] = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=300.0, write=10.0, pool=10.0)) as client:
        async def bound(idx: int) -> AttemptResult:
            async with sem:
                # Fresh deepcopy per attempt to avoid accidental mutation
                body = copy.deepcopy(transformed)
                return await fire_one(client, variant_name, body, idx, out_dir)

        results = await asyncio.gather(*(bound(i) for i in range(1, n + 1)))

    return results


def summarise(results: list[AttemptResult]) -> dict:
    n = len(results)
    failures = [r for r in results if r.is_failure]
    successes = [r for r in results if not r.is_failure]
    return {
        "variant": results[0].variant if results else "?",
        "n": n,
        "failure_count": len(failures),
        "failure_rate": (len(failures) / n) if n else 0.0,
        "success_count": len(successes),
        "finish_reasons": {fr: sum(1 for r in results if r.finish_reason == fr) for fr in sorted({r.finish_reason for r in results})},
        "avg_completion_tokens_failure": (sum(r.completion_tokens for r in failures) / len(failures)) if failures else None,
        "avg_completion_tokens_success": (sum(r.completion_tokens for r in successes) / len(successes)) if successes else None,
        "avg_reasoning_len_failure": (sum(r.reasoning_len for r in failures) / len(failures)) if failures else None,
        "avg_content_len_failure": (sum(r.content_len for r in failures) / len(failures)) if failures else None,
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("variant")
    p.add_argument("--n", type=int, default=10)
    p.add_argument("--parallelism", type=int, default=4)
    args = p.parse_args()

    out_dir = PROBE_DIR / "runs" / args.variant
    results = asyncio.run(run_variant(args.variant, args.n, args.parallelism, out_dir))

    summary = summarise(results)
    detail_path = PROBE_DIR / "runs" / f"{args.variant}_summary.json"
    detail_path.write_text(json.dumps({
        "summary": summary,
        "attempts": [asdict(r) for r in results],
    }, ensure_ascii=False, indent=2))

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
