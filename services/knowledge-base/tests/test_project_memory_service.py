"""ProjectMemoryService 단위 테스트 — Neo4j 드라이버를 mock하여 검증."""

import json
from unittest.mock import MagicMock, call

import pytest

from app.graphrag.project_memory_service import (
    MemoryLimitError,
    ProjectMemoryService,
)


def _make_service(*, memory_limit=1000):
    driver = MagicMock()
    session = MagicMock()
    driver.session.return_value.__enter__ = MagicMock(return_value=session)
    driver.session.return_value.__exit__ = MagicMock(return_value=False)
    return ProjectMemoryService(driver, memory_limit=memory_limit), session


def _mock_list_result(records):
    """list_memories용 이터러블 mock 결과를 만든다."""
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(records))
    return result


def _mock_single(value):
    """single() 반환용 mock."""
    result = MagicMock()
    result.single.return_value = value
    return result


# ── 기존 테스트 (Phase 4 적응) ──


def test_create_memory():
    svc, session = _make_service()

    # 1) dedup check → 없음, 2) count check → 0, 3) create
    session.run.side_effect = [
        _mock_single(None),       # dedup: 기존 없음
        _mock_single({"cnt": 0}), # count: 0
        MagicMock(),              # create
    ]

    result = svc.create_memory(
        "re100", "analysis_history",
        {"claimCount": 3, "severity": "critical"},
    )

    assert result["type"] == "analysis_history"
    assert result["id"].startswith("mem-")
    assert "createdAt" in result
    assert "deduplicated" not in result


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
            "expiresAt": None,
        },
        {
            "id": "mem-002",
            "type": "false_positive",
            "data": json.dumps({"pattern": "readlink TOCTOU"}),
            "createdAt": "2026-03-24T11:00:00Z",
            "expiresAt": None,
        },
    ]
    session.run.return_value = _mock_list_result(mock_records)

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
            "expiresAt": None,
        },
    ]
    session.run.return_value = _mock_list_result(mock_records)

    memories = svc.list_memories("re100", memory_type="false_positive")
    assert len(memories) == 1
    assert memories[0]["type"] == "false_positive"

    # Cypher 쿼리에 type 필터가 포함되었는지 확인
    call_args = session.run.call_args
    assert "m.type = $type" in call_args[0][0]


def test_list_memories_empty():
    svc, session = _make_service()
    session.run.return_value = _mock_list_result([])

    memories = svc.list_memories("nonexistent-project")
    assert memories == []


def test_delete_memory_success():
    svc, session = _make_service()
    session.run.return_value = _mock_single({"cnt": 1})

    deleted = svc.delete_memory("re100", "mem-001")
    assert deleted is True


def test_delete_memory_not_found():
    svc, session = _make_service()
    session.run.return_value = _mock_single(None)

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
            "expiresAt": None,
        },
    ]
    session.run.return_value = _mock_list_result(mock_records)

    memories = svc.list_memories("re100")
    assert len(memories) == 1
    assert memories[0]["data"] == {}


# ── Phase 4 신규 테스트 ──


def test_create_memory_dedup():
    """동일 (project, type, data) → 기존 메모리 반환, deduplicated=True."""
    svc, session = _make_service()

    # dedup check → 기존 존재
    session.run.return_value = _mock_single({
        "id": "mem-existing",
        "type": "false_positive",
        "createdAt": "2026-03-24T10:00:00Z",
    })

    result = svc.create_memory(
        "re100", "false_positive", {"cve": "CVE-2025-1234"},
    )

    assert result["id"] == "mem-existing"
    assert result["deduplicated"] is True
    # _ensure_indexes(3) + dedup check(1) = 4
    assert session.run.call_count == 4


def test_create_memory_different_data_no_dedup():
    """다른 data → 별도 메모리 생성."""
    svc, session = _make_service()

    session.run.side_effect = [
        _mock_single(None),       # dedup: 없음
        _mock_single({"cnt": 0}), # count: 0
        MagicMock(),              # create
    ]

    result1 = svc.create_memory(
        "re100", "false_positive", {"cve": "CVE-2025-1111"},
    )
    assert "deduplicated" not in result1

    # 리셋 후 다른 data로 생성
    session.run.side_effect = [
        _mock_single(None),       # dedup: 없음
        _mock_single({"cnt": 1}), # count: 1
        MagicMock(),              # create
    ]

    result2 = svc.create_memory(
        "re100", "false_positive", {"cve": "CVE-2025-2222"},
    )
    assert "deduplicated" not in result2
    assert result1["id"] != result2["id"]


def test_create_memory_with_ttl():
    """TTL 설정 시 expiresAt이 포함된다."""
    svc, session = _make_service()

    session.run.side_effect = [
        _mock_single(None),
        _mock_single({"cnt": 0}),
        MagicMock(),
    ]

    result = svc.create_memory(
        "re100", "analysis_history", {"test": True},
        ttl_seconds=3600,
    )

    assert "expiresAt" in result


def test_list_memories_excludes_expired():
    """list_memories 쿼리에 만료 필터가 포함된다."""
    svc, session = _make_service()
    session.run.return_value = _mock_list_result([])

    svc.list_memories("re100")

    query = session.run.call_args[0][0]
    assert "expiresAt" in query and "$now" in query


def test_create_memory_limit_exceeded():
    """한도 초과 시 MemoryLimitError 발생."""
    svc, session = _make_service(memory_limit=5)

    session.run.side_effect = [
        _mock_single(None),       # dedup: 없음
        _mock_single({"cnt": 5}), # count: 5 = limit
    ]

    with pytest.raises(MemoryLimitError, match="memory limit reached"):
        svc.create_memory("re100", "preference", {"key": "value"})


def test_create_memory_limit_with_expired_not_counted():
    """만료 메모리는 한도에 포함되지 않는다 (쿼리에 expire 필터 확인)."""
    svc, session = _make_service(memory_limit=5)

    session.run.side_effect = [
        _mock_single(None),       # dedup: 없음
        _mock_single({"cnt": 3}), # count: 3 < 5 (만료 제외)
        MagicMock(),              # create
    ]

    result = svc.create_memory("re100", "preference", {"key": "value"})
    assert result["id"].startswith("mem-")

    # count 쿼리에 expire 필터 확인 (_ensure_indexes 3 + dedup 1 + count = index 4)
    count_query = session.run.call_args_list[4][0][0]
    assert "expiresAt" in count_query and "$now" in count_query
