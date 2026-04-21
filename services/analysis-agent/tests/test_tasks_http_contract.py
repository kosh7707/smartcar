from __future__ import annotations

from app.routers import tasks
from app.schemas.response import AuditInfo, TaskFailureResponse, TokenUsage
from app.types import FailureCode, TaskStatus, TaskType


def _failure_response() -> TaskFailureResponse:
    return TaskFailureResponse(
        taskId="deep-http-contract-001",
        taskType=TaskType.DEEP_ANALYZE,
        status=TaskStatus.VALIDATION_FAILED,
        failureCode=FailureCode.INVALID_SCHEMA,
        failureDetail="필수 필드 'caveats' 누락",
        retryable=False,
        audit=AuditInfo(
            inputHash="sha256:test",
            latencyMs=0,
            tokenUsage=TokenUsage(prompt=0, completion=0),
            retryCount=1,
            ragHits=0,
            createdAt="2026-04-21T00:00:00Z",
            agentAudit={
                "turn_count": 2,
                "termination": "invalid_final_output",
            },
        ),
    )


def test_validation_failed_task_result_maps_to_http_422():
    assert tasks._http_status_for_task_result(_failure_response()) == 422


def test_deep_analyze_validation_failure_is_not_http_200(client_live, monkeypatch):
    async def fake_deep(_request):
        return _failure_response()

    monkeypatch.setattr(tasks, "_handle_deep_analyze", fake_deep)

    response = client_live.post(
        "/v1/tasks",
        json={
            "taskType": "deep-analyze",
            "taskId": "deep-http-contract-001",
            "context": {
                "trusted": {
                    "projectPath": "/tmp/project",
                },
            },
            "evidenceRefs": [
                {
                    "refId": "eref-001",
                    "artifactId": "art-001",
                    "artifactType": "sourceCode",
                    "locatorType": "lineRange",
                    "locator": {"file": "main.cpp", "startLine": 1, "endLine": 80},
                }
            ],
        },
    )

    assert response.status_code == 422
    assert response.headers["x-aegis-task-ok"] == "false"
    assert response.headers["x-aegis-task-status"] == "validation_failed"
    body = response.json()
    assert body["status"] == "validation_failed"
    assert body["failureCode"] == "INVALID_SCHEMA"
    assert body["failureDetail"] == "필수 필드 'caveats' 누락"
    assert body.get("result") is None
