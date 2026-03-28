"""ScanOrchestrator 단위 테스트 — 도구 선택, profile enrichment, 필터링."""

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.scanner.orchestrator import ScanOrchestrator, _filter_user_code_findings, _is_third_party, _is_user_path, _parse_version
from app.schemas.request import BuildProfile
from app.schemas.response import SastDataFlowStep, SastFinding, SastFindingLocation


@pytest.fixture
def orchestrator():
    return ScanOrchestrator()


def _make_finding(
    file: str,
    tool: str = "cppcheck",
    data_flow: list[SastDataFlowStep] | None = None,
) -> SastFinding:
    return SastFinding(
        toolId=tool,
        ruleId=f"{tool}:test",
        severity="warning",
        message="test finding",
        location=SastFindingLocation(file=file, line=1),
        dataFlow=data_flow,
    )


class TestParseVersion:
    def test_standard_version(self):
        assert _parse_version("2.13.0") == (2, 13, 0)

    def test_single_number(self):
        assert _parse_version("16") == (16,)

    def test_version_with_suffix(self):
        assert _parse_version("13.3.0-ubuntu") == (13, 3, 0)

    def test_none_input(self):
        assert _parse_version(None) is None

    def test_empty_string(self):
        assert _parse_version("") is None


class TestSelectTools:
    def _available_all(self):
        return {
            "semgrep": {"available": True, "version": "1.45.0"},
            "cppcheck": {"available": True, "version": "2.13.0"},
            "flawfinder": {"available": True, "version": "2.0.19"},
            "clang-tidy": {"available": True, "version": "18.1.3"},
            "scan-build": {"available": True, "version": "18.1.3"},
            "gcc-fanalyzer": {"available": True, "version": "13.3.0"},
        }

    @pytest.mark.asyncio
    async def test_all_tools_selected_no_profile(self, orchestrator):
        available = self._available_all()
        active = await orchestrator._select_tools(None, None, available)
        # All 6 should be active (not in _skipped)
        assert all(available[t]["available"] for t in ["semgrep", "cppcheck", "flawfinder"])

    @pytest.mark.asyncio
    async def test_semgrep_not_skipped_for_cpp(self, orchestrator):
        """C++ 프로젝트에서도 Semgrep은 스킵되지 않음 (확장자 필터로 대체)."""
        available = self._available_all()
        profile = BuildProfile(
            sdkId="custom", compiler="g++",
            targetArch="x86_64", languageStandard="c++17",
            headerLanguage="cpp",
        )
        active = await orchestrator._select_tools(None, profile, available)
        assert "semgrep" not in active.get("_skipped", {})
        assert active.get("semgrep") is True

    @pytest.mark.asyncio
    async def test_semgrep_not_skipped_for_c(self, orchestrator):
        available = self._available_all()
        profile = BuildProfile(
            sdkId="custom", compiler="gcc",
            targetArch="x86_64", languageStandard="c99",
            headerLanguage="c",
        )
        active = await orchestrator._select_tools(None, profile, available)
        assert "semgrep" not in active.get("_skipped", {})

    @pytest.mark.asyncio
    async def test_unavailable_tool_skipped(self, orchestrator):
        available = self._available_all()
        available["scan-build"]["available"] = False
        active = await orchestrator._select_tools(None, None, available)
        assert "scan-build" in active.get("_skipped", {})

    @pytest.mark.asyncio
    async def test_explicit_tool_list(self, orchestrator):
        available = self._available_all()
        active = await orchestrator._select_tools(["cppcheck", "flawfinder"], None, available)
        assert "cppcheck" in active
        assert "flawfinder" in active
        assert "semgrep" not in active or "semgrep" in active.get("_skipped", {})

    @pytest.mark.asyncio
    async def test_gcc_fanalyzer_sdk_recheck(self, orchestrator):
        """호스트 gcc unavailable이지만 SDK 컴파일러로 재확인 → 활성화."""
        available = self._available_all()
        available["gcc-fanalyzer"]["available"] = False
        profile = BuildProfile(
            sdkId="ti-am335x", compiler="arm-gcc",
            targetArch="arm", languageStandard="c99",
            headerLanguage="c",
        )
        orchestrator.gcc_analyzer.check_available = AsyncMock(return_value=(True, "13.3.0"))
        active = await orchestrator._select_tools(None, profile, available)
        assert "gcc-fanalyzer" not in active.get("_skipped", {})
        assert active.get("gcc-fanalyzer") is True

    @pytest.mark.asyncio
    async def test_gcc_fanalyzer_sdk_recheck_still_fails(self, orchestrator):
        """호스트 gcc unavailable + SDK 컴파일러도 old → 여전히 스킵."""
        available = self._available_all()
        available["gcc-fanalyzer"]["available"] = False
        profile = BuildProfile(
            sdkId="ti-am335x", compiler="arm-gcc",
            targetArch="arm", languageStandard="c99",
            headerLanguage="c",
        )
        orchestrator.gcc_analyzer.check_available = AsyncMock(return_value=(False, None))
        active = await orchestrator._select_tools(None, profile, available)
        assert "gcc-fanalyzer" in active.get("_skipped", {})


