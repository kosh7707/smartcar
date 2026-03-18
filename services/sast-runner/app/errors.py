from __future__ import annotations


class SastRunnerError(Exception):
    code: str = "INTERNAL_ERROR"
    status_code: int = 500
    retryable: bool = False

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class NoFilesError(SastRunnerError):
    code = "NO_FILES_PROVIDED"
    status_code = 400
    retryable = False


class SemgrepNotAvailableError(SastRunnerError):
    code = "SEMGREP_NOT_AVAILABLE"
    status_code = 503
    retryable = True


class ScanTimeoutError(SastRunnerError):
    code = "SCAN_TIMEOUT"
    status_code = 504
    retryable = True


class SarifParseError(SastRunnerError):
    code = "SARIF_PARSE_ERROR"
    status_code = 502
    retryable = False
