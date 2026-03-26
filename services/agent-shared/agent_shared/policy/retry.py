"""RetryPolicy — LLM 호출 실패 시 재시도 판단."""

from __future__ import annotations

from agent_shared.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError


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

    def get_delay_seconds(self, error: Exception, attempt: int) -> float:
        """재시도 전 대기 시간 (초).

        Circuit Breaker 503 → 30초 (S7 복구 주기에 맞춤).
        기타 → 지수 백오프 1s, 2s, 4s, 8s max.
        """
        if isinstance(error, LlmHttpError) and error.upstream_status == 503:
            return 30.0
        return min(1.0 * (2 ** attempt), 8.0)
