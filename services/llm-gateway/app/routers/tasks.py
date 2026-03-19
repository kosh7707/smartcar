import json
import logging
import time

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app.context import get_request_id, set_request_id
from app.pipeline.task_pipeline import TaskPipeline
from app.registry.model_registry import create_default_registry as create_model_registry
from app.registry.prompt_registry import create_default_registry as create_prompt_registry
from app.schemas.request import TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse

logger = logging.getLogger(__name__)
_exchange_logger = logging.getLogger("s4_exchange")

router = APIRouter(prefix="/v1", tags=["v1"])

_prompt_registry = create_prompt_registry()
_model_registry = create_model_registry()

# LLM Engine 프록시 클라이언트 — lifespan에서 초기화
_proxy_client: httpx.AsyncClient | None = None

# 동시성 제어 세마포어 — lifespan에서 초기화
import asyncio
_llm_semaphore = asyncio.Semaphore(settings.llm_concurrency)

# 파이프라인은 초기에는 enricher 없이 생성. lifespan에서 갱신.
_pipeline = TaskPipeline(_prompt_registry, _model_registry)


def _json_response(
    data: TaskSuccessResponse | TaskFailureResponse,
) -> JSONResponse:
    request_id = get_request_id()
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(
        content=data.model_dump(mode="json"),
        headers=headers,
    )


def _init_proxy_client() -> None:
    """lifespan에서 호출 — LLM Engine 프록시 httpx 클라이언트 초기화."""
    global _proxy_client
    _proxy_client = httpx.AsyncClient(
        timeout=120.0,
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=4),
    )


async def _close_proxy_client() -> None:
    """lifespan에서 호출 — 프록시 클라이언트 종료."""
    global _proxy_client
    if _proxy_client:
        await _proxy_client.aclose()
        _proxy_client = None


def _rebuild_pipeline(threat_search=None, llm_client=None) -> None:
    """lifespan에서 RAG/LLM 클라이언트 초기화 후 파이프라인 재구성."""
    global _pipeline
    enricher = None
    if threat_search:
        from app.rag.context_enricher import ContextEnricher
        enricher = ContextEnricher(threat_search)
    _pipeline = TaskPipeline(
        _prompt_registry, _model_registry,
        context_enricher=enricher, llm_client=llm_client,
    )


@router.post("/tasks")
async def create_task(request: TaskRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id"))
    logger.info(
        "[v1] Task received: taskId=%s, taskType=%s",
        request.taskId, request.taskType,
    )

    try:
        result = await _pipeline.execute(request)
    except Exception:
        logger.error("[v1] Unexpected error", exc_info=True)
        request_id = get_request_id()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal server error",
                "errorDetail": {
                    "code": "INTERNAL_ERROR",
                    "message": "Internal server error",
                    "requestId": request_id,
                    "retryable": False,
                },
            },
            headers={"X-Request-Id": request_id} if request_id else {},
        )

    return _json_response(result)


@router.get("/health")
async def health(req: Request) -> dict:
    result = {
        "service": "aegis-llm-gateway",
        "status": "ok",
        "version": "1.0.0",
        "llmMode": settings.llm_mode,
        "modelProfiles": [
            p["profileId"] for p in _model_registry.list_all()
        ],
        "activePromptVersions": {
            p["taskType"]: p["version"]
            for p in _prompt_registry.list_all()
        },
    }
    if settings.llm_mode == "real":
        result["llmBackend"] = await _check_llm_backend()
        result["llmConcurrency"] = settings.llm_concurrency

    # RAG 상태
    threat_search = getattr(req.app.state, "threat_search", None)
    result["rag"] = {
        "enabled": settings.rag_enabled,
        "kbEndpoint": settings.kb_endpoint,
        "status": "ok" if threat_search else "disabled",
    }

    return result


@router.post("/chat")
async def chat_proxy(req: Request) -> Response:
    """LLM Engine 프록시 — OpenAI-compatible chat completion 요청을 전달한다.

    S3 Agent 등 LLM 소비자가 이 엔드포인트를 통해 LLM Engine에 접근한다.
    Gateway가 단일 관문 역할을 하므로 LLM 벤더/API 변경 시 이곳만 수정하면 된다.
    """
    set_request_id(req.headers.get("x-request-id"))
    request_id = get_request_id() or ""

    body = await req.json()

    profile = _model_registry.get_default()
    llm_endpoint = profile.endpoint if profile else settings.llm_endpoint

    fwd_headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        fwd_headers["Authorization"] = f"Bearer {settings.llm_api_key}"
    if request_id:
        fwd_headers["X-Request-Id"] = request_id

    start = time.monotonic()

    try:
        async with _llm_semaphore:
            resp = await _proxy_client.post(
                f"{llm_endpoint}/v1/chat/completions",
                json=body,
                headers=fwd_headers,
            )
    except httpx.ConnectError:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.error("[chat proxy] LLM Engine 연결 실패, latencyMs=%d", elapsed_ms)
        return JSONResponse(
            status_code=503,
            content={"error": "LLM Engine unreachable", "retryable": True},
        )
    except httpx.TimeoutException:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.error("[chat proxy] LLM Engine 타임아웃, latencyMs=%d", elapsed_ms)
        return JSONResponse(
            status_code=504,
            content={"error": "LLM Engine timeout", "retryable": True},
        )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # 교환 로그 기록
    resp_data = None
    try:
        resp_data = resp.json()
    except Exception:
        pass

    _exchange_logger.info(json.dumps({
        "time": int(time.time() * 1000),
        "requestId": request_id,
        "type": "chat_proxy",
        "latencyMs": elapsed_ms,
        "status": "ok" if resp.status_code == 200 else f"HTTP_{resp.status_code}",
        "model": body.get("model", ""),
        "usage": resp_data.get("usage") if resp_data else None,
    }, ensure_ascii=False))

    if resp.status_code == 200:
        logger.info(
            "[chat proxy] 완료 requestId=%s, latencyMs=%d, model=%s",
            request_id, elapsed_ms, body.get("model", ""),
        )
    else:
        logger.warning(
            "[chat proxy] LLM Engine HTTP_%d, requestId=%s, latencyMs=%d",
            resp.status_code, request_id, elapsed_ms,
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
    )


async def _check_llm_backend() -> dict:
    """vLLM 백엔드 연결 상태를 확인한다. 실패해도 health는 정상 반환."""
    import httpx

    profile = _model_registry.get_default()
    endpoint = profile.endpoint if profile else settings.llm_endpoint

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{endpoint}/health")
            resp.raise_for_status()
            return {"status": "ok", "endpoint": endpoint}
    except Exception as e:
        return {"status": "unreachable", "endpoint": endpoint, "error": str(e)}


@router.get("/models")
async def list_models() -> dict:
    return {"profiles": _model_registry.list_all()}


@router.get("/prompts")
async def list_prompts() -> dict:
    return {"prompts": _prompt_registry.list_all()}
