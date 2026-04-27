"""Evidence ref 환각 → state-machine outcome classification 통합 테스트.

mock LLM이 unsupported refId를 포함한 응답을 반환할 때,
ResultAssembler가 public task failure 대신 completed negative outcome으로
분류하되 accepted claim/evidence를 제조하지 않는지 검증한다.
"""

import json

import pytest

from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.types import TaskType
from app.agent_runtime.schemas.agent import BudgetState, ToolCostTier, ToolTraceStep


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


class TestHallucinationRejection:
    def test_hallucinated_ref_causes_no_accepted_claims_outcome(self):
        """유사해 보이는 환각 refId도 accepted claim으로 숨기지 않는다."""
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
                "detail": "popen() is reachable from the cited code path.",
                "supportingEvidenceRefs": ["eref-001", "eref-knowledge-CWE78"],
                "location": "src/file0.c:1",
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

        assert result.status == "completed"
        assert result.result.analysisOutcome == "no_accepted_claims"
        assert result.result.qualityOutcome == "rejected"
        assert result.result.claims == []
        assert "eref-knowledge-CWE78" in (result.result.recoveryTrace[0].detail or "")

    def test_completely_fake_ref_causes_no_accepted_claims_outcome(self):
        """매칭 불가능한 환각 refId도 accepted claim으로 숨기지 않는다."""
        session = _make_session(input_refs=["eref-001"])

        final_content = json.dumps({
            "summary": "Analysis complete",
            "claims": [{
                "statement": "Vulnerability found",
                "detail": "The claim is grounded by the remaining valid evidence ref.",
                "supportingEvidenceRefs": ["eref-001", "eref-code-graph-00"],
                "location": "src/file0.c:1",
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

        assert result.status == "completed"
        assert result.result.analysisOutcome == "no_accepted_claims"
        assert result.result.qualityOutcome == "rejected"
        assert result.result.claims == []
        assert "eref-code-graph-00" in (result.result.recoveryTrace[0].detail or "")

    def test_all_valid_refs_pass_through(self):
        """유효한 refId만 있으면 그대로 통과."""
        session = _make_session(
            input_refs=["eref-001"],
            trace_refs=[["eref-caller-main"]],
        )

        final_content = json.dumps({
            "summary": "Clean analysis",
            "claims": [{
                "statement": "Finding confirmed",
                "detail": "All refs are valid and should pass through unchanged.",
                "supportingEvidenceRefs": ["eref-001", "eref-caller-main"],
                "location": "src/file0.c:1",
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
        """유효 + 환각 refId가 혼재된 경우 환각 refId는 모두 제거된다."""
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
                    "detail": "Claim 1 has one valid and one hallucinated ref.",
                    "supportingEvidenceRefs": ["eref-001", "eref-knowledge-CWE78"],
                    "location": "src/file0.c:1",
                },
                {
                    "statement": "Claim 2",
                    "detail": "Claim 2 keeps only the valid caller ref.",
                    "supportingEvidenceRefs": ["eref-totally-made-up", "eref-caller-main"],
                    "location": "src/file1.c:1",
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

        assert result.status == "completed"
        assert result.result.analysisOutcome == "no_accepted_claims"
        assert result.result.qualityOutcome == "rejected"
        assert result.result.claims == []
        assert "eref-knowledge-CWE78" in (result.result.recoveryTrace[0].detail or "")
        assert "eref-totally-made-up" in (result.result.recoveryTrace[0].detail or "")
