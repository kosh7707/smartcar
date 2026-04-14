"""Code Graph API — 프로젝트별 코드 함수 호출 그래프 엔드포인트."""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import APIRouter, Header, HTTPException, Query

from app.context import set_request_id
from app.timeout import parse_timeout, check_deadline, run_sync_with_deadline
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/code-graph", tags=["code-graph"])

_service = None
_code_vector_search = None
_code_assembler = None


def set_service(service) -> None:
    global _service
    _service = service


def set_code_vector_search(vs) -> None:
    global _code_vector_search
    _code_vector_search = vs


def set_code_assembler(asm) -> None:
    global _code_assembler
    _code_assembler = asm


class ProvenanceRequest(BaseModel):
    build_snapshot_id: str | None = Field(default=None, alias="buildSnapshotId")
    build_unit_id: str | None = Field(default=None, alias="buildUnitId")
    source_build_attempt_id: str | None = Field(default=None, alias="sourceBuildAttemptId")

    model_config = {"populate_by_name": True}


class IngestRequest(BaseModel):
    functions: list[dict] = Field(
        ...,
        description="함수 목록: [{name, file, line, calls: [str]}]",
    )
    provenance: ProvenanceRequest | None = Field(
        default=None,
        description="선택적 build snapshot provenance",
    )


class DangerousCallersRequest(BaseModel):
    dangerous_functions: list[str] = Field(
        ...,
        description="위험 함수 이름 목록",
    )
    build_snapshot_id: str | None = Field(default=None, alias="buildSnapshotId")

    model_config = {"populate_by_name": True}


def _require_service():
    if _service is None:
        raise HTTPException(503, "Code graph service not initialized")


def _ingest_readiness(node_count: int, vector_count: int) -> tuple[str, dict[str, bool], list[str]]:
    if node_count <= 0:
        return (
            "empty",
            {
                "neo4jGraph": False,
                "vectorIndex": False,
                "graphRag": False,
            },
            [],
        )

    vector_ready = vector_count >= node_count
    readiness = {
        "neo4jGraph": True,
        "vectorIndex": vector_ready,
        "graphRag": vector_ready,
    }
    if vector_ready:
        return "ready", readiness, []
    return "partial", readiness, ["VECTOR_INDEX_INCOMPLETE"]


def _rollback_ingest(project_id: str, previous_functions: list[dict] | None) -> None:
    logger.warning(
        "코드 그래프 ingest 롤백 시작: project=%s, previous_functions=%d",
        project_id,
        len(previous_functions or []),
    )
    if previous_functions:
        _service.ingest(project_id, previous_functions)
        if _code_vector_search is not None:
            _code_vector_search.ingest(project_id, previous_functions)
    else:
        _service.delete_project(project_id)
        if _code_vector_search is not None:
            _code_vector_search.delete_project(project_id)
    logger.warning("코드 그래프 ingest 롤백 완료: project=%s", project_id)


def _cleanup_staging(project_id: str, staging_project_id: str) -> None:
    logger.warning(
        "코드 그래프 staging 정리: project=%s, staging=%s",
        project_id,
        staging_project_id,
    )
    _service.delete_project(staging_project_id)
    if _code_vector_search is not None:
        _code_vector_search.delete_project(staging_project_id)


class CodeSearchRequest(BaseModel):
    query: str = Field(..., description="검색 쿼리 (자연어 또는 함수명)")
    top_k: int = Field(default=10, ge=1, le=50)
    min_score: float = Field(default=0.3, ge=0.0, le=1.0)
    graph_depth: int = Field(default=2, ge=0, le=5)
    include_call_chain: bool = Field(default=True, description="호출 체인 포함 여부")
    build_snapshot_id: str | None = Field(default=None, alias="buildSnapshotId")

    model_config = {"populate_by_name": True}


