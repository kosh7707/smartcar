import json

from agent_shared.schemas.agent import BudgetState
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.types import TaskType


def _make_session() -> AgentSession:
    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="result-assembler-test",
        context=Context(trusted={}),
        evidenceRefs=[
            EvidenceRef(
                refId="eref-001",
                artifactId="art-1",
                artifactType="source",
                locatorType="lineRange",
                locator={"file": "clients/http_client.cpp", "fromLine": 60, "toLine": 70},
            )
        ],
    )
    return AgentSession(request, BudgetState())


def test_unstructured_response_returns_failure():
    assembler = ResultAssembler()
    session = _make_session()

    result = assembler.build("## Phase A: 우선순위 수립\n1. popen 위험 분석", session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"


def test_legitimate_structured_zero_claim_response_is_allowed():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "검토 결과 actionable claim으로 승격할 근거가 충분하지 않습니다.",
        "claims": [],
        "caveats": ["high-risk로 보였던 finding은 입력 검증과 호출 맥락상 false positive로 판단했습니다."],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "low",
        "needsHumanReview": True,
        "recommendedNextSteps": ["추가 런타임 검증 시나리오 검토"],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    assert result.validation.valid is True
    assert result.result.claims == []


def test_low_confidence_claim_shape_is_allowed_without_schema_change():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "추가 검증이 필요하지만 보안상 무시할 수 없는 claim입니다.",
        "claims": [{
            "statement": "readlink 사용 경로는 exploitability closure가 불완전하지만 위험 신호가 있습니다.",
            "detail": (
                "Exploitability is plausible but not fully confirmed from the available evidence. "
                "guard/validation evidence가 더 필요합니다."
            ),
            "supportingEvidenceRefs": ["eref-001"],
            "location": "utils/fs.cpp:22",
        }],
        "caveats": ["low-confidence claim: 추가 검증이 필요합니다."],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "medium",
        "needsHumanReview": True,
        "recommendedNextSteps": ["knowledge.search로 CWE/CVE 연결 근거 보강"],
        "policyFlags": ["low_confidence_claim_present"],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    assert len(result.result.claims) == 1
    assert result.result.policyFlags == ["low_confidence_claim_present"]
    assert "Exploitability is plausible but not fully confirmed" in result.result.claims[0].detail
