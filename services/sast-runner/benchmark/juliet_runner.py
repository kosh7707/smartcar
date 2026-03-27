"""Juliet 벤치마크 러너 — 6도구 CWE별 Recall/Precision/F1 측정."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# 프로젝트 루트를 path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.scanner.orchestrator import ScanOrchestrator
from app.schemas.request import BuildProfile
from app.schemas.response import SastFinding
from benchmark.cwe_matcher import classify_findings, extract_cwes, matches_cwe
from benchmark.juliet_manifest import (
    JulietCWESuite,
    JulietTestCase,
    discover_cwe_suites,
    get_testcasesupport_path,
)
from benchmark.metrics import BenchmarkResult, CWEMetrics, RuleMetrics, ToolMetrics

logger = logging.getLogger("benchmark")

# 자동차 임베디드 우선 CWE
PRIORITY_CWES = [78, 121, 122, 190, 416, 476]

ALL_TOOLS = ["semgrep", "cppcheck", "flawfinder", "clang-tidy", "scan-build", "gcc-fanalyzer"]


async def run_benchmark(
    juliet_root: Path,
    target_cwes: list[int] | None = None,
    variant_filter: str | None = "01",
    timeout: int = 300,
    custom_rules: bool = True,
    tools: list[str] | None = None,
) -> BenchmarkResult:
    """Juliet 벤치마크를 실행하고 결과를 반환.

    Args:
        juliet_root: Juliet C/ 디렉토리 경로
        target_cwes: 대상 CWE 번호. None이면 PRIORITY_CWES 사용
        variant_filter: "01"이면 _01.c만. None이면 전부
        timeout: 도구 타임아웃 (초)
        custom_rules: False이면 커스텀 Semgrep 룰 비활성화 (delta 측정용)
        tools: 실행할 도구 목록. None이면 전부
    """
    # 커스텀 룰 비활성화 (delta 측정용)
    from app.config import settings
    _orig_rules_dir = settings.custom_rules_dir
    if not custom_rules:
        settings.custom_rules_dir = None
        logger.info("Custom Semgrep rules DISABLED for this benchmark run")
    if target_cwes is None:
        target_cwes = PRIORITY_CWES

    suites = discover_cwe_suites(juliet_root, target_cwes, variant_filter)
    if not suites:
        logger.error("No test suites found in %s for CWEs %s", juliet_root, target_cwes)
        return BenchmarkResult()

    support_path = get_testcasesupport_path(juliet_root)

    logger.info(
        "Benchmark started: %d CWEs, %d total files, variant=%s, tools=%s",
        len(suites),
        sum(s.count for s in suites),
        variant_filter or "all",
        ",".join(tools) if tools else "all",
    )

    orchestrator = ScanOrchestrator()
    result = BenchmarkResult()

    for suite in suites:
        cwe_key = f"CWE-{suite.cwe_num}"
        logger.info("--- %s (%s): %d files ---", cwe_key, suite.cwe_name, suite.count)

        cwe_metrics = await _benchmark_cwe(
            orchestrator, suite, support_path, cwe_key, timeout, tools,
        )
        result.cwe_results[cwe_key] = cwe_metrics

        logger.info(
            "%s: recall=%.1f%% (%d/%d, noise/file=%.1f)",
            cwe_key,
            cwe_metrics.combined_recall * 100,
            cwe_metrics.combined_tp,
            cwe_metrics.total_files,
            cwe_metrics.noise_per_file,
        )

    logger.info(
        "=== Overall — Recall: %.1f%%  Noise/File: %.1f ===",
        result.overall_recall * 100,
        result.overall_noise_per_file,
    )

    # 커스텀 룰 복원
    if not custom_rules:
        settings.custom_rules_dir = _orig_rules_dir

    return result


async def _benchmark_cwe(
    orchestrator: ScanOrchestrator,
    suite: JulietCWESuite,
    support_path: Path | None,
    cwe_key: str,
    timeout: int,
    tools: list[str] | None = None,
) -> CWEMetrics:
    """하나의 CWE 스위트를 벤치마크.

    최적화: CWE 디렉토리를 1회만 스캔하고 파일별로 findings를 분류.
    """
    metrics = CWEMetrics(
        cwe=cwe_key,
        cwe_name=suite.cwe_name,
        total_files=suite.count,
    )

    # 전체 소스 파일 목록
    all_source_files = [tc.relative_path for tc in suite.test_cases]

    # Juliet testcasesupport/ 헤더 경로를 BuildProfile로 전달
    # 이것 없으면 clang-tidy, scan-build, gcc-fanalyzer가 컴파일 실패 → 0건
    profile = None
    if support_path:
        profile = BuildProfile(
            sdkId="juliet-bench",
            compiler="gcc",
            targetArch="x86_64",
            languageStandard="c11",
            headerLanguage="c",
            includePaths=[str(support_path)],
        )

    try:
        findings, execution = await orchestrator.run(
            scan_dir=suite.directory,
            source_files=all_source_files,
            profile=profile,
            rulesets=["p/c", "p/security-audit"],
            tools=tools,
            timeout=timeout,
        )
    except Exception as e:
        logger.error("Scan failed for %s: %s", cwe_key, e)
        metrics.combined_fn = suite.count
        return metrics

    logger.info(
        "%s: scan complete — %d findings from %d tools",
        cwe_key, len(findings), len(execution.tools_run),
    )

    # 파일별 findings 인덱스 구축
    findings_by_file: dict[str, list[SastFinding]] = {}
    for f in findings:
        loc_file = f.location.file
        findings_by_file.setdefault(loc_file, []).append(f)

    # 파일별 TP/FN 판정 + FP(noise) 추적
    for tc in suite.test_cases:
        # finding의 location.file은 상대 경로 — tc.relative_path와 매칭
        file_findings = findings_by_file.get(tc.relative_path, [])

        # 매칭: 이 파일의 findings 중 target CWE와 매칭되는 게 있는지
        classification = classify_findings(file_findings, cwe_key)
        matched = classification["matched"]
        unmatched = classification["unmatched"]
        is_detected = len(matched) > 0

        if is_detected:
            metrics.combined_tp += 1
            metrics.detected_files.append(tc.file_path.name)
        else:
            metrics.combined_fn += 1
            metrics.missed_files.append(tc.file_path.name)

        # Noise: target CWE와 매칭되지 않는 findings 수 (finding 단위)
        metrics.combined_noise += len(unmatched)

        # 도구별 TP/FN/Noise
        tools_run = execution.tools_run
        for tool in tools_run:
            if tool not in metrics.by_tool:
                metrics.by_tool[tool] = ToolMetrics(tool_name=tool)

            tool_findings = [f for f in file_findings if f.tool_id == tool]
            tool_matched = [f for f in tool_findings if matches_cwe(f, cwe_key)]
            tool_unmatched = [f for f in tool_findings if not matches_cwe(f, cwe_key)]

            if tool_matched:
                metrics.by_tool[tool].tp += 1
            else:
                metrics.by_tool[tool].fn += 1
            metrics.by_tool[tool].noise_findings += len(tool_unmatched)

        # Per-rule 메트릭
        for f in matched:
            rid = f.rule_id or f"{f.tool_id}:unknown"
            if rid not in metrics.by_rule:
                metrics.by_rule[rid] = RuleMetrics(rule_id=rid, tool=f.tool_id)
            metrics.by_rule[rid].tp += 1
        for f in unmatched:
            rid = f.rule_id or f"{f.tool_id}:unknown"
            if rid not in metrics.by_rule:
                metrics.by_rule[rid] = RuleMetrics(rule_id=rid, tool=f.tool_id)
            metrics.by_rule[rid].noise += 1

    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description="Juliet Benchmark Runner")
    parser.add_argument(
        "--juliet-path", type=Path, required=True,
        help="Juliet C/ 디렉토리 경로",
    )
    parser.add_argument(
        "--cwes", type=str, default=None,
        help="대상 CWE 번호 (쉼표 구분, 예: 78,121,476). 기본: priority subset",
    )
    parser.add_argument(
        "--variant-filter", type=str, default="01",
        help="variant 필터 (예: 01). 'all'이면 전부",
    )
    parser.add_argument(
        "--output", type=Path, default=None,
        help="결과 JSON 출력 경로",
    )
    parser.add_argument(
        "--timeout", type=int, default=300,
        help="도구 타임아웃 (초, 기본: 300)",
    )
    parser.add_argument(
        "--no-custom-rules", action="store_true",
        help="커스텀 Semgrep 룰 비활성화 (delta 측정용)",
    )
    parser.add_argument(
        "--tools", type=str, default=None,
        help="실행할 도구 (쉼표 구분, 예: flawfinder,cppcheck). 기본: 전부",
    )
    parser.add_argument(
        "--baseline", type=Path, default=None,
        help="비교 baseline JSON 파일. 지정하면 실행 후 회귀 감지",
    )
    parser.add_argument(
        "--show-rules", action="store_true",
        help="마크다운에 per-rule 메트릭 포함",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    target_cwes = None
    if args.cwes:
        target_cwes = [int(c.strip()) for c in args.cwes.split(",")]

    variant = args.variant_filter if args.variant_filter != "all" else None
    tools = [t.strip() for t in args.tools.split(",")] if args.tools else None

    result = asyncio.run(run_benchmark(
        juliet_root=args.juliet_path,
        target_cwes=target_cwes,
        variant_filter=variant,
        timeout=args.timeout,
        custom_rules=not args.no_custom_rules,
        tools=tools,
    ))

    # JSON 출력
    output_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "julietPath": str(args.juliet_path),
        "variantFilter": args.variant_filter,
        "targetCWEs": [f"CWE-{c}" for c in (target_cwes or PRIORITY_CWES)],
        "tools": tools,
        **result.to_dict(),
    }

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output_data, indent=2, ensure_ascii=False))
        logger.info("Results saved to %s", args.output)

    # Markdown 출력
    print()
    print(result.to_markdown(show_rules=args.show_rules))

    # JSON도 stdout에 (output 없을 때)
    if not args.output:
        print()
        print(json.dumps(output_data, indent=2, ensure_ascii=False))

    # 회귀 감지
    if args.baseline:
        from benchmark.compare import compare_from_files
        compare_from_files(args.baseline, args.output or output_data)


if __name__ == "__main__":
    main()
