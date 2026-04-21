"""SAST Runner 서비스 — FastAPI 앱."""

from __future__ import annotations

import logging
import os
import sys
import time as _time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger.json import JsonFormatter


# Python logging level → pino numeric level
_LEVEL_TO_PINO = {
    logging.DEBUG: 20,
    logging.INFO: 30,
    logging.WARNING: 40,
    logging.ERROR: 50,
    logging.CRITICAL: 60,
}


class _EpochMsFormatter(JsonFormatter):
    """timestamp를 epoch ms, level을 pino 숫자로 출력하는 JSON 포매터."""

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["time"] = int(record.created * 1000)
        log_record.pop("timestamp", None)
        # level을 pino 숫자 표준으로 변환
        log_record["level"] = _LEVEL_TO_PINO.get(record.levelno, 30)

from fastapi.responses import JSONResponse

from app.config import SERVICE_VERSION, settings
from app.context import RequestIdFilter, get_request_id
from app.errors import SastRunnerError
from app.routers.scan import router as scan_router
from app.scanner.orchestrator import ScanOrchestrator


def _setup_logging() -> None:
    """JSON structured logging 설정 (observability.md 준수)."""
    handler = logging.StreamHandler(sys.stdout)
    formatter = _EpochMsFormatter(
        fmt="%(levelname)s %(message)s",
        rename_fields={"levelname": "level", "message": "msg"},
        static_fields={"service": "s4-sast"},
    )
    handler.setFormatter(formatter)

    # 파일 핸들러 (JSONL)
    log_dir = settings.log_dir or str(Path(__file__).resolve().parents[3] / "logs")
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path / "s4-sast-runner.jsonl", mode="a")
    file_handler.setFormatter(formatter)

    logger = logging.getLogger("aegis-sast-runner")
    logger.setLevel(logging.INFO)
    logger.addFilter(RequestIdFilter())
    logger.addHandler(handler)
    logger.addHandler(file_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행."""
    _setup_logging()
    logger = logging.getLogger("aegis-sast-runner")
    hot_reload = os.getenv("SAST_HOT_RELOAD", "").lower() in {"1", "true", "yes", "on"}
    logger.info(
        "SAST Runner runtime configuration",
        extra={
            "port": settings.port,
            "serviceVersion": SERVICE_VERSION,
            "hotReload": hot_reload,
            "reloadDir": "app" if hot_reload else None,
            "maxConcurrentScans": settings.max_concurrent_scans,
            "scanTimeout": settings.scan_timeout,
            "defaultRulesets": settings.default_rulesets,
            "sdkRootConfigured": bool(settings.sdk_root),
            "logDir": settings.log_dir or str(Path(__file__).resolve().parents[3] / "logs"),
        },
    )

    orch = ScanOrchestrator()
    tools = await orch.check_tools(force=True)
    for name, info in tools.items():
        if info["available"]:
            logger.info("Tool %s available: v%s", name, info["version"])
        else:
            logger.warning(
                "Tool %s not found",
                name,
                extra={
                    "probeReason": info.get("probeReason"),
                    "expectedExecutablePath": info.get("expectedExecutablePath"),
                },
            )

    policy = orch.build_health_policy(tools)
    if policy["policyStatus"] != "ok":
        logger.warning(
            "Tool availability degraded",
            extra={
                "policyStatus": policy["policyStatus"],
                "policyReasons": policy["policyReasons"],
                "unavailableTools": policy["unavailableTools"],
                "allowedSkipReasons": policy["allowedSkipReasons"],
            },
        )

    logger.info(
        "SAST Runner ready for traffic",
        extra={
            "port": settings.port,
            "serviceVersion": SERVICE_VERSION,
            "hotReload": hot_reload,
            "policyStatus": policy["policyStatus"],
            "policyReasons": policy["policyReasons"],
            "unavailableTools": policy["unavailableTools"],
            "allowedSkipReasons": policy["allowedSkipReasons"],
            "defaultRulesets": settings.default_rulesets,
        },
    )

    yield

    logger.info("SAST Runner shutting down")


app = FastAPI(
    title="AEGIS SAST Runner",
    version=SERVICE_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scan_router)


@app.exception_handler(SastRunnerError)
async def sast_runner_error_handler(request, exc: SastRunnerError):
    """SastRunnerError를 observability.md 형식으로 변환."""
    request_id = request.headers.get("X-Request-Id") or get_request_id() or "unknown"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.message,
            "errorDetail": {
                "code": exc.code,
                "message": exc.message,
                "requestId": request_id,
                "retryable": exc.retryable,
            },
        },
    )
