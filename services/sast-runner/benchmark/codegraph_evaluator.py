"""코드그래프 품질 평가 엔진 — dump_functions 출력을 ground truth와 비교."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class CodeGraphMetrics:
    """코드그래프 품질 메트릭."""

    # 함수 추출
    expected_functions: int = 0
    found_functions: int = 0
    matched_functions: int = 0
    extra_functions: list[str] = field(default_factory=list)
    missing_functions: list[str] = field(default_factory=list)

    # 호출 관계
    expected_call_edges: int = 0
    found_call_edges: int = 0
    matched_call_edges: int = 0
    extra_calls: list[tuple[str, str]] = field(default_factory=list)
    missing_calls: list[tuple[str, str]] = field(default_factory=list)

    # Origin 태깅
    origin_checks: int = 0
    origin_correct: int = 0
    origin_errors: list[dict[str, Any]] = field(default_factory=list)

    # 파일 레벨
    total_source_files: int = 0
    parsed_files: int = 0

    @property
    def function_recall(self) -> float:
        return self.matched_functions / self.expected_functions if self.expected_functions > 0 else 0.0

    @property
    def function_precision(self) -> float:
        return self.matched_functions / self.found_functions if self.found_functions > 0 else 0.0

    @property
    def call_recall(self) -> float:
        return self.matched_call_edges / self.expected_call_edges if self.expected_call_edges > 0 else 0.0

    @property
    def call_precision(self) -> float:
        return self.matched_call_edges / self.found_call_edges if self.found_call_edges > 0 else 0.0

    @property
    def origin_accuracy(self) -> float:
        return self.origin_correct / self.origin_checks if self.origin_checks > 0 else 1.0

    @property
    def parse_rate(self) -> float:
        return self.parsed_files / self.total_source_files if self.total_source_files > 0 else 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "functionRecall": round(self.function_recall, 4),
            "functionPrecision": round(self.function_precision, 4),
            "callRecall": round(self.call_recall, 4),
            "callPrecision": round(self.call_precision, 4),
            "originAccuracy": round(self.origin_accuracy, 4),
            "parseRate": round(self.parse_rate, 4),
            "detail": {
                "functions": {
                    "expected": self.expected_functions,
                    "found": self.found_functions,
                    "matched": self.matched_functions,
                    "extra": self.extra_functions,
                    "missing": self.missing_functions,
                },
                "calls": {
                    "expected": self.expected_call_edges,
                    "found": self.found_call_edges,
                    "matched": self.matched_call_edges,
                    "extraCount": len(self.extra_calls),
                    "missingCount": len(self.missing_calls),
                    "missing": [(f, c) for f, c in self.missing_calls[:20]],
                },
                "origin": {
                    "checks": self.origin_checks,
                    "correct": self.origin_correct,
                    "errors": self.origin_errors,
                },
                "files": {
                    "total": self.total_source_files,
                    "parsed": self.parsed_files,
                },
            },
        }

    def to_markdown(self) -> str:
        lines = [
            "# Code Graph Quality Report",
            "",
            "| Metric | Value | Threshold |",
            "|--------|------:|----------:|",
            f"| Function Recall | {self.function_recall:.1%} | 90% |",
            f"| Function Precision | {self.function_precision:.1%} | 90% |",
            f"| Call Recall | {self.call_recall:.1%} | 80% |",
            f"| Call Precision | {self.call_precision:.1%} | 85% |",
            f"| Origin Accuracy | {self.origin_accuracy:.1%} | 100% |",
            f"| Parse Rate | {self.parse_rate:.1%} | 100% |",
            "",
            f"Functions: {self.matched_functions}/{self.expected_functions} matched, "
            f"{len(self.extra_functions)} extra, {len(self.missing_functions)} missing",
            f"Calls: {self.matched_call_edges}/{self.expected_call_edges} matched, "
            f"{len(self.extra_calls)} extra, {len(self.missing_calls)} missing",
        ]
        if self.missing_functions:
            lines.append(f"\nMissing functions: {', '.join(self.missing_functions)}")
        if self.missing_calls:
            lines.append(f"\nMissing calls (first 10):")
            for func, call in self.missing_calls[:10]:
                lines.append(f"  {func} -> {call}")
        if self.origin_errors:
            lines.append(f"\nOrigin errors:")
            for err in self.origin_errors:
                lines.append(f"  {err['function']}: expected={err['expected']}, got={err['actual']}")
        return "\n".join(lines)

    def check_thresholds(self, thresholds: dict[str, float]) -> list[str]:
        """임계값 검사. 실패한 항목의 메시지 리스트 반환."""
        failures = []
        checks = [
            ("function_recall", self.function_recall),
            ("function_precision", self.function_precision),
            ("call_recall", self.call_recall),
            ("call_precision", self.call_precision),
            ("origin_accuracy", self.origin_accuracy),
            ("parse_rate", self.parse_rate),
        ]
        for name, value in checks:
            threshold = thresholds.get(name)
            if threshold is not None and value < threshold:
                failures.append(
                    f"{name}: {value:.2%} < {threshold:.2%}"
                )
        return failures


def evaluate_codegraph(
    actual: dict[str, Any],
    expected: dict[str, Any],
    source_files: list[str],
) -> CodeGraphMetrics:
    """dump_functions() 출력을 ground truth와 비교하여 품질 메트릭을 산출.

    Args:
        actual: dump_functions() 반환값 {"functions": [...]}
        expected: expected_codegraph.json의 전체 내용
        source_files: dump_functions에 전달된 소스 파일 목록
    """
    metrics = CodeGraphMetrics()

    # 파일 레벨 메트릭
    c_files = [f for f in source_files if f.endswith((".c", ".cpp", ".cc", ".cxx"))]
    metrics.total_source_files = len(c_files)

    actual_funcs = actual.get("functions", [])
    expected_funcs = expected.get("functions", [])

    # 파싱된 파일 수 = 함수가 1개 이상 추출된 파일 수
    parsed_files = {f["file"] for f in actual_funcs}
    metrics.parsed_files = len(parsed_files)

    # 함수 매칭: (name, file)로 식별
    expected_keys = {(f["name"], f["file"]) for f in expected_funcs}
    actual_keys = {(f["name"], f["file"]) for f in actual_funcs}

    matched = expected_keys & actual_keys
    metrics.expected_functions = len(expected_keys)
    metrics.found_functions = len(actual_keys)
    metrics.matched_functions = len(matched)
    metrics.extra_functions = [f"{n} ({f})" for n, f in sorted(actual_keys - expected_keys)]
    metrics.missing_functions = [f"{n} ({f})" for n, f in sorted(expected_keys - actual_keys)]

    # 호출 관계 매칭
    expected_call_map = {
        (f["name"], f["file"]): set(f.get("calls", []))
        for f in expected_funcs
    }
    actual_call_map = {
        (f["name"], f["file"]): set(f.get("calls", []))
        for f in actual_funcs
    }

    for key, exp_calls in expected_call_map.items():
        act_calls = actual_call_map.get(key, set())
        metrics.expected_call_edges += len(exp_calls)
        matched_calls = exp_calls & act_calls
        metrics.matched_call_edges += len(matched_calls)
        for c in sorted(exp_calls - act_calls):
            metrics.missing_calls.append((key[0], c))

    for key, act_calls in actual_call_map.items():
        exp_calls = expected_call_map.get(key, set())
        metrics.found_call_edges += len(act_calls)
        for c in sorted(act_calls - exp_calls):
            metrics.extra_calls.append((key[0], c))

    return metrics


def evaluate_origin(
    actual: dict[str, Any],
    origin_test: dict[str, Any],
) -> tuple[int, int, list[dict[str, Any]]]:
    """origin 태깅 정확도를 평가.

    Args:
        actual: dump_functions() 반환값 (libraries 적용 후)
        origin_test: expected_codegraph.json의 origin_tests[] 항목

    Returns:
        (checks, correct, errors)
    """
    actual_by_name = {f["name"]: f for f in actual.get("functions", [])}
    checks = 0
    correct = 0
    errors: list[dict[str, Any]] = []

    for exp in origin_test["expected"]:
        checks += 1
        func = actual_by_name.get(exp["name"])
        if not func:
            errors.append({
                "function": exp["name"],
                "expected": exp["origin"],
                "actual": "NOT_FOUND",
            })
            continue
        actual_origin = func.get("origin")
        actual_lib = func.get("originalLib")
        if actual_origin == exp["origin"] and actual_lib == exp["originalLib"]:
            correct += 1
        else:
            errors.append({
                "function": exp["name"],
                "expected": f"{exp['origin']} ({exp['originalLib']})",
                "actual": f"{actual_origin} ({actual_lib})",
            })

    return checks, correct, errors


def load_ground_truth(path: Path) -> dict[str, Any]:
    """ground truth JSON 파일을 로드."""
    return json.loads(path.read_text(encoding="utf-8"))
