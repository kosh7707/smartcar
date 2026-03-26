"""멀티 도구 오케스트레이터 — 6개 SAST 도구를 병렬 실행하고 결과를 합산."""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any

from app.scanner.clangtidy_runner import ClangTidyRunner
from app.scanner.cppcheck_runner import CppcheckRunner
from app.scanner.flawfinder_runner import FlawfinderRunner
from app.scanner.gcc_analyzer_runner import GccAnalyzerRunner
from app.scanner.ruleset_selector import detect_language_family
from app.scanner.sarif_parser import parse_sarif
from app.scanner.scanbuild_runner import ScanbuildRunner
from app.scanner.sdk_resolver import get_sdk_compiler, resolve_sdk_paths
from app.scanner.semgrep_runner import SemgrepRunner
from app.schemas.request import BuildProfile
from app.schemas.response import (
    ExecutionReport,
    FindingsFilterInfo,
    SastFinding,
    SdkResolutionInfo,
    ToolExecutionResult,
)

logger = logging.getLogger("aegis-sast-runner")

ALL_TOOLS = ["semgrep", "cppcheck", "flawfinder", "clang-tidy", "scan-build", "gcc-fanalyzer"]

# 최소 권장 버전 — 미만 시 경고 (차단하지 않음)
MIN_VERSIONS: dict[str, tuple[int, ...]] = {
    "semgrep": (1, 40),
    "cppcheck": (2, 13),
    "flawfinder": (2, 0, 19),
    "clang-tidy": (16,),
    "scan-build": (16,),
    "gcc-fanalyzer": (13,),
}


def _parse_version(ver_str: str | None) -> tuple[int, ...] | None:
    """버전 문자열에서 숫자 튜플 추출. '2.13.0' → (2, 13, 0)."""
    if not ver_str:
        return None
    parts = []
    for p in ver_str.split("."):
        digits = "".join(c for c in p if c.isdigit())
        if digits:
            parts.append(int(digits))
    return tuple(parts) if parts else None


