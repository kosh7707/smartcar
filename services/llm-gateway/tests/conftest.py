"""Contract test fixtures — HTTP-level 테스트를 위한 공통 설정."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.types import TaskType


@pytest.fixture()
def client_live():
    """실제 mock 파이프라인을 거치는 TestClient.

    settings를 mock 모드 + RAG 비활성화로 고정하여
    Qdrant/vLLM 의존성 없이 엔드투엔드 경로를 테스트한다.
    """
    original_mode = settings.llm_mode
    original_rag = settings.rag_enabled
    object.__setattr__(settings, "llm_mode", "mock")
    object.__setattr__(settings, "rag_enabled", False)

    from app.main import app

    with TestClient(app) as c:
        yield c

    object.__setattr__(settings, "llm_mode", original_mode)
    object.__setattr__(settings, "rag_enabled", original_rag)


@pytest.fixture()
def mock_pipeline():
    """pipeline.execute 반환값을 직접 제어할 수 있는 MagicMock."""
    pipeline = MagicMock()
    pipeline.execute = AsyncMock()
    return pipeline


@pytest.fixture()
def client(mock_pipeline):
    """mock_pipeline이 주입된 TestClient.

    lifespan 이후 app.state.pipeline을 교체하여
    실패 시나리오, 500 에러 등을 제어한다.
    """
    original_mode = settings.llm_mode
    original_rag = settings.rag_enabled
    object.__setattr__(settings, "llm_mode", "mock")
    object.__setattr__(settings, "rag_enabled", False)

    from app.main import app

    with TestClient(app) as c:
        original_pipeline = app.state.pipeline
        app.state.pipeline = mock_pipeline
        yield c
        app.state.pipeline = original_pipeline

    object.__setattr__(settings, "llm_mode", original_mode)
    object.__setattr__(settings, "rag_enabled", original_rag)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def make_task_body(
    task_type: str = "static-explain",
    task_id: str = "test-001",
    *,
    trusted: dict | None = None,
    evidence_refs: list | None = None,
    max_tokens: int = 2048,
) -> dict:
    """API 계약서 형식의 POST /v1/tasks 요청 body."""
    return {
        "taskType": task_type,
        "taskId": task_id,
        "context": {
            "trusted": trusted or {
                "finding": {
                    "findingId": "F-001",
                    "ruleId": "CWE-120",
                    "severity": "high",
                    "message": "Buffer overflow in gets()",
                    "file": "src/main.c",
                    "line": 42,
                },
            },
        },
        "evidenceRefs": evidence_refs or [
            {
                "refId": "eref-001",
                "artifactId": "art-001",
                "artifactType": "sourceCode",
                "locatorType": "lineRange",
                "locator": {"file": "src/main.c", "startLine": 1, "endLine": 50},
            },
        ],
        "constraints": {"maxTokens": max_tokens},
    }


def make_test_plan_body(task_id: str = "test-tp-001") -> dict:
    """test-plan-propose 전용 요청 body."""
    return make_task_body(
        task_type="test-plan-propose",
        task_id=task_id,
        trusted={
            "objective": "SecurityAccess brute-force lockout 검증",
            "ecuType": "Gateway ECU",
            "protocol": "UDS",
        },
    )


ALL_TASK_TYPES = [t.value for t in TaskType]
