"""Knowledge Base API — 위협 지식 검색 엔드포인트."""

import logging
import time

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import settings
from app.context import set_request_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["v1"])

# 런타임에 lifespan에서 주입
_assembler = None
_neo4j_graph = None


def set_assembler(assembler) -> None:
    global _assembler
    _assembler = assembler


def set_neo4j_graph(graph) -> None:
    global _neo4j_graph
    _neo4j_graph = graph


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    min_score: float = Field(default=0.35, ge=0.0, le=1.0)
    graph_depth: int = Field(default=2, ge=0, le=5)


@router.post("/search")
async def search(
    req: SearchRequest,
    x_request_id: str | None = Header(None, alias="X-Request-Id"),
) -> dict:
    set_request_id(x_request_id)
    start = time.monotonic()

    if _assembler is None:
        logger.warning("검색 요청 — Knowledge base 미초기화")
        return {"error": "Knowledge base not initialized", "hits": [], "total": 0}

    result = _assembler.assemble(
        req.query,
        top_k=req.top_k,
        min_score=req.min_score,
        graph_depth=req.graph_depth,
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    hits = result.get("hits", [])
    logger.info(
        "검색 요청",
        extra={"_extra": {
            "query": req.query,
            "top_k": req.top_k,
            "hits": len(hits),
            "latencyMs": elapsed_ms,
        }},
    )

    return result


@router.get("/graph/stats")
async def graph_stats() -> dict:
    if _neo4j_graph is None:
        return {"error": "Graph not initialized", "nodeCount": 0, "edgeCount": 0}
    return _neo4j_graph.get_stats()


@router.get("/graph/neighbors/{node_id}")
async def graph_neighbors(
    node_id: str,
    depth: int = Query(default=2, ge=1, le=5),
) -> dict:
    if _neo4j_graph is None:
        return {"error": "Graph not initialized"}

    node_info = _neo4j_graph.get_node_info(node_id)
    if node_info is None:
        raise HTTPException(404, f"Node '{node_id}' not found")

    neighbor_ids = _neo4j_graph.neighbors(node_id, depth=depth)
    neighbors = []
    for nid in neighbor_ids[:50]:  # 상위 50개 제한
        info = _neo4j_graph.get_node_info(nid)
        if info:
            neighbors.append(info)

    related = _neo4j_graph.get_related(node_id)

    return {
        "nodeId": node_id,
        "nodeInfo": node_info,
        "neighbors": neighbors,
        "related": related,
    }


@router.get("/health")
async def health() -> dict:
    graph_info = None
    if _neo4j_graph is not None:
        try:
            graph_info = {
                "backend": "neo4j",
                "nodeCount": _neo4j_graph.node_count,
                "edgeCount": _neo4j_graph.edge_count,
                "connected": True,
            }
        except Exception:
            graph_info = {"backend": "neo4j", "connected": False}

    return {
        "service": "smartcar-knowledge-base",
        "status": "ok",
        "version": "0.2.0",
        "qdrantPath": settings.qdrant_path,
        "initialized": _assembler is not None,
        "graph": graph_info,
    }
