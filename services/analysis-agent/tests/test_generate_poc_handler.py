from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from app.registry.model_registry import ModelProfile
from app.routers import tasks
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.schemas.response import AuditInfo, AssessmentResult, TaskSuccessResponse, TokenUsage, ValidationInfo
from app.types import TaskStatus, TaskType
from app.config import settings


def _make_poc_request() -> TaskRequest:
    return TaskRequest(
        taskType=TaskType.GENERATE_POC,
        taskId="poc-test-001",
        context=Context(trusted={
            "claim": {
                "statement": "User-controlled URL reaches popen() leading to RCE",
                "detail": "The URL is shell-expanded before reaching popen().",
                "location": "src/http_client.cpp:62",
            },
            "projectId": "gateway-webserver",
            "projectPath": "/tmp/project",
            "files": [
                {
                    "path": "src/http_client.cpp",
                    "content": "int x(){ return popen(url, \"r\") != NULL; }",
                },
            ],
        }),
        evidenceRefs=[
            EvidenceRef(
                refId="eref-001",
                artifactId="art-001",
                artifactType="source",
                locatorType="lineRange",
                locator={"file": "src/http_client.cpp", "fromLine": 1, "toLine": 80},
            ),
        ],
    )


def _mock_llm_response(content: str, prompt_tokens: int = 10, completion_tokens: int = 20):
    return SimpleNamespace(
        content=content,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )


@pytest.mark.asyncio
async def test_generate_poc_returns_structured_json_with_valid_claim(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response(json.dumps({
            "summary": "PoC가 RCE 가능성을 재현한다.",
            "claims": [{
                "statement": "PoC는 popen 경로를 통해 명령 주입 가능성을 증명한다.",
                "detail": "PoC detail",
                "supportingEvidenceRefs": ["eref-001"],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": ["escape 검증 추가"],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert len(result.result.claims) == 1
        assert result.result.claims[0].supportingEvidenceRefs == ["eref-001"]
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_repairs_missing_top_level_caveats(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    responses = [
        {
            "summary": "PoC가 RCE 가능성을 재현한다.",
            "claims": [{
                "statement": "PoC는 popen 경로를 통해 명령 주입 가능성을 증명한다.",
                "detail": "PoC detail",
                "supportingEvidenceRefs": ["eref-001"],
                "location": "src/http_client.cpp:62",
            }],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": ["escape 검증 추가"],
            "policyFlags": [],
        },
        {
            "summary": "PoC가 RCE 가능성을 재현한다.",
            "claims": [{
                "statement": "PoC는 popen 경로를 통해 명령 주입 가능성을 증명한다.",
                "detail": "PoC detail",
                "supportingEvidenceRefs": ["eref-001"],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": ["escape 검증 추가"],
            "policyFlags": [],
        },
    ]
    calls = {"count": 0}

    async def fake_call(self, *args, **kwargs):
        payload = responses[min(calls["count"], len(responses) - 1)]
        calls["count"] += 1
        return _mock_llm_response(json.dumps(payload))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert isinstance(result.result.caveats, list)
        assert result.validation.valid is True
        assert result.validation.errors == []
        assert result.result.claims[0].supportingEvidenceRefs == ["eref-001"]
        assert calls["count"] == 2
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_repairs_orphaned_claim_fragment_via_strict_schema_repair(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    responses = [
        {
            "summary": "PoC가 RCE 가능성을 재현한다.",
            "claims": [
                {
                    "statement": "PoC는 popen 경로를 통해 명령 주입 가능성을 증명한다.",
                    "detail": "## Injection 분석\n- Quote Context: -subj '/CN=",
                },
                (
                    'supportingEvidenceRefs": ["eref-001"],\n'
                    '"location": "src/http_client.cpp:62"\n'
                    '  }],\n'
                    '  "caveats": [],\n'
                    '  "usedEvidenceRefs": ["eref-001"],\n'
                    '  "suggestedSeverity": "high",\n'
                    '  "needsHumanReview": true,\n'
                    '  "recommendedNextSteps": ["escape 검증 추가"],\n'
                    '  "policyFlags": []'
                ),
            ],
        },
        {
            "summary": "PoC가 RCE 가능성을 재현한다.",
            "claims": [
                {
                    "statement": "PoC는 popen 경로를 통해 명령 주입 가능성을 증명한다.",
                    "detail": "## Injection 분석\n- Quote Context: -subj '/CN='",
                    "supportingEvidenceRefs": ["eref-001"],
                    "location": "src/http_client.cpp:62",
                }
            ],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": ["escape 검증 추가"],
            "policyFlags": [],
        },
    ]
    calls = {"count": 0}

    async def fake_call(self, *args, **kwargs):
        payload = responses[min(calls["count"], len(responses) - 1)]
        calls["count"] += 1
        return _mock_llm_response(json.dumps(payload))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert len(result.result.claims) == 1
        assert result.result.claims[0].supportingEvidenceRefs == ["eref-001"]
        assert result.result.claims[0].location == "src/http_client.cpp:62"
        assert isinstance(result.result.caveats, list)
        assert result.result.usedEvidenceRefs == ["eref-001"]
        assert result.validation.valid is True
        assert calls["count"] == 2
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_rejects_schema_valid_evidence_empty_output(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response(json.dumps({
            "summary": "PoC for command injection.",
            "claims": [{
                "statement": "CN input reaches popen and can trigger command injection.",
                "detail": "PoC calls the vulnerable certificate maker with a crafted CN.",
                "supportingEvidenceRefs": [],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": [],
            "usedEvidenceRefs": [],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "validation_failed"
        assert result.failureCode == "INVALID_GROUNDING"
        assert "claims[0].supportingEvidenceRefs가 비어 있음" in result.failureDetail
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_rejects_hallucinated_refs_after_sanitization(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response(json.dumps({
            "summary": "PoC for command injection.",
            "claims": [{
                "statement": "CN input reaches popen and can trigger command injection.",
                "detail": "PoC calls the vulnerable certificate maker with a crafted CN.",
                "supportingEvidenceRefs": ["eref-hallucinated"],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-hallucinated"],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "validation_failed"
        assert result.failureCode == "INVALID_GROUNDING"
        assert "eref-hallucinated" in result.failureDetail
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_requests_async_ownership_for_toolless_llm_call(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    seen = {}

    async def fake_call(self, *args, **kwargs):
        seen["prefer_async_ownership"] = kwargs.get("prefer_async_ownership")
        return _mock_llm_response(json.dumps({
            "summary": "PoC가 RCE 가능성을 재현한다.",
            "claims": [{
                "statement": "PoC는 popen 경로를 통해 명령 주입 가능성을 증명한다.",
                "detail": "PoC detail",
                "supportingEvidenceRefs": ["eref-001"],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": ["escape 검증 추가"],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert seen["prefer_async_ownership"] is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_rejects_unstructured_output(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response("### 계획\n1. PoC 아이디어를 정리한다.")

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "validation_failed"
        assert result.failureCode == "INVALID_SCHEMA"
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_rejects_zero_claim_json(monkeypatch):
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test",
        modelName="test-model",
        contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC],
        endpoint="http://localhost:8000",
        apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response(json.dumps({
            "summary": "No PoC available",
            "claims": [],
            "caveats": ["Not exploitable"],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "medium",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "validation_failed"
        assert result.failureCode == "INVALID_SCHEMA"
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


def _success_response(task_type: TaskType) -> TaskSuccessResponse:
    return TaskSuccessResponse(
        taskId="test",
        taskType=task_type,
        status=TaskStatus.COMPLETED,
        modelProfile="test",
        promptVersion="test",
        schemaVersion="agent-v1",
        validation=ValidationInfo(valid=True, errors=[]),
        result=AssessmentResult(
            summary="ok",
            claims=[],
            caveats=[],
            usedEvidenceRefs=[],
            suggestedSeverity=None,
            confidence=0.0,
            needsHumanReview=True,
            recommendedNextSteps=[],
            policyFlags=[],
        ),
        audit=AuditInfo(
            inputHash="sha256:test",
            latencyMs=0,
            tokenUsage=TokenUsage(prompt=0, completion=0),
            retryCount=0,
            ragHits=0,
            createdAt="2026-04-07T00:00:00Z",
        ),
    )


def _make_poc_request_with_claim_refs_no_top_refs() -> TaskRequest:
    """claim carries supportingEvidenceRefs but request.evidenceRefs is empty.

    Simulates the real-world case where generate-poc is called with a claim produced
    by deep-analyze (which already attached refs) but the caller did not re-declare
    them at the request level.
    """
    return TaskRequest(
        taskType=TaskType.GENERATE_POC,
        taskId="poc-test-claimrefs",
        context=Context(trusted={
            "claim": {
                "statement": "User input reaches popen() via run() helper.",
                "detail": "The run() helper wraps cmd.c_str() in popen. CN is concatenated into -subj.",
                "location": "main.cpp:35",
                "supportingEvidenceRefs": [
                    "eref-sast-flawfinder:shell/popen",
                    "eref-caller-create_ca",
                    "eref-file-main.cpp",
                ],
            },
            "projectId": "certmaker",
            "projectPath": "/tmp/project",
            "files": [
                {"path": "main.cpp", "content": "int run(const std::string& cmd){ return pclose(popen(cmd.c_str(), \"r\")); }"},
            ],
        }),
        evidenceRefs=[],
    )


def _make_poc_request_with_build_prep() -> TaskRequest:
    """buildPreparation alias carries concrete build metadata (no invention)."""
    return TaskRequest(
        taskType=TaskType.GENERATE_POC,
        taskId="poc-test-buildprep",
        context=Context(trusted={
            "claim": {
                "statement": "CWE-78 OS command injection via popen.",
                "detail": "User CN flows into openssl command without validation.",
                "location": "main.cpp:35",
                "supportingEvidenceRefs": ["eref-file-main.cpp"],
            },
            "projectId": "certmaker",
            "projectPath": "/tmp/project",
            "files": [{"path": "main.cpp", "content": "// stub"}],
            "buildPreparation": {
                "declaredMode": "native",
                "buildCommand": "bash /tmp/project/build-aegis-abc/aegis-build.sh",
                "buildScript": "build-aegis-abc/aegis-build.sh",
                "buildDir": "build-aegis-abc",
                "expectedArtifacts": [{"artifactType": "executable", "name": "certificate-maker"}],
                "producedArtifacts": [{"path": "build-aegis-abc/certificate-maker", "kind": "file"}],
            },
        }),
        evidenceRefs=[],
    )


@pytest.mark.asyncio
async def test_generate_poc_preserves_claim_supporting_evidence_refs(monkeypatch):
    """Phase A.1: refs from input claim pass sanitizer even when request.evidenceRefs is empty."""
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test", modelName="test-model", contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC], endpoint="http://localhost:8000", apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        # LLM uses one of the refs carried from input claim
        return _mock_llm_response(json.dumps({
            "summary": "PoC exercises popen via run() helper.",
            "claims": [{
                "statement": "PoC triggers popen via crafted CN.",
                "detail": "PoC injects CN that reaches popen.",
                "supportingEvidenceRefs": ["eref-sast-flawfinder:shell/popen", "eref-file-main.cpp"],
                "location": "main.cpp:35",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-sast-flawfinder:shell/popen"],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": ["Use execve with arg array"],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request_with_claim_refs_no_top_refs())

        assert result.status == "completed"
        # Refs from input claim must survive the sanitizer
        assert "eref-sast-flawfinder:shell/popen" in result.result.claims[0].supportingEvidenceRefs
        assert "eref-file-main.cpp" in result.result.claims[0].supportingEvidenceRefs
        # usedEvidenceRefs must also survive
        assert "eref-sast-flawfinder:shell/popen" in result.result.usedEvidenceRefs
        # Grounding ceiling (0.3) must be exceeded now that allowed_refs is non-empty
        assert result.result.confidenceBreakdown.grounding > 0.3
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_system_prompt_has_quote_awareness_and_self_check(monkeypatch):
    """Phase A.2: system prompt must contain shell-quoting and detection self-check sections."""
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test", modelName="test-model", contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC], endpoint="http://localhost:8000", apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    captured = {}

    async def fake_call(self, messages, *args, **kwargs):
        captured["messages"] = messages
        return _mock_llm_response(json.dumps({
            "summary": "ok",
            "claims": [{"statement": "s", "detail": "d", "supportingEvidenceRefs": ["eref-001"], "location": "x:1"}],
            "caveats": [], "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "low", "needsHumanReview": True,
            "recommendedNextSteps": [], "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        await tasks._handle_generate_poc(_make_poc_request())

        sys_msg = next(m["content"] for m in captured["messages"] if m["role"] == "system")
        assert "Shell quoting awareness" in sys_msg
        assert "Detection self-check" in sys_msg
        assert "Target metadata honesty" in sys_msg
        # concrete cues we want the LLM to learn
        assert "quote context" in sys_msg
        assert "side-effect" in sys_msg or "side effect" in sys_msg
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_injects_build_preparation_into_user_message(monkeypatch):
    """Phase A.3: buildPreparation alias must appear in user message so LLM does not invent."""
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test", modelName="test-model", contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC], endpoint="http://localhost:8000", apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    captured = {}

    async def fake_call(self, messages, *args, **kwargs):
        captured["messages"] = messages
        return _mock_llm_response(json.dumps({
            "summary": "ok",
            "claims": [{"statement": "s", "detail": "d", "supportingEvidenceRefs": ["eref-file-main.cpp"], "location": "main.cpp:35"}],
            "caveats": [], "usedEvidenceRefs": ["eref-file-main.cpp"],
            "suggestedSeverity": "high", "needsHumanReview": True,
            "recommendedNextSteps": [], "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        await tasks._handle_generate_poc(_make_poc_request_with_build_prep())

        user_msg = next(m["content"] for m in captured["messages"] if m["role"] == "user")
        assert "Build metadata" in user_msg
        assert "bash /tmp/project/build-aegis-abc/aegis-build.sh" in user_msg
        assert "native" in user_msg
        assert "build-aegis-abc" in user_msg
        # expectedArtifacts name must be surfaced
        assert "certificate-maker" in user_msg
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_fp_heuristic_warns_on_single_quoted_injection(monkeypatch):
    """Phase B: H2 — payload with ; inside '...' without breakout triggers caveat."""
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test", modelName="test-model", contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC], endpoint="http://localhost:8000", apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        # Mimic the failure mode S3 shipped on 2026-04-20: single-quote-wrapped CN with ; injection
        return _mock_llm_response(json.dumps({
            "summary": "PoC via crafted CN",
            "claims": [{
                "statement": "CN injection to popen",
                "detail": (
                    "## PoC 코드\n```python\n"
                    "# openssl is invoked as: -subj '/CN=test; echo PWNED_1234'\n"
                    "payload_inputs = ['1', '/tmp/x', 'test; echo PWNED_1234', '3650']\n"
                    "```\n"
                ),
                "supportingEvidenceRefs": ["eref-001"],
                "location": "main.cpp:35",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        joined = " ".join(result.result.caveats)
        assert "[auto-detected FP risk]" in joined
        assert "single-quoted" in joined or "single quote" in joined
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_fp_heuristic_warns_on_canary_echo_collision(monkeypatch):
    """Phase B: H1 — canary present in both detection logic AND input payload triggers caveat."""
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test", modelName="test-model", contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC], endpoint="http://localhost:8000", apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response(json.dumps({
            "summary": "PoC",
            "claims": [{
                "statement": "Command injection",
                "detail": (
                    "```python\n"
                    "payload = 'inject_VULNERABLE_FOUND_marker'\n"
                    "if 'VULNERABLE_FOUND' in stdout:\n"
                    "    print('SUCCESS')\n"
                    "```\n"
                ),
                "supportingEvidenceRefs": ["eref-001"],
                "location": "main.cpp:35",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        joined = " ".join(result.result.caveats)
        assert "[auto-detected FP risk]" in joined
        assert "canary" in joined.lower()
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_fp_heuristic_does_not_trigger_on_clean_poc(monkeypatch):
    """Phase B backward-compat: a properly-structured PoC produces no auto caveats."""
    original_mode = settings.llm_mode
    monkeypatch.setattr(tasks._model_registry, "get_default", lambda: ModelProfile(
        profileId="test", modelName="test-model", contextLimit=8192,
        allowedTaskTypes=[TaskType.GENERATE_POC], endpoint="http://localhost:8000", apiKey="",
    ))
    object.__setattr__(settings, "llm_mode", "real")

    async def fake_call(self, *args, **kwargs):
        return _mock_llm_response(json.dumps({
            "summary": "PoC",
            "claims": [{
                "statement": "Side-effect based detection",
                "detail": (
                    "```python\n"
                    "import os, uuid\n"
                    "nonce = uuid.uuid4().hex\n"
                    "# inject CN that escapes single quotes: test' && touch /tmp/pwned.$nonce && echo '\n"
                    "payload = f\"test' && touch /tmp/pwned.{nonce} && echo '\"\n"
                    "# detection: file existence\n"
                    "assert os.path.exists(f'/tmp/pwned.{nonce}')\n"
                    "```\n"
                ),
                "supportingEvidenceRefs": ["eref-001"],
                "location": "main.cpp:35",
            }],
            "caveats": ["PoC relies on /tmp writeability"],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "critical",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        auto_caveats = [c for c in result.result.caveats if "[auto-detected FP risk]" in c]
        assert auto_caveats == [], f"unexpected auto caveats: {auto_caveats}"
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_create_task_routes_deep_analyze_without_poc(monkeypatch):
    calls = {"deep": 0, "poc": 0}

    async def fake_deep(_request):
        calls["deep"] += 1
        return _success_response(TaskType.DEEP_ANALYZE)

    async def fake_poc(_request):
        calls["poc"] += 1
        return _success_response(TaskType.GENERATE_POC)

    monkeypatch.setattr(tasks, "_handle_deep_analyze", fake_deep)
    monkeypatch.setattr(tasks, "_handle_generate_poc", fake_poc)

    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="analysis-001",
        context=Context(trusted={"projectPath": "/tmp/project"}),
    )
    response = await tasks.create_task(request, Request({"type": "http", "headers": []}))

    assert response.status_code == 200
    assert calls == {"deep": 1, "poc": 0}