class ScanOrchestrator:
    """6개 SAST 도구를 병렬로 실행하고 결과를 합산한다."""

    def __init__(self) -> None:
        self.semgrep = SemgrepRunner()
        self.cppcheck = CppcheckRunner()
        self.flawfinder = FlawfinderRunner()
        self.clangtidy = ClangTidyRunner()
        self.scanbuild = ScanbuildRunner()
        self.gcc_analyzer = GccAnalyzerRunner()

    async def check_tools(self) -> dict[str, dict]:
        """모든 도구의 가용 여부를 확인."""
        results = await asyncio.gather(
            self.semgrep.check_available(),
            self.cppcheck.check_available(),
            self.flawfinder.check_available(),
            self.clangtidy.check_available(),
            self.scanbuild.check_available(),
            self.gcc_analyzer.check_available(),
        )

        names = ["semgrep", "cppcheck", "flawfinder", "clang-tidy", "scan-build", "gcc-fanalyzer"]
        tool_info = {
            name: {"available": avail, "version": ver}
            for name, (avail, ver) in zip(names, results)
        }

        # 최소 버전 경고
        for name, info in tool_info.items():
            if not info["available"]:
                continue
            min_ver = MIN_VERSIONS.get(name)
            if not min_ver:
                continue
            parsed = _parse_version(info["version"])
            if parsed and parsed < min_ver:
                min_str = ".".join(str(v) for v in min_ver)
                logger.warning(
                    "Tool %s version %s is below minimum recommended %s",
                    name, info["version"], min_str,
                )

        return tool_info

    async def run(
        self,
        scan_dir: Path,
        source_files: list[str],
        profile: BuildProfile | None,
        rulesets: list[str],
        compile_commands: str | None = None,
        tools: list[str] | None = None,
        timeout: int = 120,
        third_party_paths: list[str] | None = None,
    ) -> tuple[list[SastFinding], ExecutionReport]:
        """도구들을 병렬 실행하고 합산된 findings + 실행 보고서를 반환.

        Returns:
            (findings, execution_report)
        """
        # 1. 도구 자동 선택
        available_tools = await self.check_tools()
        active_tools = self._select_tools(
            tools, profile, available_tools,
        )

        # 2. SDK 경로 해석
        enriched_profile = self._enrich_profile_with_sdk(profile)
        sdk_info = self._build_sdk_info(profile, enriched_profile)

        # 3. 도구별 태스크 생성
        # - clang-tidy, scan-build: enriched (SDK 헤더 필요 — 컴파일 기반 분석)
        # - cppcheck: original (SDK 헤더 -I 시 전부 파싱하여 타임아웃)
        # - gcc-fanalyzer: original (호스트 gcc 폴백 시 ARM 헤더 불필요)
        # - semgrep, flawfinder: profile 불필요 (텍스트/패턴 기반)
        task_map = {}
        if "semgrep" in active_tools:
            task_map["semgrep"] = self._run_semgrep(scan_dir, rulesets, timeout)
        if "cppcheck" in active_tools:
            task_map["cppcheck"] = self._run_cppcheck(scan_dir, profile, timeout, compile_commands)
        if "flawfinder" in active_tools:
            task_map["flawfinder"] = self._run_flawfinder(scan_dir, timeout)
        if "clang-tidy" in active_tools:
            task_map["clang-tidy"] = self._run_clangtidy(
                scan_dir, source_files, enriched_profile, timeout, compile_commands,
            )
        if "scan-build" in active_tools:
            task_map["scan-build"] = self._run_scanbuild(
                scan_dir, source_files, enriched_profile, timeout,
            )
        if "gcc-fanalyzer" in active_tools:
            task_map["gcc-fanalyzer"] = self._run_gcc_analyzer(
                scan_dir, source_files, profile, enriched_profile, timeout,
            )

        # 4. 병렬 실행 + 시간 측정
        t0 = time.perf_counter()
        results = await asyncio.gather(
            *task_map.values(), return_exceptions=True,
        )

        # 5. 결과 수집
        all_findings: list[SastFinding] = []
        tool_results: dict[str, ToolExecutionResult] = {}

        # 도구 버전 정보 취득
        tool_versions = {
            name: info.get("version")
            for name, info in available_tools.items()
        }

        for tool_name, result in zip(task_map.keys(), results):
            elapsed = int((time.perf_counter() - t0) * 1000)
            if isinstance(result, Exception):
                logger.warning("Tool %s failed: %s", tool_name, str(result))
                tool_results[tool_name] = ToolExecutionResult(
                    status="failed", findings_count=0, elapsed_ms=elapsed,
                    skip_reason=str(result), version=tool_versions.get(tool_name),
                )
            else:
                all_findings.extend(result)
                tool_results[tool_name] = ToolExecutionResult(
                    status="ok", findings_count=len(result), elapsed_ms=elapsed,
                    version=tool_versions.get(tool_name),
                )
                logger.info("Tool %s completed: %d findings", tool_name, len(result))

        # 스킵된 도구 기록
        for tool_name, reason in active_tools.get("_skipped", {}).items():
            tool_results[tool_name] = ToolExecutionResult(
                status="skipped", findings_count=0, elapsed_ms=0,
                skip_reason=reason, version=tool_versions.get(tool_name),
            )

        # 6. 사용자 코드 + 경계면 필터링
        before = len(all_findings)
        all_findings, cross_boundary = _filter_user_code_findings(
            all_findings, source_files, third_party_paths,
        )
        filtered = before - len(all_findings)
        if filtered > 0 or cross_boundary > 0:
            logger.info(
                "Findings filter: %d removed, %d cross-boundary kept (before=%d, after=%d)",
                filtered, cross_boundary, before, len(all_findings),
            )

        # 7. 실행 보고서 조립
        execution = ExecutionReport(
            tools_run=list(task_map.keys()),
            tool_results=tool_results,
            sdk=SdkResolutionInfo(**sdk_info),
            filtering=FindingsFilterInfo(
                before_filter=before,
                after_filter=len(all_findings),
                sdk_noise_removed=filtered,
                cross_boundary_kept=cross_boundary,
            ),
        )

        return all_findings, execution

    def _select_tools(
        self,
        requested: list[str] | None,
        profile: BuildProfile | None,
        available: dict[str, dict],
    ) -> dict[str, Any]:
        """BuildProfile + 가용성을 보고 실행할 도구를 결정."""
        candidates = set(requested or ALL_TOOLS)
        active: dict[str, Any] = {"_skipped": {}}

        for tool in list(candidates):
            # 가용성 체크
            if not available.get(tool, {}).get("available", False):
                active["_skipped"][tool] = f"Not installed"
                candidates.discard(tool)
                continue

            # BuildProfile 기반 자동 스킵
            if profile and tool == "semgrep":
                lang = detect_language_family(profile)
                if lang == "cpp":
                    active["_skipped"][tool] = "C++ project — Semgrep pattern rules ineffective"
                    candidates.discard(tool)
                    logger.info("Auto-skip %s: C++ project", tool)
                    continue

            if tool == "gcc-fanalyzer" and profile:
                sdk_gcc = get_sdk_compiler(profile)
                if not sdk_gcc and profile.sdk_id != "custom":
                    # SDK가 지정됐는데 크로스 컴파일러가 없으면 호스트 gcc 사용
                    pass  # 호스트 gcc로 폴백

        active.update({t: True for t in candidates})
        return active

    def _build_sdk_info(
        self,
        original: BuildProfile | None,
        enriched: BuildProfile | None,
    ) -> dict[str, Any]:
        """SDK 해석 정보를 dict로 반환 (SdkResolutionInfo 생성에 사용)."""
        if original is None:
            return {"resolved": False, "sdk_id": None, "include_paths_added": 0}

        original_paths = len(original.include_paths or [])
        enriched_paths = len(enriched.include_paths or []) if enriched else 0

        return {
            "resolved": enriched_paths > original_paths,
            "sdk_id": original.sdk_id,
            "include_paths_added": enriched_paths - original_paths,
        }

    def _enrich_profile_with_sdk(
        self, profile: BuildProfile | None,
    ) -> BuildProfile | None:
        """BuildProfile에 SDK 인클루드 경로를 병합."""
        if profile is None:
            return None

        sdk_paths = resolve_sdk_paths(profile)
        if not sdk_paths:
            return profile

        existing = profile.include_paths or []
        merged = existing + [p for p in sdk_paths if p not in existing]

        logger.info(
            "SDK '%s' resolved %d include paths (total: %d)",
            profile.sdk_id, len(sdk_paths), len(merged),
        )
        return profile.model_copy(update={"include_paths": merged})

    # --- 개별 도구 실행 ---

    async def _run_semgrep(
        self, scan_dir: Path, rulesets: list[str], timeout: int,
    ) -> list[SastFinding]:
        sarif = await self.semgrep.run(scan_dir, rulesets, timeout)
        findings, _ = parse_sarif(sarif, scan_dir)
        return findings

    async def _run_cppcheck(
        self, scan_dir: Path, profile: BuildProfile | None, timeout: int,
        compile_commands: str | None = None,
    ) -> list[SastFinding]:
        return await self.cppcheck.run(scan_dir, profile, timeout, compile_commands)

    async def _run_flawfinder(
        self, scan_dir: Path, timeout: int,
    ) -> list[SastFinding]:
        return await self.flawfinder.run(scan_dir, timeout)

    async def _run_clangtidy(
        self, scan_dir: Path, source_files: list[str],
        profile: BuildProfile | None, timeout: int,
        compile_commands: str | None = None,
    ) -> list[SastFinding]:
        return await self.clangtidy.run(
            scan_dir, source_files, profile, timeout=timeout,
            compile_commands=compile_commands,
        )

    async def _run_scanbuild(
        self, scan_dir: Path, source_files: list[str],
        profile: BuildProfile | None, timeout: int,
    ) -> list[SastFinding]:
        return await self.scanbuild.run(scan_dir, source_files, profile, timeout)

    async def _run_gcc_analyzer(
        self, scan_dir: Path, source_files: list[str],
        profile: BuildProfile | None, enriched_profile: BuildProfile | None,
        timeout: int,
    ) -> list[SastFinding]:
        return await self.gcc_analyzer.run(
            scan_dir, source_files, profile, timeout,
            enriched_profile=enriched_profile,
        )


