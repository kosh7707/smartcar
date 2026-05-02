"""ToolRouter 단위 테스트."""

from __future__ import annotations

import json

import pytest

from app.agent_runtime.schemas.agent import (
    BudgetState,
    ToolCallRequest,
    ToolCostTier,
    ToolResult,
)
from app.agent_runtime.tools.executor import ToolExecutor
from app.agent_runtime.tools.hooks import HookRunner
from app.agent_runtime.tools.registry import ToolRegistry, ToolSchema, ToolSideEffect
from app.budget.manager import BudgetManager
from app.core.agent_session import AgentSession
from app.policy.tool_failure import ToolFailurePolicy
from app.schemas.request import Context, TaskRequest
from app.tools.router import ToolRouter
from app.types import TaskType


# ── 헬퍼 ──────────────────────────────────────────────────


def _make_session(budget: BudgetState | None = None) -> AgentSession:
    req = TaskRequest(
        taskType=TaskType.BUILD_RESOLVE,
        taskId="test-router-001",
        context=Context(trusted={}),
    )
    return AgentSession(request=req, budget=budget or BudgetState(
        max_steps=10,
        max_completion_tokens=20000,
        max_cheap_calls=20,
        max_medium_calls=5,
        max_expensive_calls=5,
        max_consecutive_no_evidence=6,
    ))


def _make_call(name: str = "read_file", args: dict | None = None) -> ToolCallRequest:
    return ToolCallRequest(id="call-001", name=name, arguments=args or {"path": "/tmp/a.txt"})


class _FakeImpl:
    """성공적인 ToolResult를 반환하는 fake 구현체."""

    def __init__(self, evidence_refs: list[str] | None = None):
        self._refs = evidence_refs or []

    async def execute(self, arguments: dict) -> ToolResult:
        return ToolResult(
            tool_call_id="",
            name="",
            success=True,
            content='{"ok": true}',
            new_evidence_refs=self._refs,
        )


class _FailingImpl:
    """실패 ToolResult를 반환하는 fake 구현체."""

    async def execute(self, arguments: dict) -> ToolResult:
        return ToolResult(
            tool_call_id="",
            name="",
            success=False,
            content='{"error": "fail"}',
            error="some_error",
        )


class _TrackingImpl:
    def __init__(self) -> None:
        self.calls = 0

    async def execute(self, arguments: dict) -> ToolResult:
        self.calls += 1
        return ToolResult(
            tool_call_id="",
            name="",
            success=True,
            content='{"ok": true}',
        )


class _TrackingHook:
    def __init__(self) -> None:
        self.pre_calls = 0
        self.post_calls = 0

    def pre_tool_use(self, name: str, args: dict):
        self.pre_calls += 1
        from app.agent_runtime.tools.hooks import HookResult
        return HookResult.allowed()

    def post_tool_use(self, name: str, args: dict, output: str, is_error: bool):
        self.post_calls += 1
        from app.agent_runtime.tools.hooks import HookResult
        return HookResult.allowed()


def _build_router(
    budget: BudgetState | None = None,
    register_schema: bool = True,
    register_impl: bool = True,
    impl: object | None = None,
    tier: ToolCostTier = ToolCostTier.CHEAP,
    name: str = "read_file",
    side_effect: ToolSideEffect = ToolSideEffect.PURE,
    hook_runner: HookRunner | None = None,
) -> tuple[ToolRouter, BudgetManager, AgentSession]:
    bs = budget or BudgetState(
        max_steps=10,
        max_completion_tokens=20000,
        max_cheap_calls=20,
        max_medium_calls=5,
        max_expensive_calls=5,
        max_consecutive_no_evidence=6,
    )
    bm = BudgetManager(bs)
    registry = ToolRegistry()
    if register_schema:
        registry.register(ToolSchema(
            name=name,
            description="Read a file",
            parameters={"type": "object", "properties": {"path": {"type": "string"}}},
            cost_tier=tier,
            side_effect=side_effect,
        ))
    executor = ToolExecutor(timeout_ms=5000)
    failure_policy = ToolFailurePolicy()
    router = ToolRouter(registry, executor, bm, failure_policy, hook_runner=hook_runner)
    if register_impl:
        router.register_implementation(name, impl or _FakeImpl())
    session = _make_session(bs)
    return router, bm, session


# ── 미등록 tool ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_unknown_tool_rejected() -> None:
    """레지스트리에 없는 tool 호출 → error ToolResult."""
    router, _, session = _build_router()
    call = _make_call(name="nonexistent_tool", args={"x": 1})
    results = await router.execute([call], session)
    assert len(results) == 1
    assert results[0].success is False
    assert "Unknown tool" in results[0].content


# ── 중복 호출 차단 ──────────────────────────────────────


@pytest.mark.asyncio
async def test_duplicate_call_blocked() -> None:
    """동일 args_hash 두 번째 호출 → 차단."""
    router, bm, session = _build_router()
    call1 = _make_call()
    call2 = _make_call()  # 동일 name + args → 동일 args_hash
    # 첫 호출 성공
    r1 = await router.execute([call1], session)
    assert r1[0].success is True
    # 두 번째 호출은 중복 차단
    r2 = await router.execute([call2], session)
    assert r2[0].success is False
    assert "차단" in r2[0].content


