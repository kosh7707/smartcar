"""TerminationPolicy 단위 테스트."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from agent_shared.schemas.agent import BudgetState, LlmResponse, TurnRecord
from app.core.agent_session import AgentSession
from app.policy.termination import TerminationPolicy
from app.schemas.request import Context, TaskRequest
from app.types import TaskType


def _make_session(budget: BudgetState | None = None) -> AgentSession:
    """테스트용 AgentSession 생성 헬퍼."""
    req = TaskRequest(
        taskType=TaskType.BUILD_RESOLVE,
        taskId="test-task-001",
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


def _add_turns(session: AgentSession, n: int) -> None:
    """빈 턴을 n개 기록."""
    for _ in range(n):
        session.record_content_turn(LlmResponse(prompt_tokens=0, completion_tokens=0))


# ── 기본 동작 ──────────────────────────────────────────────


def test_no_stop_fresh() -> None:
    """새 세션은 종료되지 않는다."""
    session = _make_session()
    policy = TerminationPolicy(timeout_ms=300_000)
    assert policy.should_stop(session) is False


# ── max_steps ──────────────────────────────────────────────


def test_stop_max_steps() -> None:
    """turn_count >= max_steps → should_stop=True, reason='max_steps'."""
    session = _make_session()
    _add_turns(session, session.budget.max_steps)
    policy = TerminationPolicy(timeout_ms=300_000)
    assert policy.should_stop(session) is True
    assert session.termination_reason == "max_steps"


# ── budget_exhausted ────────────────────────────────────────


def test_stop_budget_exhausted() -> None:
    """completion tokens 초과 → reason='budget_exhausted'."""
    session = _make_session()
    session.budget.total_completion_tokens = session.budget.max_completion_tokens
    policy = TerminationPolicy(timeout_ms=300_000)
    assert policy.should_stop(session) is True
    assert session.termination_reason == "budget_exhausted"


# ── timeout ─────────────────────────────────────────────────


def test_stop_timeout() -> None:
    """경과 시간이 timeout을 초과하면 reason='timeout'."""
    session = _make_session()
    policy = TerminationPolicy(timeout_ms=100)
    # elapsed_ms()를 mock하여 200ms 반환
    with patch.object(type(session), "elapsed_ms", return_value=200):
        assert policy.should_stop(session) is True
    assert session.termination_reason == "timeout"


# ── no_new_evidence ─────────────────────────────────────────


def test_stop_no_new_evidence() -> None:
    """연속 무증거 턴이 임계값 이상 → reason='no_new_evidence'."""
    session = _make_session()
    session.budget.consecutive_no_evidence_turns = session.budget.max_consecutive_no_evidence
    policy = TerminationPolicy(timeout_ms=300_000)
    assert policy.should_stop(session) is True
    assert session.termination_reason == "no_new_evidence"


# ── all_tiers_exhausted ────────────────────────────────────


def test_stop_all_tiers_exhausted() -> None:
    """모든 tier 소진 → reason='all_tiers_exhausted'."""
    session = _make_session()
    session.budget.cheap_calls = session.budget.max_cheap_calls
    session.budget.medium_calls = session.budget.max_medium_calls
    session.budget.expensive_calls = session.budget.max_expensive_calls
    policy = TerminationPolicy(timeout_ms=300_000)
    assert policy.should_stop(session) is True
    assert session.termination_reason == "all_tiers_exhausted"


# ── reason 기록 확인 ──────────────────────────────────────


def test_reason_stored_in_session() -> None:
    """should_stop 호출 후 session.termination_reason이 설정되어야 한다."""
    session = _make_session()
    session.budget.total_steps = session.budget.max_steps
    _add_turns(session, session.budget.max_steps)
    policy = TerminationPolicy(timeout_ms=300_000)
    policy.should_stop(session)
    assert session.termination_reason != ""
    assert session.termination_reason == "max_steps"
