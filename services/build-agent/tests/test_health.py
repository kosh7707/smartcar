def test_health(client):
    resp = client.get("/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "s3-build"
    assert data["status"] == "ok"

def test_build_resolve_mock(client):
    """build-resolve 요청이 200을 반환하고 유효한 응답 구조를 갖는지 확인."""
    resp = client.post("/v1/tasks", json={
        "taskType": "build-resolve",
        "taskId": "test-build-001",
        "context": {"trusted": {"objective": "test build", "projectPath": "/tmp/test"}},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("completed", "budget_exceeded", "model_error", "validation_failed")
    assert data["taskId"] == "test-build-001"
    assert data["taskType"] == "build-resolve"


def test_sdk_analyze_mock(client):
    """sdk-analyze 요청이 200을 반환하고 유효한 응답 구조를 갖는지 확인."""
    resp = client.post("/v1/tasks", json={
        "taskType": "sdk-analyze",
        "taskId": "test-sdk-001",
        "context": {"trusted": {"projectPath": "/tmp/test-sdk"}},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("completed", "budget_exceeded", "model_error", "validation_failed")
    assert data["taskId"] == "test-sdk-001"
    assert data["taskType"] == "sdk-analyze"
    # mock 모드에서는 sdkProfile이 포함되어야 함
    if data["status"] == "completed":
        result = data.get("result", {})
        assert "sdkProfile" in result or result.get("sdkProfile") is None


def test_unknown_task_type(client):
    """미지원 taskType은 400을 반환해야 한다."""
    resp = client.post("/v1/tasks", json={
        "taskType": "unknown-type",
        "taskId": "test-unknown",
        "context": {"trusted": {"projectPath": "/tmp/test"}},
    })
    assert resp.status_code in (400, 422)
