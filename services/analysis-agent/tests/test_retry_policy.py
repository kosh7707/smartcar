"""RetryPolicy 단위 테스트."""

from agent_shared.errors import LlmHttpError, LlmInputTooLargeError, LlmTimeoutError, LlmUnavailableError
from agent_shared.policy.retry import RetryPolicy


def test_retry_on_timeout():
    policy = RetryPolicy(max_retries=2)
    assert policy.should_retry(LlmTimeoutError(), attempt=0) is True
    assert policy.should_retry(LlmTimeoutError(), attempt=1) is True
    assert policy.should_retry(LlmTimeoutError(), attempt=2) is False


def test_retry_on_unavailable():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(LlmUnavailableError(), attempt=0) is True


def test_retry_on_429():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(LlmHttpError(429), attempt=0) is True


def test_no_retry_on_400():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(LlmHttpError(400), attempt=0) is False


def test_no_retry_on_input_too_large():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(LlmInputTooLargeError(1000, 500), attempt=0) is False


def test_no_retry_on_generic_exception():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(ValueError("oops"), attempt=0) is False


def test_delay_exponential_backoff():
    policy = RetryPolicy()
    assert policy.get_delay_seconds(LlmTimeoutError(), 0) == 1.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 1) == 2.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 2) == 4.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 3) == 8.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 4) == 8.0  # capped


def test_delay_circuit_breaker_503():
    """Circuit Breaker 503은 30초 대기 (S7 복구 주기)."""
    policy = RetryPolicy()
    error = LlmHttpError(503, "LLM Engine circuit open")
    assert policy.get_delay_seconds(error, 0) == 30.0
    assert policy.get_delay_seconds(error, 1) == 30.0


def test_retry_on_503():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(LlmHttpError(503), attempt=0) is True
