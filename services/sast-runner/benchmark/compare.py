"""벤치마크 회귀 감지 — 두 결과를 비교하여 Recall/Precision 변화를 분석."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger("benchmark")


@dataclass
class CWEDelta:
    """하나의 CWE에 대한 변화."""
    cwe: str
    baseline_recall: float
    current_recall: float
    recall_delta: float
    baseline_noise_per_file: float = 0.0
    current_noise_per_file: float = 0.0
    baseline_targeted_noise_pf: float = 0.0
    current_targeted_noise_pf: float = 0.0

    @property
    def is_regression(self) -> bool:
        return self.recall_delta < -0.001  # 0.1% 이상 하락

    @property
    def is_improvement(self) -> bool:
        return self.recall_delta > 0.001


@dataclass
class ComparisonReport:
    """비교 결과 보고서."""
    baseline_path: str
    current_path: str
    overall_recall_delta: float = 0.0
    cwe_deltas: list[CWEDelta] = field(default_factory=list)

    @property
    def regressions(self) -> list[CWEDelta]:
        return [d for d in self.cwe_deltas if d.is_regression]

    @property
    def improvements(self) -> list[CWEDelta]:
        return [d for d in self.cwe_deltas if d.is_improvement]

    def has_regression(self, threshold: float = 0.05) -> bool:
        """recall이 threshold 이상 하락한 CWE가 있으면 True."""
        return any(d.recall_delta <= -threshold for d in self.cwe_deltas)

    def to_markdown(self) -> str:
        lines = ["# Benchmark Comparison", ""]
        lines.append(f"Baseline: `{self.baseline_path}`")
        lines.append(f"Current:  `{self.current_path}`")
        lines.append("")

        lines.append(
            f"**Overall Recall: {self.overall_recall_delta:+.1%}**"
        )
        lines.append("")

        if self.regressions:
            lines.append("## Regressions")
            lines.append("| CWE | Recall | Delta |")
            lines.append("|-----|--------|-------|")
            for d in sorted(self.regressions, key=lambda x: x.recall_delta):
                lines.append(
                    f"| {d.cwe} | {d.baseline_recall:.1%} → {d.current_recall:.1%} "
                    f"| **{d.recall_delta:+.1%}** |"
                )
            lines.append("")

        if self.improvements:
            lines.append("## Improvements")
            lines.append("| CWE | Recall | Delta |")
            lines.append("|-----|--------|-------|")
            for d in sorted(self.improvements, key=lambda x: -x.recall_delta):
                lines.append(
                    f"| {d.cwe} | {d.baseline_recall:.1%} → {d.current_recall:.1%} "
                    f"| {d.recall_delta:+.1%} |"
                )
            lines.append("")

        if not self.regressions and not self.improvements:
            lines.append("No significant changes detected.")

        return "\n".join(lines)


def _load_result(path_or_data: Path | dict | str) -> dict:
    """JSON 파일 또는 dict를 로드."""
    if isinstance(path_or_data, dict):
        return path_or_data
    path = Path(path_or_data)
    return json.loads(path.read_text())


def _get_cwe_metrics(data: dict, cwe: str) -> dict:
    """결과 JSON에서 CWE별 combined 메트릭을 추출."""
    results = data.get("results", {})
    cwe_data = results.get(cwe, {})
    combined = cwe_data.get("combined", {})
    return combined


def compare(
    baseline_data: dict,
    current_data: dict,
    baseline_label: str = "baseline",
    current_label: str = "current",
) -> ComparisonReport:
    """두 벤치마크 결과를 비교."""
    report = ComparisonReport(
        baseline_path=baseline_label,
        current_path=current_label,
    )

    b_summary = baseline_data.get("summary", {})
    c_summary = current_data.get("summary", {})
    report.overall_recall_delta = (
        c_summary.get("overallRecall", 0) - b_summary.get("overallRecall", 0)
    )

    # 모든 CWE를 합집합으로
    all_cwes = set(baseline_data.get("results", {}).keys()) | set(current_data.get("results", {}).keys())

    for cwe in sorted(all_cwes):
        b_combined = _get_cwe_metrics(baseline_data, cwe)
        c_combined = _get_cwe_metrics(current_data, cwe)

        b_recall = b_combined.get("recall", 0.0)
        c_recall = c_combined.get("recall", 0.0)
        b_noise = b_combined.get("noisePerFile", 0.0)
        c_noise = c_combined.get("noisePerFile", 0.0)
        b_targeted = b_combined.get("targetedNoisePerFile", b_noise)
        c_targeted = c_combined.get("targetedNoisePerFile", c_noise)

        report.cwe_deltas.append(CWEDelta(
            cwe=cwe,
            baseline_recall=b_recall,
            current_recall=c_recall,
            recall_delta=c_recall - b_recall,
            baseline_noise_per_file=b_noise,
            current_noise_per_file=c_noise,
            baseline_targeted_noise_pf=b_targeted,
            current_targeted_noise_pf=c_targeted,
        ))

    return report


def compare_from_files(
    baseline_path: Path,
    current_path_or_data: Path | dict,
) -> ComparisonReport:
    """파일에서 로드하여 비교하고 결과를 출력."""
    baseline = _load_result(baseline_path)
    current = _load_result(current_path_or_data)

    bl = str(baseline_path)
    cl = str(current_path_or_data) if isinstance(current_path_or_data, Path) else "(current run)"

    report = compare(baseline, current, bl, cl)

    print()
    print(report.to_markdown())

    if report.has_regression():
        logger.warning("REGRESSION DETECTED — recall dropped >5%% on some CWEs")

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Comparison Tool")
    parser.add_argument(
        "--baseline", type=Path, required=True,
        help="Baseline JSON 파일",
    )
    parser.add_argument(
        "--current", type=Path, required=True,
        help="현재 결과 JSON 파일",
    )
    parser.add_argument(
        "--threshold", type=float, default=0.05,
        help="회귀 판정 임계값 (기본: 0.05 = 5%%)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    baseline = _load_result(args.baseline)
    current = _load_result(args.current)

    report = compare(baseline, current, str(args.baseline), str(args.current))

    print(report.to_markdown())

    if report.has_regression(args.threshold):
        logger.warning("REGRESSION DETECTED (threshold=%.1f%%)", args.threshold * 100)
        sys.exit(1)
    else:
        logger.info("No regression detected (threshold=%.1f%%)", args.threshold * 100)


if __name__ == "__main__":
    main()
