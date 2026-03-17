"""POST /v1/tasks 실패 응답 구조 계약 테스트.

mock_pipeline으로 pipeline.execute 반환값을 직접 제어하여
실패 시나리오를 검증한다.
"""

import uuid
from datetime import datetime, timezone

import pytest

from app.schemas.response import (
    AuditInfo,
    TaskFailureResponse,
    TokenUsage,
)
from app.types import FailureCode, TaskStatus
from tests.conftest import make_task_body


def _make_failure_response(
    failure_code: FailureCode,
    status: TaskStatus = TaskStatus.VALIDATION_FAILED,
    retryable: bool = False,
    task_id: str = "fail-001",
    task_type: str = "static-explain",
) -> TaskFailureResponse:
    return TaskFailureResponse(
        taskId=task_id,
        taskType=task_type,
        status=status,
        failureCode=failure_code,
        failureDetail=f"Test failure: {failure_code}",
        retryable=retryable,
        audit=AuditInfo(
            inputHash="sha256:abcdef0123456789",
            latencyMs=42,
            tokenUsage=TokenUsage(prompt=100, completion=50),
            retryCount=0,
            ragHits=0,
            createdAt=datetime.now(timezone.utc).isoformat(),
        ),
    )


class TestFailureStructure:
    """실패 응답의 JSON 구조 검증."""

    def test_failure_response_fields(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.INVALID_SCHEMA,
        )
        resp = client.post("/v1/tasks", json=make_task_body())
        assert resp.status_code == 200
        data = resp.json()
        for field in ("taskId", "taskType", "status", "failureCode",
                      "failureDetail", "retryable", "audit"):
            assert field in data, f"missing field: {field}"

    def test_failure_no_result_field(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.INVALID_SCHEMA,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert "result" not in data


class TestRetryableMapping:
    """failureCode별 retryable 매핑 검증."""

    def test_timeout_retryable_true(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.TIMEOUT, TaskStatus.TIMEOUT, retryable=True,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert data["failureCode"] == "TIMEOUT"
        assert data["retryable"] is True

    def test_llm_overloaded_retryable_true(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.LLM_OVERLOADED, TaskStatus.MODEL_ERROR, retryable=True,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert data["failureCode"] == "LLM_OVERLOADED"
        assert data["retryable"] is True

    def test_model_unavailable_retryable_true(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.MODEL_UNAVAILABLE, TaskStatus.MODEL_ERROR, retryable=True,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert data["failureCode"] == "MODEL_UNAVAILABLE"
        assert data["retryable"] is True

    def test_input_too_large_retryable_false(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.INPUT_TOO_LARGE, TaskStatus.BUDGET_EXCEEDED, retryable=False,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert data["failureCode"] == "INPUT_TOO_LARGE"
        assert data["retryable"] is False

    def test_unknown_task_type_retryable_false(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.UNKNOWN_TASK_TYPE, TaskStatus.VALIDATION_FAILED, retryable=False,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert data["failureCode"] == "UNKNOWN_TASK_TYPE"
        assert data["retryable"] is False


class TestFailureAudit:
    def test_failure_audit_fields(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.INVALID_SCHEMA,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        audit = data["audit"]
        for field in ("inputHash", "latencyMs", "tokenUsage",
                      "retryCount", "ragHits", "createdAt"):
            assert field in audit, f"missing audit field: {field}"

    def test_failure_x_request_id(self, client, mock_pipeline):
        mock_pipeline.execute.return_value = _make_failure_response(
            FailureCode.INVALID_SCHEMA,
        )
        rid = f"fail-{uuid.uuid4()}"
        resp = client.post(
            "/v1/tasks",
            json=make_task_body(),
            headers={"X-Request-Id": rid},
        )
        assert resp.headers.get("x-request-id") == rid


class TestInternalServerError:
    """pipeline 예외 시 500 응답 형식 검증."""

    def test_500_observability_format(self, client, mock_pipeline):
        mock_pipeline.execute.side_effect = RuntimeError("boom")
        resp = client.post("/v1/tasks", json=make_task_body())
        assert resp.status_code == 500
        data = resp.json()
        assert data["success"] is False
        assert "error" in data
        assert "errorDetail" in data

    def test_500_error_detail_fields(self, client, mock_pipeline):
        mock_pipeline.execute.side_effect = RuntimeError("boom")
        data = client.post("/v1/tasks", json=make_task_body()).json()
        detail = data["errorDetail"]
        for field in ("code", "message", "requestId", "retryable"):
            assert field in detail, f"missing errorDetail field: {field}"
        assert detail["code"] == "INTERNAL_ERROR"
        assert detail["retryable"] is False


class TestFailureCodeStatusMapping:
    """각 failureCode에 대응하는 status 값 확인."""

    @pytest.mark.parametrize("code,status", [
        (FailureCode.INVALID_SCHEMA, TaskStatus.VALIDATION_FAILED),
        (FailureCode.INVALID_GROUNDING, TaskStatus.VALIDATION_FAILED),
        (FailureCode.TIMEOUT, TaskStatus.TIMEOUT),
        (FailureCode.MODEL_UNAVAILABLE, TaskStatus.MODEL_ERROR),
        (FailureCode.TOKEN_BUDGET_EXCEEDED, TaskStatus.BUDGET_EXCEEDED),
        (FailureCode.UNSAFE_CONTENT, TaskStatus.UNSAFE_OUTPUT),
        (FailureCode.EMPTY_RESPONSE, TaskStatus.EMPTY_RESULT),
        (FailureCode.LLM_OVERLOADED, TaskStatus.MODEL_ERROR),
        (FailureCode.INPUT_TOO_LARGE, TaskStatus.BUDGET_EXCEEDED),
        (FailureCode.UNKNOWN_TASK_TYPE, TaskStatus.VALIDATION_FAILED),
    ])
    def test_all_failure_codes_status_mapping(
        self, client, mock_pipeline, code, status,
    ):
        mock_pipeline.execute.return_value = _make_failure_response(
            code, status,
        )
        data = client.post("/v1/tasks", json=make_task_body()).json()
        assert data["failureCode"] == code.value
        assert data["status"] == status.value
