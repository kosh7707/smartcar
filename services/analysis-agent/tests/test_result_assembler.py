import json

from agent_shared.schemas.agent import BudgetState
from agent_shared.schemas.agent import ToolCallRequest, ToolResult
from app.core.agent_session import AgentSession
from app.core.phase_one_types import Phase1Result
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


def _add_command_injection_catalog(session: AgentSession) -> None:
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "This causes a new program to execute and is difficult to use safely (CWE-78).",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78", "context": 'FILE *p = popen(cmd.c_str(), "r");'},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["fgets", "pclose", "popen"]},
            {"name": "prompt", "file": "main.cpp", "line": 69, "calls": ["getline", "trim"]},
            {"name": "create_ca", "file": "main.cpp", "line": 143, "calls": ["run", "to_string"]},
            {"name": "main", "file": "main.cpp", "line": 257, "calls": ["prompt", "create_ca"]},
        ],
    ))
    session.evidence_catalog.ingest_tool_result(
        ToolCallRequest(id="read1", name="code.read_file", arguments={"path": "main.cpp"}),
        ToolResult(
            tool_call_id="read1",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // main.cpp:35',
            new_evidence_refs=["eref-file-main.cpp"],
        ),
    )
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())


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


def test_missing_top_level_caveats_is_scaffolded_when_claim_is_grounded():
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

    assert result.status == "completed"
    assert result.result.caveats == []
    assert "deterministic_schema_scaffold" in result.result.policyFlags


def test_missing_top_level_used_refs_is_synced_from_claim_refs_when_grounded():
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

    assert result.status == "completed"
    assert result.result.usedEvidenceRefs == ["eref-001"]
    assert "deterministic_schema_scaffold" in result.result.policyFlags


def test_missing_contract_required_metadata_fields_still_fail_when_severity_is_unsafe_to_infer():
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
    assert "'suggestedSeverity'가 문자열이 아님" in result.failureDetail
    assert "필수 필드 'needsHumanReview' 누락" not in result.failureDetail
    assert "필수 필드 'recommendedNextSteps' 누락" not in result.failureDetail
    assert "필수 필드 'policyFlags' 누락" not in result.failureDetail


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
    assert "'needsHumanReview'가 bool이 아님" not in result.failureDetail
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
    assert "'caveats'가 리스트가 아님" not in result.failureDetail
    assert "'usedEvidenceRefs'가 리스트가 아님" not in result.failureDetail
    assert "'suggestedSeverity'가 문자열이 아님" in result.failureDetail
    assert "'needsHumanReview'가 bool이 아님" not in result.failureDetail
    assert "'recommendedNextSteps'가 리스트가 아님" not in result.failureDetail
    assert "'policyFlags'가 리스트가 아님" not in result.failureDetail


def test_command_injection_false_negative_empty_claims_is_repaired_from_catalog():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "SAST의 popen finding은 오탐으로 판단했습니다.",
        "claims": [],
        "caveats": ["오탐으로 판단"],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "low",
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    assert len(result.result.claims) == 1
    claim = result.result.claims[0]
    assert "CWE-78" in claim.statement
    assert claim.location == "main.cpp:35"
    assert "eref-sast-flawfinder:shell/popen" in claim.supportingEvidenceRefs
    assert "deterministic_command_injection_repair" in result.result.policyFlags


def test_command_injection_claim_missing_fields_repaired_from_catalog():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "CWE-78 finding exists.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The command construction reaches popen.",
        }],
        "caveats": [],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    claim = result.result.claims[0]
    assert claim.location == "main.cpp:35"
    assert "eref-sast-flawfinder:shell/popen" in claim.supportingEvidenceRefs


def test_command_injection_repair_not_applied_without_complete_catalog():
    assembler = ResultAssembler()
    session = _make_session()
    final_content = json.dumps({
        "summary": "claims missing fields but no complete evidence catalog exists.",
        "claims": [{
            "statement": "User input reaches popen.",
            "detail": "Missing refs and location should not be invented.",
        }],
        "caveats": [],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"


def test_sast_only_command_injection_empty_claims_fails_quality_gate():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "popen finding appears to be a false positive.",
        "claims": [],
        "caveats": ["insufficient evidence"],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "low",
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "command_injection_evidence_incomplete" in result.failureDetail


def test_user_named_constant_popen_does_not_create_deterministic_claim():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["popen"]},
            {"name": "user_status", "file": "main.cpp", "line": 80, "calls": ["run"]},
        ],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "No claim.",
        "claims": [],
        "caveats": [],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "low",
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "user_input_path" in result.failureDetail


def test_unrelated_prompt_path_does_not_create_deterministic_claim():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "main.cpp", "line": 29, "calls": ["popen"]},
            {"name": "banner", "file": "main.cpp", "line": 249, "calls": ["run"]},
            {"name": "prompt", "file": "main.cpp", "line": 69, "calls": ["getline"]},
            {"name": "main", "file": "main.cpp", "line": 257, "calls": ["prompt"]},
        ],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "No claim.",
        "claims": [],
        "caveats": [],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "low",
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "user_input_path" in result.failureDetail


