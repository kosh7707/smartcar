"""RetryPolicy 단위 테스트."""

from app.errors import LlmHttpError, LlmInputTooLargeError, LlmTimeoutError, LlmUnavailableError
from app.policy.retry import RetryPolicy


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
    assert policy.get_delay_ms(0) == 1000
    assert policy.get_delay_ms(1) == 2000
    assert policy.get_delay_ms(2) == 4000
    assert policy.get_delay_ms(3) == 8000
    assert policy.get_delay_ms(4) == 8000  # capped