@router.post("/{project_id}/ingest")
async def ingest(
    project_id: str, req: IngestRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
    x_timeout_ms: int | None = Header(None, alias="X-Timeout-Ms"),
) -> dict:
    set_request_id(x_request_id)
    deadline, _ = parse_timeout(x_timeout_ms)
    _require_service()

    provenance = (
        req.provenance.model_dump(exclude_none=True)
        if req.provenance is not None else None
    )
    previous_functions = _service.export_project(project_id)
    replaced_existing_graph = len(previous_functions) > 0
    staging_project_id = f"__staging__::{project_id}::{uuid.uuid4().hex}"
    try:
        staged_result = _service.ingest(staging_project_id, req.functions, provenance=provenance)
        check_deadline(deadline, "neo4j-stage-ingest")

        vector_count = 0
        if _code_vector_search is not None:
            try:
                vector_count = _code_vector_search.ingest(
                    staging_project_id,
                    req.functions,
                    provenance=provenance,
                )
                check_deadline(deadline, "vector-stage-ingest")
            except HTTPException:
                raise
            except Exception as e:
                logger.warning("코드 함수 벡터 stage 적재 실패 (Neo4j staging만 성공): %s", e)
                vector_count = 0

        _service.activate_staging(staging_project_id, project_id)
        check_deadline(deadline, "neo4j-activate")
        result = {
            **staged_result,
            "project_id": project_id,
            "replaceMode": "replace_project_graph",
            "replacedExistingGraph": replaced_existing_graph,
        }
        result["vectorCount"] = 0
        if _code_vector_search is not None:
            _code_vector_search.activate_staging(staging_project_id, project_id)
            result["vectorCount"] = vector_count
            check_deadline(deadline, "vector-activate")
    except HTTPException as exc:
        try:
            _cleanup_staging(project_id, staging_project_id)
        except Exception as cleanup_error:
            logger.error(
                "코드 그래프 staging 정리 실패: project=%s staging=%s error=%s",
                project_id,
                staging_project_id,
                cleanup_error,
            )
        if exc.status_code == 408:
            try:
                _rollback_ingest(project_id, previous_functions)
            except Exception as rollback_error:
                logger.error(
                    "코드 그래프 ingest 롤백 실패: project=%s error=%s",
                    project_id,
                    rollback_error,
                )
        raise
    else:
        try:
            _cleanup_staging(project_id, staging_project_id)
        except Exception as cleanup_error:
            logger.error(
                "코드 그래프 staging 정리 실패: project=%s staging=%s error=%s",
                project_id,
                staging_project_id,
                cleanup_error,
            )

    status, readiness, warnings = _ingest_readiness(
        result.get("nodeCount", 0),
        result.get("vectorCount", 0),
    )
    result["operation"] = {
        "mode": result.get("replaceMode", "replace_project_graph"),
        "repeatable": True,
        "replacedExistingGraph": result.get("replacedExistingGraph", False),
    }
    result["readiness"] = readiness
    result["status"] = status
    if warnings:
        result["warnings"] = warnings

    return result


@router.get("/{project_id}/stats")
async def stats(
    project_id: str,
    build_snapshot_id: str | None = Query(default=None, alias="buildSnapshotId"),
) -> dict:
    _require_service()
    return _service.get_stats(project_id, build_snapshot_id=build_snapshot_id)


@router.get("/{project_id}/callers/{function_name}")
async def callers(
    project_id: str,
    function_name: str,
    depth: int = Query(default=2, ge=1, le=10),
    build_snapshot_id: str | None = Query(default=None, alias="buildSnapshotId"),
) -> dict:
    _require_service()
    results = _service.get_callers(
        project_id, function_name, depth=depth, build_snapshot_id=build_snapshot_id,
    )
    return {"function": function_name, "depth": depth, "callers": results}


@router.get("/{project_id}/callees/{function_name}")
async def callees(
    project_id: str,
    function_name: str,
    build_snapshot_id: str | None = Query(default=None, alias="buildSnapshotId"),
) -> dict:
    _require_service()
    results = _service.get_callees(
        project_id, function_name, build_snapshot_id=build_snapshot_id,
    )
    return {"function": function_name, "callees": results}


@router.post("/{project_id}/dangerous-callers")
async def dangerous_callers(
    project_id: str, req: DangerousCallersRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
    x_timeout_ms: int | None = Header(None, alias="X-Timeout-Ms"),
) -> dict:
    set_request_id(x_request_id)
    deadline, _ = parse_timeout(x_timeout_ms)
    _require_service()
    results = await run_sync_with_deadline(
        deadline,
        "dangerous-callers",
        _service.find_dangerous_callers,
        project_id,
        req.dangerous_functions,
        build_snapshot_id=req.build_snapshot_id,
    )
    return {"results": results}


@router.post("/{project_id}/search")
async def search(
    project_id: str,
    req: CodeSearchRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
    x_timeout_ms: int | None = Header(None, alias="X-Timeout-Ms"),
) -> dict:
    set_request_id(x_request_id)
    deadline, _ = parse_timeout(x_timeout_ms)
    if _code_assembler is None:
        raise HTTPException(503, "Code graph search not initialized")

    start = time.monotonic()
    result = await run_sync_with_deadline(
        deadline,
        "code-graph-search",
        _code_assembler.search,
        project_id,
        req.query,
        top_k=req.top_k,
        min_score=req.min_score,
        graph_depth=req.graph_depth,
        include_call_chain=req.include_call_chain,
        build_snapshot_id=req.build_snapshot_id,
    )
    elapsed_ms = int((time.monotonic() - start) * 1000)

    logger.info(
        "코드 그래프 검색",
        extra={"_extra": {
            "projectId": project_id,
            "query": req.query,
            "hits": result["total"],
            "latencyMs": elapsed_ms,
        }},
    )

    return {**result, "latency_ms": elapsed_ms}


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict:
    _require_service()
    deleted = _service.delete_project(project_id)
    if not deleted:
        raise HTTPException(404, f"Project '{project_id}' not found")

    if _code_vector_search is not None:
        try:
            _code_vector_search.delete_project(project_id)
        except Exception as e:
            logger.warning("코드 함수 벡터 삭제 실패: %s", e)

    return {"deleted": True, "project_id": project_id}


@router.get("")
async def list_projects() -> dict:
    _require_service()
    projects = _service.list_projects()
    return {"projects": projects}