def test_deep_metadata_fields_are_scaffolded_from_complete_command_bundle():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    bundle = session.evidence_catalog.command_injection_bundle()
    final_content = json.dumps({
        "summary": "CWE-78 command injection is present.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The command construction reaches popen through a coherent source and caller path.",
            "supportingEvidenceRefs": bundle.refs,
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": bundle.refs,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    assert result.result.suggestedSeverity == "high"
    assert result.result.needsHumanReview is True
    assert "deterministic_schema_scaffold" in result.result.policyFlags


def test_contextual_cwe_knowledge_ref_is_replaced_with_local_bundle_refs():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "CWE-78 command injection is present.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The model cited CWE background, but local source/caller evidence exists.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE-78"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-knowledge-CWE-78"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    claim_refs = result.result.claims[0].supportingEvidenceRefs
    assert "eref-knowledge-CWE-78" not in claim_refs
    assert "eref-knowledge-CWE-78" not in result.result.usedEvidenceRefs
    assert "eref-sast-flawfinder:shell/popen" in claim_refs
    assert "eref-file-main.cpp" in claim_refs
    assert any(ref.startswith("eref-caller-") for ref in claim_refs)
    assert "sanitized_contextual_knowledge_refs" in result.result.policyFlags
    assert "repopulated_local_grounding_refs" in result.result.policyFlags


def test_contextual_cwe_knowledge_ref_in_used_and_claim_refs_is_removed():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "CWE-78 command injection is present.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The claim should be grounded by local refs after cleanup.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE-78"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-knowledge-CWE-78", "eref-file-main.cpp"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    assert all(not ref.startswith("eref-knowledge-") for ref in result.result.usedEvidenceRefs)
    assert set(result.result.claims[0].supportingEvidenceRefs).issubset(set(result.result.usedEvidenceRefs))


def test_sast_only_after_contextual_knowledge_strip_fails_grounding():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "CWE-78 command injection is present.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "SAST plus CWE background is not enough after contextual ref cleanup.",
            "supportingEvidenceRefs": ["eref-sast-flawfinder:shell/popen", "eref-knowledge-CWE-78"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-sast-flawfinder:shell/popen", "eref-knowledge-CWE-78"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "insufficient_command_injection_grounding" in result.failureDetail


def test_mismatched_cwe_knowledge_ref_is_not_sanitized():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    session.extra_allowed_refs.add("eref-knowledge-CWE-79")
    final_content = json.dumps({
        "summary": "CWE mismatch should not be repaired.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The emitted knowledge ref points at a different CWE.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE-79"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-knowledge-CWE-79"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "eref-knowledge-CWE-79" in result.failureDetail
    assert "contextual knowledge ref not allowed" in result.failureDetail


def test_contextual_cwe_cleanup_does_not_hide_fake_refs():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "Fake refs must remain failures.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "One contextual ref is repairable, but the fake ref is not.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE-78", "eref-totally-made-up"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-knowledge-CWE-78", "eref-totally-made-up"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "eref-totally-made-up" in result.failureDetail


def test_typo_knowledge_ref_is_not_sanitized():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "Typo knowledge refs must not be repaired.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The ref is not the exact contextual CWE grammar.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE78"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-knowledge-CWE78"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "eref-knowledge-CWE78" in result.failureDetail


def test_contextual_knowledge_cleanup_requires_coherent_local_bundle_not_category_presence():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "source.cpp", "line": 29, "calls": ["popen"]},
            {"name": "create_ca", "file": "caller.cpp", "line": 143, "calls": ["run"]},
        ],
    ))
    session.evidence_catalog.ingest_tool_result(
        ToolCallRequest(id="read-third", name="code.read_file", arguments={"path": "third.cpp"}),
        ToolResult(
            tool_call_id="read-third",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // third.cpp:35',
            new_evidence_refs=["eref-file-third.cpp"],
        ),
    )
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "Unrelated local evidence must not become a coherent bundle.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The local refs are individually valid but not path coherent.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE-78"],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-knowledge-CWE-78"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "insufficient_command_injection_grounding" in result.failureDetail


def test_local_only_incoherent_command_injection_refs_fail_without_knowledge_cleanup():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/popen",
            "message": "CWE-78 popen",
            "location": {"file": "main.cpp", "line": 35},
            "metadata": {"name": "popen", "cweId": "CWE-78"},
        }],
        code_functions=[
            {"name": "run", "file": "source.cpp", "line": 29, "calls": ["popen"]},
            {"name": "create_ca", "file": "caller.cpp", "line": 143, "calls": ["run"]},
        ],
    ))
    session.evidence_catalog.ingest_tool_result(
        ToolCallRequest(id="read-third", name="code.read_file", arguments={"path": "third.cpp"}),
        ToolResult(
            tool_call_id="read-third",
            name="code.read_file",
            success=True,
            content='std::getline(std::cin, cn); std::string cmd = "openssl -subj /CN=" + cn; FILE *p = popen(cmd.c_str(), "r"); // third.cpp:35',
            new_evidence_refs=["eref-file-third.cpp"],
        ),
    )
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "Local refs are valid but incoherent.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The cited refs do not form one coherent path.",
            "supportingEvidenceRefs": [
                "eref-sast-flawfinder:shell/popen",
                "eref-file-third.cpp",
                "eref-caller-create_ca-caller.cpp-143",
            ],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": [
            "eref-sast-flawfinder:shell/popen",
            "eref-file-third.cpp",
            "eref-caller-create_ca-caller.cpp-143",
        ],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "insufficient_command_injection_grounding" in result.failureDetail


