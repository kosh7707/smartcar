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
        # pino 숫자 표준: 10=debug, 20=info(→30), 30=warning(→40), 40=error(→50)
        _LEVEL_MAP = {"DEBUG": 20, "INFO": 30, "WARNING": 40, "ERROR": 50, "CRITICAL": 60}
        log_record["level"] = _LEVEL_MAP.get(record.levelname, 30)
        log_record["time"] = int(record.created * 1000)
        log_record["service"] = "s7-gateway"
        log_record["msg"] = log_record.pop("message", "")
        request_id = get_request_id()
        if request_id:
            log_record["requestId"] = request_id


_formatter = _JsonFormatter()

_stdout_handler = logging.StreamHandler(sys.stdout)
_stdout_handler.setFormatter(_formatter)

_log_dir = Path(os.environ.get("LOG_DIR", Path(__file__).resolve().parent.parent.parent.parent / "logs"))
_log_dir.mkdir(parents=True, exist_ok=True)
_file_handler = logging.FileHandler(_log_dir / "aegis-llm-gateway.jsonl")
_file_handler.setFormatter(_formatter)

logging.root.handlers = [_stdout_handler, _file_handler]
logging.root.setLevel(logging.INFO)

# LLM 교환 로그 — 요청/응답 JSON 전문 기록 (stdout 미출력)
_exchange_handler = logging.FileHandler(_log_dir / "llm-exchange.jsonl")
_exchange_handler.setFormatter(logging.Formatter("%(message)s"))
_exchange_logger = logging.getLogger("llm_exchange")
_exchange_logger.handlers = [_exchange_handler]
_exchange_logger.setLevel(logging.INFO)
_exchange_logger.propagate = False

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # RAG: S5 Knowledge Base HTTP 클라이언트 초기화
    threat_search = None
    if settings.rag_enabled:
        from app.rag.threat_search import ThreatSearch
        threat_search = ThreatSearch(settings.kb_endpoint)
        logger.info("RAG 활성화: kb_endpoint=%s", settings.kb_endpoint)

    _app.state.threat_search = threat_search

    # dump 파일 정리 (7일 이상 된 파일 삭제)
    _dump_dir = _log_dir / "llm-dumps"
    if _dump_dir.exists():
        import time as _time
        _cutoff = _time.time() - 7 * 86400
        _cleaned = 0
        for _f in _dump_dir.iterdir():
            if _f.is_file() and _f.stat().st_mtime < _cutoff:
                _f.unlink()
                _cleaned += 1
        if _cleaned:
            logger.info("dump 파일 정리: %d건 삭제 (7일 초과)", _cleaned)

    # Circuit Breaker + TokenTracker 초기화
    from app.circuit_breaker import CircuitBreaker
    from app.metrics.token_tracker import TokenTracker
    circuit_breaker = CircuitBreaker()
    token_tracker = TokenTracker()
    _app.state.circuit_breaker = circuit_breaker
    _app.state.token_tracker = token_tracker

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
            circuit_breaker=circuit_breaker,
        )

    # RAG enricher + LLM 클라이언트를 주입하여 파이프라인 재구성
    from app.routers.tasks import _rebuild_pipeline, _init_proxy_client, _set_circuit_breaker, _set_token_tracker
    _rebuild_pipeline(threat_search, llm_client)
    _set_circuit_breaker(circuit_breaker)
    _set_token_tracker(token_tracker)

    # LLM Engine 프록시 클라이언트 초기화 (/v1/chat 용)
    _init_proxy_client()

    # real 모드일 때 LLM Engine 워밍업 (torch.compile 캐시 생성)
    if llm_client:
        try:
            logger.info("LLM Engine 워밍업 시작...")
            await llm_client.generate(
                [{"role": "user", "content": "Hello"}],
                max_tokens=8, temperature=0.0,
            )
            logger.info("LLM Engine 워밍업 완료")
        except Exception as e:
            logger.warning("LLM Engine 워밍업 실패 (서비스는 정상 기동): %s", e)

    logger.info(
        "LLM Gateway started (mode: %s, rag: %s, concurrency: %d)",
        settings.llm_mode,
        "enabled" if threat_search else "disabled",
        settings.llm_concurrency,
    )
    yield

    from app.routers.tasks import _close_proxy_client
    await _close_proxy_client()
    if llm_client:
        await llm_client.aclose()
    if threat_search:
        await threat_search.close()


app = FastAPI(
    title="AEGIS LLM Gateway",
    description="자동차 전장부품 사이버보안 검증 프레임워크 - LLM 연동 게이트웨이",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(tasks._metrics_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
