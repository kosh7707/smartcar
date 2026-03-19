"""벤치마크 메트릭 산출 — Recall, 도구별 기여도."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolMetrics:
    """단일 도구의 CWE별 메트릭."""
    tool_name: str
    tp: int = 0
    fn: int = 0

    @property
    def recall(self) -> float:
        total = self.tp + self.fn
        return self.tp / total if total > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "tool": self.tool_name,
            "tp": self.tp,
            "fn": self.fn,
            "recall": round(self.recall, 4),
        }


@dataclass
class CWEMetrics:
    """하나의 CWE에 대한 전체 메트릭."""
    cwe: str
    cwe_name: str
    total_files: int = 0
    combined_tp: int = 0
    combined_fn: int = 0
    by_tool: dict[str, ToolMetrics] = field(default_factory=dict)
    detected_files: list[str] = field(default_factory=list)
    missed_files: list[str] = field(default_factory=list)

    @property
    def combined_recall(self) -> float:
        total = self.combined_tp + self.combined_fn
        return self.combined_tp / total if total > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "cwe": self.cwe,
            "cweName": self.cwe_name,
            "totalFiles": self.total_files,
            "combined": {
                "tp": self.combined_tp,
                "fn": self.combined_fn,
                "recall": round(self.combined_recall, 4),
            },
            "byTool": {
                name: tm.to_dict() for name, tm in self.by_tool.items()
            },
            "detectedFiles": self.detected_files[:20],
            "missedFiles": self.missed_files[:20],
        }


@dataclass
class BenchmarkResult:
    """전체 벤치마크 결과."""
    cwe_results: dict[str, CWEMetrics] = field(default_factory=dict)

    @property
    def overall_recall(self) -> float:
        total_tp = sum(m.combined_tp for m in self.cwe_results.values())
        total_fn = sum(m.combined_fn for m in self.cwe_results.values())
        total = total_tp + total_fn
        return total_tp / total if total > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "results": {
                cwe: m.to_dict() for cwe, m in self.cwe_results.items()
            },
            "summary": {
                "overallRecall": round(self.overall_recall, 4),
                "totalTP": sum(m.combined_tp for m in self.cwe_results.values()),
                "totalFN": sum(m.combined_fn for m in self.cwe_results.values()),
                "cweCount": len(self.cwe_results),
            },
        }

    def to_markdown(self) -> str:
        lines = ["# SAST Runner Benchmark Results", ""]
        lines.append(f"**Overall Recall: {self.overall_recall:.1%}**")
        lines.append("")

        # CWE별 테이블
        tools = set()
        for m in self.cwe_results.values():
            tools.update(m.by_tool.keys())
        tools_sorted = sorted(tools)

        header = "| CWE | " + " | ".join(tools_sorted) + " | Combined |"
        sep = "|-----|" + "|".join(["------"] * len(tools_sorted)) + "|----------|"
        lines.extend([header, sep])

        for cwe, m in sorted(self.cwe_results.items()):
            cells = []
            for t in tools_sorted:
                tm = m.by_tool.get(t)
                cells.append(f"{tm.recall:.0%}" if tm else "—")
            cells.append(f"**{m.combined_recall:.0%}**")
            lines.append(f"| {cwe} | " + " | ".join(cells) + " |")

        lines.append("")
        lines.append(f"Total files: {sum(m.total_files for m in self.cwe_results.values())}")
        return "\n".join(lines)