def test_unrelated_caller_does_not_satisfy_coherence_when_bundle_exists():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        code_functions=[
            {"name": "unrelated", "file": "other.cpp", "line": 1, "calls": ["run"]},
        ],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "A coherent bundle exists but the claim cites an unrelated caller.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The cited caller is not on the coherent path.",
            "supportingEvidenceRefs": [
                "eref-sast-flawfinder:shell/popen",
                "eref-file-main.cpp",
                "eref-caller-unrelated-other.cpp-1",
            ],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": [
            "eref-sast-flawfinder:shell/popen",
            "eref-file-main.cpp",
            "eref-caller-unrelated-other.cpp-1",
        ],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "insufficient_command_injection_grounding" in result.failureDetail


def test_system_shell_execution_claim_with_sast_only_refs_fails_coherence_gate():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/system",
            "message": "CWE-78 system shell execution",
            "location": {"file": "main.cpp", "line": 40},
            "metadata": {"name": "system", "cweId": "CWE-78"},
        }],
        code_functions=[],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "SAST-only shell execution claim must not pass coherence.",
        "claims": [{
            "statement": "User input can trigger arbitrary shell execution through system().",
            "detail": "This command injection claim cites only SAST and lacks source/input/caller path support.",
            "supportingEvidenceRefs": ["eref-sast-flawfinder:shell/system"],
            "location": "main.cpp:40",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-sast-flawfinder:shell/system"],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_GROUNDING"
    assert "insufficient_command_injection_grounding" in result.failureDetail


def test_non_command_execution_wording_does_not_trigger_command_injection_gate():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_phase1_result(Phase1Result(
        sast_findings=[{
            "ruleId": "flawfinder:shell/system",
            "message": "CWE-78 system shell execution",
            "location": {"file": "main.cpp", "line": 40},
            "metadata": {"name": "system", "cweId": "CWE-78"},
        }],
        code_functions=[],
    ))
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "Non-command execution wording should not be overmatched.",
        "claims": [{
            "statement": "Test execution takes longer than expected.",
            "detail": "This describes ordinary test runtime behavior, not process-spawning risk.",
            "supportingEvidenceRefs": ["eref-001"],
            "location": "tests/test_runner.cpp:10",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "info",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"


def test_plain_execution_word_in_evidence_does_not_make_empty_claims_fail_command_gate():
    assembler = ResultAssembler()
    session = _make_session()
    session.evidence_catalog.ingest_tool_result(
        ToolCallRequest(id="read-test", name="code.read_file", arguments={"path": "tests/test_runner.cpp"}),
        ToolResult(
            tool_call_id="read-test",
            name="code.read_file",
            success=True,
            content="Test execution takes longer than expected. // tests/test_runner.cpp:10",
            new_evidence_refs=["eref-file-test-runner.cpp"],
        ),
    )
    session.extra_allowed_refs.update(session.evidence_catalog.ref_ids())
    final_content = json.dumps({
        "summary": "No actionable command-injection claim is present.",
        "claims": [],
        "caveats": ["Plain execution wording is not OS command injection evidence."],
        "usedEvidenceRefs": ["eref-file-test-runner.cpp"],
        "suggestedSeverity": "info",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    assert result.result.claims == []


def test_partial_command_injection_refs_are_repopulated_from_complete_bundle():
    assembler = ResultAssembler()
    session = _make_session()
    _add_command_injection_catalog(session)
    final_content = json.dumps({
        "summary": "CWE-78 command injection is present with partial refs.",
        "claims": [{
            "statement": "User input reaches popen and can cause command injection.",
            "detail": "The model cited SAST and caller refs but omitted the source/input-path ref.",
            "supportingEvidenceRefs": [
                "eref-sast-flawfinder:shell/popen",
                "eref-caller-create_ca-main.cpp-143",
            ],
            "location": "main.cpp:35",
        }],
        "caveats": [],
        "usedEvidenceRefs": [
            "eref-sast-flawfinder:shell/popen",
            "eref-caller-create_ca-main.cpp-143",
        ],
        "suggestedSeverity": "high",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = assembler.build(final_content, session)

    assert result.status == "completed"
    refs = result.result.claims[0].supportingEvidenceRefs
    assert "eref-file-main.cpp" in refs
    assert "eref-sast-flawfinder:shell/popen" in refs
    assert "eref-caller-create_ca-main.cpp-143" in refs
