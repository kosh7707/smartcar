from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

from bench.models import RunRecord


def summarize(records: list[RunRecord], *, metadata: dict[str, Any]) -> dict[str, Any]:
    total = len(records)
    errored = [r for r in records if r.error_type]
    malformed = [r for r in records if r.malformed]
    decisive = [r for r in records if r.decisive and r.mode == "quality" and not r.error_type]
    all_scored = [r for r in records if not r.error_type]

    by_family = _group_scores(records, key="family")
    by_mode = _group_scores(records, key="mode")
    by_source_kind = _group_scores(records, key="source_kind")

    repeat_variance = _repeat_variance(records)
    quality_score = mean([r.score for r in decisive]) if decisive else 0.0
    all_score = mean([r.score for r in all_scored]) if all_scored else 0.0

    return {
        "metadata": metadata,
        "counts": {
            "total": total,
            "errored": len(errored),
            "malformed": len(malformed),
            "scored": len(all_scored),
            "decisive": len(decisive),
        },
        "rates": {
            "transportErrorRate": len(errored) / total if total else 0.0,
            "malformedOutputRate": len(malformed) / total if total else 0.0,
            "passRate": sum(1 for r in all_scored if r.passed) / len(all_scored) if all_scored else 0.0,
        },
        "scores": {
            "qualityScore": round(quality_score, 4),
            "allScoredMean": round(all_score, 4),
        },
        "byFamily": by_family,
        "byMode": by_mode,
        "bySourceKind": by_source_kind,
        "repeatVariance": repeat_variance,
        "latency": _latency(records),
        "throughput": _throughput(records),
        "servingDiagnosticsByConcurrency": _serving_by_concurrency(records),
        "tokenUsage": _tokens(records),
        "warnings": _warnings(records, metadata),
    }


def _group_scores(records: list[RunRecord], *, key: str) -> dict[str, Any]:
    groups: dict[str, list[RunRecord]] = defaultdict(list)
    for record in records:
        groups[str(getattr(record, key))].append(record)
    out: dict[str, Any] = {}
    for name, items in sorted(groups.items()):
        scored = [r for r in items if not r.error_type]
        out[name] = {
            "count": len(items),
            "scored": len(scored),
            "meanScore": round(mean([r.score for r in scored]), 4) if scored else 0.0,
            "passRate": round(sum(1 for r in scored if r.passed) / len(scored), 4) if scored else 0.0,
            "malformedRate": round(sum(1 for r in items if r.malformed) / len(items), 4) if items else 0.0,
            "errorRate": round(sum(1 for r in items if r.error_type) / len(items), 4) if items else 0.0,
        }
    return out


def _repeat_variance(records: list[RunRecord]) -> dict[str, Any]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for record in records:
        if record.error_type:
            continue
        grouped[record.task_id].append((record.content or str(record.tool_calls or "")).strip())
    repeated = {task_id: values for task_id, values in grouped.items() if len(values) > 1}
    return {
        task_id: {"runs": len(values), "uniqueOutputs": len(set(values)), "stable": len(set(values)) == 1}
        for task_id, values in sorted(repeated.items())
    }


def _latency(records: list[RunRecord]) -> dict[str, Any]:
    values = sorted(r.latency_ms for r in records if r.latency_ms is not None)
    return _latency_stats(values)


def _latency_stats(values: list[int]) -> dict[str, Any]:
    if not values:
        return {"count": 0}
    return {"count": len(values), "meanMs": round(mean(values), 2), "p50Ms": _percentile(values, 0.5), "p95Ms": _percentile(values, 0.95), "maxMs": max(values)}


def _tokens(records: list[RunRecord]) -> dict[str, int]:
    return {
        "prompt": sum(r.prompt_tokens or 0 for r in records),
        "completion": sum(r.completion_tokens or 0 for r in records),
    }


def _throughput(records: list[RunRecord]) -> dict[str, Any]:
    all_values = sorted(value for record in records if (value := toks_per_second(record)) is not None)
    serving_values = sorted(value for record in records if record.mode == "serving-diagnostics" and (value := toks_per_second(record)) is not None)

    return {"all": _throughput_stats(all_values), "servingDiagnostics": _throughput_stats(serving_values)}


