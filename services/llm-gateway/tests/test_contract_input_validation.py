"""입력 검증 (422) 계약 테스트.

Pydantic 모델 검증에 의한 422 반환을 HTTP 레벨에서 확인한다.
"""

from tests.conftest import make_task_body


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
