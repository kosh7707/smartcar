import json
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.core.phase_one_types import Phase1Result
from app.routers.deep_analyze_handler import _configure_phase2_graph_tools, handle_deep_analyze
from app.schemas.request import Context, TaskRequest
from app.types import TaskType
from app.agent_runtime.tools.registry import ToolRegistry, ToolSchema


def _register_graph_tools(registry: ToolRegistry) -> None:
    for name in ("code_graph.callers", "code_graph.callees", "code_graph.search"):
        registry.register(ToolSchema(name=name, description=name))


class _Tool:
    def __init__(self):
        self.project_id = None

    def set_project_id(self, project_id: str) -> None:
        self.project_id = project_id


def test_configure_phase2_graph_tools_removes_unready_graph_search():
    registry = ToolRegistry()
    _register_graph_tools(registry)
    callers = _Tool()
    callees = _Tool()
    search = _Tool()

    phase1 = Phase1Result(
        code_graph_neo4j_ready=True,
        code_graph_graph_rag_ready=False,
    )

    _configure_phase2_graph_tools(
        registry,
        phase1,
        "proj-1",
        callers_tool=callers,
        callees_tool=callees,
        search_tool=search,
    )

    assert registry.get("code_graph.callers") is not None
    assert registry.get("code_graph.callees") is not None
    assert registry.get("code_graph.search") is None
    assert callers.project_id == "proj-1"
    assert callees.project_id == "proj-1"
    assert search.project_id is None


def test_configure_phase2_graph_tools_removes_all_graph_tools_when_neo4j_not_ready():
    registry = ToolRegistry()
    _register_graph_tools(registry)
    callers = _Tool()
    callees = _Tool()
    search = _Tool()

    phase1 = Phase1Result(
        code_graph_neo4j_ready=False,
        code_graph_graph_rag_ready=False,
    )

    _configure_phase2_graph_tools(
        registry,
        phase1,
        "proj-1",
        callers_tool=callers,
        callees_tool=callees,
        search_tool=search,
    )

    assert registry.get("code_graph.callers") is None
    assert registry.get("code_graph.callees") is None
    assert registry.get("code_graph.search") is None


@pytest.mark.asyncio
async def test_handle_deep_analyze_requests_async_ownership_on_toolless_turn(monkeypatch):
    original_mode = settings.llm_mode
    object.__setattr__(settings, "llm_mode", "real")

    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="deep-async-001",
        context=Context(trusted={
            "objective": "test",
            "projectPath": "/tmp/project",
            "projectId": "proj-1",
        }),
    )

    seen: dict[str, object] = {}

    async def fake_phase1_execute(self, session):
        return Phase1Result()

    async def fake_phase1_aclose(self):
        seen["phase1_closed"] = True

    async def fake_call(self, *args, **kwargs):
        seen["prefer_async_ownership"] = kwargs.get("prefer_async_ownership")
        from app.agent_runtime.schemas.agent import LlmResponse
        return LlmResponse(
            content=json.dumps({
                "summary": "Deep analysis completed",
                "claims": [],
                "caveats": [],
                "usedEvidenceRefs": [],
                "suggestedSeverity": "info",
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
        "app.agent_runtime.tools.registry.ToolRegistry.get_available_schemas",
        lambda self, budget_manager: None,
    )
    monkeypatch.setattr("app.core.phase_one.Phase1Executor.execute", fake_phase1_execute)
    monkeypatch.setattr("app.core.phase_one.Phase1Executor.aclose", fake_phase1_aclose)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.call", fake_call)
    monkeypatch.setattr("app.agent_runtime.llm.caller.LlmCaller.aclose", fake_aclose)

    model_registry = MagicMock()
    model_registry.get_default.return_value = MagicMock(
        endpoint="http://localhost:8000",
        modelName="test-model",
        apiKey="",
    )

    try:
        result = await handle_deep_analyze(request, model_registry)
        assert result.status == "completed"
        assert seen["prefer_async_ownership"] is True
        assert seen["phase1_closed"] is True
    finally:
        object.__setattr__(settings, "llm_mode", original_mode)
