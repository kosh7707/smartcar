"""Phase 0 스켈레톤 검증 — 서비스 기동 + 레거시 task type 동작 확인."""

from tests.conftest import LEGACY_TASK_TYPES, make_task_body, make_test_plan_body


def test_health_endpoint(client_live):
    resp = client_live.get("/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "smartcar-analysis-agent"
    assert data["status"] == "ok"
    assert "agentConfig" in data
    assert data["agentConfig"]["maxSteps"] == 6


def test_models_endpoint(client_live):
    resp = client_live.get("/v1/models")
    assert resp.status_code == 200
    assert "profiles" in resp.json()


def test_prompts_endpoint(client_live):
    resp = client_live.get("/v1/prompts")
    assert resp.status_code == 200
    assert "prompts" in resp.json()


def test_legacy_task_types_succeed(client_live):
    """기존 5개 task type이 mock 모드에서 정상 동작하는지 확인."""
    for task_type in LEGACY_TASK_TYPES:
        if task_type == "test-plan-propose":
            body = make_test_plan_body()
        else:
            body = make_task_body(task_type=task_type)
        resp = client_live.post("/v1/tasks", json=body)
        assert resp.status_code == 200, f"{task_type} failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "completed", f"{task_type}: {data}"
        assert data["taskType"] == task_type


def test_deep_analyze_returns_completed(client_live):
    """deep-analyze가 mock 모드에서 정상 동작."""
    body = make_task_body(task_type="deep-analyze")
    resp = client_live.post("/v1/tasks", json=body)
    assert resp.status_code == 200, f"deep-analyze failed: {resp.text}"
    data = resp.json()
    assert data["status"] == "completed"
    assert data["taskType"] == "deep-analyze"
    assert data["audit"]["agentAudit"] is not None
    assert data["audit"]["agentAudit"]["turn_count"] >= 1


def test_success_response_has_audit(client_live):
    """성공 응답에 audit 필드가 존재하는지 확인."""
    body = make_task_body()
    resp = client_live.post("/v1/tasks", json=body)
    data = resp.json()
    assert "audit" in data
    assert "inputHash" in data["audit"]
    assert "latencyMs" in data["audit"]


def test_success_response_has_result(client_live):
    """성공 응답에 result 필드가 올바르게 구성되는지 확인."""
    body = make_task_body()
    resp = client_live.post("/v1/tasks", json=body)
    data = resp.json()
    result = data["result"]
    assert "summary" in result
    assert "claims" in result
    assert "confidence" in result