# ── tier 예산 소진 ──────────────────────────────────────


@pytest.mark.asyncio
async def test_tier_budget_exhausted() -> None:
    """tier 예산 소진 후 호출 → error."""
    budget = BudgetState(
        max_steps=100,
        max_completion_tokens=20000,
        max_cheap_calls=1,
        max_medium_calls=5,
        max_expensive_calls=5,
        max_consecutive_no_evidence=6,
    )
    router, bm, session = _build_router(budget=budget)
    # 첫 호출로 cheap 소진
    call1 = _make_call(args={"path": "/a"})
    await router.execute([call1], session)
    # 두 번째 cheap 호출 시도 → 예산 소진
    call2 = _make_call(args={"path": "/b"})
    results = await router.execute([call2], session)
    assert results[0].success is False
    assert "Budget exhausted" in results[0].content


# ── 정상 디스패치 ──────────────────────────────────────


@pytest.mark.asyncio
async def test_successful_dispatch() -> None:
    """정상 디스패치 → success=True, 예산 기록."""
    router, bm, session = _build_router()
    call = _make_call()
    results = await router.execute([call], session)
    assert results[0].success is True
    assert bm.state.cheap_calls == 1
    assert bm.state.total_steps == 1


# ── evidence 카운터 리셋 ───────────────────────────────


@pytest.mark.asyncio
async def test_evidence_resets_counter() -> None:
    """new_evidence_refs가 있으면 no_evidence 카운터 리셋."""
    router, bm, session = _build_router(
        impl=_FakeImpl(evidence_refs=["ref-001"]),
    )
    # 먼저 no-evidence 카운터 올려놓기
    bm.record_no_evidence_turn(turn=1)
    bm.record_no_evidence_turn(turn=2)
    assert bm.state.consecutive_no_evidence_turns == 2
    # evidence가 있는 tool 실행 → 카운터 리셋
    call = _make_call()
    await router.execute([call], session)
    assert bm.state.consecutive_no_evidence_turns == 0


# ── evidence 없으면 카운터 증가 ───────────────────────


@pytest.mark.asyncio
async def test_no_evidence_increments() -> None:
    """new_evidence_refs가 비어있으면 no_evidence 카운터 +1."""
    router, bm, session = _build_router(impl=_FakeImpl(evidence_refs=[]))
    call = _make_call()
    await router.execute([call], session)
    assert bm.state.consecutive_no_evidence_turns == 1


# ── trace 기록 ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_trace_step_recorded() -> None:
    """실행 후 session.trace에 ToolTraceStep이 추가되어야 한다."""
    router, _, session = _build_router()
    call = _make_call()
    await router.execute([call], session)
    assert len(session.trace) == 1
    step = session.trace[0]
    assert step.tool == "read_file"
    assert step.success is True
    assert step.step_id == "step_01"


# ── 구현체 없음 ────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_implementation_returns_failure() -> None:
    """스키마는 있지만 구현체가 없으면 ToolFailurePolicy로 처리."""
    router, _, session = _build_router(register_impl=False)
    call = _make_call()
    results = await router.execute([call], session)
    assert results[0].success is False
    assert "No implementation" in results[0].content


@pytest.mark.asyncio
async def test_write_tool_success_clears_duplicate_hashes() -> None:
    """write side-effect 성공 후 동일 args_hash 재호출이 허용되어야 한다."""
    router, bm, session = _build_router(
        name="write_file",
        side_effect=ToolSideEffect.WRITE,
    )
    call1 = _make_call(name="write_file", args={"path": "/tmp/a.txt"})
    call2 = _make_call(name="write_file", args={"path": "/tmp/a.txt"})

    r1 = await router.execute([call1], session)
    assert r1[0].success is True
    assert bm.is_duplicate_call(call1.args_hash) is False

    r2 = await router.execute([call2], session)
    assert r2[0].success is True
    assert bm.state.total_steps == 2


@pytest.mark.asyncio
async def test_schema_violation_returns_error_without_execution_budget_or_trace() -> None:
    hook_runner = HookRunner()
    tracking_hook = _TrackingHook()
    hook_runner.register(tracking_hook)
    router, bm, session = _build_router(hook_runner=hook_runner)
    impl = _TrackingImpl()
    router.register_implementation("read_file", impl)

    call = _make_call(args={"path": 123})
    results = await router.execute([call], session)

    assert results[0].success is False
    assert results[0].error == "schema_violation"
    payload = json.loads(results[0].content)
    assert payload["tool"] == "read_file"
    assert payload["retryHint"]
    assert any("$.path" in violation for violation in payload["violations"])
    assert impl.calls == 0
    assert tracking_hook.pre_calls == 0
    assert tracking_hook.post_calls == 0
    assert bm.state.total_steps == 0
    assert bm.state.cheap_calls == 0
    assert bm.is_duplicate_call(call.args_hash) is False
    assert session.trace == []
