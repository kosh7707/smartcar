"""TokenCounter 단위 테스트."""

from unittest.mock import MagicMock

from app.budget.token_counter import TokenCounter
from app.agent_runtime.schemas.agent import BudgetState, LlmResponse


def _make_session(budget: BudgetState | None = None):
    session = MagicMock()
    session.budget = budget or BudgetState()
    return session


def test_record_accumulates_completion_tokens():
    counter = TokenCounter()
    session = _make_session()
    response = LlmResponse(prompt_tokens=100, completion_tokens=50)
    counter.record(response, session)
    assert session.budget.total_prompt_tokens == 100
    assert session.budget.total_completion_tokens == 50


def test_record_multiple_turns():
    counter = TokenCounter()
    session = _make_session()
    counter.record(LlmResponse(prompt_tokens=300, completion_tokens=30), session)
    counter.record(LlmResponse(prompt_tokens=200, completion_tokens=20), session)
    assert session.budget.total_prompt_tokens == 500
    assert session.budget.total_completion_tokens == 50


def test_record_zero_tokens():
    counter = TokenCounter()
    session = _make_session()
    counter.record(LlmResponse(), session)
    assert session.budget.total_prompt_tokens == 0
    assert session.budget.total_completion_tokens == 0
