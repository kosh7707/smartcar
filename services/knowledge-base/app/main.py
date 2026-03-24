"""Knowledge Base — 위협 지식 검색 서비스 (Qdrant + Neo4j GraphRAG)."""

import logging
from contextlib import asynccontextmanager

import neo4j
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings
from app.cve.nvd_client import NvdClient
from app.graphrag.code_graph_service import CodeGraphService
from app.graphrag.knowledge_assembler import KnowledgeAssembler, GraphLike
from app.graphrag.neo4j_graph import Neo4jGraph
from app.graphrag.vector_search import VectorSearch
from app.observability import setup_logging
from app.rag.threat_search import ThreatSearch
from app.graphrag.project_memory_service import ProjectMemoryService
from app.routers import api, code_graph_api, cve_api, project_memory_api

setup_logging("s5-kb", log_file_name="aegis-knowledge-base")
logger = logging.getLogger(__name__)


class _NullGraph:
    """Neo4j 미연결 시 빈 결과를 반환하는 폴백 그래프."""

    def get_related(self, node_id: str) -> dict[str, list[str]]:
        return {}

    def get_node_info(self, node_id: str) -> dict | None:
        return None

    def neighbors(self, node_id: str, depth: int = 2) -> list[str]:
        return []


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threat_search = None
    vector_search = None
    assembler = None
    driver = None
    nvd_client = None

    # Qdrant 벡터 검색 초기화
    try:
        threat_search = ThreatSearch(settings.qdrant_path)
        vector_search = VectorSearch(threat_search)
        logger.info("Qdrant 초기화 완료: path=%s", settings.qdrant_path)
    except Exception as e:
        logger.warning("Qdrant 초기화 실패 (데이터 미적재 시 정상): %s", e)

    # Neo4j 그래프 초기화
    neo4j_graph = None
    code_graph_svc = None
    memory_svc = None

    try:
        driver = neo4j.GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        driver.verify_connectivity()

        neo4j_graph = Neo4jGraph(driver)
        code_graph_svc = CodeGraphService(driver)
        memory_svc = ProjectMemoryService(driver)

        logger.info(
            "Neo4j 연결 완료: %d nodes, %d edges",
            neo4j_graph.node_count, neo4j_graph.edge_count,
        )
    except Exception as e:
        logger.warning("Neo4j 연결 실패 (미설치 시 정상): %s", e)

    # KnowledgeAssembler 조립 (벡터 + 그래프)
    if vector_search:
        graph: GraphLike = neo4j_graph if neo4j_graph else _NullGraph()
        assembler = KnowledgeAssembler(vector_search, graph, rrf_k=settings.rrf_k)
        if not neo4j_graph:
            logger.warning("Neo4j 미연결 — 벡터 검색만 사용 (그래프 보강 없음)")

    # NVD 실시간 CVE 조회 클라이언트
    try:
        nvd_client = NvdClient(
            api_key=settings.nvd_api_key,
            api_base=settings.nvd_api_base,
            rate_delay=settings.nvd_rate_delay,
            cache_ttl=settings.nvd_cache_ttl,
            neo4j_graph=neo4j_graph,
            nvd_concurrency=settings.nvd_batch_concurrency,
            epss_enabled=settings.epss_enabled,
            kev_ttl=settings.kev_ttl,
        )
        logger.info("NVD 클라이언트 초기화 완료 (API 키: %s)", "있음" if settings.nvd_api_key else "없음")
    except Exception as e:
        logger.warning("NVD 클라이언트 초기화 실패: %s", e)

    api.set_assembler(assembler)
    api.set_neo4j_graph(neo4j_graph)
    code_graph_api.set_service(code_graph_svc)
    cve_api.set_nvd_client(nvd_client)
    project_memory_api.set_service(memory_svc if neo4j_graph else None)

    logger.info("Knowledge Base 초기화 완료")

    yield

    if nvd_client:
        await nvd_client.close()
    if threat_search:
        threat_search.close()
    if driver:
        try:
            driver.close()
            logger.info("Neo4j 연결 종료")
        except Exception:
            logger.warning("Neo4j 연결 이미 종료됨 (외부 종료)")


app = FastAPI(
    title="AEGIS Knowledge Base",
    description="위협 지식 검색 서비스 — Qdrant 벡터 검색 + Neo4j 관계 그래프",
    version="0.2.0",
    lifespan=lifespan,
)

class _RequestIdMiddleware(BaseHTTPMiddleware):
    """X-Request-Id를 응답 헤더에 반환한다."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id")
        response: Response = await call_next(request)
        if request_id:
            response.headers["X-Request-Id"] = request_id
        return response


app.add_middleware(_RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router)
app.include_router(code_graph_api.router)
app.include_router(cve_api.router)
app.include_router(project_memory_api.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
