"""Phase 1+2: HTTP 에러 시맨틱 + Health/Readiness 분리 테스트."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import api


@pytest.fixture(autouse=True)
def _reset_state():
    """테스트 전후 글로벌 상태 초기화."""
    old_assembler = api._assembler
    old_graph = api._neo4j_graph
    api.set_assembler(None)
    api.set_neo4j_graph(None)
    yield
    api.set_assembler(old_assembler)
    api.set_neo4j_graph(old_graph)


client = TestClient(app, raise_server_exceptions=False)


def _assert_503_format(resp, expected_code="KB_NOT_READY"):
    """503 응답이 observability.md 에러 포맷을 따르는지 검증."""
    assert resp.status_code == 503
    body = resp.json()
    assert body["success"] is False
    assert "error" in body
    assert body["errorDetail"]["code"] == expected_code
    assert body["errorDetail"]["retryable"] is True


# ── Phase 1: 미초기화 시 503 반환 ──


_TIMEOUT_HEADER = {"X-Timeout-Ms": "10000"}


def test_search_uninitialized_returns_503():
    resp = client.post("/v1/search", json={"query": "CWE-78"}, headers=_TIMEOUT_HEADER)
    _assert_503_format(resp)


def test_search_batch_uninitialized_returns_503():
    resp = client.post(
        "/v1/search/batch",
        json={"queries": [{"query": "test"}]},
        headers=_TIMEOUT_HEADER,
    )
    _assert_503_format(resp)


def test_graph_stats_uninitialized_returns_503():
    resp = client.get("/v1/graph/stats")
    _assert_503_format(resp)


def test_graph_neighbors_uninitialized_returns_503():
    resp = client.get("/v1/graph/neighbors/CWE-78")
    _assert_503_format(resp)


def test_error_includes_request_id():
    resp = client.post(
        "/v1/search",
        json={"query": "test"},
        headers={"X-Request-Id": "req-test-123", "X-Timeout-Ms": "10000"},
    )
    _assert_503_format(resp)
    assert resp.json()["errorDetail"]["requestId"] == "req-test-123"


def test_search_missing_timeout_returns_400():
    """X-Timeout-Ms 헤더 누락 시 400 반환."""
    resp = client.post("/v1/search", json={"query": "test"})
    assert resp.status_code == 400
    assert "X-Timeout-Ms" in resp.json()["error"]


# ── Phase 2: Health / Readiness ──


def test_health_always_200():
    resp = client.get("/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "aegis-knowledge-base"
    assert "initialized" not in body  # 이전 필드 제거됨
    assert "graph" not in body


def test_ready_returns_503_when_not_initialized():
    resp = client.get("/v1/ready")
    _assert_503_format(resp)


def test_ready_returns_200_when_initialized():
    class FakeGraph:
        node_count = 100
        edge_count = 200

    class FakeAssembler:
        pass

    api.set_assembler(FakeAssembler())
    api.set_neo4j_graph(FakeGraph())

    resp = client.get("/v1/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ready"] is True
    assert body["components"]["qdrant"]["initialized"] is True
    assert body["components"]["neo4j"]["connected"] is True
    assert body["components"]["neo4j"]["nodeCount"] == 100


# ── 전역 HTTPException 핸들러 ──


def test_http_exception_uses_observability_format():
    """기존 HTTPException(404)도 observability 포맷으로 변환되는지 확인."""

    class FakeGraph:
        node_count = 10
        edge_count = 5

        def get_node_info(self, node_id):
            return None

    api.set_neo4j_graph(FakeGraph())
    api.set_assembler(object())  # assembler만 truthy면 됨

    resp = client.get("/v1/graph/neighbors/NONEXISTENT")
    assert resp.status_code == 404
    body = resp.json()
    assert body["success"] is False
    assert body["errorDetail"]["code"] == "NOT_FOUND"
