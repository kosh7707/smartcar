"""ContextEnricher 단위 테스트 — 쿼리 추출 + 포맷팅."""
from unittest.mock import MagicMock

from app.rag.context_enricher import ContextEnricher
from app.rag.threat_search import ThreatHit
from app.schemas.request import Context, TaskRequest
from app.types import TaskType


def _make_request(task_type: TaskType, trusted: dict) -> TaskRequest:
    return TaskRequest(
        taskType=task_type,
        taskId="test-rag-001",
        context=Context(trusted=trusted),
        evidenceRefs=[],
    )


def _make_hit(
    id: str = "CWE-120",
    source: str = "CWE",
    title: str = "Buffer Overflow",
    score: float = 0.9,
    **kwargs,
) -> ThreatHit:
    return ThreatHit(
        id=id,
        source=source,
        title=title,
        threat_category=kwargs.get("threat_category", "Memory Corruption"),
        severity=kwargs.get("severity"),
        attack_surfaces=kwargs.get("attack_surfaces", []),
        related_cwe=kwargs.get("related_cwe", []),
        related_cve=kwargs.get("related_cve", []),
        related_attack=kwargs.get("related_attack", []),
        score=score,
    )


def test_static_explain_extracts_finding_info():
    """static-explain: finding의 title + ruleId로 쿼리 생성."""
    mock_search = MagicMock()
    mock_search.search.return_value = [_make_hit()]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_EXPLAIN, {
        "finding": {"title": "Buffer Overflow", "ruleId": "CWE-120", "severity": "critical"},
    })

    context, hits = enricher.enrich(request, top_k=3)

    mock_search.search.assert_called_once()
    call_args = mock_search.search.call_args
    query = call_args[0][0]
    assert "Buffer Overflow" in query
    assert "CWE-120" in query
    assert hits == 1
    assert context  # non-empty


def test_dynamic_annotate_extracts_rule_titles():
    """dynamic-annotate: ruleMatches의 title들로 쿼리 생성."""
    mock_search = MagicMock()
    mock_search.search.return_value = [_make_hit()]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.DYNAMIC_ANNOTATE, {
        "ruleMatches": [
            {"title": "DoS Flooding Attack"},
            {"title": "CAN Bus Injection"},
        ],
    })

    context, hits = enricher.enrich(request, top_k=3)

    query = mock_search.search.call_args[0][0]
    assert "DoS Flooding Attack" in query
    assert "CAN Bus Injection" in query


def test_test_plan_extracts_objective():
    """test-plan-propose: objective + targetProtocol로 쿼리 생성."""
    mock_search = MagicMock()
    mock_search.search.return_value = [_make_hit()]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.TEST_PLAN_PROPOSE, {
        "objective": "ECU SecurityAccess 우회 테스트",
        "targetProtocol": "UDS",
    })

    context, hits = enricher.enrich(request, top_k=3)

    query = mock_search.search.call_args[0][0]
    assert "ECU SecurityAccess" in query
    assert "UDS" in query


def test_static_cluster_extracts_finding_titles():
    """static-cluster: findings 목록의 title들로 쿼리 생성."""
    mock_search = MagicMock()
    mock_search.search.return_value = [_make_hit()]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_CLUSTER, {
        "findings": [
            {"title": "Buffer Overflow"},
            {"title": "Integer Overflow"},
        ],
    })

    context, hits = enricher.enrich(request, top_k=3)

    query = mock_search.search.call_args[0][0]
    assert "Buffer Overflow" in query
    assert "Integer Overflow" in query


def test_report_draft_extracts_confirmed_findings():
    """report-draft: confirmedFindings의 title들로 쿼리 생성."""
    mock_search = MagicMock()
    mock_search.search.return_value = [_make_hit()]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.REPORT_DRAFT, {
        "confirmedFindings": [
            {"title": "Use-After-Free"},
        ],
    })

    context, hits = enricher.enrich(request, top_k=3)

    query = mock_search.search.call_args[0][0]
    assert "Use-After-Free" in query


def test_static_explain_fallback_to_rule_matches():
    """static-explain: finding 없으면 ruleMatches에서 쿼리 추출 (S2 실 포맷)."""
    mock_search = MagicMock()
    mock_search.search.return_value = [_make_hit()]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_EXPLAIN, {
        "ruleMatches": [
            {"ruleId": "CWE-120", "title": "Buffer Overflow", "severity": "critical"},
            {"ruleId": "CWE-787", "title": "Out-of-bounds Write"},
        ],
    })

    context, hits = enricher.enrich(request, top_k=3)

    query = mock_search.search.call_args[0][0]
    assert "Buffer Overflow" in query
    assert "CWE-120" in query
    assert "Out-of-bounds Write" in query
    assert "CWE-787" in query
    assert hits == 1


def test_empty_query_returns_empty():
    """쿼리 추출 실패 시 빈 컨텍스트."""
    mock_search = MagicMock()

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_EXPLAIN, {})  # no finding or ruleMatches

    context, hits = enricher.enrich(request)

    assert context == ""
    assert hits == 0
    mock_search.search.assert_not_called()


def test_no_hits_returns_empty():
    """검색 결과 없으면 빈 컨텍스트."""
    mock_search = MagicMock()
    mock_search.search.return_value = []

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_EXPLAIN, {
        "finding": {"title": "Some Weakness", "ruleId": "CWE-999"},
    })

    context, hits = enricher.enrich(request)

    assert context == ""
    assert hits == 0


def test_format_hits_includes_crossrefs():
    """포맷된 컨텍스트에 교차참조가 포함된다."""
    mock_search = MagicMock()
    mock_search.search.return_value = [
        _make_hit(
            "CWE-787", "CWE", "Out-of-bounds Write", 0.95,
            severity=None,
            related_cwe=["CWE-119"],
            related_cve=["CVE-2023-29389"],
            related_attack=["T0866"],
            attack_surfaces=["ECU/게이트웨이"],
        ),
    ]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_EXPLAIN, {
        "finding": {"title": "OOB Write", "ruleId": "CWE-787"},
    })

    context, hits = enricher.enrich(request)

    assert "CWE-787" in context
    assert "Out-of-bounds Write" in context
    assert "CVE-2023-29389" in context
    assert "T0866" in context
    assert "ECU/게이트웨이" in context


def test_format_hits_includes_severity():
    """CVSS 점수가 포맷에 포함된다."""
    mock_search = MagicMock()
    mock_search.search.return_value = [
        _make_hit("CVE-2023-001", "CVE", "Some CVE", 0.88, severity=9.8),
    ]

    enricher = ContextEnricher(mock_search)
    request = _make_request(TaskType.STATIC_EXPLAIN, {
        "finding": {"title": "test", "ruleId": "R1"},
    })

    context, _ = enricher.enrich(request)

    assert "CVSS 9.8" in context
