from __future__ import annotations

import argparse
import asyncio
import json
import time
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bench import __version__
from bench.client import BenchmarkClient
from bench.fixtures import builtin_tasks
from bench.models import BenchTask, RequestPath, RunRecord
from bench.scoring import assistant_content, score_response
from bench.summary import summarize, summary_markdown


def _filter_tasks(tasks: list[BenchTask], *, mode: str, limit: int | None) -> list[BenchTask]:
    if mode != "all":
        tasks = [task for task in tasks if task.mode == mode]
    if limit is not None:
        tasks = tasks[:limit]
    return tasks


def _apply_thinking_mode(task: BenchTask, thinking_mode: str) -> BenchTask:
    if thinking_mode == "task":
        return task
    return replace(task, enable_thinking=(thinking_mode == "on"))


def _request_model(metadata: dict[str, Any], fallback: str) -> str:
    return metadata.get("servedModel") or fallback


async def _run_serving_diagnostics(
    *,
    client: BenchmarkClient,
    base_task: BenchTask,
    model: str,
    model_label: str,
    expected_model: str | None,
    actual_model: str | None,
    request_path: RequestPath,
    concurrency: int,
) -> list[RunRecord]:
    async def one(index: int) -> RunRecord:
        result = await client.chat(base_task, model=model, request_id=f"bench-serving-{concurrency}-{index}")
        if result.response is None:
            return RunRecord(
                task_id=f"serving_diag_c{concurrency}", family="serving", mode="serving-diagnostics",
                source_kind="serving-diagnostic", decisive=False, repeat_index=index,
                model_label=model_label, expected_model=expected_model, actual_model=actual_model,
                request_path=request_path, latency_ms=result.latency_ms, error_type=result.error_type, error=result.error,
            )
        content, tool_calls, finish_reason, usage = assistant_content(result.response)
        score = score_response(base_task, result.response)
        return RunRecord(
            task_id=f"serving_diag_c{concurrency}", family="serving", mode="serving-diagnostics",
            source_kind="serving-diagnostic", decisive=False, repeat_index=index,
            model_label=model_label, expected_model=expected_model, actual_model=actual_model,
            request_path=request_path, latency_ms=result.latency_ms,
            prompt_tokens=usage.get("prompt"), completion_tokens=usage.get("completion"),
            finish_reason=finish_reason, content=content, tool_calls=tool_calls,
            score=score.score, passed=score.passed, malformed=score.malformed,
            scorer_reason=score.reason,
            metadata={
                "concurrency": concurrency,
                "scorerDetails": score.details,
                "generationControls": {
                    "temperature": base_task.temperature,
                    "topP": base_task.top_p,
                    "topK": base_task.top_k,
                    "maxTokens": base_task.max_tokens,
                    "enableThinking": base_task.enable_thinking,
                    "responseFormat": base_task.response_format,
                },
            },
        )

    return await asyncio.gather(*(one(i) for i in range(concurrency)))


