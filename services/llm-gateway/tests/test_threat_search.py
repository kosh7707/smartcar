"""ThreatSearch 단위 테스트 — Qdrant 모킹."""
from unittest.mock import MagicMock, patch

from app.rag.threat_search import ThreatHit, ThreatSearch


def _mock_query_result(
    id: str = "CWE-120",
    source: str = "CWE",
    title: str = "Buffer Copy without Checking Size of Input",
    score: float = 0.92,
    **kwargs,
):
    """Qdrant query 결과 모킹 객체."""
    r = MagicMock()
    r.metadata = {
        "id": id,
        "source": source,
        "title": title,
        "threat_category": kwargs.get("threat_category", "Memory Corruption"),
        "severity": kwargs.get("severity"),
        "attack_surfaces": kwargs.get("attack_surfaces", []),
        "related_cwe": kwargs.get("related_cwe", []),
        "related_cve": kwargs.get("related_cve", []),
        "related_attack": kwargs.get("related_attack", []),
    }
    r.score = score
    return r


@patch("app.rag.threat_search.QdrantClient")
def test_search_returns_threat_hits(mock_client_cls):
    """검색 결과가 ThreatHit 리스트로 변환된다."""
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    # 컬렉션 존재 확인 모킹
    col = MagicMock()
    col.name = "threat_knowledge"
    mock_client.get_collections.return_value = MagicMock(collections=[col])

    mock_client.query.return_value = [
        _mock_query_result("CWE-120", "CWE", "Buffer Overflow", 0.95, severity=None),
        _mock_query_result("CVE-2023-29389", "CVE", "CVE-2023-29389", 0.87, severity=9.8),
    ]

    ts = ThreatSearch("/fake/path")
    hits = ts.search("buffer overflow", top_k=5)

    assert len(hits) == 2
    assert isinstance(hits[0], ThreatHit)
    assert hits[0].id == "CWE-120"
    assert hits[0].source == "CWE"
    assert hits[0].score == 0.95
    assert hits[1].severity == 9.8


@patch("app.rag.threat_search.QdrantClient")
def test_search_empty_results(mock_client_cls):
    """검색 결과가 없으면 빈 리스트."""
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    col = MagicMock()
    col.name = "threat_knowledge"
    mock_client.get_collections.return_value = MagicMock(collections=[col])

    mock_client.query.return_value = []

    ts = ThreatSearch("/fake/path")
    hits = ts.search("nonexistent query")

    assert hits == []


@patch("app.rag.threat_search.QdrantClient")
def test_search_preserves_crossrefs(mock_client_cls):
    """교차참조 필드가 올바르게 매핑된다."""
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    col = MagicMock()
    col.name = "threat_knowledge"
    mock_client.get_collections.return_value = MagicMock(collections=[col])

    mock_client.query.return_value = [
        _mock_query_result(
            "CWE-787", "CWE", "Out-of-bounds Write", 0.91,
            related_cwe=["CWE-119"],
            related_cve=["CVE-2023-29389"],
            related_attack=["T0866"],
        ),
    ]

    ts = ThreatSearch("/fake/path")
    hits = ts.search("memory write")

    assert hits[0].related_cwe == ["CWE-119"]
    assert hits[0].related_cve == ["CVE-2023-29389"]
    assert hits[0].related_attack == ["T0866"]


@patch("app.rag.threat_search.QdrantClient")
def test_min_score_filters_low_relevance(mock_client_cls):
    """min_score 미만 결과가 제외된다."""
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    col = MagicMock()
    col.name = "threat_knowledge"
    mock_client.get_collections.return_value = MagicMock(collections=[col])

    mock_client.query.return_value = [
        _mock_query_result("CWE-120", "CWE", "Buffer Overflow", 0.92),
        _mock_query_result("CWE-787", "CWE", "OOB Write", 0.65),
        _mock_query_result("CWE-200", "CWE", "Info Exposure", 0.30),
        _mock_query_result("CWE-79", "CWE", "XSS", 0.15),
        _mock_query_result("CWE-89", "CWE", "SQL Injection", 0.10),
    ]

    ts = ThreatSearch("/fake/path")

    # min_score=0.35 → 0.30, 0.15, 0.10 제외
    hits = ts.search("buffer overflow", top_k=5, min_score=0.35)
    assert len(hits) == 2
    assert hits[0].id == "CWE-120"
    assert hits[1].id == "CWE-787"

    # min_score=0 → 전부 포함
    hits_all = ts.search("buffer overflow", top_k=5, min_score=0.0)
    assert len(hits_all) == 5


@patch("app.rag.threat_search.QdrantClient")
def test_missing_collection_raises(mock_client_cls):
    """컬렉션이 없으면 RuntimeError."""
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client
    mock_client.get_collections.return_value = MagicMock(collections=[])

    try:
        ThreatSearch("/fake/path")
        assert False, "Should have raised RuntimeError"
    except RuntimeError as e:
        assert "threat_knowledge" in str(e)


@patch("app.rag.threat_search.QdrantClient")
def test_close_calls_client_close(mock_client_cls):
    """close()가 Qdrant 클라이언트를 정리한다."""
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    col = MagicMock()
    col.name = "threat_knowledge"
    mock_client.get_collections.return_value = MagicMock(collections=[col])

    ts = ThreatSearch("/fake/path")
    ts.close()

    mock_client.close.assert_called_once()
