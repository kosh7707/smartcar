"""Project Memory API — 프로젝트별 에이전트 메모리 엔드포인트."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.context import set_request_id
from app.errors import error_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/project-memory", tags=["project-memory"])

_service = None


def set_service(service) -> None:
    global _service
    _service = service


class ProvenanceRequest(BaseModel):
    build_snapshot_id: str | None = Field(default=None, alias="buildSnapshotId")
    build_unit_id: str | None = Field(default=None, alias="buildUnitId")
    source_build_attempt_id: str | None = Field(default=None, alias="sourceBuildAttemptId")

    model_config = {"populate_by_name": True}


class CreateMemoryRequest(BaseModel):
    type: str = Field(
        ...,
        description="메모리 타입: analysis_history, false_positive, resolved, preference",
    )
    data: dict = Field(
        ...,
        description="메모리 데이터 (자유 형식 JSON)",
    )
    ttl_seconds: int | None = Field(
        default=None, ge=60,
        description="선택적 TTL (초). 설정 시 만료 시각 계산. None이면 영구 보존.",
    )
    provenance: ProvenanceRequest | None = Field(
        default=None,
        description="선택적 build snapshot provenance",
    )


def _require_service():
    if _service is None:
        raise HTTPException(503, "Project memory service not initialized")


def _elapsed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


@router.get("/{project_id}")
async def list_memories(
    project_id: str,
    type: str | None = Query(default=None, description="메모리 타입 필터"),
    build_snapshot_id: str | None = Query(default=None, alias="buildSnapshotId"),
    build_unit_id: str | None = Query(default=None, alias="buildUnitId"),
    source_build_attempt_id: str | None = Query(default=None, alias="sourceBuildAttemptId"),
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    start = time.monotonic()
    _require_service()
    memories = _service.list_memories(
        project_id,
        memory_type=type,
        provenance_filters={
            "build_snapshot_id": build_snapshot_id,
            "build_unit_id": build_unit_id,
            "source_build_attempt_id": source_build_attempt_id,
        },
    )
    logger.info(
        "프로젝트 메모리 조회",
        extra={"_extra": {
            "projectId": project_id,
            "type": type,
            "buildSnapshotId": build_snapshot_id,
            "buildUnitId": build_unit_id,
            "sourceBuildAttemptId": source_build_attempt_id,
            "resultCount": len(memories),
            "elapsedMs": _elapsed_ms(start),
        }},
    )
    return {"projectId": project_id, "memories": memories}


@router.post("/{project_id}")
async def create_memory(
    project_id: str,
    req: CreateMemoryRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    start = time.monotonic()
    _require_service()
    from app.graphrag.project_memory_service import MemoryLimitError
    try:
        result = _service.create_memory(
            project_id,
            req.type,
            req.data,
            ttl_seconds=req.ttl_seconds,
            provenance=(
                req.provenance.model_dump(exclude_none=True)
                if req.provenance is not None else None
            ),
        )
    except ValueError as e:
        logger.warning(
            "프로젝트 메모리 생성 실패",
            extra={"_extra": {
                "projectId": project_id,
                "type": req.type,
                "error": str(e),
                "elapsedMs": _elapsed_ms(start),
            }},
        )
        raise HTTPException(422, str(e))
    except MemoryLimitError as e:
        logger.warning(
            "프로젝트 메모리 생성 실패",
            extra={"_extra": {
                "projectId": project_id,
                "type": req.type,
                "error": str(e),
                "code": "MEMORY_LIMIT_EXCEEDED",
                "elapsedMs": _elapsed_ms(start),
            }},
        )
        return error_response(409, "MEMORY_LIMIT_EXCEEDED", str(e), retryable=False)
    logger.info(
        "프로젝트 메모리 생성 요청 완료",
        extra={"_extra": {
            "projectId": project_id,
            "type": req.type,
            "memoryId": result.get("id"),
            "deduplicated": result.get("deduplicated", False),
            "hasTtl": req.ttl_seconds is not None,
            "hasProvenance": req.provenance is not None,
            "elapsedMs": _elapsed_ms(start),
        }},
    )
    return result


@router.delete("/{project_id}/{memory_id}")
async def delete_memory(
    project_id: str,
    memory_id: str,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    start = time.monotonic()
    _require_service()
    deleted = _service.delete_memory(project_id, memory_id)
    if not deleted:
        raise HTTPException(404, f"Memory '{memory_id}' not found in project '{project_id}'")
    logger.info(
        "프로젝트 메모리 삭제",
        extra={"_extra": {
            "projectId": project_id,
            "memoryId": memory_id,
            "deleted": True,
            "elapsedMs": _elapsed_ms(start),
        }},
    )
    return {"deleted": True, "projectId": project_id, "memoryId": memory_id}