async def run_benchmark(args: argparse.Namespace) -> dict[str, Any]:
    request_path: RequestPath = args.request_path
    client = BenchmarkClient(args.base_url, request_path=request_path, timeout_s=args.timeout)
    records: list[RunRecord] = []
    started_at = datetime.now(UTC).isoformat()
    try:
        model_meta = await client.model_metadata()
        server_meta = await client.server_metadata()
        actual_model = model_meta.get("servedModel")
        if args.expected_model and actual_model and args.expected_model != actual_model and not args.allow_model_mismatch:
            raise SystemExit(f"expected model {args.expected_model!r} but endpoint serves {actual_model!r}; use --allow-model-mismatch to continue")
        model = args.model or _request_model(model_meta, args.model_label)
        tasks = [
            _apply_thinking_mode(task, args.thinking_mode)
            for task in _filter_tasks(builtin_tasks(args.suite), mode=args.mode, limit=args.limit)
        ]

        if args.mode in {"all", "serving-diagnostics"}:
            serving_task = _apply_thinking_mode(BenchTask(
                id="serving_probe",
                family="serving",
                mode="serving-diagnostics",
                source_kind="serving-diagnostic",
                messages=[{"role": "user", "content": "Reply with exactly: pong"}],
                scorer="exact",
                expected={"text": "pong"},
                max_tokens=2048,
                enable_thinking=True,
            ), args.thinking_mode)
            for concurrency in args.concurrency:
                records.extend(await _run_serving_diagnostics(
                    client=client, base_task=serving_task, model=model,
                    model_label=args.model_label, expected_model=args.expected_model,
                    actual_model=actual_model, request_path=request_path, concurrency=concurrency,
                ))

        for task in tasks:
            for repeat_index in range(task.repeat):
                result = await client.chat(task, model=model, request_id=f"bench-{args.model_label}-{task.id}-{repeat_index}")
                if result.response is None:
                    records.append(RunRecord(
                        task_id=task.id, family=task.family, mode=task.mode,
                        source_kind=task.source_kind, decisive=task.decisive,
                        repeat_index=repeat_index, model_label=args.model_label,
                        expected_model=args.expected_model, actual_model=actual_model,
                        request_path=request_path, latency_ms=result.latency_ms,
                        error_type=result.error_type, error=result.error,
                        metadata={"statusCode": result.status_code, "notes": task.notes},
                    ))
                    continue
                score = score_response(task, result.response)
                content, tool_calls, finish_reason, usage = assistant_content(result.response)
                records.append(RunRecord(
                    task_id=task.id, family=task.family, mode=task.mode,
                    source_kind=task.source_kind, decisive=task.decisive,
                    repeat_index=repeat_index, model_label=args.model_label,
                    expected_model=args.expected_model, actual_model=actual_model,
                    request_path=request_path, latency_ms=result.latency_ms,
                    prompt_tokens=usage.get("prompt"), completion_tokens=usage.get("completion"),
                    finish_reason=finish_reason, content=content, tool_calls=tool_calls,
                    score=score.score, passed=score.passed, malformed=score.malformed,
                    scorer_reason=score.reason,
                    metadata={
                        "scorerDetails": score.details,
                        "generationControls": {
                            "temperature": task.temperature,
                            "topP": task.top_p,
                            "topK": task.top_k,
                            "maxTokens": task.max_tokens,
                            "enableThinking": task.enable_thinking,
                            "responseFormat": task.response_format,
                        },
                        "notes": task.notes,
                    },
                ))
    finally:
        await client.aclose()

    completed_at = datetime.now(UTC).isoformat()
    metadata = {
        "benchmarkVersion": __version__,
        "suite": args.suite,
        "mode": args.mode,
        "limit": args.limit,
        "thinkingMode": args.thinking_mode,
        "requestPath": args.request_path,
        "baseUrl": args.base_url,
        "modelLabel": args.model_label,
        "expectedModel": args.expected_model,
        "actualModel": records[0].actual_model if records else None,
        "startedAt": started_at,
        "completedAt": completed_at,
        "modelMetadata": model_meta,
        "serverMetadata": server_meta,
        "concurrency": args.concurrency,
    }
    return {"metadata": metadata, "records": records, "summary": summarize(records, metadata=metadata)}


def _write_outputs(output_dir: Path, payload: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    records = payload["records"]
    with (output_dir / "raw.jsonl").open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record.to_json(), ensure_ascii=False) + "\n")
    (output_dir / "summary.json").write_text(json.dumps(payload["summary"], ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "summary.md").write_text(summary_markdown(payload["summary"]), encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="S7 text-only Qwen benchmark harness")
    parser.add_argument("--base-url", default="http://10.126.37.19:8000", help="OpenAI-compatible base URL or S7 Gateway base URL")
    parser.add_argument("--request-path", choices=["direct", "gateway"], default="direct", help="direct uses /v1/chat/completions; gateway uses /v1/chat")
    parser.add_argument("--mode", choices=["all", "quality", "strict-format", "gateway-contract", "serving-diagnostics"], default="all")
    parser.add_argument("--suite", choices=["quick", "standard", "long", "hard"], default="quick")
    parser.add_argument("--thinking-mode", choices=["task", "on", "off"], default="task", help="Override task thinking controls for diagnostic runs")
    parser.add_argument("--model-label", default="qwen36", help="Human label for this run; not trusted as served-model proof")
    parser.add_argument("--model", default=None, help="Model field to send; defaults to endpoint /v1/models served model")
    parser.add_argument("--expected-model", default=None, help="If set, fail unless /v1/models proves this exact model")
    parser.add_argument("--allow-model-mismatch", action="store_true", help="Continue when expected and actual served model differ, marking warning in summary")
    parser.add_argument("--limit", type=int, default=None, help="Limit non-serving tasks after suite/mode filtering")
    parser.add_argument("--output-dir", type=Path, default=Path("bench/results/latest"))
    parser.add_argument("--timeout", type=float, default=1800.0)
    parser.add_argument("--concurrency", type=int, nargs="+", default=[1, 2, 4], help="Serving diagnostic concurrency levels")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    start = time.monotonic()
    payload = asyncio.run(run_benchmark(args))
    _write_outputs(args.output_dir, payload)
    elapsed = time.monotonic() - start
    print(json.dumps({
        "outputDir": str(args.output_dir),
        "summary": payload["summary"].get("scores", {}),
        "counts": payload["summary"].get("counts", {}),
        "elapsedSeconds": round(elapsed, 2),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
