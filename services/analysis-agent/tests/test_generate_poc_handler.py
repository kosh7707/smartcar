from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from starlette.requests import Request

from app.agent_runtime.errors import LlmTimeoutError, StrictJsonContractError
from app.registry.model_registry import ModelProfile
from app.routers import generate_poc_handler, tasks
from app.schemas.request import Constraints, Context, EvidenceRef, TaskRequest
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


def test_generate_poc_async_poll_deadline_uses_explicit_advisory_timeout():
    request = _make_poc_request()
    assert (
        generate_poc_handler._generate_poc_async_poll_deadline_seconds(request)
        == settings.llm_async_poll_deadline_ms / 1000
    )

    base = _make_poc_request()
    explicit = TaskRequest(
        taskType=base.taskType,
        taskId=base.taskId,
        context=base.context,
        evidenceRefs=base.evidenceRefs,
        constraints=Constraints(maxTokens=6000, timeoutMs=600000),
    )
    assert generate_poc_handler._generate_poc_async_poll_deadline_seconds(explicit) == 595.0


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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
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
                    "detail": "## Input analysis\n- Argument context: user-controlled field",
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
                    "detail": "## Input analysis\n- Argument context: user-controlled field",
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
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
async def test_generate_poc_schema_repair_scaffold_restores_required_shape(monkeypatch):
    """Regression: repair retry must not preserve summary+claims-only invalid shape."""
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
            "summary": "PoC summary without required Assessment fields.",
            "claims": [{
                "statement": "CN input reaches popen.",
                "detail": "The vulnerable path shells out through popen.",
            }],
        },
        {
            # Simulates the hot-test failure: the LLM repair expands detail but
            # keeps the same invalid summary+claims-only shape. S3 must preserve
            # its deterministic scaffold instead of accepting this shape.
            "summary": "Expanded PoC summary but still missing required keys.",
            "claims": [{
                "statement": "CN input reaches popen.",
                "detail": "Expanded narrative PoC detail without refs or location.",
            }],
        },
    ]
    calls = {"count": 0}

    async def fake_call(self, *args, **kwargs):
        payload = responses[min(calls["count"], len(responses) - 1)]
        calls["count"] += 1
        return _mock_llm_response(json.dumps(payload))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert calls["count"] == 2
        assert result.audit.retryCount == 1
        assert isinstance(result.result.caveats, list)
        assert result.result.usedEvidenceRefs == ["eref-001"]
        assert result.result.suggestedSeverity == "medium"
        assert result.result.needsHumanReview is True
        assert result.result.recommendedNextSteps == []
        assert "structured_finalizer" in result.result.policyFlags
        assert result.result.claims[0].location == "src/http_client.cpp:62"
        assert result.result.claims[0].supportingEvidenceRefs == ["eref-001"]
        assert "Expanded narrative PoC detail" in result.result.claims[0].detail
        assert result.validation.valid is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.parametrize(
    "first_content",
    [
        pytest.param("not-json", id="non_json_initial_response"),
        pytest.param(json.dumps({
            "summary": "PoC summary without required Assessment fields.",
            "claims": [{
                "statement": "CN input reaches popen.",
                "detail": "The vulnerable path shells out through popen.",
            }],
        }), id="schema_invalid_initial_response"),
    ],
)
@pytest.mark.asyncio
async def test_generate_poc_classifies_schema_repair_strict_json_failure(monkeypatch, first_content):
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
    calls = {"count": 0}

    async def fake_call(self, *args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            return _mock_llm_response(first_content)
        raise StrictJsonContractError(
            async_request_id="acr-repair",
            gateway_request_id="req-repair",
            error_detail="schema repair produced invalid json",
        )

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert calls["count"] == 2
        assert result.validation.valid is True
        assert not hasattr(result, "failureCode")
        assert result.result.pocOutcome == "poc_inconclusive"
        assert result.result.recoveryTrace[0].deficiency == "SCHEMA_DEFICIENT"
        assert result.result.recoveryTrace[0].action == "schema_repair_call_failed"
        assert result.audit.retryCount == 1
        detail = result.result.recoveryTrace[0].detail or ""
        assert "strict_json_contract_violation" in detail
        assert "acr-repair" in detail
        assert "req-repair" in detail
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_retries_strict_json_contract_violation(monkeypatch):
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
    calls = {"count": 0}

    async def fake_call(self, *args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise StrictJsonContractError(
                async_request_id="acr-strict-1",
                error_detail="model returned invalid json",
            )
        return _mock_llm_response(json.dumps({
            "summary": "PoC after strict-json retry.",
            "claims": [{
                "statement": "PoC proves command injection.",
                "detail": "The retry returns valid JSON.",
                "supportingEvidenceRefs": ["eref-001"],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": [],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert calls["count"] == 2
        assert result.audit.retryCount == 1
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_strict_json_contract_violation_after_retry(monkeypatch):
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
        raise StrictJsonContractError(
            async_request_id="acr-strict-2",
            gateway_request_id="req-gw-2",
            error_detail="still invalid",
        )

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert result.result.pocOutcome == "poc_inconclusive"
        assert result.result.recoveryTrace[0].deficiency == "LLM_OUTPUT_DEFICIENT"
        assert result.audit.retryCount == 1
        detail = result.result.recoveryTrace[0].detail or ""
        assert "strict_json_contract_violation" in detail
        assert "acr-strict-2" in detail
        assert "req-gw-2" in detail
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_generic_initial_llm_failure_as_completed_outcome(monkeypatch):
    """Unknown LLM/output failures should not escape as task failure for valid input."""
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
        raise RuntimeError("client decoded no usable model output")

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert not hasattr(result, "failureCode")
        assert result.result.pocOutcome == "poc_inconclusive"
        assert result.result.cleanPass is False
        assert result.result.recoveryTrace[0].deficiency == "LLM_OUTPUT_DEFICIENT"
        assert result.result.recoveryTrace[0].action == "llm_call_failed"
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_llm_timeout_as_completed_inconclusive(monkeypatch):
    """A live-runtime LLM budget miss should still return a schema-valid completed envelope."""
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
        raise LlmTimeoutError("async poll deadline exceeded")

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert not hasattr(result, "failureCode")
        assert result.result.pocOutcome == "poc_inconclusive"
        assert result.result.cleanPass is False
        assert result.result.recoveryTrace[0].deficiency == "LLM_TIMEOUT_RECOVERED"
        assert result.result.evaluationVerdict.taskCompleted is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_generic_strict_retry_failure_as_completed_outcome(monkeypatch):
    """Strict-json retry transport/output deficiency should become completed inconclusive."""
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
    calls = {"count": 0}

    async def fake_call(self, *args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            raise StrictJsonContractError(
                async_request_id="acr-strict-unknown",
                error_detail="initial strict-json violation",
            )
        raise RuntimeError("retry returned no usable model output")

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert calls["count"] == 2
        assert not hasattr(result, "failureCode")
        assert result.result.pocOutcome == "poc_inconclusive"
        assert result.result.recoveryTrace[0].deficiency == "LLM_OUTPUT_DEFICIENT"
        assert result.result.recoveryTrace[0].action == "strict_json_retry_failed"
        assert result.audit.retryCount == 1
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_scaffold_does_not_use_mismatched_request_refs(monkeypatch):
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
            "summary": "PoC summary without evidence refs.",
            "claims": [{"statement": "s", "detail": "d"}],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request_without_claim_refs_or_location_mismatched_request_ref())

        assert result.status == "validation_failed"
        assert result.failureCode == "INVALID_SCHEMA"
        assert "context.trusted.claim" in result.failureDetail
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_schema_valid_evidence_empty_output(monkeypatch):
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert result.validation.valid is True
        assert result.result.pocOutcome == "poc_rejected"
        assert result.result.qualityOutcome == "rejected"
        assert result.result.recoveryTrace[0].deficiency == "REFS_OR_GROUNDING_DEFICIENT"
        assert "claims[0].supportingEvidenceRefs가 비어 있음" in (result.result.recoveryTrace[0].detail or "")
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_hallucinated_refs_after_sanitization(monkeypatch):
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert result.validation.valid is True
        assert result.result.pocOutcome == "poc_rejected"
        assert result.result.recoveryTrace[0].deficiency == "REFS_OR_GROUNDING_DEFICIENT"
        assert "eref-hallucinated" in (result.result.recoveryTrace[0].detail or "")
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert seen["prefer_async_ownership"] is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_verdict_reports_actual_quality_outcome(monkeypatch):
    """Quality caveats must not be reported as a clean accepted gate."""
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
            "summary": "PoC requires analyst review.",
            "claims": [{
                "statement": "PoC demonstrates command injection.",
                "detail": "PoC detail with non-destructive reproduction steps.",
                "supportingEvidenceRefs": ["eref-001"],
                "location": "src/http_client.cpp:62",
            }],
            "caveats": ["Binary path must be checked in the caller environment."],
            "usedEvidenceRefs": ["eref-001"],
            "suggestedSeverity": "high",
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert result.result.qualityOutcome == "accepted_with_caveats"
        assert result.result.cleanPass is False
        assert "quality:accepted_with_caveats" in result.result.evaluationVerdict.gateOutcomes
        assert "analysis, quality, and PoC gates accepted" not in result.result.evaluationVerdict.reasons
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_repairs_unstructured_output_with_scaffold(monkeypatch):
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert result.audit.retryCount == 1
        assert result.result.usedEvidenceRefs == ["eref-001"]
        assert result.result.claims[0].supportingEvidenceRefs == ["eref-001"]
        assert result.result.claims[0].location == "src/http_client.cpp:62"
        assert "structured_finalizer" in result.result.policyFlags
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_generate_poc_classifies_zero_claim_json(monkeypatch):
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        result = await tasks._handle_generate_poc(_make_poc_request())

        assert result.status == "completed"
        assert result.validation.valid is True
        assert result.result.pocOutcome == "poc_rejected"
        assert result.result.recoveryTrace[0].deficiency == "POC_DEFICIENT"
        assert "최소 1개" in (result.result.recoveryTrace[0].detail or "")
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
                "location": "src/main.c:12",
                "supportingEvidenceRefs": [
                    "eref-sast-flawfinder:shell/popen",
                    "eref-caller-create_ca",
                    "eref-file-main.cpp",
                ],
            },
            "projectId": "demo-project",
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
                "statement": "Generated PoC uses provided build metadata.",
                "detail": "The PoC should cite the build metadata without inventing artifact paths.",
                "location": "src/main.c:12",
                "supportingEvidenceRefs": ["eref-file-main.cpp"],
            },
            "projectId": "demo-project",
            "projectPath": "/tmp/project",
            "files": [{"path": "src/main.c", "content": "// stub"}],
            "buildPreparation": {
                "declaredMode": "native",
                "buildCommand": "bash /tmp/project/build-output/aegis-build.sh",
                "buildScript": "build-output/aegis-build.sh",
                "buildDir": "build-output",
                "expectedArtifacts": [{"artifactType": "executable", "name": "demo-tool"}],
                "producedArtifacts": [{"path": "build-output/demo-tool", "kind": "file"}],
            },
        }),
        evidenceRefs=[],
    )


def _make_poc_request_without_claim_refs_or_location_mismatched_request_ref() -> TaskRequest:
    return TaskRequest(
        taskType=TaskType.GENERATE_POC,
        taskId="poc-test-mismatch",
        context=Context(trusted={
            "claim": {
                "statement": "User-controlled URL reaches popen() leading to RCE",
                "detail": "The URL is shell-expanded before reaching popen().",
            },
            "projectId": "gateway-webserver",
            "projectPath": "/tmp/project",
            "files": [
                {"path": "src/http_client.cpp", "content": "int x(){ return popen(url, \"r\") != NULL; }"},
            ],
        }),
        evidenceRefs=[
            EvidenceRef(
                refId="eref-unrelated",
                artifactId="art-001",
                artifactType="binary",
                locatorType="file",
                locator={"file": "other.cpp", "startLine": 1, "endLine": 2},
            ),
        ],
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
                "location": "src/main.c:12",
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

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
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
            "claims": [{"statement": "s", "detail": "d", "supportingEvidenceRefs": ["eref-file-main.cpp"], "location": "src/main.c:12"}],
            "caveats": [], "usedEvidenceRefs": ["eref-file-main.cpp"],
            "suggestedSeverity": "high", "needsHumanReview": True,
            "recommendedNextSteps": [], "policyFlags": [],
        }))

    async def fake_aclose(self):
        return None

    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)
    try:
        await tasks._handle_generate_poc(_make_poc_request_with_build_prep())

        user_msg = next(m["content"] for m in captured["messages"] if m["role"] == "user")
        assert "Build metadata" in user_msg
        assert "bash /tmp/project/build-output/aegis-build.sh" in user_msg
        assert "native" in user_msg
        assert "build-output" in user_msg
        # expectedArtifacts name must be surfaced
        assert "demo-tool" in user_msg
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
