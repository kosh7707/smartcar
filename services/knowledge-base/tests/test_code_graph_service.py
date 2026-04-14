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

    call_count = [0]
    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "RETURN count(n) AS cnt" in query and "MATCH (n:Function {project_id: $pid}) " in query and "DETACH DELETE" not in query:
            call_count[0] += 1
            if call_count[0] == 1:
                result.single.return_value = {"cnt": 0}
            else:
                result.single.return_value = {"cnt": 4}
            return result
        if "DETACH DELETE" in query:
            return result
        if "UNWIND" in query:
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
    assert result["replaceMode"] == "replace_project_graph"
    assert result["replacedExistingGraph"] is False
    assert session.run.call_count >= 4  # existing count + delete + create nodes + create edges + stats


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


def test_get_function():
    svc, session = _make_service()

    record = MagicMock()
    record.__getitem__ = lambda self, key: {
        "name": "postJson", "file": "http_client.cpp", "line": 8,
        "origin": None, "original_lib": None, "original_version": None,
    }[key]
    record.keys = lambda: ["name", "file", "line", "origin", "original_lib", "original_version"]
    result = MagicMock()
    result.single.return_value = record
    session.run.return_value = result

    func = svc.get_function("test-project", "postJson")
    assert func is not None
    assert func["name"] == "postJson"
    assert func["file"] == "http_client.cpp"


def test_get_function_not_found():
    svc, session = _make_service()

    result = MagicMock()
    result.single.return_value = None
    session.run.return_value = result

    func = svc.get_function("test-project", "nonexistent")
    assert func is None


# ── origin 메타데이터 ──


def test_normalize_functions_camelcase():
    """S4 camelCase → snake_case 변환 확인."""
    from app.graphrag.code_graph_service import CodeGraphService

    functions = [
        {
            "name": "curl_exec",
            "file": "third-party/libcurl/curl_exec.c",
            "line": 42,
            "origin": "modified-third-party",
            "originalLib": "libcurl",
            "originalVersion": "7.68.0",
        },
    ]
    normalized = CodeGraphService._normalize_functions(functions)

    assert normalized[0]["original_lib"] == "libcurl"
    assert normalized[0]["original_version"] == "7.68.0"
    assert normalized[0]["origin"] == "modified-third-party"


def test_normalize_functions_no_origin():
    """origin 필드 없는 일반 프로젝트 함수도 정상 처리."""
    from app.graphrag.code_graph_service import CodeGraphService

    functions = [
        {"name": "main", "file": "src/main.cpp", "line": 1},
    ]
    normalized = CodeGraphService._normalize_functions(functions)

    assert normalized[0]["name"] == "main"
    assert normalized[0]["origin"] is None
    assert normalized[0]["original_lib"] is None


def test_normalize_functions_with_route_provenance():
    from app.graphrag.code_graph_service import CodeGraphService

    functions = [{"name": "main", "file": "src/main.cpp", "line": 1}]
    normalized = CodeGraphService._normalize_functions(
        functions,
        provenance={
            "buildSnapshotId": "snap-1",
            "buildUnitId": "unit-1",
            "sourceBuildAttemptId": "attempt-1",
        },
    )

    assert normalized[0]["build_snapshot_id"] == "snap-1"
    assert normalized[0]["build_unit_id"] == "unit-1"
    assert normalized[0]["source_build_attempt_id"] == "attempt-1"


def test_ingest_with_origin():
    """origin 포함 함수 적재 시 Neo4j SET 쿼리에 origin 필드 포함 확인."""
    svc, session = _make_service()

    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "count(n)" in query:
            result.single.return_value = {"cnt": 2}
        elif "count(r)" in query:
            result.single.return_value = {"cnt": 1}
        elif "DISTINCT n.file" in query:
            result.__iter__ = MagicMock(return_value=iter([{"file": "curl_exec.c"}]))
        return result

    session.run.side_effect = run_side_effect

    functions = [
        {
            "name": "curl_exec",
            "file": "third-party/libcurl/curl_exec.c",
            "line": 42,
            "calls": ["curl_multi_perform"],
            "originalLib": "libcurl",
            "originalVersion": "7.68.0",
            "origin": "modified-third-party",
        },
    ]

    result = svc.ingest("test-project", functions)
    assert result["project_id"] == "test-project"

    # UNWIND 쿼리에 origin 필드가 포함되었는지 확인
    unwind_calls = [
        call for call in session.run.call_args_list
        if "UNWIND" in str(call) and "origin" in str(call)
    ]
    assert len(unwind_calls) >= 1


def test_ingest_returns_provenance():
    svc, session = _make_service()

    count_calls = [0]
    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "RETURN count(n) AS cnt" in query and "MATCH (n:Function {project_id: $pid}) " in query and "DETACH DELETE" not in query:
            count_calls[0] += 1
            result.single.return_value = {"cnt": 0 if count_calls[0] == 1 else 1}
        elif "count(r)" in query:
            result.single.return_value = {"cnt": 0}
        elif "DISTINCT n.file" in query:
            result.__iter__ = MagicMock(return_value=iter([{"file": "main.cpp"}]))
        return result

    session.run.side_effect = run_side_effect

    result = svc.ingest(
        "test-project",
        [{"name": "main", "file": "main.cpp", "line": 1, "calls": ["popen"]}],
        provenance={"buildSnapshotId": "snap-1", "buildUnitId": "unit-1"},
    )

    assert result["provenance"] == {
        "buildSnapshotId": "snap-1",
        "buildUnitId": "unit-1",
        "sourceBuildAttemptId": None,
    }

    edge_calls = [
        call for call in session.run.call_args_list
        if "MERGE (caller)-[:CALLS]->(callee)" in str(call)
    ]
    assert edge_calls
    assert edge_calls[0].kwargs["build_snapshot_id"] == "snap-1"


