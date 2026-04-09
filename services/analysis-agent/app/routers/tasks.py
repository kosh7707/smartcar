import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from agent_shared.context import get_request_id, set_request_id
from app.pipeline.task_pipeline import TaskPipeline
from app.registry.model_registry import create_default_registry as create_model_registry
from app.registry.prompt_registry import create_default_registry as create_prompt_registry
from app.routers.deep_analyze_handler import handle_deep_analyze as _handle_deep_analyze_impl
from app.routers.generate_poc_handler import handle_generate_poc as _handle_generate_poc_impl
from app.schemas.request import TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from app.types import TaskType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["v1"])

_prompt_registry = create_prompt_registry()
_model_registry = create_model_registry()

# 레거시 파이프라인 (기존 5개 task type용)
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


async def _handle_deep_analyze(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """Compatibility wrapper to preserve tasks-module handler seam."""
    return await _handle_deep_analyze_impl(request, _model_registry)


async def _handle_generate_poc(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """Compatibility wrapper to preserve tasks-module handler seam."""
    return await _handle_generate_poc_impl(request, _model_registry)


@router.post("/tasks")
async def create_task(request: TaskRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id"))
    logger.info(
        "[v1] Task received: taskId=%s, taskType=%s",
        request.taskId, request.taskType,
    )

    try:
        if request.taskType == TaskType.DEEP_ANALYZE:
            result = await _handle_deep_analyze(request)
        elif request.taskType == TaskType.GENERATE_POC:
            result = await _handle_generate_poc(request)
        else:
            request_id = get_request_id()
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"Unsupported taskType: {request.taskType}",
                    "errorDetail": {
                        "code": "UNKNOWN_TASK_TYPE",
                        "message": (
                            "Analysis Agent supports only 'deep-analyze' and "
                            "'generate-poc'. Legacy task types are handled by "
                            "S7 LLM Gateway."
                        ),
                        "requestId": request_id,
                        "retryable": False,
                    },
                },
                headers={"X-Request-Id": request_id} if request_id else {},
            )
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
    prompt_versions = {
        "deep-analyze": "agent-v1",
        "generate-poc": next(
            (p["version"] for p in _prompt_registry.list_all() if p["taskType"] == "generate-poc"),
            "v1",
        ),
    }
    result = {
        "service": "s3-agent",
        "status": "ok",
        "version": "0.1.0",
        "llmMode": settings.llm_mode,
        "modelProfiles": [
            p["profileId"] for p in _model_registry.list_all()
        ],
        "activePromptVersions": prompt_versions,
        "agentConfig": {
            "maxSteps": settings.agent_max_steps,
            "maxCompletionTokens": settings.agent_max_completion_tokens,
            "toolBudget": {
                "cheap": settings.agent_max_cheap_calls,
                "medium": settings.agent_max_medium_calls,
                "expensive": settings.agent_max_expensive_calls,
            },
        },
    }
    if settings.llm_mode == "real":
        result["llmBackend"] = await _check_llm_backend()
        result["llmConcurrency"] = settings.llm_concurrency

    threat_search = getattr(req.app.state, "threat_search", None)
    result["rag"] = {
        "enabled": settings.rag_enabled,
        "kbEndpoint": settings.kb_endpoint,
        "status": "ok" if threat_search else "disabled",
    }

    return result


async def _check_llm_backend() -> dict:
    """S7 Gateway 연결 상태를 확인한다."""
    import httpx

    endpoint = settings.llm_endpoint  # S7 Gateway 주소

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{endpoint}/v1/health")
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": "ok",
                "gateway": endpoint,
                "gatewayLlmBackend": data.get("llmBackend"),
            }
    except Exception as e:
        return {"status": "unreachable", "gateway": endpoint, "error": str(e)}


@router.get("/models")
async def list_models() -> dict:
    return {"profiles": _model_registry.list_all()}


@router.get("/prompts")
async def list_prompts() -> dict:
    return {"prompts": _prompt_registry.list_all()}
