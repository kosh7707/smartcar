"""RetryPolicy — LLM 호출 실패 시 재시도 판단."""

from __future__ import annotations

from app.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError


class RetryPolicy:
    """transient 에러(timeout, 429, 503)만 재시도."""

    def __init__(self, max_retries: int = 1) -> None:
        self._max_retries = max_retries

    def should_retry(self, error: Exception, attempt: int) -> bool:
        if attempt >= self._max_retries:
            return False
        if isinstance(error, (LlmTimeoutError, LlmUnavailableError)):
            return True
        if isinstance(error, LlmHttpError) and error.retryable:
            return True
        return False

    def get_delay_ms(self, attempt: int) -> int:
        """지수 백오프: 1000 * 2^attempt, 최대 8000ms."""
        return min(1000 * (2 ** attempt), 8000)
