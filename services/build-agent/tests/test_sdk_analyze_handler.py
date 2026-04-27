from __future__ import annotations

import json

import pytest

from app.config import settings
from app.routers.sdk_analyze_handler import handle_sdk_analyze
from app.schemas.request import Context, TaskRequest
from app.types import TaskType


@pytest.mark.asyncio
async def test_sdk_analyze_requests_async_ownership_on_toolless_turn(monkeypatch, tmp_path):
    original_mode = settings.llm_mode
    object.__setattr__(settings, "llm_mode", "real")

    request = TaskRequest(
        taskType=TaskType.SDK_ANALYZE,
        taskId="sdk-async-001",
        context=Context(trusted={"projectPath": str(tmp_path)}),
    )

    seen: dict[str, object] = {}

    async def fake_call(self, *args, **kwargs):
        seen["prefer_async_ownership"] = kwargs.get("prefer_async_ownership")
        from app.agent_runtime.schemas.agent import LlmResponse
        return LlmResponse(
            content=json.dumps({
                "summary": "SDK 분석 완료",
                "sdkProfile": {
                    "compiler": "mock-gcc",
                    "compilerPrefix": "mock",
                    "gccVersion": "0.0.0",
                    "targetArch": "mock-arch",
                    "languageStandard": "c11",
                    "sysroot": "",
                    "environmentSetup": "",
                    "includePaths": [],
                    "defines": {},
                },
                "claims": [{"statement": "Mock SDK 분석 완료", "supportingEvidenceRefs": []}],
                "caveats": [],
                "usedEvidenceRefs": [],
                "needsHumanReview": True,
                "recommendedNextSteps": [],
                "policyFlags": [],
            }),
            prompt_tokens=10,
            completion_tokens=20,
        )

    async def fake_aclose(self):
        return None

    monkeypatch.setattr(
        "app.budget.manager.BudgetManager.no_callable_tools_remaining",
        lambda self: True,
    )
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)

    try:
        result = await handle_sdk_analyze(request)
        assert result.status == "completed"
        assert seen["prefer_async_ownership"] is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)


@pytest.mark.asyncio
async def test_sdk_analyze_rejects_relative_project_path():
    request = TaskRequest(
        taskType=TaskType.SDK_ANALYZE,
        taskId="sdk-invalid-relative",
        context=Context(trusted={"projectPath": "../sdk"}),
    )

    result = await handle_sdk_analyze(request)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "absolute path" in result.failureDetail


@pytest.mark.asyncio
async def test_sdk_analyze_rejects_missing_project_directory(tmp_path):
    request = TaskRequest(
        taskType=TaskType.SDK_ANALYZE,
        taskId="sdk-invalid-missing",
        context=Context(trusted={"projectPath": str(tmp_path / "missing-sdk")}),
    )

    result = await handle_sdk_analyze(request)

    assert result.status == "validation_failed"
    assert result.failureCode == "INVALID_SCHEMA"
    assert "exist and be a directory" in result.failureDetail
