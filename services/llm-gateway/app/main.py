import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger

from app.config import settings
from app.context import get_request_id
from app.routers import analyze, health
from app.v1.routers import tasks as v1_tasks


class _JsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["level"] = record.levelname.lower()
        log_record["time"] = int(record.created * 1000)
        log_record["service"] = "s3-llm-gateway"
        log_record["msg"] = log_record.pop("message", "")
        request_id = get_request_id()
        if request_id:
            log_record["requestId"] = request_id


_formatter = _JsonFormatter()

_stdout_handler = logging.StreamHandler(sys.stdout)
_stdout_handler.setFormatter(_formatter)

_log_dir = Path(os.environ.get("LOG_DIR", Path(__file__).resolve().parent.parent.parent.parent / "logs"))
_log_dir.mkdir(parents=True, exist_ok=True)
_file_handler = logging.FileHandler(_log_dir / "s3-llm-gateway.jsonl")
_file_handler.setFormatter(_formatter)

logging.root.handlers = [_stdout_handler, _file_handler]
logging.root.setLevel(logging.INFO)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("LLM Gateway started (mode: %s)", settings.llm_mode)
    yield


app = FastAPI(
    title="Smartcar LLM Gateway",
    description="자동차 전장부품 사이버보안 검증 프레임워크 - LLM 연동 게이트웨이",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(health.router)
app.include_router(v1_tasks.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