def _is_user_path(path: str) -> bool:
    """상대 경로면 사용자 코드로 간주."""
    return not path.startswith("/")


def _is_third_party(path: str, third_party_paths: list[str]) -> bool:
    """경로가 서드파티 라이브러리 디렉토리에 속하는지 확인."""
    for tp in third_party_paths:
        if path.startswith(tp) or path.startswith(tp.rstrip("/")):
            return True
    return False


def _filter_user_code_findings(
    findings: list[SastFinding],
    source_files: list[str],
    third_party_paths: list[str] | None = None,
) -> tuple[list[SastFinding], int]:
    """사용자 코드 findings + 경계면 findings를 남긴다.

    분류 기준 (3단계):
    1. 절대 경로 (SDK/시스템 헤더) → cross-boundary 검사 후 제거/유지
    2. thirdPartyPaths에 해당 (vendored 서드파티) → cross-boundary 검사 후 제거/유지
    3. 그 외 상대 경로 → 사용자 코드 (유지)

    Returns:
        (filtered_findings, cross_boundary_count)
    """
    tp_paths = third_party_paths or []
    result: list[SastFinding] = []
    cross_boundary_count = 0

    for finding in findings:
        loc_file = finding.location.file

        # 1. 절대 경로 (SDK/시스템 헤더)
        if not _is_user_path(loc_file):
            if _check_cross_boundary(finding):
                finding = finding.model_copy(update={"origin": "cross-boundary"})
                result.append(finding)
                cross_boundary_count += 1
            continue

        # 2. vendored 서드파티 라이브러리 (상대 경로지만 thirdPartyPaths에 해당)
        if tp_paths and _is_third_party(loc_file, tp_paths):
            if _check_cross_boundary(finding, tp_paths):
                finding = finding.model_copy(update={"origin": "cross-boundary"})
                result.append(finding)
                cross_boundary_count += 1
            continue

        # 3. 사용자 코드 — 유지
        result.append(finding)

    return result, cross_boundary_count


def _check_cross_boundary(
    finding: SastFinding,
    third_party_paths: list[str] | None = None,
) -> bool:
    """finding의 dataFlow에 사용자 코드 step이 있으면 경계면으로 판정."""
    if not finding.data_flow:
        return False
    tp_paths = third_party_paths or []
    return any(
        _is_user_path(step.file) and not _is_third_party(step.file, tp_paths)
        for step in finding.data_flow
    )