def _serving_by_concurrency(records: list[RunRecord]) -> dict[str, Any]:
    groups: dict[str, list[RunRecord]] = defaultdict(list)
    for record in records:
        if record.mode != "serving-diagnostics":
            continue
        concurrency = record.metadata.get("concurrency", "unknown")
        groups[str(concurrency)].append(record)

    out: dict[str, Any] = {}
    for concurrency, items in sorted(groups.items(), key=lambda kv: (0, int(kv[0])) if kv[0].isdigit() else (1, kv[0])):
        scored = [r for r in items if not r.error_type]
        out[concurrency] = {
            "count": len(items),
            "scored": len(scored),
            "errorRate": round(sum(1 for r in items if r.error_type) / len(items), 4) if items else 0.0,
            "malformedRate": round(sum(1 for r in items if r.malformed) / len(items), 4) if items else 0.0,
            "passRate": round(sum(1 for r in scored if r.passed) / len(scored), 4) if scored else 0.0,
            "latency": _latency_stats(sorted(r.latency_ms for r in items if r.latency_ms is not None)),
            "throughput": _throughput_stats(sorted(value for r in items if (value := toks_per_second(r)) is not None)),
        }
    return out


def toks_per_second(record: RunRecord) -> float | None:
    if not record.latency_ms or record.latency_ms <= 0 or record.completion_tokens is None:
        return None
    return record.completion_tokens / (record.latency_ms / 1000)


def _throughput_stats(values: list[float]) -> dict[str, Any]:
    if not values:
        return {"count": 0}

    return {
        "count": len(values),
        "meanCompletionTokensPerSecond": round(mean(values), 2),
        "p50CompletionTokensPerSecond": round(_percentile(values, 0.5), 2),
        "p95CompletionTokensPerSecond": round(_percentile(values, 0.95), 2),
        "maxCompletionTokensPerSecond": round(max(values), 2),
    }


def _percentile(values: list[int] | list[float], percentile: float) -> int | float:
    idx = min(int(round((len(values) - 1) * percentile)), len(values) - 1)
    return values[idx]


def _warnings(records: list[RunRecord], metadata: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    expected = metadata.get("expectedModel")
    actual = metadata.get("actualModel")
    if expected and actual and expected != actual:
        warnings.append(f"expected model {expected!r} differs from actual served model {actual!r}")
    if any(r.source_kind == "custom-s7-diagnostic" for r in records):
        warnings.append("custom-s7-diagnostic fixtures are non-decisive by themselves")
    if metadata.get("requestPath") == "gateway":
        warnings.append("gateway path validates operational contract and may include model override effects")
    return warnings


def summary_markdown(summary: dict[str, Any]) -> str:
    lines = ["# S7 Qwen Benchmark Summary", ""]
    meta = summary.get("metadata", {})
    lines.extend([
        f"- Model label: `{meta.get('modelLabel')}`",
        f"- Actual model: `{meta.get('actualModel')}`",
        f"- Request path: `{meta.get('requestPath')}`",
        f"- Mode: `{meta.get('mode')}`",
        f"- Suite: `{meta.get('suite')}`",
        "",
        "## Scores",
        f"- Quality score: **{summary.get('scores', {}).get('qualityScore', 0.0)}**",
        f"- Pass rate: **{summary.get('rates', {}).get('passRate', 0.0)}**",
        f"- Malformed output rate: **{summary.get('rates', {}).get('malformedOutputRate', 0.0)}**",
        f"- Transport error rate: **{summary.get('rates', {}).get('transportErrorRate', 0.0)}**",
        "",
        "## By family",
    ])
    for family, data in summary.get("byFamily", {}).items():
        lines.append(f"- `{family}`: mean={data['meanScore']} pass={data['passRate']} count={data['count']}")
    warnings = summary.get("warnings") or []
    if warnings:
        lines.extend(["", "## Warnings"])
        lines.extend(f"- {warning}" for warning in warnings)
    return "\n".join(lines) + "\n"
