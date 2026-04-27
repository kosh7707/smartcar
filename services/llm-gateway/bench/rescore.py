from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from bench.fixtures import builtin_tasks
from bench.models import RunRecord
from bench.scoring import score_response
from bench.summary import summarize, summary_markdown


def _record_from_json(data: dict[str, Any]) -> RunRecord:
    return RunRecord(
        task_id=data["taskId"],
        family=data["family"],
        mode=data["mode"],
        source_kind=data["sourceKind"],
        decisive=bool(data["decisive"]),
        repeat_index=int(data["repeatIndex"]),
        model_label=data["modelLabel"],
        expected_model=data.get("expectedModel"),
        actual_model=data.get("actualModel"),
        request_path=data["requestPath"],
        latency_ms=data.get("latencyMs"),
        prompt_tokens=data.get("promptTokens"),
        completion_tokens=data.get("completionTokens"),
        finish_reason=data.get("finishReason"),
        content=data.get("content"),
        tool_calls=data.get("toolCalls"),
        score=float(data.get("score", 0.0)),
        passed=bool(data.get("passed", False)),
        malformed=bool(data.get("malformed", False)),
        error_type=data.get("errorType"),
        error=data.get("error"),
        scorer_reason=data.get("scorerReason", ""),
        metadata=data.get("metadata") or {},
    )


def _response_from_record(record: RunRecord) -> dict[str, Any]:
    message: dict[str, Any] = {}
    if record.content is not None:
        message["content"] = record.content
    if record.tool_calls is not None:
        message["tool_calls"] = record.tool_calls
    return {
        "choices": [{"message": message, "finish_reason": record.finish_reason}],
        "usage": {
            "prompt_tokens": record.prompt_tokens or 0,
            "completion_tokens": record.completion_tokens or 0,
        },
    }


def load_records(raw_path: Path) -> list[RunRecord]:
    records: list[RunRecord] = []
    for line in raw_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            records.append(_record_from_json(json.loads(line)))
    return records


def rescore_records(records: list[RunRecord], *, suite: str) -> list[RunRecord]:
    tasks = {task.id: task for task in builtin_tasks(suite)}
    rescored: list[RunRecord] = []
    for record in records:
        task = tasks.get(record.task_id)
        if task is None or record.error_type:
            rescored.append(record)
            continue
        score = score_response(task, _response_from_record(record))
        metadata = dict(record.metadata)
        metadata["rescored"] = True
        metadata["scorerDetails"] = score.details
        record.score = score.score
        record.passed = score.passed
        record.malformed = score.malformed
        record.scorer_reason = score.reason
        record.metadata = metadata
        rescored.append(record)
    return rescored


def write_outputs(output_dir: Path, records: list[RunRecord], metadata: dict[str, Any]) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = summarize(records, metadata=metadata)
    with (output_dir / "raw.jsonl").open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record.to_json(), ensure_ascii=False) + "\n")
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "summary.md").write_text(summary_markdown(summary), encoding="utf-8")
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-score an existing S7 benchmark raw.jsonl with current scorers")
    parser.add_argument("--raw", required=True, type=Path)
    parser.add_argument("--summary", required=True, type=Path, help="Original summary.json; metadata is preserved with rescore notes")
    parser.add_argument("--suite", required=True, choices=["quick", "standard", "long", "hard"])
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args(argv)

    original_summary = json.loads(args.summary.read_text(encoding="utf-8"))
    metadata = dict(original_summary.get("metadata") or {})
    metadata["rescoredFrom"] = str(args.raw)
    metadata["rescoredWithCurrentScorers"] = True
    metadata["suite"] = args.suite
    records = rescore_records(load_records(args.raw), suite=args.suite)
    summary = write_outputs(args.output_dir, records, metadata)
    print(json.dumps({"outputDir": str(args.output_dir), "scores": summary.get("scores"), "counts": summary.get("counts")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
