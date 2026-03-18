"""Neo4jGraph 단위 테스트 — Neo4j 드라이버를 mock하여 검증."""

from unittest.mock import MagicMock, patch

from app.graphrag.neo4j_graph import Neo4jGraph


def _mock_driver():
    """Neo4j 드라이버 mock을 생성한다."""
    driver = MagicMock()
    return driver


def _make_session_run_results(results_map: dict):
    """session.run() 호출 시 쿼리 패턴에 따라 다른 결과를 반환하는 mock."""
    def side_effect(query, **kwargs):
        mock_result = MagicMock()
        for pattern, data in results_map.items():
            if pattern in query:
                if isinstance(data, list):
                    mock_result.__iter__ = MagicMock(return_value=iter(data))
                    if data:
                        mock_result.single.return_value = data[0]
                    else:
                        mock_result.single.return_value = None
                elif isinstance(data, dict):
                    mock_result.single.return_value = data
                    mock_result.__iter__ = MagicMock(return_value=iter([data]))
                return mock_result
        # 기본: 빈 결과
        mock_result.single.return_value = {"cnt": 0}
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        return mock_result
    return side_effect


def test_node_count():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)

    result = MagicMock()
    result.single.return_value = {"cnt": 1729}
    session.run.return_value = result

    graph = Neo4jGraph(driver)
    assert graph.node_count == 1729


def test_edge_count():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)

    result = MagicMock()
    result.single.return_value = {"cnt": 5432}
    session.run.return_value = result

    graph = Neo4jGraph(driver)
    assert graph.edge_count == 5432


def test_neighbors():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)

    mock_records = [{"mid": "CVE-2021-28372"}, {"mid": "CAPEC-88"}]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    graph = Neo4jGraph(driver)
    neighbors = graph.neighbors("CWE-78", depth=2)
    assert "CVE-2021-28372" in neighbors
    assert "CAPEC-88" in neighbors


def test_get_related():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)

    mock_records = [
        {"rel_type": "RELATED_CVE", "mid": "CVE-2021-28372"},
        {"rel_type": "RELATED_CAPEC", "mid": "CAPEC-88"},
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    graph = Neo4jGraph(driver)
    related = graph.get_related("CWE-78")
    assert "cve" in related
    assert "CVE-2021-28372" in related["cve"]
    assert "capec" in related
    assert "CAPEC-88" in related["capec"]


def test_get_node_info_found():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)

    # neo4j Node를 dict-like mock으로
    mock_node = {"id": "CWE-78", "title": "OS Command Injection", "severity": None}
    record = MagicMock()
    record.__getitem__ = lambda self, key: mock_node
    result = MagicMock()
    result.single.return_value = record
    session.run.return_value = result

    graph = Neo4jGraph(driver)
    info = graph.get_node_info("CWE-78")
    assert info is not None


def test_get_node_info_not_found():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)

    result = MagicMock()
    result.single.return_value = None
    session.run.return_value = result

    graph = Neo4jGraph(driver)
    info = graph.get_node_info("NONEXISTENT")
    assert info is None
