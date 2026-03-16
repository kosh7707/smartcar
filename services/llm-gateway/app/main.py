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
from app.routers import tasks


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
    # RAG: rag_enabled=false로 명시 비활성화하지 않는 한, Qdrant 데이터 존재 시 자동 활성화
    threat_search = None
    if settings.rag_enabled:
        try:
            from app.rag.threat_search import ThreatSearch
            threat_search = ThreatSearch(settings.qdrant_path)
            logger.info("RAG 활성화: qdrant_path=%s", settings.qdrant_path)
        except Exception as e:
            logger.info("RAG 자동 감지 실패 (데이터 미적재 시 정상): %s", e)

    _app.state.threat_search = threat_search

    # real 모드: httpx 클라이언트를 1회 생성하여 connection pooling 활용
    llm_client = None
    if settings.llm_mode == "real":
        from app.clients.real import RealLlmClient
        from app.registry.model_registry import create_default_registry as create_model_registry

        registry = create_model_registry()
        profile = registry.get_default()
        llm_client = RealLlmClient(
            endpoint=profile.endpoint if profile else settings.llm_endpoint,
            model=profile.modelName if profile else settings.llm_model,
            api_key=profile.apiKey if profile else settings.llm_api_key,
            enable_thinking=False, json_mode=True,
        )

    # RAG enricher + LLM 클라이언트를 주입하여 파이프라인 재구성
    from app.routers.tasks import _rebuild_pipeline
    _rebuild_pipeline(threat_search, llm_client)

    logger.info(
        "LLM Gateway started (mode: %s, rag: %s, concurrency: %d)",
        settings.llm_mode,
        "enabled" if threat_search else "disabled",
        settings.llm_concurrency,
    )
    yield

    if llm_client:
        await llm_client.aclose()
    if threat_search:
        threat_search.close()


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

app.include_router(tasks.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
