"""RetryPolicy 단위 테스트."""

from app.agent_runtime.errors import (
    LlmContractViolationError,
    LlmHttpError, LlmInputTooLargeError, LlmPoolExhaustedError,
    LlmTimeoutError, LlmUnavailableError, StrictJsonContractError,
)
from app.agent_runtime.policy.retry import RetryPolicy


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
    assert policy.get_delay_seconds(LlmTimeoutError(), 0) == 2.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 1) == 4.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 2) == 8.0
    assert policy.get_delay_seconds(LlmTimeoutError(), 3) == 8.0  # capped


def test_delay_circuit_breaker_503():
    """Circuit Breaker 503은 30초 대기 (S7 복구 주기)."""
    policy = RetryPolicy()
    error = LlmHttpError(503, "LLM Engine circuit open")
    assert policy.get_delay_seconds(error, 0) == 30.0
    assert policy.get_delay_seconds(error, 1) == 30.0


def test_retry_on_503():
    policy = RetryPolicy(max_retries=1)
    assert policy.should_retry(LlmHttpError(503), attempt=0) is True


def test_retry_on_pool_exhausted():
    """Pool 소진 에러도 재시도 대상."""
    policy = RetryPolicy(max_retries=2)
    assert policy.should_retry(LlmPoolExhaustedError(), attempt=0) is True
    assert policy.get_delay_seconds(LlmPoolExhaustedError(), 0) == 5.0


def test_retry_on_response_contract_violation():
    policy = RetryPolicy(max_retries=1)
    error = LlmContractViolationError(violation_reason="response_contract_violation")
    assert policy.should_retry(error, attempt=0) is True
    assert policy.get_delay_seconds(error, 0) == 2.0


def test_retry_on_strict_json_contract_violation():
    policy = RetryPolicy(max_retries=1)
    error = StrictJsonContractError(error_detail="invalid json")
    assert policy.should_retry(error, attempt=0) is True
    assert policy.get_delay_seconds(error, 0) == 2.0


def test_429_retry_after_header():
    """429 + Retry-After 헤더가 있으면 해당 값 사용."""
    policy = RetryPolicy()
    error = LlmHttpError(429, "Too Many Requests", retry_after=10.0)
    assert policy.get_delay_seconds(error, 0) == 10.0


def test_429_retry_after_capped():
    """Retry-After가 60초 초과면 60초로 cap."""
    policy = RetryPolicy()
    error = LlmHttpError(429, "Too Many Requests", retry_after=120.0)
    assert policy.get_delay_seconds(error, 0) == 60.0


def test_429_no_retry_after_uses_backoff():
    """429에 Retry-After 없으면 지수 백오프."""
    policy = RetryPolicy()
    error = LlmHttpError(429, "Too Many Requests")
    assert policy.get_delay_seconds(error, 0) == 2.0
    assert policy.get_delay_seconds(error, 1) == 4.0
