import json
import logging
import time
from uuid import uuid4

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config import settings
from app.context import get_request_id, set_request_id
from app.metrics import prom
from app.schemas.request import TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse

logger = logging.getLogger(__name__)
_exchange_logger = logging.getLogger("llm_exchange")

router = APIRouter(prefix="/v1", tags=["v1"])
_STRICT_JSON_HEADER = "x-aegis-strict-json"


def _json_response(
    data: TaskSuccessResponse | TaskFailureResponse,
) -> JSONResponse:
    request_id = get_request_id()
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(
        content=data.model_dump(mode="json"),
        headers=headers,
    )


def _is_truthy_header(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _strict_json_requested(req: Request) -> bool:
    return _is_truthy_header(req.headers.get(_STRICT_JSON_HEADER))


def _strict_json_violation(
    request_id: str,
    model: str,
    elapsed_ms: int,
    detail: str,
) -> JSONResponse:
    logger.warning(
        "[chat proxy] strict JSON contract violation requestId=%s, latencyMs=%d, detail=%s",
        request_id, elapsed_ms, detail,
        extra={"elapsedMs": elapsed_ms},
    )
    return JSONResponse(
        status_code=502,
        content={
            "error": "Strict JSON contract violated",
            "errorDetail": detail,
            "retryable": True,
            "strictJson": True,
        },
        headers={
            "X-Request-Id": request_id,
            "X-Model": model,
            "X-Gateway-Latency-Ms": str(elapsed_ms),
            "X-AEGIS-Strict-JSON": "applied",
        },
    )


def _enforce_strict_json_request_controls(body: dict) -> None:
    body["response_format"] = {"type": "json_object"}
    chat_template_kwargs = body.get("chat_template_kwargs")
    if not isinstance(chat_template_kwargs, dict):
        chat_template_kwargs = {}
    chat_template_kwargs["enable_thinking"] = False
    body["chat_template_kwargs"] = chat_template_kwargs


def _apply_strict_json_response_contract(resp_data: dict) -> tuple[dict | None, str | None]:
    choices = resp_data.get("choices")
    if not isinstance(choices, list) or not choices:
        return None, "LLM response missing choices[0] in strict JSON mode"

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        return None, "LLM response choices[0] is not an object in strict JSON mode"

    message = first_choice.get("message")
    if not isinstance(message, dict):
        return None, "LLM response missing choices[0].message in strict JSON mode"

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        return None, "LLM response missing JSON content in strict JSON mode"

    try:
        parsed_content = json.loads(content)
    except json.JSONDecodeError as exc:
        return None, f"LLM response content is not valid JSON in strict JSON mode: {exc.msg}"

    if not isinstance(parsed_content, dict):
        return None, "LLM response content is not a JSON object in strict JSON mode"

    normalized = dict(resp_data)
    normalized_choices = list(choices)
    normalized_choice = dict(first_choice)
    normalized_message = dict(message)
    normalized_message["content"] = json.dumps(parsed_content, ensure_ascii=False, separators=(",", ":"))
    if "reasoning" in normalized_message:
        normalized_message["reasoning"] = None
    normalized_choice["message"] = normalized_message
    normalized_choices[0] = normalized_choice
    normalized["choices"] = normalized_choices
    return normalized, None


@router.post("/tasks")
async def create_task(request: TaskRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id") or f"gw-{uuid4().hex[:12]}")
    logger.info(
        "[v1] Task received: taskId=%s, taskType=%s",
        request.taskId, request.taskType,
    )

    pipeline = req.app.state.pipeline
    token_tracker = getattr(req.app.state, "token_tracker", None)

    task_start = time.monotonic()
    try:
        result = await pipeline.execute(request)
    except Exception:
        logger.error("[v1] Unexpected error", exc_info=True)
        task_duration = time.monotonic() - task_start
        if token_tracker:
            await token_tracker.record(
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
    if token_tracker:
        is_success = hasattr(result, "status") and result.status == "completed"
        token_usage = getattr(getattr(result, "audit", None), "tokenUsage", None)
        await token_tracker.record(
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
    model_registry = req.app.state.model_registry
    prompt_registry = req.app.state.prompt_registry

    result = {
        "service": "s7-gateway",
        "status": "ok",
        "version": "1.0.0",
        "llmMode": settings.llm_mode,
        "modelProfiles": [
            p["profileId"] for p in model_registry.list_all()
        ],
        "activePromptVersions": {
            p["taskType"]: p["version"]
            for p in prompt_registry.list_all()
        },
    }
    if settings.llm_mode == "real":
        result["llmBackend"] = await _check_llm_backend(model_registry, req.app.state.proxy_client)
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
    strict_json = _strict_json_requested(req)

    model_registry = req.app.state.model_registry
    profile = model_registry.get_default()
    llm_endpoint = profile.endpoint if profile else settings.llm_endpoint

    # 모델명 오버라이드 — 호출자가 어떤 모델명을 보내든 Gateway가 실제 모델로 교체
    body["model"] = profile.modelName if profile else settings.llm_model
    if strict_json:
        _enforce_strict_json_request_controls(body)

    fwd_headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        fwd_headers["Authorization"] = f"Bearer {settings.llm_api_key}"
    if request_id:
        fwd_headers["X-Request-Id"] = request_id

    # 호출자 타임아웃: X-Timeout-Seconds 헤더로 전달, 미전달 시 기본 1800초
    _MAX_TIMEOUT = 1800.0
    try:
        caller_timeout = min(
            float(req.headers.get("x-timeout-seconds", _MAX_TIMEOUT)),
            _MAX_TIMEOUT,
        )
    except (ValueError, TypeError):
        caller_timeout = _MAX_TIMEOUT
    req_timeout = httpx.Timeout(
        connect=settings.llm_connect_timeout,
        read=caller_timeout,
        write=10.0,
        pool=10.0,
    )

    start = time.monotonic()

    circuit_breaker = getattr(req.app.state, "circuit_breaker", None)
    token_tracker = getattr(req.app.state, "token_tracker", None)
    llm_semaphore = req.app.state.llm_semaphore
    proxy_client = req.app.state.proxy_client

    # Circuit Breaker 확인
    if circuit_breaker:
        from app.errors import LlmCircuitOpenError
        try:
            await circuit_breaker.check()
        except LlmCircuitOpenError:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            logger.warning("[chat proxy] Circuit Breaker OPEN — 즉시 실패")
            return JSONResponse(
                status_code=503,
                content={"error": "LLM Engine circuit open", "retryable": True},
                headers={
                    "X-Request-Id": request_id,
                    "X-Model": body.get("model", ""),
                    "X-Gateway-Latency-Ms": str(elapsed_ms),
                },
            )

    try:
        async with llm_semaphore:
            prom.CONCURRENT_REQUESTS.inc()
            try:
                resp = await proxy_client.post(
                    f"{llm_endpoint}/v1/chat/completions",
                    json=body,
                    headers=fwd_headers,
                    timeout=req_timeout,
                )
            finally:
                prom.CONCURRENT_REQUESTS.dec()
    except httpx.ConnectError:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        has_tools = bool(body.get("tools"))
        logger.error(
            "[chat proxy] 실패 requestId=%s, latencyMs=%d, error=CONNECT, hasTools=%s",
            request_id, elapsed_ms, has_tools,
        )
        if circuit_breaker:
            await circuit_breaker.record_failure()
        return JSONResponse(
            status_code=503,
            content={"error": "LLM Engine unreachable", "retryable": True},
            headers={
                "X-Request-Id": request_id,
                "X-Model": body.get("model", ""),
                "X-Gateway-Latency-Ms": str(elapsed_ms),
            },
        )
    except httpx.TimeoutException:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        has_tools = bool(body.get("tools"))
        logger.error(
            "[chat proxy] 실패 requestId=%s, latencyMs=%d, error=TIMEOUT, hasTools=%s",
            request_id, elapsed_ms, has_tools,
        )
        if circuit_breaker:
            await circuit_breaker.record_failure()
        return JSONResponse(
            status_code=504,
            content={"error": "LLM Engine timeout", "retryable": True},
            headers={
                "X-Request-Id": request_id,
                "X-Model": body.get("model", ""),
                "X-Gateway-Latency-Ms": str(elapsed_ms),
            },
        )

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # 교환 로그 기록
    resp_data = None
    try:
        resp_data = resp.json()
    except Exception:
        pass

    # finish_reason 추출 (교환 로그 + 성공 로그 공용)
    _choices = resp_data.get("choices", [{}]) if resp_data else [{}]
    _finish_reason = _choices[0].get("finish_reason", "?") if _choices else "?"

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
        "finishReason": _finish_reason,
        "strictJson": strict_json,
        "toolChoice": body.get("tool_choice", "none"),
        "toolCount": len(body.get("tools", [])),
    }, ensure_ascii=False))

    if strict_json and resp.status_code == 200:
        normalized_resp_data, strict_error = _apply_strict_json_response_contract(
            resp_data if isinstance(resp_data, dict) else {},
        )
        if strict_error:
            return _strict_json_violation(
                request_id=request_id,
                model=body.get("model", ""),
                elapsed_ms=elapsed_ms,
                detail=strict_error,
            )
        resp_data = normalized_resp_data

    if resp.status_code == 200:
        if circuit_breaker:
            await circuit_breaker.record_success()
        usage = resp_data.get("usage", {}) if resp_data else {}
        if token_tracker:
            await token_tracker.record(
                endpoint="chat",
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                success=True,
                duration_s=elapsed_ms / 1000,
            )
        logger.info(
            "[chat proxy] 완료 requestId=%s, latencyMs=%d, model=%s, "
            "promptTokens=%d, completionTokens=%d, finishReason=%s, strictJson=%s, "
            "hasTools=%s, toolChoice=%s, toolCount=%d",
            request_id, elapsed_ms, body.get("model", ""),
            usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
            _finish_reason, strict_json, bool(body.get("tools")),
            body.get("tool_choice", "none"), len(body.get("tools", [])),
            extra={"elapsedMs": elapsed_ms},
        )
    else:
        if circuit_breaker and resp.status_code >= 500:
            await circuit_breaker.record_failure()
        if token_tracker:
            await token_tracker.record(
                endpoint="chat", success=False,
                duration_s=elapsed_ms / 1000,
                error_type=f"HTTP_{resp.status_code}",
            )
        logger.warning(
            "[chat proxy] LLM Engine HTTP_%d, requestId=%s, latencyMs=%d",
            resp.status_code, request_id, elapsed_ms,
        )

    resp_headers: dict[str, str] = {}
    if request_id:
        resp_headers["X-Request-Id"] = request_id
    resp_headers["X-Model"] = body.get("model", "")
    resp_headers["X-Gateway-Latency-Ms"] = str(elapsed_ms)
    if strict_json:
        resp_headers["X-AEGIS-Strict-JSON"] = "applied"

    return Response(
        content=json.dumps(resp_data, ensure_ascii=False).encode() if strict_json and resp_data else resp.content,
        status_code=resp.status_code,
        media_type="application/json",
        headers=resp_headers,
    )


async def _check_llm_backend(model_registry, proxy_client: httpx.AsyncClient) -> dict:
    """vLLM 백엔드 연결 상태를 확인한다. 실패해도 health는 정상 반환."""
    profile = model_registry.get_default()
    endpoint = profile.endpoint if profile else settings.llm_endpoint

    try:
        resp = await proxy_client.get(f"{endpoint}/health", timeout=5.0)
        resp.raise_for_status()
        return {"status": "ok", "endpoint": endpoint}
    except Exception as e:
        return {"status": "unreachable", "endpoint": endpoint, "error": str(e)}


@router.get("/usage")
async def usage(req: Request) -> dict:
    token_tracker = getattr(req.app.state, "token_tracker", None)
    if token_tracker:
        return await token_tracker.snapshot()
    return {"error": "TokenTracker not initialized"}


@router.get("/models")
async def list_models(req: Request) -> dict:
    return {"profiles": req.app.state.model_registry.list_all()}


@router.get("/prompts")
async def list_prompts(req: Request) -> dict:
    return {"prompts": req.app.state.prompt_registry.list_all()}


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
