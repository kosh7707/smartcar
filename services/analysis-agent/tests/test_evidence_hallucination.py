"""Evidence ref 환각 → 교정 통합 테스트.

mock LLM이 환각 refId를 포함한 응답을 반환할 때,
ResultAssembler가 sanitize 후 validation.valid == True를 보장하는지 검증한다.
"""

import json

import pytest

from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.types import TaskType
from agent_shared.schemas.agent import BudgetState, ToolCostTier, ToolTraceStep


def _make_session(
    input_refs: list[str],
    extra_allowed: set[str] | None = None,
    trace_refs: list[list[str]] | None = None,
) -> AgentSession:
    """테스트용 AgentSession 구성."""
    evidence = [
        EvidenceRef(
            refId=ref_id, artifactId=f"art-{i}",
            artifactType="source", locatorType="lineRange",
            locator={"file": f"src/file{i}.c", "fromLine": 1, "toLine": 50},
        )
        for i, ref_id in enumerate(input_refs)
    ]
    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="test-hallucination",
        context=Context(trusted={"findings": []}),
        evidenceRefs=evidence,
    )
    session = AgentSession(request, BudgetState())
    if extra_allowed:
        session.extra_allowed_refs = extra_allowed
    if trace_refs:
        for i, refs in enumerate(trace_refs):
            session.trace.append(ToolTraceStep(
                step_id=f"step_{i:02d}",
                turn_number=1,
                tool="knowledge.search",
                args_hash=f"hash-{i}",
                cost_tier=ToolCostTier.CHEAP,
                duration_ms=100,
                success=True,
                new_evidence_refs=refs,
            ))
    return session


class TestHallucinationCorrection:
    def test_hallucinated_ref_corrected_to_valid(self):
        """환각 refId가 유사한 allowed ref로 교정된다."""
        session = _make_session(
            input_refs=["eref-001"],
            extra_allowed={"eref-sast-cmd-injection"},
            trace_refs=[["eref-knowledge-CWE-78"]],
        )

        # LLM이 eref-knowledge-CWE78 (하이픈 누락) 환각
        final_content = json.dumps({
            "summary": "Command injection found",
            "claims": [{
                "statement": "popen() vulnerable",
                "supportingEvidenceRefs": ["eref-001", "eref-knowledge-CWE78"],
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001", "eref-knowledge-CWE78"],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        })

        assembler = ResultAssembler()
        result = assembler.build(final_content, session)

        assert result.validation.valid is True
        assert result.validation.errors == []
        # 교정된 refId 확인
        assert "eref-knowledge-CWE-78" in result.result.usedEvidenceRefs
        assert "eref-knowledge-CWE78" not in result.result.usedEvidenceRefs

    def test_completely_fake_ref_removed(self):
        """매칭 불가능한 환각 refId는 제거된다."""
        session = _make_session(input_refs=["eref-001"])

        final_content = json.dumps({
            "summary": "Analysis complete",
            "claims": [{
                "statement": "Vulnerability found",
                "supportingEvidenceRefs": ["eref-001", "eref-code-graph-00"],
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001", "eref-code-graph-00"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        })

        assembler = ResultAssembler()
        result = assembler.build(final_content, session)

        assert result.validation.valid is True
        assert result.validation.errors == []
        assert result.result.usedEvidenceRefs == ["eref-001"]
        assert result.result.claims[0].supportingEvidenceRefs == ["eref-001"]

    def test_all_valid_refs_pass_through(self):
        """유효한 refId만 있으면 교정 없이 통과."""
        session = _make_session(
            input_refs=["eref-001"],
            trace_refs=[["eref-caller-main"]],
        )

        final_content = json.dumps({
            "summary": "Clean analysis",
            "claims": [{
                "statement": "Finding confirmed",
                "supportingEvidenceRefs": ["eref-001", "eref-caller-main"],
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001", "eref-caller-main"],
            "suggestedSeverity": "medium",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        })

        assembler = ResultAssembler()
        result = assembler.build(final_content, session)

        assert result.validation.valid is True
        assert result.validation.errors == []
        assert set(result.result.usedEvidenceRefs) == {"eref-001", "eref-caller-main"}

    def test_mixed_hallucination_scenario(self):
        """유효 + 교정가능 + 불가능 refId가 혼재된 경우."""
        session = _make_session(
            input_refs=["eref-001"],
            extra_allowed={"eref-sast-cmd-injection"},
            trace_refs=[["eref-knowledge-CWE-78", "eref-caller-main"]],
        )

        final_content = json.dumps({
            "summary": "Mixed refs",
            "claims": [
                {
                    "statement": "Claim 1",
                    "supportingEvidenceRefs": ["eref-001", "eref-knowledge-CWE78"],
                },
                {
                    "statement": "Claim 2",
                    "supportingEvidenceRefs": ["eref-totally-made-up", "eref-caller-main"],
                },
            ],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001", "eref-knowledge-CWE78", "eref-totally-made-up", "eref-caller-main"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        })

        assembler = ResultAssembler()
        result = assembler.build(final_content, session)

        assert result.validation.valid is True
        assert result.validation.errors == []
        # claim 1: eref-knowledge-CWE78 → eref-knowledge-CWE-78
        assert "eref-knowledge-CWE-78" in result.result.claims[0].supportingEvidenceRefs
        # claim 2: eref-totally-made-up 제거, eref-caller-main 유지
        assert result.result.claims[1].supportingEvidenceRefs == ["eref-caller-main"]
