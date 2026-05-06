from __future__ import annotations

import pytest

from app.routers import tasks
from app.schemas.response import (
    AssessmentResult,
    AuditInfo,
    RecoveryTraceEntry,
    TaskFailureResponse,
    TaskSuccessResponse,
    TokenUsage,
    ValidationInfo,
)
from app.types import (
    AnalysisOutcome,
    FailureCode,
    PocOutcome,
    QualityOutcome,
    TaskStatus,
    TaskType,
)


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


def _completed_negative_response(task_type: TaskType = TaskType.DEEP_ANALYZE) -> TaskSuccessResponse:
    return TaskSuccessResponse(
        taskId="deep-http-contract-001",
        taskType=task_type,
        status=TaskStatus.COMPLETED,
        modelProfile="test",
        promptVersion="agent-v1",
        schemaVersion="agent-v1",
        validation=ValidationInfo(valid=True, errors=[]),
        result=AssessmentResult(
            summary="review completed with negative outcome",
            claims=[],
            caveats=["schema deficiency recovered"],
            usedEvidenceRefs=[],
            suggestedSeverity="info",
            analysisOutcome=AnalysisOutcome.INCONCLUSIVE,
            qualityOutcome=QualityOutcome.REPAIR_EXHAUSTED,
            pocOutcome=(
                PocOutcome.POC_REJECTED
                if task_type == TaskType.GENERATE_POC
                else PocOutcome.POC_NOT_REQUESTED
            ),
            recoveryTrace=[
                RecoveryTraceEntry(
                    deficiency="SCHEMA_DEFICIENT",
                    action="outcome_classification",
                    outcome="inconclusive",
                )
            ],
        ),
        audit=AuditInfo(
            inputHash="sha256:test",
            latencyMs=0,
            tokenUsage=TokenUsage(prompt=0, completion=0),
            retryCount=1,
            ragHits=0,
            createdAt="2026-04-24T00:00:00Z",
        ),
    )


def test_validation_failed_task_result_maps_to_http_422():
    assert tasks._http_status_for_task_result(_failure_response()) == 422


def test_deep_analyze_internal_deficiency_completed_is_http_200(client_live, monkeypatch):
    async def fake_deep(_request):
        return _completed_negative_response()

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

    assert response.status_code == 200
    assert response.headers["x-aegis-task-ok"] == "true"
    assert response.headers["x-aegis-task-status"] == "completed"
    body = response.json()
    assert body["status"] == "completed"
    assert "failureCode" not in body
    assert body["validation"]["valid"] is True
    assert body["result"]["analysisOutcome"] == "inconclusive"
    assert body["result"]["qualityOutcome"] == "repair_exhausted"
    assert body["result"]["recoveryTrace"][0]["deficiency"] == "SCHEMA_DEFICIENT"


def test_generate_poc_rejected_outcome_completed_is_http_200(client_live, monkeypatch):
    async def fake_poc(_request):
        return _completed_negative_response(TaskType.GENERATE_POC)

    monkeypatch.setattr(tasks, "_handle_generate_poc", fake_poc)

    response = client_live.post(
        "/v1/tasks",
        json={
            "taskType": "generate-poc",
            "taskId": "poc-http-contract-001",
            "context": {
                "trusted": {
                    "objective": "Generate PoC",
                    "claim": {
                        "statement": "User input reaches popen",
                        "detail": "The command is shell-expanded.",
                        "location": "main.cpp:12",
                    },
                    "files": [{"path": "main.cpp", "content": "int main(){}"}],
                },
            },
            "evidenceRefs": [],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["result"]["pocOutcome"] == "poc_rejected"
    assert "failureCode" not in body


def test_deep_analyze_route_accepts_camel_case_generation_constraints(client_live, monkeypatch):
    captured = {}

    async def fake_deep(request):
        captured["constraints"] = request.constraints
        return _completed_negative_response()

    monkeypatch.setattr(tasks, "_handle_deep_analyze", fake_deep)

    response = client_live.post(
        "/v1/tasks",
        json={
            "taskType": "deep-analyze",
            "taskId": "deep-http-contract-constraints-001",
            "context": {"trusted": {"projectPath": "/tmp/project"}},
            "evidenceRefs": [],
            "constraints": {
                "maxTokens": 32768,
                "enableThinking": False,
                "temperature": 0.6,
                "topP": 0.8,
                "topK": -1,
                "minP": 0.1,
                "presencePenalty": 0.2,
                "repetitionPenalty": 1.1,
            },
        },
    )

    assert response.status_code == 200
    constraints = captured["constraints"]
    assert constraints.maxTokens == 32768
    assert constraints.enableThinking is False
    assert constraints.temperature == 0.6
    assert constraints.topP == 0.8
    assert constraints.topK == -1
    assert constraints.minP == 0.1
    assert constraints.presencePenalty == 0.2
    assert constraints.repetitionPenalty == 1.1


@pytest.mark.parametrize("field_name", ["top_p", "presence_penalty"])
def test_deep_analyze_route_rejects_snake_case_generation_constraints(client_live, field_name):
    response = client_live.post(
        "/v1/tasks",
        json={
            "taskType": "deep-analyze",
            "taskId": "deep-http-contract-constraints-bad-001",
            "context": {"trusted": {"projectPath": "/tmp/project"}},
            "evidenceRefs": [],
            "constraints": {
                "maxTokens": 1024,
                field_name: 0.5,
            },
        },
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(field_name in str(item.get("loc", ())) for item in detail)


def test_generate_poc_route_rejects_max_tokens_above_32768(client_live):
    response = client_live.post(
        "/v1/tasks",
        json={
            "taskType": "generate-poc",
            "taskId": "poc-http-contract-max-001",
            "context": {
                "trusted": {
                    "objective": "Generate PoC",
                    "claim": {
                        "statement": "User input reaches popen",
                        "detail": "The command is shell-expanded.",
                        "location": "main.cpp:12",
                    },
                    "files": [{"path": "main.cpp", "content": "int main(){}"}],
                },
            },
            "evidenceRefs": [],
            "constraints": {"maxTokens": 32769},
        },
    )

    assert response.status_code == 422
