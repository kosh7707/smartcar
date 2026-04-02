"""RetryPolicy 단위 테스트."""

from __future__ import annotations

import pytest

from agent_shared.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError
from agent_shared.policy.retry import RetryPolicy


@pytest.fixture
def policy() -> RetryPolicy:
    return RetryPolicy(max_retries=2)


# ── should_retry ────────────────────────────────────────────


def test_retry_on_timeout(policy: RetryPolicy) -> None:
    """LlmTimeoutError → 재시도 가능."""
    err = LlmTimeoutError()
    assert policy.should_retry(err, attempt=0) is True


def test_retry_on_503(policy: RetryPolicy) -> None:
    """LlmHttpError(503) → 재시도 가능 (retryable=True)."""
    err = LlmHttpError(503)
    assert policy.should_retry(err, attempt=0) is True


def test_no_retry_on_400(policy: RetryPolicy) -> None:
    """LlmHttpError(400) → 재시도 불가 (retryable=False)."""
    err = LlmHttpError(400)
    assert policy.should_retry(err, attempt=0) is False


def test_no_retry_after_max(policy: RetryPolicy) -> None:
    """attempt >= max_retries → 재시도 불가."""
    err = LlmTimeoutError()
    assert policy.should_retry(err, attempt=2) is False
    assert policy.should_retry(err, attempt=3) is False


# ── get_delay_seconds ──────────────────────────────────────


def test_delay_503_is_30s(policy: RetryPolicy) -> None:
    """503 에러 시 Circuit Breaker 복구 대기: 30초."""
    err = LlmHttpError(503)
    assert policy.get_delay_seconds(err, attempt=0) == 30.0


def test_delay_timeout_exponential_backoff(policy: RetryPolicy) -> None:
    """Timeout 에러는 지수 백오프: 2s, 4s, 8s max."""
    err = LlmTimeoutError()
    assert policy.get_delay_seconds(err, attempt=0) == 2.0
    assert policy.get_delay_seconds(err, attempt=1) == 4.0
    assert policy.get_delay_seconds(err, attempt=2) == 8.0
    assert policy.get_delay_seconds(err, attempt=3) == 8.0  # capped
