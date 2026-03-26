"""TokenCounter 단위 테스트."""

from unittest.mock import MagicMock

from app.budget.token_counter import TokenCounter
from agent_shared.schemas.agent import BudgetState, LlmResponse


def _make_session(budget: BudgetState | None = None):
    session = MagicMock()
    session.budget = budget or BudgetState()
    return session


def test_record_accumulates_completion_tokens():
    counter = TokenCounter()
    session = _make_session()
    response = LlmResponse(prompt_tokens=100, completion_tokens=50)
    counter.record(response, session)
    assert session.budget.total_completion_tokens == 50


def test_record_multiple_turns():
    counter = TokenCounter()
    session = _make_session()
    counter.record(LlmResponse(completion_tokens=30), session)
    counter.record(LlmResponse(completion_tokens=20), session)
    assert session.budget.total_completion_tokens == 50


def test_record_zero_tokens():
    counter = TokenCounter()
    session = _make_session()
    counter.record(LlmResponse(), session)
    assert session.budget.total_completion_tokens == 0
