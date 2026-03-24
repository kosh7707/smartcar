import json
import logging
import time
from uuid import uuid4

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
_exchange_logger = logging.getLogger("llm_exchange")

router = APIRouter(prefix="/v1", tags=["v1"])

_prompt_registry = create_prompt_registry()
_model_registry = create_model_registry()

# LLM Engine 프록시 클라이언트 — lifespan에서 초기화
_proxy_client: httpx.AsyncClient | None = None

# Circuit Breaker + TokenTracker — lifespan에서 초기화
from app.circuit_breaker import CircuitBreaker
from app.metrics.token_tracker import TokenTracker
_circuit_breaker: CircuitBreaker | None = None
_token_tracker: TokenTracker | None = None

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
        timeout=httpx.Timeout(
            connect=settings.llm_connect_timeout,
            read=settings.llm_read_timeout,
            write=10.0,
            pool=10.0,
        ),
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=4),
    )


async def _close_proxy_client() -> None:
    """lifespan에서 호출 — 프록시 클라이언트 종료."""
    global _proxy_client
    if _proxy_client:
        await _proxy_client.aclose()
        _proxy_client = None


def _set_circuit_breaker(cb: CircuitBreaker) -> None:
    """lifespan에서 호출 — Circuit Breaker 주입."""
    global _circuit_breaker
    _circuit_breaker = cb


def _set_token_tracker(tt: TokenTracker) -> None:
    """lifespan에서 호출 — TokenTracker 주입."""
    global _token_tracker
    _token_tracker = tt


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
    set_request_id(req.headers.get("x-request-id") or f"gw-{uuid4().hex[:12]}")
    logger.info(
        "[v1] Task received: taskId=%s, taskType=%s",
        request.taskId, request.taskType,
    )

    task_start = time.monotonic()
    try:
        result = await _pipeline.execute(request)
    except Exception:
        logger.error("[v1] Unexpected error", exc_info=True)
        task_duration = time.monotonic() - task_start
        if _token_tracker:
            _token_tracker.record(
                endpoint="tasks", task_type=request.taskType,
                success=False, duration_s=task_duration,
                error_type="INTERNAL_ERROR",
            )
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

    task_duration = time.monotonic() - task_start
    if _token_tracker:
        is_success = hasattr(result, "status") and result.status == "completed"
        token_usage = getattr(getattr(result, "audit", None), "tokenUsage", None)
        _token_tracker.record(
            endpoint="tasks",
            task_type=request.taskType,
            prompt_tokens=token_usage.prompt if token_usage else 0,
            completion_tokens=token_usage.completion if token_usage else 0,
            success=is_success,
            duration_s=task_duration,
            error_type=getattr(result, "failureCode", None) if not is_success else None,
        )

    return _json_response(result)


