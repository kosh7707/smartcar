"""ToolRouter 단위 테스트."""

from unittest.mock import MagicMock

import pytest

from app.budget.manager import BudgetManager
from app.policy.tool_failure import ToolFailurePolicy
from app.schemas.agent import BudgetState, ToolCallRequest, ToolCostTier
from app.tools.executor import ToolExecutor
from app.tools.implementations.mock_tools import MockEchoTool, MockKnowledgeTool
from app.tools.registry import ToolRegistry, ToolSchema
from app.tools.router import ToolRouter


def _make_router(budget_overrides: dict | None = None) -> ToolRouter:
    registry = ToolRegistry()
    registry.register(ToolSchema(name="knowledge.search", description="test", cost_tier=ToolCostTier.CHEAP))
    registry.register(ToolSchema(name="echo", description="echo", cost_tier=ToolCostTier.CHEAP))

    budget = BudgetState(**(budget_overrides or {}))
    bm = BudgetManager(budget)
    executor = ToolExecutor(timeout_ms=5000)
    failure_policy = ToolFailurePolicy()

    router = ToolRouter(registry, executor, bm, failure_policy)
    router.register_implementation("knowledge.search", MockKnowledgeTool())
    router.register_implementation("echo", MockEchoTool())
    return router


def _make_session():
    session = MagicMock()
    session.turn_count = 1
    session.trace = []
    return session


@pytest.mark.asyncio
async def test_successful_dispatch():
    router = _make_router()
    session = _make_session()
    calls = [ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})]
    results = await router.execute(calls, session)
    assert len(results) == 1
    assert results[0].success is True
    assert "CWE-78" in results[0].content


@pytest.mark.asyncio
async def test_unknown_tool_returns_error():
    router = _make_router()
    session = _make_session()
    calls = [ToolCallRequest(id="call_1", name="nonexistent", arguments={})]
    results = await router.execute(calls, session)
    assert results[0].success is False
    assert "Unknown tool" in results[0].content


@pytest.mark.asyncio
async def test_duplicate_call_blocked():
    router = _make_router()
    session = _make_session()
    call = ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})
    # First call
    results1 = await router.execute([call], session)
    assert results1[0].success is True
    # Second call with same args
    call2 = ToolCallRequest(id="call_2", name="knowledge.search", arguments={"query": "CWE-78"})
    results2 = await router.execute([call2], session)
    assert results2[0].success is False
    assert "Duplicate" in results2[0].content


@pytest.mark.asyncio
async def test_tier_budget_enforced():
    router = _make_router({"max_cheap_calls": 1})
    session = _make_session()
    call1 = ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "a"})
    call2 = ToolCallRequest(id="c2", name="echo", arguments={"x": "b"})
    await router.execute([call1], session)
    results = await router.execute([call2], session)
    assert results[0].success is False
    assert "Budget exhausted" in results[0].content


@pytest.mark.asyncio
async def test_no_implementation_returns_failure():
    registry = ToolRegistry()
    registry.register(ToolSchema(name="orphan", description="no impl"))
    bm = BudgetManager(BudgetState())
    router = ToolRouter(registry, ToolExecutor(), bm, ToolFailurePolicy())
    session = _make_session()
    results = await router.execute(
        [ToolCallRequest(id="c1", name="orphan", arguments={})],
        session,
    )
    assert results[0].success is False


@pytest.mark.asyncio
async def test_trace_recorded_in_session():
    router = _make_router()
    session = _make_session()
    calls = [ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "test"})]
    await router.execute(calls, session)
    assert len(session.trace) == 1
    assert session.trace[0].tool == "knowledge.search"
    assert session.trace[0].cost_tier == ToolCostTier.CHEAP


@pytest.mark.asyncio
async def test_multiple_tools_in_single_turn():
    router = _make_router()
    session = _make_session()
    calls = [
        ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "CWE-78"}),
        ToolCallRequest(id="c2", name="echo", arguments={"msg": "hello"}),
    ]
    results = await router.execute(calls, session)
    assert len(results) == 2
    assert all(r.success for r in results)
