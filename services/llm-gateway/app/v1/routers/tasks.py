import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.context import get_request_id, set_request_id
from app.v1.pipeline.task_pipeline import TaskPipeline
from app.v1.registry.model_registry import create_default_registry as create_model_registry
from app.v1.registry.prompt_registry import create_default_registry as create_prompt_registry
from app.v1.schemas.request import TaskRequest
from app.v1.schemas.response import TaskFailureResponse, TaskSuccessResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["v1"])

_prompt_registry = create_prompt_registry()
_model_registry = create_model_registry()
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
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal server error",
                "code": "INTERNAL_ERROR",
            },
        )

    return _json_response(result)


@router.get("/health")
async def health() -> dict:
    return {
        "service": "smartcar-llm-gateway",
        "status": "ok",
        "version": "1.0.0",
        "modelProfiles": [
            p["profileId"] for p in _model_registry.list_all()
        ],
        "activePromptVersions": {
            p["taskType"]: p["version"]
            for p in _prompt_registry.list_all()
        },
    }


@router.get("/models")
async def list_models() -> dict:
    return {"profiles": _model_registry.list_all()}


@router.get("/prompts")
async def list_prompts() -> dict:
    return {"prompts": _prompt_registry.list_all()}
