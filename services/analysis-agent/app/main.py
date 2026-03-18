import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.observability import setup_logging
from app.routers import tasks

_SERVICE_NAME = "s3-analysis-agent"
_log_dir = setup_logging(_SERVICE_NAME)

# S4 교환 로그
_exchange_handler = logging.FileHandler(_log_dir / "s4-exchange.jsonl")
_exchange_handler.setFormatter(logging.Formatter("%(message)s"))
_exchange_logger = logging.getLogger("s4_exchange")
_exchange_logger.handlers = [_exchange_handler]
_exchange_logger.setLevel(logging.INFO)
_exchange_logger.propagate = False

# LLM 호출별 전문 덤프 디렉토리
(_log_dir / "llm-dumps").mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # RAG 초기화
    threat_search = None
    if settings.rag_enabled:
        try:
            from app.rag.threat_search import ThreatSearch
            threat_search = ThreatSearch(settings.qdrant_path)
            logger.info("RAG 활성화: qdrant_path=%s", settings.qdrant_path)
        except Exception as e:
            logger.info("RAG 자동 감지 실패 (데이터 미적재 시 정상): %s", e)

    _app.state.threat_search = threat_search

    # real 모드: httpx 클라이언트 생성
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

    # 레거시 파이프라인 재구성
    from app.routers.tasks import _rebuild_pipeline
    _rebuild_pipeline(threat_search, llm_client)

    logger.info(
        "Analysis Agent started (mode: %s, rag: %s, concurrency: %d)",
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
    title="Smartcar Analysis Agent",
    description="자동차 전장부품 사이버보안 검증 프레임워크 - 에이전트 기반 분석 서비스",
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

    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
