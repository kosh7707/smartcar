"""TerminationPolicy 단위 테스트."""

import time
from unittest.mock import MagicMock

from app.policy.termination import TerminationPolicy
from app.schemas.agent import BudgetState


def _make_session(budget_overrides: dict | None = None, elapsed_ms: int = 0, turn_count: int = 0):
    session = MagicMock()
    session.budget = BudgetState(**(budget_overrides or {}))
    session.elapsed_ms.return_value = elapsed_ms
    session.turn_count = turn_count
    session.set_termination_reason = MagicMock()
    return session


def test_not_stopped_when_within_all_budgets():
    policy = TerminationPolicy(timeout_ms=300_000)
    session = _make_session()
    assert policy.should_stop(session) is False


def test_stops_at_max_steps():
    policy = TerminationPolicy()
    session = _make_session({"max_steps": 3}, turn_count=3)
    assert policy.should_stop(session) is True
    session.set_termination_reason.assert_called_with("max_steps")


def test_stops_at_max_completion_tokens():
    policy = TerminationPolicy()
    session = _make_session({"max_completion_tokens": 100, "total_completion_tokens": 100})
    assert policy.should_stop(session) is True
    session.set_termination_reason.assert_called_with("budget_exhausted")


def test_stops_at_timeout():
    policy = TerminationPolicy(timeout_ms=5000)
    session = _make_session(elapsed_ms=5001)
    assert policy.should_stop(session) is True
    session.set_termination_reason.assert_called_with("timeout")


def test_stops_at_no_new_evidence():
    policy = TerminationPolicy()
    session = _make_session({
        "consecutive_no_evidence_turns": 2,
        "max_consecutive_no_evidence": 2,
    })
    assert policy.should_stop(session) is True
    session.set_termination_reason.assert_called_with("no_new_evidence")


def test_stops_when_all_tiers_exhausted():
    policy = TerminationPolicy()
    session = _make_session({
        "max_cheap_calls": 1, "cheap_calls": 1,
        "max_medium_calls": 1, "medium_calls": 1,
        "max_expensive_calls": 1, "expensive_calls": 1,
    })
    assert policy.should_stop(session) is True
    session.set_termination_reason.assert_called_with("all_tiers_exhausted")


def test_does_not_stop_with_remaining_tier():
    policy = TerminationPolicy()
    session = _make_session({
        "max_cheap_calls": 3, "cheap_calls": 1,
        "max_medium_calls": 1, "medium_calls": 1,
        "max_expensive_calls": 1, "expensive_calls": 1,
    })
    assert policy.should_stop(session) is False


def test_priority_max_steps_before_tokens():
    """max_steps(턴 수)가 tokens보다 먼저 체크됨."""
    policy = TerminationPolicy()
    session = _make_session({
        "max_steps": 2,
        "max_completion_tokens": 100, "total_completion_tokens": 100,
    }, turn_count=2)
    assert policy.should_stop(session) is True
    session.set_termination_reason.assert_called_with("max_steps")
