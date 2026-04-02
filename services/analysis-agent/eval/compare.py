"""compare.py — 두 평가 실행 결과를 비교하여 회귀를 감지한다.

Usage:
    python -m eval.compare eval/results/baseline.json eval/results/candidate.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_METRIC_KEYS = [
    "recall", "precision", "fp_rejection", "severity_accuracy",
    "evidence_validity", "cwe_coverage",
]


def compare_runs(
    baseline_path: str,
    candidate_path: str,
    regression_threshold: float = 0.05,
) -> dict:
    """두 평가 결과를 비교한다."""
    baseline = json.loads(Path(baseline_path).read_text())
    candidate = json.loads(Path(candidate_path).read_text())

    b_results = {r["golden_id"]: r for r in baseline["results"]}
    c_results = {r["golden_id"]: r for r in candidate["results"]}

    common_ids = sorted(set(b_results) & set(c_results))
    regressions = []
    improvements = []
    per_case = []

    for gid in common_ids:
        b_eval = b_results[gid]["eval_result"]
        c_eval = c_results[gid]["eval_result"]

        b_comp = b_eval.get("composite_score", 0)
        c_comp = c_eval.get("composite_score", 0)
        delta = round(c_comp - b_comp, 4)

        b_metrics = b_eval.get("metrics", {})
        c_metrics = c_eval.get("metrics", {})

        metric_deltas = {}
        flags = []
        for key in _METRIC_KEYS:
            bv = b_metrics.get(key, 0)
            cv = c_metrics.get(key, 0)
            if isinstance(bv, dict) or isinstance(cv, dict):
                continue  # detail_heuristics 등 dict은 스킵
            md = round(cv - bv, 4)
            metric_deltas[key] = md
            if md < -regression_threshold:
                flags.append(f"REGRESSED:{key}")
                regressions.append({"case": gid, "metric": key, "delta": md})
            elif md > regression_threshold:
                improvements.append({"case": gid, "metric": key, "delta": md})

        per_case.append({
            "golden_id": gid,
            "baseline_composite": b_comp,
            "candidate_composite": c_comp,
            "delta": delta,
            "metric_deltas": metric_deltas,
            "flags": flags,
        })

    # 전체 composite delta
    b_mean = baseline.get("summary", {}).get("mean_composite", 0)
    c_mean = candidate.get("summary", {}).get("mean_composite", 0)

    verdict = "REGRESSED" if regressions else "PASS"

    return {
        "baseline_run_id": baseline.get("run_id", "?"),
        "candidate_run_id": candidate.get("run_id", "?"),
        "summary": {
            "composite_delta": round(c_mean - b_mean, 4),
            "baseline_mean": b_mean,
            "candidate_mean": c_mean,
            "regressions": regressions,
            "improvements": improvements,
            "verdict": verdict,
        },
        "per_case": per_case,
    }


def _print_report(report: dict) -> None:
    """터미널에 사람이 읽기 쉬운 비교 보고서를 출력한다."""
    s = report["summary"]
    print(f"\n=== Evaluation Comparison ===")
    print(f"  Baseline:  {report['baseline_run_id']} (mean: {s['baseline_mean']:.2f})")
    print(f"  Candidate: {report['candidate_run_id']} (mean: {s['candidate_mean']:.2f})")
    print(f"  Delta:     {s['composite_delta']:+.4f}")
    print(f"  Verdict:   {s['verdict']}")

    if s["regressions"]:
        print(f"\n  REGRESSIONS ({len(s['regressions'])}):")
        for r in s["regressions"]:
            print(f"    - {r['case']}.{r['metric']}: {r['delta']:+.2f}")

    if s["improvements"]:
        print(f"\n  Improvements ({len(s['improvements'])}):")
        for imp in s["improvements"]:
            print(f"    + {imp['case']}.{imp['metric']}: {imp['delta']:+.2f}")

    print(f"\n  Per-case:")
    print(f"  {'Case':<35} {'Base':>6} {'Cand':>6} {'Delta':>7} {'Flags'}")
    print(f"  {'-'*35} {'-'*6} {'-'*6} {'-'*7} {'-'*20}")
    for pc in report["per_case"]:
        flags_str = ", ".join(pc["flags"]) if pc["flags"] else "-"
        print(
            f"  {pc['golden_id']:<35} "
            f"{pc['baseline_composite']:>6.2f} "
            f"{pc['candidate_composite']:>6.2f} "
            f"{pc['delta']:>+7.4f} "
            f"{flags_str}"
        )
    print()


def main():
    parser = argparse.ArgumentParser(description="AEGIS Eval Run Comparison")
    parser.add_argument("baseline", help="Baseline eval results JSON path")
    parser.add_argument("candidate", help="Candidate eval results JSON path")
    parser.add_argument("--threshold", type=float, default=0.05,
                        help="Regression threshold (default: 0.05)")
    parser.add_argument("--output", default="", help="Save report to JSON file")
    args = parser.parse_args()

    report = compare_runs(args.baseline, args.candidate, args.threshold)
    _print_report(report)

    if args.output:
        Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"  Report saved: {args.output}")

    sys.exit(1 if report["summary"]["verdict"] == "REGRESSED" else 0)


if __name__ == "__main__":
    main()
