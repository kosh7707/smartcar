from __future__ import annotations


class S3Error(Exception):
    """S3 LLM Gateway 기본 예외."""

    def __init__(self, message: str, *, code: str, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class LlmTimeoutError(S3Error):
    """S4 LLM 요청 시간 초과."""

    def __init__(self, message: str = "LLM 요청 시간 초과"):
        super().__init__(message, code="LLM_TIMEOUT", retryable=True)


class LlmUnavailableError(S3Error):
    """S4 LLM 서버 연결 불가."""

    def __init__(self, message: str = "LLM 서버 연결 불가"):
        super().__init__(message, code="LLM_UNAVAILABLE", retryable=True)


class LlmInputTooLargeError(S3Error):
    """프롬프트가 모델 입력 한도를 초과."""

    def __init__(self, chars: int, limit: int):
        msg = f"프롬프트가 입력 한도를 초과합니다 ({chars:,}자 > {limit:,}자 상한)"
        super().__init__(msg, code="INPUT_TOO_LARGE", retryable=False)
        self.chars = chars
        self.limit = limit


class LlmHttpError(S3Error):
    """S4 LLM 서버가 HTTP 오류를 반환."""

    def __init__(self, status_code: int, message: str | None = None):
        msg = message or f"LLM 서버 HTTP {status_code} 오류"
        retryable = status_code in (429, 503)
        code = "LLM_OVERLOADED" if retryable else "LLM_HTTP_ERROR"
        super().__init__(msg, code=code, retryable=retryable)
        self.upstream_status = status_code
