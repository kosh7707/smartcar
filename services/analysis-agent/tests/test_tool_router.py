"""ToolRouter 단위 테스트."""

from unittest.mock import MagicMock

import pytest

from app.budget.manager import BudgetManager
from app.policy.tool_failure import ToolFailurePolicy
from app.agent_runtime.schemas.agent import BudgetState, ToolCallRequest, ToolCostTier
from app.agent_runtime.tools.executor import ToolExecutor
from app.agent_runtime.tools.hooks import HookResult, HookRunner
from app.tools.implementations.mock_tools import MockEchoTool, MockKnowledgeTool
from app.agent_runtime.tools.registry import ToolRegistry, ToolSchema
from app.tools.router import ToolRouter


def _make_router_with_budget(
    budget_overrides: dict | None = None,
    hook_runner: HookRunner | None = None,
) -> tuple[ToolRouter, BudgetManager]:
    registry = ToolRegistry()
    registry.register(ToolSchema(name="knowledge.search", description="test", cost_tier=ToolCostTier.CHEAP))
    registry.register(ToolSchema(name="echo", description="echo", cost_tier=ToolCostTier.CHEAP))

    budget = BudgetState(**(budget_overrides or {}))
    bm = BudgetManager(budget)
    executor = ToolExecutor(timeout_ms=5000)
    failure_policy = ToolFailurePolicy()

    router = ToolRouter(registry, executor, bm, failure_policy, hook_runner=hook_runner)
    router.register_implementation("knowledge.search", MockKnowledgeTool())
    router.register_implementation("echo", MockEchoTool())
    return router, bm


def _make_router(budget_overrides: dict | None = None) -> ToolRouter:
    router, _ = _make_router_with_budget(budget_overrides)
    return router


def _make_session():
    session = MagicMock()
    session.turn_count = 1
    session.trace = []
    return session


class _DenyPreHook:
    def pre_tool_use(self, name: str, args: dict) -> HookResult:
        return HookResult.denied("blocked by test pre hook")

    def post_tool_use(self, name: str, args: dict, output: str, is_error: bool) -> HookResult:
        return HookResult.allowed()


class _DenyPostHook:
    def pre_tool_use(self, name: str, args: dict) -> HookResult:
        return HookResult.allowed()

    def post_tool_use(self, name: str, args: dict, output: str, is_error: bool) -> HookResult:
        return HookResult.denied("blocked by test post hook")


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


@pytest.mark.asyncio
async def test_evidence_resets_no_evidence_counter():
    router, bm = _make_router_with_budget()
    session = _make_session()
    bm.record_no_evidence_turn(turn=1)
    bm.record_no_evidence_turn(turn=2)

    results = await router.execute(
        [ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "CWE-78"})],
        session,
    )

    assert results[0].success is True
    assert bm.state.consecutive_no_evidence_turns == 0


@pytest.mark.asyncio
async def test_no_evidence_tool_increments_counter():
    router, bm = _make_router_with_budget()
    session = _make_session()

    results = await router.execute(
        [ToolCallRequest(id="c1", name="echo", arguments={"msg": "hello"})],
        session,
    )

    assert results[0].success is True
    assert bm.state.consecutive_no_evidence_turns == 1


@pytest.mark.asyncio
async def test_pre_hook_denial_skips_execution_budget_and_trace():
    hook_runner = HookRunner()
    hook_runner.register(_DenyPreHook())
    router, bm = _make_router_with_budget(hook_runner=hook_runner)
    session = _make_session()

    results = await router.execute(
        [ToolCallRequest(id="c1", name="echo", arguments={"msg": "hello"})],
        session,
    )

    assert results[0].success is False
    assert results[0].error == "hook_denied"
    assert "blocked by test pre hook" in results[0].content
    assert bm.state.total_steps == 0
    assert bm.state.cheap_calls == 0
    assert session.trace == []


@pytest.mark.asyncio
async def test_post_hook_denial_marks_result_failed_and_records_trace():
    hook_runner = HookRunner()
    hook_runner.register(_DenyPostHook())
    router, bm = _make_router_with_budget(hook_runner=hook_runner)
    session = _make_session()

    results = await router.execute(
        [ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "CWE-78"})],
        session,
    )

    assert results[0].success is False
    assert results[0].error == "hook_denied_post"
    assert "blocked by test post hook" in results[0].content
    assert bm.state.total_steps == 1
    assert len(session.trace) == 1
    assert session.trace[0].success is False
