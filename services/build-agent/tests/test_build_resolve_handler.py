from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.config import settings
from app.routers.build_resolve_handler import handle_build_resolve
from app.schemas.request import Context, TaskRequest
from app.types import TaskType


@pytest.mark.asyncio
async def test_build_resolve_requests_async_ownership_on_toolless_turn(monkeypatch, tmp_path: Path):
    original_mode = settings.llm_mode
    object.__setattr__(settings, "llm_mode", "real")

    (tmp_path / "README.md").write_text("test project")

    request = TaskRequest(
        taskType=TaskType.BUILD_RESOLVE,
        taskId="build-async-001",
        contractVersion="build-resolve-v1",
        strictMode=True,
        context=Context(trusted={
            "projectPath": str(tmp_path),
            "buildTargetPath": ".",
                "buildTargetName": "test-project",
                "build": {"mode": "native"},
                "expectedArtifacts": [
                    {"kind": "file-set", "path": "build-aegis-default/aegis-build.sh"},
                ],
            }),
    )

    seen: dict[str, object] = {}

    async def fake_call(self, *args, **kwargs):
        seen["prefer_async_ownership"] = kwargs.get("prefer_async_ownership")
        from agent_shared.schemas.agent import LlmResponse
        return LlmResponse(
            content=json.dumps({
                "summary": "빌드 완료",
                "buildResult": {
                    "success": True,
                    "buildCommand": "bash build-aegis-default/aegis-build.sh",
                    "buildScript": "build-aegis-default/aegis-build.sh",
                    "buildDir": "build-aegis-default",
                    "declaredMode": "native",
                    "sdkId": None,
                    "producedArtifacts": ["build-aegis-default/aegis-build.sh"],
                },
                "claims": [{"statement": "Mock 빌드 완료", "supportingEvidenceRefs": []}],
                "caveats": [],
                "usedEvidenceRefs": [],
                "needsHumanReview": False,
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
    monkeypatch.setattr(
        "app.core.result_assembler.ResultAssembler._has_build_success_evidence",
        lambda self, session: True,
    )
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("agent_shared.llm.caller.LlmCaller.aclose", fake_aclose)

    try:
        result = await handle_build_resolve(request)
        assert result.status == "completed"
        assert seen["prefer_async_ownership"] is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)
