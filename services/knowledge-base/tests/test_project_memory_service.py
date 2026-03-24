"""ProjectMemoryService 단위 테스트 — Neo4j 드라이버를 mock하여 검증."""

import json
from unittest.mock import MagicMock

import pytest

from app.graphrag.project_memory_service import ProjectMemoryService


def _make_service():
    driver = MagicMock()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    return ProjectMemoryService(driver), session


def test_create_memory():
    svc, session = _make_service()
    session.run.return_value = MagicMock()

    result = svc.create_memory(
        "re100", "analysis_history",
        {"claimCount": 3, "severity": "critical"},
    )

    assert result["type"] == "analysis_history"
    assert result["id"].startswith("mem-")
    assert "createdAt" in result


def test_create_memory_invalid_type():
    svc, session = _make_service()

    with pytest.raises(ValueError, match="Invalid memory type"):
        svc.create_memory("re100", "invalid_type", {"key": "value"})


def test_list_memories():
    svc, session = _make_service()

    mock_records = [
        {
            "id": "mem-001",
            "type": "analysis_history",
            "data": json.dumps({"claimCount": 3}),
            "createdAt": "2026-03-24T10:00:00Z",
        },
        {
            "id": "mem-002",
            "type": "false_positive",
            "data": json.dumps({"pattern": "readlink TOCTOU"}),
            "createdAt": "2026-03-24T11:00:00Z",
        },
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    memories = svc.list_memories("re100")
    assert len(memories) == 2
    assert memories[0]["id"] == "mem-001"
    assert memories[0]["data"]["claimCount"] == 3
    assert memories[1]["type"] == "false_positive"


def test_list_memories_with_type_filter():
    svc, session = _make_service()

    mock_records = [
        {
            "id": "mem-002",
            "type": "false_positive",
            "data": json.dumps({"pattern": "readlink"}),
            "createdAt": "2026-03-24T11:00:00Z",
        },
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    memories = svc.list_memories("re100", memory_type="false_positive")
    assert len(memories) == 1
    assert memories[0]["type"] == "false_positive"

    # Cypher 쿼리에 type 필터가 포함되었는지 확인
    call_args = session.run.call_args
    assert "m.type = $type" in call_args[0][0]


def test_list_memories_empty():
    svc, session = _make_service()

    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter([]))
    session.run.return_value = result

    memories = svc.list_memories("nonexistent-project")
    assert memories == []


def test_delete_memory_success():
    svc, session = _make_service()

    result = MagicMock()
    result.single.return_value = {"cnt": 1}
    session.run.return_value = result

    deleted = svc.delete_memory("re100", "mem-001")
    assert deleted is True


def test_delete_memory_not_found():
    svc, session = _make_service()

    result = MagicMock()
    result.single.return_value = None
    session.run.return_value = result

    deleted = svc.delete_memory("re100", "mem-999")
    assert deleted is False


def test_list_memories_corrupted_json():
    """data 필드의 JSON이 깨져있어도 빈 dict로 처리."""
    svc, session = _make_service()

    mock_records = [
        {
            "id": "mem-bad",
            "type": "preference",
            "data": "not-valid-json{{{",
            "createdAt": "2026-03-24T10:00:00Z",
        },
    ]
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(mock_records))
    session.run.return_value = result

    memories = svc.list_memories("re100")
    assert len(memories) == 1
    assert memories[0]["data"] == {}