class TestIsUserPath:
    def test_relative_path(self):
        assert _is_user_path("src/main.c") is True

    def test_absolute_path(self):
        assert _is_user_path("/usr/include/stdio.h") is False


class TestFilterUserCodeFindings:
    def test_keeps_relative_paths(self):
        findings = [
            _make_finding("src/main.c"),
            _make_finding("lib/util.c"),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 2
        assert stats["cross_boundary"] == 0

    def test_removes_absolute_paths(self):
        findings = [
            _make_finding("src/main.c"),
            _make_finding("/usr/include/stdio.h"),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 1
        assert result[0].location.file == "src/main.c"
        assert stats["cross_boundary"] == 0

    def test_empty_findings(self):
        result, stats = _filter_user_code_findings([], [])
        assert result == []
        assert stats["cross_boundary"] == 0

    def test_cross_boundary_kept(self):
        """SDK 경로 finding이지만 dataFlow에 사용자 코드 포함 → 유지 + origin 태깅."""
        findings = [
            _make_finding(
                "/home/kosh/sdks/ti-am335x/sysroot/usr/include/sdk_api.h",
                tool="gcc-fanalyzer",
                data_flow=[
                    SastDataFlowStep(file="src/main.c", line=10, content="buf allocated here"),
                    SastDataFlowStep(
                        file="/home/kosh/sdks/ti-am335x/sysroot/usr/include/sdk_api.h",
                        line=42, content="buffer overflow here",
                    ),
                ],
            ),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 1
        assert stats["cross_boundary"] == 1
        assert result[0].origin == "cross-boundary"

    def test_pure_sdk_finding_removed(self):
        """SDK 경로 finding + dataFlow도 전부 SDK → 제거."""
        findings = [
            _make_finding(
                "/usr/include/openssl/ssl.h",
                tool="clang-tidy",
                data_flow=[
                    SastDataFlowStep(file="/usr/include/openssl/bio.h", line=5, content="note"),
                    SastDataFlowStep(file="/usr/include/openssl/ssl.h", line=10, content="note"),
                ],
            ),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 0
        assert stats["cross_boundary"] == 0

    def test_sdk_finding_no_dataflow_removed(self):
        """SDK 경로 finding + dataFlow 없음 → 제거."""
        findings = [
            _make_finding("/usr/include/stdlib.h", tool="cppcheck"),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 0
        assert stats["cross_boundary"] == 0

    def test_mixed_findings(self):
        """사용자 + 경계면 + 순수 SDK 혼합 → 올바르게 분류."""
        findings = [
            # 사용자 코드
            _make_finding("src/main.c"),
            # 경계면 (SDK location + user dataFlow)
            _make_finding(
                "/sdk/include/api.h",
                tool="scan-build",
                data_flow=[
                    SastDataFlowStep(file="src/caller.c", line=5, content="call site"),
                    SastDataFlowStep(file="/sdk/include/api.h", line=20, content="overflow"),
                ],
            ),
            # 순수 SDK
            _make_finding("/usr/include/string.h"),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 2  # 사용자 1 + 경계면 1
        assert stats["cross_boundary"] == 1
        # 사용자 코드 finding은 origin 없음
        assert result[0].origin is None
        # 경계면 finding은 origin 태깅
        assert result[1].origin == "cross-boundary"


class TestIsThirdParty:
    def test_match(self):
        assert _is_third_party("lib/civetweb/civetweb.c", ["lib/civetweb/"]) is True

    def test_no_match(self):
        assert _is_third_party("src/main.c", ["lib/civetweb/"]) is False

    def test_match_without_trailing_slash(self):
        assert _is_third_party("lib/civetweb/civetweb.c", ["lib/civetweb"]) is True

    def test_empty_list(self):
        assert _is_third_party("lib/civetweb/civetweb.c", []) is False


class TestThirdPartyFiltering:
    """thirdPartyPaths를 사용한 vendored 서드파티 필터링."""

    def test_third_party_finding_removed(self):
        """서드파티 경로 finding → 제거."""
        findings = [
            _make_finding("lib/civetweb/civetweb.c"),
        ]
        result, stats = _filter_user_code_findings(
            findings, ["lib/civetweb/"],
        )
        assert len(result) == 0
        assert stats["cross_boundary"] == 0

    def test_user_code_kept_with_third_party(self):
        """thirdPartyPaths가 있어도 사용자 코드 finding은 유지."""
        findings = [
            _make_finding("src/main.c"),
            _make_finding("lib/civetweb/civetweb.c"),
        ]
        result, stats = _filter_user_code_findings(
            findings, ["lib/civetweb/"],
        )
        assert len(result) == 1
        assert result[0].location.file == "src/main.c"

    def test_third_party_cross_boundary_kept(self):
        """서드파티 finding이지만 dataFlow에 사용자 코드 → 경계면 유지."""
        findings = [
            _make_finding(
                "lib/civetweb/civetweb.c",
                tool="gcc-fanalyzer",
                data_flow=[
                    SastDataFlowStep(file="src/main.c", line=10, content="user calls api"),
                    SastDataFlowStep(file="lib/civetweb/civetweb.c", line=200, content="overflow"),
                ],
            ),
        ]
        result, stats = _filter_user_code_findings(
            findings, ["lib/civetweb/"],
        )
        assert len(result) == 1
        assert stats["cross_boundary"] == 1
        assert result[0].origin == "cross-boundary"

    def test_third_party_internal_dataflow_removed(self):
        """서드파티 finding + dataFlow도 전부 서드파티 → 제거."""
        findings = [
            _make_finding(
                "lib/civetweb/civetweb.c",
                tool="cppcheck",
                data_flow=[
                    SastDataFlowStep(file="lib/civetweb/civetweb.h", line=5, content="note"),
                    SastDataFlowStep(file="lib/civetweb/civetweb.c", line=10, content="note"),
                ],
            ),
        ]
        result, stats = _filter_user_code_findings(
            findings, ["lib/civetweb/"],
        )
        assert len(result) == 0
        assert stats["cross_boundary"] == 0

    def test_no_third_party_paths_keeps_all_relative(self):
        """thirdPartyPaths 미지정 → 기존 동작 (상대 경로 전부 유지)."""
        findings = [
            _make_finding("src/main.c"),
            _make_finding("lib/civetweb/civetweb.c"),
        ]
        result, stats = _filter_user_code_findings(findings, [])
        assert len(result) == 2
        assert stats["cross_boundary"] == 0

    def test_multiple_third_party_dirs(self):
        """여러 서드파티 디렉토리 필터링."""
        findings = [
            _make_finding("src/main.c"),
            _make_finding("lib/civetweb/civetweb.c"),
            _make_finding("vendor/tinydtls/dtls.c"),
            _make_finding("deps/mbedtls/ssl.c"),
        ]
        result, stats = _filter_user_code_findings(
            findings, ["lib/civetweb/", "vendor/tinydtls/", "deps/mbedtls/"],
        )
        assert len(result) == 1
        assert result[0].location.file == "src/main.c"


class TestBuildSdkInfo:
    def test_no_profile(self, orchestrator):
        info = orchestrator._build_sdk_info(None, None)
        assert info["resolved"] is False

    def test_with_enriched_profile(self, orchestrator):
        original = BuildProfile(
            sdkId="ti-am335x", compiler="arm-gcc",
            targetArch="arm", languageStandard="c99",
            headerLanguage="c",
            includePaths=["/user/path"],
        )
        enriched = original.model_copy(update={
            "include_paths": ["/user/path", "/sdk/path1", "/sdk/path2"],
        })
        info = orchestrator._build_sdk_info(original, enriched)
        assert info["resolved"] is True
        assert info["include_paths_added"] == 2
