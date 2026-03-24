def test_health(client):
    resp = client.get("/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "s3-build"
    assert data["status"] == "ok"

def test_build_resolve_mock(client):
    resp = client.post("/v1/tasks", json={
        "taskType": "build-resolve",
        "taskId": "test-build-001",
        "context": {"trusted": {"objective": "test build", "projectPath": "/tmp/test"}},
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("completed", "budget_exceeded")
