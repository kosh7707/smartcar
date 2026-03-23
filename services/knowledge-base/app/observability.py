"""observability — JSON structured logging utilities."""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

from app.context import get_request_id

_log_dir: Path | None = None


# Python logging level → pino numeric level
_PINO_LEVELS = {
    logging.DEBUG: 20,
    logging.INFO: 30,
    logging.WARNING: 40,
    logging.ERROR: 50,
    logging.CRITICAL: 60,
}


class _JsonFormatter(logging.Formatter):
    """JSON structured log formatter (pino 호환)."""

    def __init__(self, service_name: str) -> None:
        super().__init__()
        self._service = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_record: dict = {
            "level": _PINO_LEVELS.get(record.levelno, 30),
            "time": int(record.created * 1000),
            "service": self._service,
            "msg": record.getMessage(),
        }
        request_id = get_request_id()
        if request_id:
            log_record["requestId"] = request_id
        _extra = getattr(record, "_extra", None)
        if _extra:
            log_record.update(_extra)
        return json.dumps(log_record, ensure_ascii=False)


def setup_logging(
    service_name: str,
    log_dir: Path | None = None,
    log_file_name: str | None = None,
) -> Path:
    """JSON structured logging + JSONL file output. Returns log_dir."""
    global _log_dir
    if log_dir is None:
        log_dir = Path(os.environ.get(
            "LOG_DIR",
            str(Path(__file__).resolve().parent.parent.parent.parent / "logs"),
        ))
    log_dir.mkdir(parents=True, exist_ok=True)
    _log_dir = log_dir

    formatter = _JsonFormatter(service_name)

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(formatter)

    file_name = log_file_name or service_name
    file_handler = logging.FileHandler(log_dir / f"{file_name}.jsonl")
    file_handler.setFormatter(formatter)

    logging.root.handlers = [stdout_handler, file_handler]
    logging.root.setLevel(logging.INFO)

    # 서드파티 라이브러리 로그 노이즈 억제
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    return log_dir
