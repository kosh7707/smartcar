"""CodeVectorSearch 단위 테스트 — QdrantClient를 mock하여 검증."""

from unittest.mock import MagicMock, patch

from app.graphrag.code_vector_search import CodeVectorSearch, CodeFunctionHit, COLLECTION


def _make_client():
    client = MagicMock()
    coll = MagicMock()
    coll.name = COLLECTION
    client.get_collections.return_value.collections = [coll]
    return client


# ── _build_document ──


def test_build_document_basic():
    func = {"name": "postJson", "file": "src/http_client.cpp", "line": 8, "calls": ["fopen", "fclose"]}
    doc = CodeVectorSearch._build_document(func)
    assert "Function: postJson" in doc
    assert "File: src/http_client.cpp (line 8)" in doc
    assert "Calls: fopen, fclose" in doc
    assert "dangerous" not in doc.lower()


def test_build_document_dangerous_calls():
    func = {"name": "execCmd", "file": "src/util.cpp", "line": 5, "calls": ["popen", "fgets", "strlen"]}
    doc = CodeVectorSearch._build_document(func)
    assert "Calls dangerous functions: popen, fgets" in doc


def test_build_document_with_origin():
    func = {
        "name": "curl_exec", "file": "lib/curl.c", "line": 42,
        "calls": [], "origin": "modified-third-party",
        "originalLib": "libcurl", "originalVersion": "7.68.0",
    }
    doc = CodeVectorSearch._build_document(func)
    assert "Origin: modified-third-party (libcurl 7.68.0)" in doc


def test_build_document_minimal():
    func = {"name": "main"}
    doc = CodeVectorSearch._build_document(func)
    assert doc == "Function: main"


# ── ingest ──


def test_ingest():
    client = _make_client()
    vs = CodeVectorSearch(client)

    functions = [
        {"name": "postJson", "file": "src/http_client.cpp", "line": 8, "calls": ["popen"]},
        {"name": "main", "file": "src/main.cpp", "line": 1, "calls": ["postJson"]},
    ]
    count = vs.ingest("proj-1", functions)

    assert count == 2
    client.add.assert_called_once()
    call_kwargs = client.add.call_args
    assert call_kwargs.kwargs["collection_name"] == COLLECTION
    metadata = call_kwargs.kwargs["metadata"]
    assert metadata[0]["project_id"] == "proj-1"
    assert metadata[0]["name"] == "postJson"


def test_ingest_empty():
    client = _make_client()
    vs = CodeVectorSearch(client)
    count = vs.ingest("proj-1", [])
    assert count == 0


# ── search ──


def test_search():
    client = _make_client()
    vs = CodeVectorSearch(client)

    hit = MagicMock()
    hit.score = 0.85
    hit.metadata = {
        "name": "postJson", "file": "src/http_client.cpp", "line": 8,
        "calls": ["popen"], "origin": None, "original_lib": None, "original_version": None,
    }
    client.query.return_value = [hit]

    results = vs.search("network handler", project_id="proj-1", top_k=5, min_score=0.3)
    assert len(results) == 1
    assert results[0].name == "postJson"
    assert results[0].score == 0.85

    call_kwargs = client.query.call_args.kwargs
    assert call_kwargs["collection_name"] == COLLECTION


def test_search_min_score_filter():
    client = _make_client()
    vs = CodeVectorSearch(client)

    low_hit = MagicMock()
    low_hit.score = 0.1
    low_hit.metadata = {"name": "lowFunc", "file": None, "line": None, "calls": [],
                        "origin": None, "original_lib": None, "original_version": None}
    client.query.return_value = [low_hit]

    results = vs.search("test", project_id="proj-1", min_score=0.5)
    assert len(results) == 0


def test_search_no_collection():
    client = MagicMock()
    client.get_collections.return_value.collections = []
    vs = CodeVectorSearch(client)

    results = vs.search("test", project_id="proj-1")
    assert results == []


# ── delete ──


def test_delete_project():
    client = _make_client()
    vs = CodeVectorSearch(client)

    vs.delete_project("proj-1")
    client.delete.assert_called_once()


def test_delete_project_no_collection():
    client = MagicMock()
    client.get_collections.return_value.collections = []
    vs = CodeVectorSearch(client)

    vs.delete_project("proj-1")
    client.delete.assert_not_called()