def test_ingest_marks_existing_graph_replacement():
    svc, session = _make_service()

    count_calls = [0]

    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "RETURN count(n) AS cnt" in query and "MATCH (n:Function {project_id: $pid}) " in query and "DETACH DELETE" not in query:
            count_calls[0] += 1
            result.single.return_value = {"cnt": 2 if count_calls[0] == 1 else 1}
        elif "count(r)" in query:
            result.single.return_value = {"cnt": 0}
        elif "DISTINCT n.file" in query:
            result.__iter__ = MagicMock(return_value=iter([{"file": "main.cpp"}]))
        return result

    session.run.side_effect = run_side_effect

    result = svc.ingest(
        "test-project",
        [{"name": "main", "file": "main.cpp", "line": 1, "calls": []}],
    )

    assert result["replaceMode"] == "replace_project_graph"
    assert result["replacedExistingGraph"] is True


def test_get_function_with_provenance_filter():
    svc, session = _make_service()

    result = MagicMock()
    result.single.return_value = {
        "name": "postJson",
        "file": "http_client.cpp",
        "line": 8,
        "origin": None,
        "original_lib": None,
        "original_version": None,
        "build_snapshot_id": "snap-1",
        "build_unit_id": "unit-1",
        "source_build_attempt_id": "attempt-1",
    }
    session.run.return_value = result

    func = svc.get_function("test-project", "postJson", build_snapshot_id="snap-1")

    assert func["provenance"] == {
        "buildSnapshotId": "snap-1",
        "buildUnitId": "unit-1",
        "sourceBuildAttemptId": "attempt-1",
    }
    assert session.run.call_args.kwargs["build_snapshot_id"] == "snap-1"
    query = session.run.call_args[0][0]
    assert "properties(fn)['build_snapshot_id'] = $build_snapshot_id" in query
    assert "coalesce(properties(fn)['build_unit_id'], null) AS build_unit_id" in query


def test_get_stats_with_snapshot_filter_counts_both_edge_ends():
    svc, session = _make_service()

    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "count(n)" in query:
            result.single.return_value = {"cnt": 2}
        elif "count(r)" in query:
            result.single.return_value = {"cnt": 1}
        elif "DISTINCT n.file" in query:
            result.__iter__ = MagicMock(return_value=iter([{"file": "main.cpp"}]))
        return result

    session.run.side_effect = run_side_effect

    svc.get_stats("test-project", build_snapshot_id="snap-1")

    edge_query = session.run.call_args_list[1][0][0]
    assert "properties(endNode(r))['build_snapshot_id']" in edge_query


def test_find_dangerous_callers_uses_map_access_for_optional_provenance():
    svc, session = _make_service()

    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter([]))
    session.run.return_value = result

    svc.find_dangerous_callers("test-project", ["popen"], build_snapshot_id="snap-1")

    query = session.run.call_args[0][0]
    assert "properties(caller)['build_snapshot_id'] = $build_snapshot_id" in query
    assert "coalesce(properties(caller)['source_build_attempt_id'], null)" in query


def test_export_project():
    svc, session = _make_service()

    mock_records = [
        {
            "name": "main",
            "file": "main.cpp",
            "line": 1,
            "origin": None,
            "original_lib": None,
            "original_version": None,
            "build_snapshot_id": "snap-1",
            "build_unit_id": "unit-1",
            "source_build_attempt_id": None,
            "calls": ["helper", None],
        },
        {
            "name": "helper",
            "file": "helper.cpp",
            "line": 2,
            "origin": "modified-third-party",
            "original_lib": "libx",
            "original_version": "1.2.3",
            "build_snapshot_id": None,
            "build_unit_id": None,
            "source_build_attempt_id": None,
            "calls": [],
        },
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    exported = svc.export_project("test-project")

    assert exported[0]["name"] == "main"
    assert exported[0]["calls"] == ["helper"]
    assert exported[0]["provenance"]["buildSnapshotId"] == "snap-1"
    assert exported[1]["originalLib"] == "libx"


def test_activate_staging():
    svc, session = _make_service()

    def run_side_effect(query, **kwargs):
        result = MagicMock()
        if "count(n)" in query:
            result.single.return_value = {"cnt": 2}
        elif "count(r)" in query:
            result.single.return_value = {"cnt": 1}
        elif "DISTINCT n.file" in query:
            result.__iter__ = MagicMock(return_value=iter([{"file": "main.cpp"}]))
        return result

    session.run.side_effect = run_side_effect

    stats = svc.activate_staging("__staging__", "test-project")

    assert stats["nodeCount"] == 2
    queries = [call.args[0] for call in session.run.call_args_list]
    assert any("DETACH DELETE" in query for query in queries)
    assert any("SET n.project_id = $pid" in query for query in queries)