@router.get("/health")
async def health(req: Request) -> dict:
    result = {
        "service": "s7-gateway",
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

    # Circuit Breaker 상태
    cb = getattr(req.app.state, "circuit_breaker", None)
    if cb:
        result["circuitBreaker"] = cb.snapshot()

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
    raw_id = req.headers.get("x-request-id") or f"gw-{uuid4().hex[:12]}"
    set_request_id(raw_id)
    request_id = get_request_id() or ""

    body = await req.json()

    profile = _model_registry.get_default()
    llm_endpoint = profile.endpoint if profile else settings.llm_endpoint

    # 모델명 오버라이드 — 호출자가 어떤 모델명을 보내든 Gateway가 실제 모델로 교체
    body["model"] = profile.modelName if profile else settings.llm_model

    fwd_headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        fwd_headers["Authorization"] = f"Bearer {settings.llm_api_key}"
    if request_id:
        fwd_headers["X-Request-Id"] = request_id

    # 호출자 타임아웃: X-Timeout-Seconds 헤더로 전달, 미전달 시 기본 1800초
    _MAX_TIMEOUT = 1800.0
    caller_timeout = min(
        float(req.headers.get("x-timeout-seconds", _MAX_TIMEOUT)),
        _MAX_TIMEOUT,
    )
    req_timeout = httpx.Timeout(
        connect=settings.llm_connect_timeout,
        read=caller_timeout,
        write=10.0,
        pool=10.0,
    )

    start = time.monotonic()

    # Circuit Breaker 확인
    if _circuit_breaker:
        from app.errors import LlmCircuitOpenError
        try:
            await _circuit_breaker.check()
        except LlmCircuitOpenError:
            logger.warning("[chat proxy] Circuit Breaker OPEN — 즉시 실패")
            return JSONResponse(
                status_code=503,
                content={"error": "LLM Engine circuit open", "retryable": True},
            )

    try:
        async with _llm_semaphore:
            resp = await _proxy_client.post(
                f"{llm_endpoint}/v1/chat/completions",
                json=body,
                headers=fwd_headers,
                timeout=req_timeout,
            )
    except httpx.ConnectError:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        has_tools = bool(body.get("tools"))
        logger.error(
            "[chat proxy] 실패 requestId=%s, latencyMs=%d, error=CONNECT, hasTools=%s",
            request_id, elapsed_ms, has_tools,
        )
        if _circuit_breaker:
            await _circuit_breaker.record_failure()
        return JSONResponse(
            status_code=503,
            content={"error": "LLM Engine unreachable", "retryable": True},
            headers={"X-Request-Id": request_id},
        )
    except httpx.TimeoutException:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        has_tools = bool(body.get("tools"))
        logger.error(
            "[chat proxy] 실패 requestId=%s, latencyMs=%d, error=TIMEOUT, hasTools=%s",
            request_id, elapsed_ms, has_tools,
        )
        if _circuit_breaker:
            await _circuit_breaker.record_failure()
        return JSONResponse(
            status_code=504,
            content={"error": "LLM Engine timeout", "retryable": True},
            headers={"X-Request-Id": request_id},
        )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # 교환 로그 기록
    resp_data = None
    try:
        resp_data = resp.json()
    except Exception:
        pass

    _exchange_logger.info(json.dumps({
        "service": "s7-gateway",
        "level": 30,
        "time": int(time.time() * 1000),
        "requestId": request_id,
        "msg": f"[LLM exchange] {body.get('model', '')} latencyMs={elapsed_ms}",
        "type": "chat_proxy",
        "elapsedMs": elapsed_ms,
        "latencyMs": elapsed_ms,
        "status": "ok" if resp.status_code == 200 else f"HTTP_{resp.status_code}",
        "model": body.get("model", ""),
        "usage": resp_data.get("usage") if resp_data else None,
    }, ensure_ascii=False))

    if resp.status_code == 200:
        if _circuit_breaker:
            await _circuit_breaker.record_success()
        usage = resp_data.get("usage", {}) if resp_data else {}
        if _token_tracker:
            _token_tracker.record(
                endpoint="chat",
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                success=True,
                duration_s=elapsed_ms / 1000,
            )
        choices = resp_data.get("choices", [{}]) if resp_data else [{}]
        finish_reason = choices[0].get("finish_reason", "?") if choices else "?"
        logger.info(
            "[chat proxy] 완료 requestId=%s, latencyMs=%d, model=%s, "
            "promptTokens=%d, completionTokens=%d, finishReason=%s, hasTools=%s",
            request_id, elapsed_ms, body.get("model", ""),
            usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
            finish_reason, bool(body.get("tools")),
            extra={"elapsedMs": elapsed_ms},
        )
    else:
        if _token_tracker:
            _token_tracker.record(
                endpoint="chat", success=False,
                duration_s=elapsed_ms / 1000,
                error_type=f"HTTP_{resp.status_code}",
            )
        logger.warning(
            "[chat proxy] LLM Engine HTTP_%d, requestId=%s, latencyMs=%d",
            resp.status_code, request_id, elapsed_ms,
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type="application/json",
        headers={"X-Request-Id": request_id} if request_id else {},
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


@router.get("/usage")
async def usage() -> dict:
    if _token_tracker:
        return _token_tracker.snapshot()
    return {"error": "TokenTracker not initialized"}


@router.get("/models")
async def list_models() -> dict:
    return {"profiles": _model_registry.list_all()}


@router.get("/prompts")
async def list_prompts() -> dict:
    return {"prompts": _prompt_registry.list_all()}


# Prometheus 메트릭 — /v1 prefix 밖에 위치
from fastapi import APIRouter as _AR
_metrics_router = _AR()


@_metrics_router.get("/metrics")
async def metrics() -> Response:
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
