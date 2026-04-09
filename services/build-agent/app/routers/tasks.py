"""Thin build-agent task router preserving public /v1 surfaces."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from agent_shared.context import get_request_id, set_request_id
from app.routers.build_resolve_handler import handle_build_resolve as _handle_build_resolve
from app.routers.build_route_support import json_response as _json_response
from app.routers.sdk_analyze_handler import handle_sdk_analyze as _handle_sdk_analyze
from app.schemas.request import TaskRequest
from app.types import TaskType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["v1"])


@router.post("/tasks")
async def create_task(request: TaskRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id"))
    logger.info("[v1] Task received: taskId=%s, taskType=%s", request.taskId, request.taskType)

    try:
        if request.taskType == TaskType.BUILD_RESOLVE:
            result = await _handle_build_resolve(request)
        elif request.taskType == TaskType.SDK_ANALYZE:
            result = await _handle_sdk_analyze(request)
        else:
            request_id = get_request_id()
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"Unsupported taskType: {request.taskType}",
                    "errorDetail": {
                        "code": "UNKNOWN_TASK_TYPE",
                        "message": f"Build Agent supports 'build-resolve' and 'sdk-analyze', got '{request.taskType}'",
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
async def health() -> dict:
    return {
        "service": "s3-build",
        "status": "ok",
        "version": "1.0.0",
        "llmMode": settings.llm_mode,
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
