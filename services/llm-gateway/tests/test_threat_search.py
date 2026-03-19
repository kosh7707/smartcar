"""ThreatSearch 단위 테스트 — S5 KB HTTP 클라이언트 모킹."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

import httpx

from app.rag.threat_search import ThreatHit, ThreatSearch


def _s5_response(hits: list[dict], total: int | None = None) -> dict:
    """S5 POST /v1/search 응답 구조."""
    return {
        "query": "test",
        "hits": hits,
        "total": total if total is not None else len(hits),
        "extracted_ids": [],
        "related_cwe": [],
        "related_cve": [],
        "related_attack": [],
    }


def _s5_hit(
    id: str = "CWE-120",
    source: str = "CWE",
    title: str = "Buffer Copy without Checking Size of Input",
    score: float = 0.92,
    threat_category: str = "Memory Corruption",
    graph_relations: dict | None = None,
) -> dict:
    hit = {
        "id": id,
        "source": source,
        "title": title,
        "score": score,
        "threat_category": threat_category,
        "match_type": "vector_semantic",
    }
    if graph_relations:
        hit["graph_relations"] = graph_relations
    return hit


@pytest.mark.asyncio
async def test_search_returns_threat_hits():
    """검색 결과가 ThreatHit 리스트로 변환된다."""
    ts = ThreatSearch("http://localhost:8002")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = _s5_response([
        _s5_hit("CWE-120", "CWE", "Buffer Overflow", 0.95),
        _s5_hit("CVE-2023-29389", "CVE", "CVE-2023-29389", 0.87),
    ])

    ts._client.post = AsyncMock(return_value=mock_response)

    hits = await ts.search("buffer overflow", top_k=5)

    assert len(hits) == 2
    assert isinstance(hits[0], ThreatHit)
    assert hits[0].id == "CWE-120"
    assert hits[0].source == "CWE"
    assert hits[0].score == 0.95
    assert hits[1].id == "CVE-2023-29389"

    await ts.close()


@pytest.mark.asyncio
async def test_search_empty_results():
    """검색 결과가 없으면 빈 리스트."""
    ts = ThreatSearch("http://localhost:8002")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = _s5_response([])

    ts._client.post = AsyncMock(return_value=mock_response)

    hits = await ts.search("nonexistent query")

    assert hits == []
    await ts.close()


@pytest.mark.asyncio
async def test_search_preserves_crossrefs():
    """교차참조 필드가 graph_relations에서 올바르게 매핑된다."""
    ts = ThreatSearch("http://localhost:8002")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = _s5_response([
        _s5_hit(
            "CWE-787", "CWE", "Out-of-bounds Write", 0.91,
            graph_relations={
                "cwe": ["CWE-119"],
                "cve": ["CVE-2023-29389"],
                "attack": ["T0866"],
            },
        ),
    ])

    ts._client.post = AsyncMock(return_value=mock_response)

    hits = await ts.search("memory write")

    assert hits[0].related_cwe == ["CWE-119"]
    assert hits[0].related_cve == ["CVE-2023-29389"]
    assert hits[0].related_attack == ["T0866"]
    await ts.close()


@pytest.mark.asyncio
async def test_http_error_returns_empty():
    """S5 HTTP 에러 시 빈 리스트 (graceful degradation)."""
    ts = ThreatSearch("http://localhost:8002")

    ts._client.post = AsyncMock(
        side_effect=httpx.ConnectError("connection refused")
    )

    hits = await ts.search("buffer overflow")

    assert hits == []
    await ts.close()


@pytest.mark.asyncio
async def test_timeout_returns_empty():
    """S5 타임아웃 시 빈 리스트 (graceful degradation)."""
    ts = ThreatSearch("http://localhost:8002")

    ts._client.post = AsyncMock(
        side_effect=httpx.TimeoutException("read timed out")
    )

    hits = await ts.search("buffer overflow")

    assert hits == []
    await ts.close()


@pytest.mark.asyncio
async def test_close_calls_aclose():
    """close()가 httpx 클라이언트를 정리한다."""
    ts = ThreatSearch("http://localhost:8002")
    ts._client.aclose = AsyncMock()

    await ts.close()

    ts._client.aclose.assert_called_once()
