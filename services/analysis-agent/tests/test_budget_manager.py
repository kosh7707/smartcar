"""BudgetManager 단위 테스트."""

from app.budget.manager import BudgetManager
from agent_shared.schemas.agent import BudgetState, ToolCostTier


def _make_manager(**overrides) -> BudgetManager:
    return BudgetManager(BudgetState(**overrides))


def test_initial_state_all_zeros():
    m = _make_manager()
    s = m.state
    assert s.total_steps == 0
    assert s.total_completion_tokens == 0
    assert s.cheap_calls == 0
    assert s.medium_calls == 0
    assert s.expensive_calls == 0


def test_can_make_call_within_budget():
    m = _make_manager(max_cheap_calls=3)
    assert m.can_make_call(ToolCostTier.CHEAP) is True


def test_can_make_call_exhausted():
    m = _make_manager(max_cheap_calls=1)
    m.record_tool_call(ToolCostTier.CHEAP)
    assert m.can_make_call(ToolCostTier.CHEAP) is False


def test_record_tool_call_increments_tier_and_steps():
    m = _make_manager()
    m.record_tool_call(ToolCostTier.MEDIUM)
    assert m.state.medium_calls == 1
    assert m.state.total_steps == 1
    m.record_tool_call(ToolCostTier.CHEAP)
    assert m.state.cheap_calls == 1
    assert m.state.total_steps == 2


def test_record_tokens_accumulates():
    m = _make_manager()
    m.record_tokens(100, 50)
    m.record_tokens(200, 80)
    assert m.state.total_completion_tokens == 130


def test_is_exhausted_by_steps():
    m = _make_manager(max_steps=2)
    assert m.is_exhausted() is False
    m.record_tool_call(ToolCostTier.CHEAP)
    m.record_tool_call(ToolCostTier.CHEAP)
    assert m.is_exhausted() is True


def test_is_exhausted_by_tokens():
    m = _make_manager(max_completion_tokens=100)
    m.record_tokens(0, 99)
    assert m.is_exhausted() is False
    m.record_tokens(0, 1)
    assert m.is_exhausted() is True


def test_duplicate_call_detection():
    m = _make_manager()
    assert m.is_duplicate_call("abc123") is False
    m.register_call_hash("abc123")
    assert m.is_duplicate_call("abc123") is True
    assert m.is_duplicate_call("def456") is False


def test_no_evidence_counter():
    m = _make_manager(max_consecutive_no_evidence=2)
    m.record_no_evidence_turn()
    assert m.state.consecutive_no_evidence_turns == 1
    m.reset_no_evidence_counter()
    assert m.state.consecutive_no_evidence_turns == 0


def test_no_callable_tools_remaining():
    m = _make_manager(max_cheap_calls=1, max_medium_calls=1, max_expensive_calls=1)
    assert m.no_callable_tools_remaining() is False
    m.record_tool_call(ToolCostTier.CHEAP)
    m.record_tool_call(ToolCostTier.MEDIUM)
    m.record_tool_call(ToolCostTier.EXPENSIVE)
    assert m.no_callable_tools_remaining() is True


def test_expensive_tier_budget():
    m = _make_manager(max_expensive_calls=1)
    assert m.can_make_call(ToolCostTier.EXPENSIVE) is True
    m.record_tool_call(ToolCostTier.EXPENSIVE)
    assert m.can_make_call(ToolCostTier.EXPENSIVE) is False
