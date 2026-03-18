"""요청 컨텍스트 전파 — requestId를 모든 레이어에서 접근 가능하게."""

from __future__ import annotations

import logging
from contextvars import ContextVar

_request_id: ContextVar[str] = ContextVar("request_id", default="")


def set_request_id(rid: str) -> None:
    _request_id.set(rid)


def get_request_id() -> str:
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    """로그 레코드에 자동으로 requestId를 주입하는 필터."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not getattr(record, "requestId", None):
            record.requestId = get_request_id()
        return True
