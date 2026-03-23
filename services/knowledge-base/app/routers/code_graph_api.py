"""Code Graph API — 프로젝트별 코드 함수 호출 그래프 엔드포인트."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Query

from app.context import set_request_id
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/code-graph", tags=["code-graph"])

_service = None


def set_service(service) -> None:
    global _service
    _service = service


class IngestRequest(BaseModel):
    functions: list[dict] = Field(
        ...,
        description="함수 목록: [{name, file, line, calls: [str]}]",
    )


class DangerousCallersRequest(BaseModel):
    dangerous_functions: list[str] = Field(
        ...,
        description="위험 함수 이름 목록",
    )


def _require_service():
    if _service is None:
        raise HTTPException(503, "Code graph service not initialized")


@router.post("/{project_id}/ingest")
async def ingest(
    project_id: str, req: IngestRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    _require_service()
    result = _service.ingest(project_id, req.functions)
    return result


@router.get("/{project_id}/stats")
async def stats(project_id: str) -> dict:
    _require_service()
    return _service.get_stats(project_id)


@router.get("/{project_id}/callers/{function_name}")
async def callers(
    project_id: str,
    function_name: str,
    depth: int = Query(default=2, ge=1, le=10),
) -> dict:
    _require_service()
    results = _service.get_callers(project_id, function_name, depth=depth)
    return {"function": function_name, "depth": depth, "callers": results}


@router.get("/{project_id}/callees/{function_name}")
async def callees(project_id: str, function_name: str) -> dict:
    _require_service()
    results = _service.get_callees(project_id, function_name)
    return {"function": function_name, "callees": results}


@router.post("/{project_id}/dangerous-callers")
async def dangerous_callers(
    project_id: str, req: DangerousCallersRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    _require_service()
    results = _service.find_dangerous_callers(project_id, req.dangerous_functions)
    return {"results": results}


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict:
    _require_service()
    deleted = _service.delete_project(project_id)
    if not deleted:
        raise HTTPException(404, f"Project '{project_id}' not found")
    return {"deleted": True, "project_id": project_id}


@router.get("")
async def list_projects() -> dict:
    _require_service()
    projects = _service.list_projects()
    return {"projects": projects}
