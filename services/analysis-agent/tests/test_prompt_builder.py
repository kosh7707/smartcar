"""SystemPromptBuilder 단위 테스트."""

from __future__ import annotations

from app.agent_runtime.llm.prompt_builder import DYNAMIC_BOUNDARY, SystemPromptBuilder
from app.agent_runtime.schemas.agent import BudgetState


class TestBasicBuild:
    def test_empty_builder(self):
        builder = SystemPromptBuilder()
        assert builder.build() == ""
        assert builder.section_count() == 0

    def test_single_section(self):
        result = SystemPromptBuilder().add_section("역할", "보안 분석가").build()
        assert "## 역할" in result
        assert "보안 분석가" in result

    def test_multiple_sections_order(self):
        result = (
            SystemPromptBuilder()
            .add_section("역할", "분석가")
            .add_section("임무", "SAST 분석")
            .add_section("규칙", "JSON 출력")
            .build()
        )
        # 순서 보존
        idx_role = result.index("역할")
        idx_mission = result.index("임무")
        idx_rule = result.index("규칙")
        assert idx_role < idx_mission < idx_rule

    def test_section_with_markdown_header(self):
        """이미 # 헤더가 있는 content는 ## 접두사를 붙이지 않는다."""
        content = "# 큰 제목\n내용"
        result = SystemPromptBuilder().add_section("제목", content).build()
        assert result.startswith("# 큰 제목")
        assert "## 제목" not in result

    def test_sections_separated_by_double_newline(self):
        result = (
            SystemPromptBuilder()
            .add_section("A", "내용A")
            .add_section("B", "내용B")
            .build()
        )
        assert "\n\n" in result


class TestEnvironment:
    def test_environment_injection(self):
        result = (
            SystemPromptBuilder()
            .add_section("역할", "분석가")
            .with_environment(platform="linux", cwd="/project", date="2026-04-02")
            .build()
        )
        assert "## 환경 정보" in result
        assert "linux" in result
        assert "/project" in result
        assert "2026-04-02" in result

    def test_environment_with_model(self):
        result = (
            SystemPromptBuilder()
            .with_environment(platform="linux", cwd="/", date="today", model="qwen-122b")
            .build()
        )
        assert "qwen-122b" in result


class TestBudget:
    def test_budget_injection(self):
        budget = BudgetState(max_steps=10, max_cheap_calls=8, max_medium_calls=3)
        result = (
            SystemPromptBuilder()
            .add_section("역할", "분석가")
            .with_budget(budget)
            .build()
        )
        assert "## 도구 예산" in result
        assert "최대 8회" in result
        assert "최대 3회" in result
        assert "최대 10 턴" in result


class TestSuffix:
    def test_suffix(self):
        result = (
            SystemPromptBuilder()
            .add_section("역할", "분석가")
            .set_suffix("/no_think")
            .build()
        )
        assert result.endswith("/no_think")


class TestDynamicBoundary:
    def test_boundary_marker(self):
        result = (
            SystemPromptBuilder()
            .add_section("정적", "캐시 가능")
            .add_section("동적", "세션 변동")
            .mark_dynamic_boundary("정적")
            .build()
        )
        assert DYNAMIC_BOUNDARY in result
        idx_static = result.index("캐시 가능")
        idx_boundary = result.index(DYNAMIC_BOUNDARY)
        idx_dynamic = result.index("세션 변동")
        assert idx_static < idx_boundary < idx_dynamic

    def test_no_boundary_if_not_set(self):
        result = (
            SystemPromptBuilder()
            .add_section("A", "내용")
            .build()
        )
        assert DYNAMIC_BOUNDARY not in result


class TestUtilities:
    def test_has_section(self):
        builder = SystemPromptBuilder().add_section("역할", "분석가")
        assert builder.has_section("역할")
        assert not builder.has_section("없는섹션")

    def test_section_count(self):
        builder = (
            SystemPromptBuilder()
            .add_section("A", "a")
            .add_section("B", "b")
            .add_section("C", "c")
        )
        assert builder.section_count() == 3


def test_phase2_prompt_lists_full_required_schema_and_omits_knowledge_ref_example():
    from app.core.phase_one_prompt import build_phase2_prompt
    from app.core.phase_one_types import Phase1Result

    system_prompt, _ = build_phase2_prompt(Phase1Result(), {}, evidence_refs=[])

    assert "summary, claims, caveats, usedEvidenceRefs, suggestedSeverity, needsHumanReview, recommendedNextSteps, policyFlags" in system_prompt
    assert "eref-knowledge-CWE-78" not in system_prompt
    assert "Knowledge/CWE ref" in system_prompt or "위협 지식" in system_prompt


def test_phase2_prompt_contains_live_recovery_ledger_summary():
    from app.core.phase_one_prompt import build_phase2_prompt
    from app.core.phase_one_types import Phase1Result

    _, user = build_phase2_prompt(
        Phase1Result(),
        {"objective": "test"},
        evidence_refs=[],
        live_recovery_summary={
            "totalAttempts": 1,
            "shownAttempts": [{
                "class": "negative",
                "sourceTool": "knowledge.search",
                "status": "no_hits",
                "summary": "knowledge.search: no_hits",
                "toolArguments": {"query": "CWE-78"},
            }],
            "truncated": False,
            "negativeCount": 1,
            "operationalCount": 0,
        },
    )

    assert "Live Recovery / Evidence Ledger Summary" in user
    assert "diagnostic only; not proof refs" in user
    assert "knowledge.search" in user
    assert '"negativeCount": 1' in user


def test_phase2_prompt_contains_suggested_next_action_advisory():
    from app.core.phase_one_prompt import build_phase2_prompt
    from app.core.phase_one_types import Phase1Result

    _, user = build_phase2_prompt(
        Phase1Result(),
        {"objective": "test"},
        suggested_next_action={
            "tool_name": "knowledge.search",
            "arguments": {"query": "CWE-78", "top_k": 5},
            "target_slot": "threat_knowledge",
        },
    )

    assert "Suggested Next Evidence Acquisition Action" in user
    assert "advisory" in user
    assert "knowledge.search" in user
