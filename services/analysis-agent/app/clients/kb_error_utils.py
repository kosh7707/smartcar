from __future__ import annotations

import httpx


def kb_error_code(response: httpx.Response | None) -> str | None:
    if response is None:
        return None
    try:
        data = response.json()
    except Exception:
        return None
    code = data.get("errorDetail", {}).get("code")
    return code if isinstance(code, str) else None


def is_kb_not_ready_response(response: httpx.Response | None) -> bool:
    return response is not None and response.status_code == 503 and kb_error_code(response) == "KB_NOT_READY"


def is_kb_timeout_response(response: httpx.Response | None) -> bool:
    return response is not None and response.status_code == 408 and kb_error_code(response) == "TIMEOUT"


def is_kb_not_ready_error(exc: Exception) -> bool:
    return isinstance(exc, httpx.HTTPStatusError) and is_kb_not_ready_response(exc.response)


def is_kb_timeout_error(exc: Exception) -> bool:
    return isinstance(exc, httpx.HTTPStatusError) and is_kb_timeout_response(exc.response)
