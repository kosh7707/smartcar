"""코드그래프 품질 평가 테스트 — clang 실행 기반 통합 테스트.

pytest -m integration -k codegraph 으로 실행.
clang 미설치 시 자동 skip.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from app.scanner.ast_dumper import AstDumper
from benchmark.codegraph_evaluator import (
    CodeGraphMetrics,
    evaluate_codegraph,
    evaluate_origin,
    load_ground_truth,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
CG_PROJECT = FIXTURES_DIR / "codegraph_project"
GROUND_TRUTH_PATH = CG_PROJECT / "expected_codegraph.json"

SOURCE_FILES = [
    "src/main.c",
    "src/server.c",
    "src/handler.c",
    "src/logger.c",
    "third-party/minijson/minijson.c",
]


def _clang_available() -> bool:
    for name in ("clang", "clang-18", "clang-17", "clang-16"):
        if shutil.which(name):
            return True
    return False


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not _clang_available(), reason="clang not installed"),
]


@pytest.fixture
def ground_truth():
    return load_ground_truth(GROUND_TRUTH_PATH)


@pytest.fixture
def dumper():
    return AstDumper()


# ──────────── 기본 품질 메트릭 ────────────


class TestCodeGraphQuality:
    """dump_functions → ground truth 비교 품질 평가."""

    @pytest.mark.asyncio
    async def test_function_extraction(self, dumper, ground_truth):
        """모든 기대 함수가 추출되는지 확인 (function recall/precision)."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        metrics = evaluate_codegraph(result, ground_truth, SOURCE_FILES)

        thresholds = ground_truth["thresholds"]
        assert metrics.function_recall >= thresholds["function_recall"], (
            f"Function recall {metrics.function_recall:.2%} < {thresholds['function_recall']:.0%}\n"
            f"Missing: {metrics.missing_functions}"
        )
        assert metrics.function_precision >= thresholds["function_precision"], (
            f"Function precision {metrics.function_precision:.2%} < {thresholds['function_precision']:.0%}\n"
            f"Extra: {metrics.extra_functions}"
        )

    @pytest.mark.asyncio
    async def test_call_relationships(self, dumper, ground_truth):
        """호출 관계가 정확한지 확인 (call recall/precision)."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        metrics = evaluate_codegraph(result, ground_truth, SOURCE_FILES)

        thresholds = ground_truth["thresholds"]
        assert metrics.call_recall >= thresholds["call_recall"], (
            f"Call recall {metrics.call_recall:.2%} < {thresholds['call_recall']:.0%}\n"
            f"Missing calls: {metrics.missing_calls[:10]}"
        )
        assert metrics.call_precision >= thresholds["call_precision"], (
            f"Call precision {metrics.call_precision:.2%} < {thresholds['call_precision']:.0%}\n"
            f"Extra calls: {metrics.extra_calls[:10]}"
        )

    @pytest.mark.asyncio
    async def test_parse_rate(self, dumper, ground_truth):
        """모든 소스 파일이 파싱 성공하는지 확인."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        metrics = evaluate_codegraph(result, ground_truth, SOURCE_FILES)

        thresholds = ground_truth["thresholds"]
        assert metrics.parse_rate >= thresholds["parse_rate"], (
            f"Parse rate {metrics.parse_rate:.2%} < {thresholds['parse_rate']:.0%}\n"
            f"Parsed {metrics.parsed_files}/{metrics.total_source_files} files"
        )

    @pytest.mark.asyncio
    async def test_all_thresholds(self, dumper, ground_truth):
        """전체 임계값 일괄 검증 — 리포트 출력."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        metrics = evaluate_codegraph(result, ground_truth, SOURCE_FILES)
        failures = metrics.check_thresholds(ground_truth["thresholds"])
        assert not failures, (
            f"Threshold failures:\n  " + "\n  ".join(failures)
            + f"\n\n{metrics.to_markdown()}"
        )


# ──────────── 헤더 필터링 ────────────


class TestHeaderFiltering:
    """시스템 헤더 함수가 결과에 포함되지 않는지 확인."""

    @pytest.mark.asyncio
    async def test_no_system_header_functions(self, dumper):
        """추출된 함수 중 절대 경로(시스템 헤더) 파일의 함수가 없어야 한다."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        for func in result["functions"]:
            assert not func["file"].startswith("/"), (
                f"System header function leaked: {func['name']} in {func['file']}"
            )

    @pytest.mark.asyncio
    async def test_no_builtin_functions(self, dumper):
        """__builtin_*, __bswap_* 등 내부 함수가 결과에 없어야 한다."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        for func in result["functions"]:
            assert not func["name"].startswith("__"), (
                f"Internal/builtin function leaked: {func['name']}"
            )


# ──────────── Origin 태깅 ────────────


class TestOriginTagging:
    """서드파티 라이브러리 origin 태깅 정확도."""

    @pytest.mark.asyncio
    async def test_unmodified_third_party(self, dumper, ground_truth):
        """matchRatio == 100 → origin: 'third-party'."""
        test = ground_truth["origin_tests"][0]
        result = await dumper.dump_functions(
            CG_PROJECT, SOURCE_FILES, None, libraries=test["libraries"],
        )
        checks, correct, errors = evaluate_origin(result, test)
        assert correct == checks, (
            f"Origin accuracy {correct}/{checks}\nErrors: {errors}"
        )

    @pytest.mark.asyncio
    async def test_modified_third_party(self, dumper, ground_truth):
        """matchRatio < 100 → origin: 'modified-third-party'."""
        test = ground_truth["origin_tests"][1]
        result = await dumper.dump_functions(
            CG_PROJECT, SOURCE_FILES, None, libraries=test["libraries"],
        )
        checks, correct, errors = evaluate_origin(result, test)
        assert correct == checks, (
            f"Origin accuracy {correct}/{checks}\nErrors: {errors}"
        )

    @pytest.mark.asyncio
    async def test_user_code_no_origin(self, dumper):
        """라이브러리 매칭되지 않는 함수에는 origin 태그가 없어야 한다."""
        libs = [{"name": "minijson", "version": "1.0.0", "path": "third-party/minijson",
                 "diff": {"matchRatio": 100}}]
        result = await dumper.dump_functions(
            CG_PROJECT, SOURCE_FILES, None, libraries=libs,
        )
        for func in result["functions"]:
            if not func["file"].startswith("third-party/"):
                assert "origin" not in func, (
                    f"User code function has origin tag: {func['name']} -> {func.get('origin')}"
                )


# ──────────── Skip Paths ────────────


class TestSkipPaths:
    """skip_paths로 서드파티 파일 제외 동작 검증."""

    @pytest.mark.asyncio
    async def test_skip_excludes_third_party(self, dumper, ground_truth):
        """skip_paths 지정 시 해당 경로 함수가 결과에서 제외."""
        sp_test = ground_truth["skip_paths_test"]
        result = await dumper.dump_functions(
            CG_PROJECT, SOURCE_FILES, None,
            skip_paths=sp_test["skip_paths"],
        )
        func_names = {f["name"] for f in result["functions"]}
        for excluded in sp_test["expected_excluded"]:
            assert excluded not in func_names, (
                f"Function {excluded} should be excluded by skip_paths"
            )
        assert len(result["functions"]) == sp_test["expected_remaining_count"]


# ──────────── 그래프 연결성 ────────────


class TestGraphConnectivity:
    """코드그래프의 연결성 — S5 ingest 후 유용성 지표."""

    @pytest.mark.asyncio
    async def test_cross_file_calls_exist(self, dumper):
        """파일 간 호출 관계가 존재하는지 확인 (그래프 연결성)."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        funcs_by_name = {f["name"]: f for f in result["functions"]}

        # main.c → server.c (init_server)
        assert "init_server" in funcs_by_name["main"]["calls"]
        # main.c → server.c (handle_client)
        assert "handle_client" in funcs_by_name["main"]["calls"]
        # server.c → handler.c (process_request)
        assert "process_request" in funcs_by_name["handle_client"]["calls"]
        # handler.c → logger.c (log_message)
        assert "log_message" in funcs_by_name["execute_action"]["calls"]
        # logger.c → logger.c (self-reference in log_error)
        assert "log_message" in funcs_by_name["log_error"]["calls"]

    @pytest.mark.asyncio
    async def test_dangerous_function_calls_captured(self, dumper):
        """위험 함수 호출이 캡처되는지 확인 — S5 dangerous-callers 지원."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        funcs_by_name = {f["name"]: f for f in result["functions"]}

        # system() 호출 추적 가능
        assert "system" in funcs_by_name["execute_action"]["calls"]
        # strcpy() 호출 추적 가능
        assert "strcpy" in funcs_by_name["parse_input"]["calls"]

    @pytest.mark.asyncio
    async def test_edge_density(self, dumper):
        """edge density (평균 호출 수)가 합리적 범위인지 확인."""
        result = await dumper.dump_functions(CG_PROJECT, SOURCE_FILES, None)
        funcs = result["functions"]
        total_calls = sum(len(f["calls"]) for f in funcs)
        density = total_calls / len(funcs) if funcs else 0
        # 이 프로젝트에서 평균 호출 수는 약 2.0
        assert density >= 1.0, f"Edge density too low: {density:.1f}"
        assert density <= 10.0, f"Edge density suspiciously high: {density:.1f}"
