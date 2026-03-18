"""Knowledge Base — 위협 지식 검색 서비스 (Qdrant + Neo4j GraphRAG)."""

import logging
from contextlib import asynccontextmanager

import neo4j
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.observability import setup_logging
from app.routers import api, code_graph_api

setup_logging("smartcar-knowledge-base")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Qdrant 벡터 검색 초기화
    threat_search = None
    assembler = None
    driver = None

    try:
        from app.rag.threat_search import ThreatSearch
        from app.graphrag.vector_search import VectorSearch
        from app.graphrag.knowledge_assembler import KnowledgeAssembler

        threat_search = ThreatSearch(settings.qdrant_path)
        vector_search = VectorSearch(threat_search)
        logger.info("Qdrant 초기화 완료: path=%s", settings.qdrant_path)
    except Exception as e:
        logger.warning("Qdrant 초기화 실패 (데이터 미적재 시 정상): %s", e)
        vector_search = None

    # Neo4j 그래프 초기화
    neo4j_graph = None
    code_graph_svc = None

    try:
        from app.graphrag.neo4j_graph import Neo4jGraph
        from app.graphrag.code_graph_service import CodeGraphService

        driver = neo4j.GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        driver.verify_connectivity()

        neo4j_graph = Neo4jGraph(driver)
        code_graph_svc = CodeGraphService(driver)

        logger.info(
            "Neo4j 연결 완료: %d nodes, %d edges",
            neo4j_graph.node_count, neo4j_graph.edge_count,
        )
    except Exception as e:
        logger.warning("Neo4j 연결 실패 (미설치 시 정상): %s", e)

    # KnowledgeAssembler 조립 (벡터 + 그래프)
    if vector_search and neo4j_graph:
        from app.graphrag.knowledge_assembler import KnowledgeAssembler
        assembler = KnowledgeAssembler(vector_search, neo4j_graph)
    elif vector_search:
        # Neo4j 없으면 벡터만 사용 (그래프 보강 없음)
        logger.warning("Neo4j 미연결 — 벡터 검색만 사용")
        from app.graphrag.knowledge_assembler import KnowledgeAssembler
        from app.graphrag.neo4j_graph import Neo4jGraph
        # fallback: assembler without graph (graph methods return empty)
        assembler = None

    api.set_assembler(assembler)
    api.set_neo4j_graph(neo4j_graph)
    code_graph_api.set_service(code_graph_svc)

    logger.info("Knowledge Base 초기화 완료")

    yield

    if threat_search:
        threat_search.close()
    if driver:
        driver.close()
        logger.info("Neo4j 연결 종료")


app = FastAPI(
    title="Smartcar Knowledge Base",
    description="위협 지식 검색 서비스 — Qdrant 벡터 검색 + Neo4j 관계 그래프",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router)
app.include_router(code_graph_api.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
