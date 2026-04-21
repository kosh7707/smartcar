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


def test_missing_top_level_caveats_remains_schema_failure_without_repair():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "popen 호출 경로가 확인되어 command injection 가능성이 있습니다.",
        "claims": [{
            "statement": "사용자 입력이 popen 호출에 도달합니다.",
            "detail": "입력값이 shell command 문자열로 연결된 뒤 popen으로 실행됩니다.",
            "supportingEvidenceRefs": ["eref-001"],
            "location": "clients/http_client.cpp:64",
        }],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": ["shell escaping 제거 및 execve argv 배열로 대체"],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "필수 필드 'caveats' 누락" in result.failureDetail


def test_missing_top_level_used_refs_remains_schema_failure_without_repair():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "증거 ref가 claim 수준에는 존재하지만 top-level usedEvidenceRefs가 누락되었습니다.",
        "claims": [{
            "statement": "취약 호출 경로가 증거 ref로 뒷받침됩니다.",
            "detail": "claim-level supportingEvidenceRefs에서 top-level refs를 안전하게 복구합니다.",
            "supportingEvidenceRefs": ["eref-001"],
            "location": "clients/http_client.cpp:64",
        }],
        "caveats": [],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "필수 필드 'usedEvidenceRefs' 누락" in result.failureDetail


def test_missing_contract_required_metadata_fields_remain_schema_failure_without_repair():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "메타데이터 required field가 누락되었습니다.",
        "claims": [{
            "statement": "취약 호출 경로가 증거 ref로 뒷받침됩니다.",
            "detail": "policyFlags/recommendedNextSteps 등도 계약상 required입니다.",
            "supportingEvidenceRefs": ["eref-001"],
            "location": "clients/http_client.cpp:64",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-001"],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "필수 필드 'suggestedSeverity' 누락" in result.failureDetail
    assert "필수 필드 'needsHumanReview' 누락" in result.failureDetail
    assert "필수 필드 'recommendedNextSteps' 누락" in result.failureDetail
    assert "필수 필드 'policyFlags' 누락" in result.failureDetail


def test_missing_claim_supporting_refs_remains_schema_failure_without_repair():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "claim-level required refs가 누락되었습니다.",
        "claims": [{
            "statement": "취약 호출 경로가 있다고 주장하지만 claim refs가 없습니다.",
            "detail": "supportingEvidenceRefs 누락은 sanitizer가 []로 숨기면 안 됩니다.",
            "location": "clients/http_client.cpp:64",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "claims[0]: 'supportingEvidenceRefs' 누락" in result.failureDetail


def test_missing_claim_detail_and_location_remain_schema_failure_without_repair():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "claim detail/location 누락은 계약 위반입니다.",
        "claims": [{
            "statement": "취약 호출 경로가 있다고 주장합니다.",
            "supportingEvidenceRefs": ["eref-001"],
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "claims[0]: 'detail' 누락" in result.failureDetail
    assert "claims[0]: 'location' 누락" in result.failureDetail


def test_claim_with_only_hallucinated_refs_fails_grounding_after_sanitize():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "환각 ref만으로 claim을 만들면 안 됩니다.",
        "claims": [{
            "statement": "지원되지 않는 증거 ref만 가진 claim입니다.",
            "detail": "sanitizer가 fake ref를 제거한 뒤 claim이 ungrounded가 됩니다.",
            "supportingEvidenceRefs": ["eref-totally-fake"],
            "location": "clients/http_client.cpp:64",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-totally-fake"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "eref-totally-fake" in result.failureDetail


def test_required_collection_fields_with_wrong_types_fail_schema_validation():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "필수 collection field 타입이 깨졌습니다.",
        "claims": [{
            "statement": "supportingEvidenceRefs가 문자열이면 안 됩니다.",
            "detail": "schema repair 또는 failure 대상입니다.",
            "supportingEvidenceRefs": "eref-001",
            "location": "clients/http_client.cpp:64",
        }],
        "caveats": [123],
        "usedEvidenceRefs": [123],
        "suggestedSeverity": 123,
        "needsHumanReview": "yes",
        "recommendedNextSteps": [123],
        "policyFlags": [123],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "caveats[0]가 문자열이 아님" in result.failureDetail
    assert "usedEvidenceRefs[0]가 문자열이 아님" in result.failureDetail
    assert "claims[0]: 'supportingEvidenceRefs'가 리스트가 아님" in result.failureDetail
    assert "'suggestedSeverity'가 문자열이 아님" in result.failureDetail
    assert "'needsHumanReview'가 bool이 아님" in result.failureDetail
    assert "recommendedNextSteps[0]가 문자열이 아님" in result.failureDetail
    assert "policyFlags[0]가 문자열이 아님" in result.failureDetail


def test_required_fields_with_null_values_fail_schema_validation_without_exception():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": None,
        "claims": None,
        "caveats": None,
        "usedEvidenceRefs": None,
        "suggestedSeverity": None,
        "needsHumanReview": None,
        "recommendedNextSteps": None,
        "policyFlags": None,
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "'summary'가 문자열이 아님" in result.failureDetail
    assert "'claims'가 리스트가 아님" in result.failureDetail
    assert "'caveats'가 리스트가 아님" in result.failureDetail
    assert "'usedEvidenceRefs'가 리스트가 아님" in result.failureDetail
    assert "'suggestedSeverity'가 문자열이 아님" in result.failureDetail
    assert "'needsHumanReview'가 bool이 아님" in result.failureDetail
    assert "'recommendedNextSteps'가 리스트가 아님" in result.failureDetail
    assert "'policyFlags'가 리스트가 아님" in result.failureDetail
