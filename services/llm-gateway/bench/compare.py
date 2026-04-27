from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def compare_summaries(baseline: dict[str, Any], candidate: dict[str, Any], *, min_delta: float = 0.03) -> dict[str, Any]:
    base_quality = float(baseline.get("scores", {}).get("qualityScore", 0.0))
    cand_quality = float(candidate.get("scores", {}).get("qualityScore", 0.0))
    delta = cand_quality - base_quality
    cand_rates = candidate.get("rates", {})
    catastrophic = cand_rates.get("transportErrorRate", 0.0) >= 0.2 or cand_rates.get("malformedOutputRate", 0.0) >= 0.2
    if catastrophic:
        recommendation = "do-not-replace"
        reason = "candidate quality may be invalidated by catastrophic stability/transport issues"
    elif delta >= min_delta:
        recommendation = "replace"
        reason = "candidate quality score exceeds baseline by configured margin"
    elif abs(delta) < min_delta:
        recommendation = "route-by-workload"
        reason = "quality scores are close; inspect family-level strengths and stability diagnostics"
    else:
        recommendation = "do-not-replace"
        reason = "candidate quality score does not exceed baseline"
    return {
        "baselineModel": baseline.get("metadata", {}).get("actualModel"),
        "candidateModel": candidate.get("metadata", {}).get("actualModel"),
        "baselineQualityScore": base_quality,
        "candidateQualityScore": cand_quality,
        "qualityDelta": round(delta, 4),
        "minDelta": min_delta,
        "recommendation": recommendation,
        "reason": reason,
        "candidateStability": cand_rates,
        "baselineStability": baseline.get("rates", {}),
        "confounds": list((baseline.get("warnings") or [])) + list((candidate.get("warnings") or [])),
    }


def comparison_markdown(result: dict[str, Any]) -> str:
    return "\n".join([
        "# S7 Qwen Benchmark Comparison",
        "",
        f"- Baseline: `{result.get('baselineModel')}` quality={result.get('baselineQualityScore')}",
        f"- Candidate: `{result.get('candidateModel')}` quality={result.get('candidateQualityScore')}",
        f"- Delta: **{result.get('qualityDelta')}**",
        f"- Recommendation: **{result.get('recommendation')}**",
        f"- Reason: {result.get('reason')}",
        "",
        "## Confounds / warnings",
        *[f"- {item}" for item in result.get("confounds", [])],
        "",
    ])


def compare_many_summaries(summaries: dict[str, dict[str, Any]], *, min_delta: float = 0.03) -> dict[str, Any]:
    rows = [_summary_row(label, summary) for label, summary in summaries.items()]
    rows.sort(key=lambda row: (
        row["catastrophic"],
        -row["qualityScore"],
        -row["allScoredMean"],
        -(row["servingMeanCompletionTokensPerSecond"] or 0.0),
        row["latencyP50Ms"] if row["latencyP50Ms"] is not None else float("inf"),
        row["label"],
    ))
    viable = [row for row in rows if not row["catastrophic"]]
    if not viable:
        recommendation = "do-not-replace"
        reason = "all models have catastrophic transport or malformed-output rates"
        winner = None
    elif len(viable) == 1:
        recommendation = "prefer"
        reason = "only one viable model completed without catastrophic stability issues"
        winner = viable[0]["label"]
    else:
        delta = viable[0]["qualityScore"] - viable[1]["qualityScore"]
        winner = viable[0]["label"]
        if delta >= min_delta:
            recommendation = "prefer"
            reason = "top model quality score exceeds second place by configured margin"
        else:
            winner = None
            recommendation = "route-by-workload"
            reason = "top quality scores are close; inspect family-level strengths and operational diagnostics"

    return {
        "models": rows,
        "winner": winner,
        "recommendation": recommendation,
        "reason": reason,
        "minDelta": min_delta,
        "confounds": [warning for summary in summaries.values() for warning in summary.get("warnings", [])],
    }


