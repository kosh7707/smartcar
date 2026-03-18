"""CodeGraphService 단위 테스트 — Neo4j 드라이버를 mock하여 검증."""

from unittest.mock import MagicMock

from app.graphrag.code_graph_service import CodeGraphService


def _mock_driver():
    driver = MagicMock()
    return driver


def _make_service():
    driver = _mock_driver()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    return CodeGraphService(driver), session


def test_ingest():
    svc, session = _make_service()

    # get_stats mock (called after ingest)
    call_count = [0]
    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "DETACH DELETE" in query:
            return result
        if "UNWIND" in query:
            return result
        if "count(n)" in query:
            result.single.return_value = {"cnt": 4}
            return result
        if "count(r)" in query:
            result.single.return_value = {"cnt": 3}
            return result
        if "DISTINCT n.file" in query:
            result.__iter__ = MagicMock(return_value=iter([{"file": "http_client.cpp"}]))
            return result
        return result

    session.run.side_effect = run_side_effect

    functions = [
        {"name": "postJson", "file": "http_client.cpp", "line": 8, "calls": ["popen", "fgets"]},
        {"name": "main", "file": "main.cpp", "line": 1, "calls": ["postJson"]},
    ]

    result = svc.ingest("test-project", functions)
    assert result["project_id"] == "test-project"
    assert session.run.call_count >= 3  # delete + create nodes + create edges + stats


def test_get_callers():
    svc, session = _make_service()

    mock_records = [
        {"name": "main", "file": "main.cpp", "line": 1},
        {"name": "postJson", "file": "http_client.cpp", "line": 8},
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    callers = svc.get_callers("test-project", "popen", depth=3)
    assert len(callers) == 2
    assert callers[0]["name"] == "main"


def test_get_callees():
    svc, session = _make_service()

    mock_records = [
        {"name": "popen", "file": None, "line": None},
        {"name": "fgets", "file": None, "line": None},
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    callees = svc.get_callees("test-project", "postJson")
    assert len(callees) == 2
    names = [c["name"] for c in callees]
    assert "popen" in names
    assert "fgets" in names


def test_find_dangerous_callers():
    svc, session = _make_service()

    mock_records = [
        {"name": "postJson", "file": "http_client.cpp", "line": 8, "dangerous_calls": ["popen"]},
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    results = svc.find_dangerous_callers("test-project", ["popen", "system", "memcpy"])
    assert len(results) == 1
    assert results[0]["name"] == "postJson"
    assert "popen" in results[0]["dangerous_calls"]


def test_list_projects():
    svc, session = _make_service()

    mock_records = [{"pid": "proj-a"}, {"pid": "proj-b"}]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    projects = svc.list_projects()
    assert "proj-a" in projects
    assert "proj-b" in projects


def test_delete_project():
    svc, session = _make_service()

    result = MagicMock()
    result.single.return_value = {"cnt": 5}
    session.run.return_value = result

    deleted = svc.delete_project("test-project")
    assert deleted is True


def test_delete_nonexistent_project():
    svc, session = _make_service()

    result = MagicMock()
    result.single.return_value = None
    session.run.return_value = result

    deleted = svc.delete_project("nonexistent")
    assert deleted is False
