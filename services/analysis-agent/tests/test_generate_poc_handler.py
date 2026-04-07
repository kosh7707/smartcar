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