def multi_comparison_markdown(result: dict[str, Any]) -> str:
    lines = [
        "# S7 Qwen Benchmark Multi-Model Comparison",
        "",
        f"- Recommendation: **{result.get('recommendation')}**",
        f"- Winner: `{result.get('winner') or 'none'}`",
        f"- Reason: {result.get('reason')}",
        "",
        "## Ranking",
    ]
    for index, row in enumerate(result.get("models", []), start=1):
        root_suffix = f" root={row['rootModel']}" if row.get("rootModel") and row.get("rootModel") != row.get("actualModel") else ""
        lines.append(
            f"{index}. `{row['label']}` / `{row['actualModel']}`{root_suffix}: "
            f"quality={row['qualityScore']} all={row['allScoredMean']} "
            f"transport={row['transportErrorRate']} malformed={row['malformedOutputRate']} "
            f"latency_p50_ms={row['latencyP50Ms']} serving_tps={row['servingMeanCompletionTokensPerSecond']}"
        )
    confounds = result.get("confounds") or []
    if confounds:
        lines.extend(["", "## Confounds / warnings"])
        lines.extend(f"- {item}" for item in confounds)
    return "\n".join(lines) + "\n"


def _summary_row(label: str, summary: dict[str, Any]) -> dict[str, Any]:
    rates = summary.get("rates", {})
    scores = summary.get("scores", {})
    model_data = summary.get("metadata", {}).get("modelMetadata", {}).get("response", {}).get("data", [])
    root_model = model_data[0].get("root") if model_data and isinstance(model_data[0], dict) else None
    transport = float(rates.get("transportErrorRate", 0.0))
    malformed = float(rates.get("malformedOutputRate", 0.0))
    return {
        "label": label,
        "actualModel": summary.get("metadata", {}).get("actualModel"),
        "rootModel": root_model,
        "qualityScore": float(scores.get("qualityScore", 0.0)),
        "allScoredMean": float(scores.get("allScoredMean", 0.0)),
        "transportErrorRate": transport,
        "malformedOutputRate": malformed,
        "passRate": float(rates.get("passRate", 0.0)),
        "catastrophic": transport >= 0.2 or malformed >= 0.2,
        "latencyP50Ms": summary.get("latency", {}).get("p50Ms"),
        "latencyP95Ms": summary.get("latency", {}).get("p95Ms"),
        "servingMeanCompletionTokensPerSecond": summary.get("throughput", {}).get("servingDiagnostics", {}).get("meanCompletionTokensPerSecond"),
        "counts": summary.get("counts", {}),
        "warnings": summary.get("warnings", []),
    }


def _load_labeled_summary(value: str) -> tuple[str, dict[str, Any]]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("summary must be LABEL=PATH")
    label, raw_path = value.split("=", 1)
    if not label:
        raise argparse.ArgumentTypeError("summary label cannot be empty")
    path = Path(raw_path)
    return label, json.loads(path.read_text())


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare S7 benchmark summary.json files")
    parser.add_argument("--baseline", type=Path, help="Baseline summary for two-model comparison")
    parser.add_argument("--candidate", type=Path, help="Candidate summary for two-model comparison")
    parser.add_argument("--summary", action="append", default=[], metavar="LABEL=PATH", help="Repeat for three-or-more model ranking")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--min-delta", type=float, default=0.03)
    args = parser.parse_args()

    if args.summary:
        summaries = dict(_load_labeled_summary(value) for value in args.summary)
        if len(summaries) < 2:
            parser.error("--summary requires at least two LABEL=PATH values")
        result = compare_many_summaries(summaries, min_delta=args.min_delta)
        markdown = multi_comparison_markdown(result)
    else:
        if args.baseline is None or args.candidate is None:
            parser.error("provide --baseline/--candidate or repeat --summary LABEL=PATH")
        baseline = json.loads(args.baseline.read_text())
        candidate = json.loads(args.candidate.read_text())
        result = compare_summaries(baseline, candidate, min_delta=args.min_delta)
        markdown = comparison_markdown(result)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "comparison.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (args.output_dir / "comparison.md").write_text(markdown)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
