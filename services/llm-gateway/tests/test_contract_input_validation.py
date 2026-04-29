"""입력 검증 (422) 계약 테스트.

Pydantic 모델 검증에 의한 422 반환을 HTTP 레벨에서 확인한다.
"""

import pytest

from tests.conftest import make_chat_body, make_task_body


class TestInputValidation:
    def test_unknown_task_type_422(self, client_live):
        body = make_task_body(task_type="nonexistent-type")
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422

    def test_missing_task_id_422(self, client_live):
        body = make_task_body()
        del body["taskId"]
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422

    def test_missing_context_422(self, client_live):
        body = make_task_body()
        del body["context"]
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422

    def test_empty_body_422(self, client_live):
        resp = client_live.post("/v1/tasks", json={})
        assert resp.status_code == 422

    def test_invalid_json_422(self, client_live):
        resp = client_live.post(
            "/v1/tasks",
            content=b"not-json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422

    def test_max_tokens_out_of_range_422(self, client_live):
        body = make_task_body(max_tokens=99999)
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422

    def test_missing_constraints_422(self, client_live):
        body = make_task_body()
        del body["constraints"]
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422
        assert any(
            err.get("loc") == ["body", "constraints"]
            for err in resp.json().get("detail", [])
        )

    @pytest.mark.parametrize("field", [
        "enableThinking",
        "maxTokens",
        "temperature",
        "topP",
        "topK",
        "minP",
        "presencePenalty",
        "repetitionPenalty",
    ])
    def test_missing_required_generation_constraint_422(self, client_live, field):
        body = make_task_body()
        del body["constraints"][field]
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422
        assert any(
            err.get("loc") == ["body", "constraints", field]
            for err in resp.json().get("detail", [])
        )

    @pytest.mark.parametrize(("field", "value"), [
        ("temperature", -0.1),
        ("temperature", 2.1),
        ("topP", -0.1),
        ("topP", 1.1),
        ("topK", -2),
        ("minP", -0.1),
        ("minP", 1.1),
        ("presencePenalty", -2.1),
        ("presencePenalty", 2.1),
        ("repetitionPenalty", -0.1),
        ("repetitionPenalty", 2.1),
    ])
    def test_generation_constraint_out_of_range_422(self, client_live, field, value):
        body = make_task_body()
        body["constraints"][field] = value
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 422

    def test_async_chat_missing_messages_422(self, client_live):
        body = make_chat_body()
        del body["messages"]
        resp = client_live.post("/v1/async-chat-requests", json=body)
        assert resp.status_code == 422

    def test_async_chat_empty_messages_422(self, client_live):
        body = make_chat_body()
        body["messages"] = []
        resp = client_live.post("/v1/async-chat-requests", json=body)
        assert resp.status_code == 422
