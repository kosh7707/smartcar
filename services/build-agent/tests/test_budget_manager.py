"""BudgetManager 단위 테스트."""

from __future__ import annotations

import pytest

from app.agent_runtime.schemas.agent import BudgetState, ToolCostTier
from app.budget.manager import BudgetManager


@pytest.fixture
def bm(budget_state: BudgetState) -> BudgetManager:
    return BudgetManager(budget_state)


# ── 초기 상태 ──────────────────────────────────────────────


def test_initial_state(bm: BudgetManager) -> None:
    """Fresh BudgetManager: 모든 카운터가 0이어야 한다."""
    snap = bm.snapshot()
    assert snap["steps"] == 0
    assert snap["tokens"] == 0
    assert snap["cheap"] == 0
    assert snap["medium"] == 0
    assert snap["expensive"] == 0


# ── record_tool_call ────────────────────────────────────────


def test_record_cheap_call(bm: BudgetManager) -> None:
    """CHEAP 호출 기록 시 cheap_calls 증가."""
    bm.record_tool_call(ToolCostTier.CHEAP, turn=1)
    assert bm.state.cheap_calls == 1
    assert bm.state.total_steps == 1


def test_record_expensive_call(bm: BudgetManager) -> None:
    """EXPENSIVE 호출 기록 시 expensive_calls 증가."""
    bm.record_tool_call(ToolCostTier.EXPENSIVE, turn=1)
    assert bm.state.expensive_calls == 1
    assert bm.state.total_steps == 1


def test_record_medium_call(bm: BudgetManager) -> None:
    """MEDIUM 호출 기록 시 medium_calls 증가."""
    bm.record_tool_call(ToolCostTier.MEDIUM, turn=1)
    assert bm.state.medium_calls == 1
    assert bm.state.total_steps == 1


# ── can_make_call ───────────────────────────────────────────


def test_can_make_call_within_budget(bm: BudgetManager) -> None:
    """예산 범위 내이면 True."""
    assert bm.can_make_call(ToolCostTier.CHEAP) is True
    assert bm.can_make_call(ToolCostTier.MEDIUM) is True
    assert bm.can_make_call(ToolCostTier.EXPENSIVE) is True


def test_can_make_call_exhausted(bm: BudgetManager) -> None:
    """예산 소진 시 False."""
    for _ in range(bm.state.max_cheap_calls):
        bm.record_tool_call(ToolCostTier.CHEAP)
    assert bm.can_make_call(ToolCostTier.CHEAP) is False


# ── duplicate detection ─────────────────────────────────────


def test_duplicate_detection(bm: BudgetManager) -> None:
    """등록된 해시는 중복으로 판별되어야 한다."""
    h = "abc123"
    assert bm.is_duplicate_call(h) is False
    bm.register_call_hash(h)
    assert bm.is_duplicate_call(h) is True


# ── no-evidence counter ─────────────────────────────────────


def test_no_evidence_counter(bm: BudgetManager) -> None:
    """record_no_evidence_turn 호출 시 카운터 증가, reset 시 0."""
    bm.record_no_evidence_turn(turn=1)
    bm.record_no_evidence_turn(turn=2)
    assert bm.state.consecutive_no_evidence_turns == 2
    bm.reset_no_evidence_counter(turn=3)
    assert bm.state.consecutive_no_evidence_turns == 0


# ── is_exhausted ────────────────────────────────────────────


def test_is_exhausted_by_steps(bm: BudgetManager) -> None:
    """total_steps >= max_steps 이면 소진."""
    bm.state.total_steps = bm.state.max_steps
    assert bm.is_exhausted() is True


def test_is_exhausted_by_tokens(bm: BudgetManager) -> None:
    """토큰 예산 소진 시 True."""
    bm.state.total_completion_tokens = bm.state.max_completion_tokens
    assert bm.is_exhausted() is True


# ── no_callable_tools_remaining ─────────────────────────────


def test_no_callable_tools_all_exhausted(bm: BudgetManager) -> None:
    """모든 tier 소진 시 True."""
    bm.state.cheap_calls = bm.state.max_cheap_calls
    bm.state.medium_calls = bm.state.max_medium_calls
    bm.state.expensive_calls = bm.state.max_expensive_calls
    assert bm.no_callable_tools_remaining() is True


def test_not_exhausted_when_one_tier_remaining(bm: BudgetManager) -> None:
    """하나의 tier라도 남아있으면 False."""
    bm.state.cheap_calls = bm.state.max_cheap_calls
    bm.state.medium_calls = bm.state.max_medium_calls
    # expensive 남아있음
    assert bm.no_callable_tools_remaining() is False
