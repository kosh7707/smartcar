"""SAST Runner 서비스 — FastAPI 앱."""

from __future__ import annotations

import logging
import sys
import time as _time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger.json import JsonFormatter


class _EpochMsFormatter(JsonFormatter):
    """timestamp를 epoch ms로 출력하는 JSON 포매터."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["time"] = int(record.created * 1000)
        log_record.pop("timestamp", None)

from app.config import settings
from app.context import RequestIdFilter
from app.routers.scan import router as scan_router
from app.scanner.orchestrator import ScanOrchestrator


def _setup_logging() -> None:
    """JSON structured logging 설정 (observability.md 준수)."""
    handler = logging.StreamHandler(sys.stdout)
    formatter = _EpochMsFormatter(
        fmt="%(levelname)s %(message)s",
        rename_fields={"levelname": "level", "message": "msg"},
        static_fields={"service": "s4-sast-runner"},
    )
    handler.setFormatter(formatter)

    # 파일 핸들러 (JSONL)
    log_dir = settings.log_dir or str(Path(__file__).resolve().parents[3] / "logs")
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path / "s4-sast-runner.jsonl", mode="a")
    file_handler.setFormatter(formatter)

    logger = logging.getLogger("s4-sast-runner")
    logger.setLevel(logging.INFO)
    logger.addFilter(RequestIdFilter())
    logger.addHandler(handler)
    logger.addHandler(file_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행."""
    _setup_logging()
    logger = logging.getLogger("s4-sast-runner")

    orch = ScanOrchestrator()
    tools = await orch.check_tools()
    for name, info in tools.items():
        if info["available"]:
            logger.info("Tool %s available: v%s", name, info["version"])
        else:
            logger.warning("Tool %s not found", name)

    logger.info(
        "SAST Runner started on port %d (rulesets: %s)",
        settings.port,
        settings.default_rulesets,
    )

    yield

    logger.info("SAST Runner shutting down")


app = FastAPI(
    title="AEGIS SAST Runner",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)
