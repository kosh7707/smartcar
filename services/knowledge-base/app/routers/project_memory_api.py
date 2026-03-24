"""Project Memory API — 프로젝트별 에이전트 메모리 엔드포인트."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.context import set_request_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/project-memory", tags=["project-memory"])

_service = None


def set_service(service) -> None:
    global _service
    _service = service


class CreateMemoryRequest(BaseModel):
    type: str = Field(
        ...,
        description="메모리 타입: analysis_history, false_positive, resolved, preference",
    )
    data: dict = Field(
        ...,
        description="메모리 데이터 (자유 형식 JSON)",
    )


def _require_service():
    if _service is None:
        raise HTTPException(503, "Project memory service not initialized")


@router.get("/{project_id}")
async def list_memories(
    project_id: str,
    type: str | None = Query(default=None, description="메모리 타입 필터"),
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    _require_service()
    memories = _service.list_memories(project_id, memory_type=type)
    return {"projectId": project_id, "memories": memories}


@router.post("/{project_id}")
async def create_memory(
    project_id: str,
    req: CreateMemoryRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    _require_service()
    try:
        result = _service.create_memory(project_id, req.type, req.data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return result


@router.delete("/{project_id}/{memory_id}")
async def delete_memory(
    project_id: str,
    memory_id: str,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    _require_service()
    deleted = _service.delete_memory(project_id, memory_id)
    if not deleted:
        raise HTTPException(404, f"Memory '{memory_id}' not found in project '{project_id}'")
    return {"deleted": True, "projectId": project_id, "memoryId": memory_id}
