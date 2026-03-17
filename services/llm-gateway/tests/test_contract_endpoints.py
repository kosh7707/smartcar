"""GET 엔드포인트 (/v1/health, /v1/models, /v1/prompts) 계약 테스트."""

from tests.conftest import ALL_TASK_TYPES


# ---------------------------------------------------------------------------
# GET /v1/health
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_health_required_fields(self, client_live):
        resp = client_live.get("/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        for field in ("service", "status", "version", "llmMode",
                      "modelProfiles", "activePromptVersions", "rag"):
            assert field in data, f"missing field: {field}"

    def test_health_service_name(self, client_live):
        data = client_live.get("/v1/health").json()
        assert data["service"] == "smartcar-llm-gateway"

    def test_health_status_ok(self, client_live):
        data = client_live.get("/v1/health").json()
        assert data["status"] == "ok"

    def test_health_model_profiles_is_list(self, client_live):
        data = client_live.get("/v1/health").json()
        assert isinstance(data["modelProfiles"], list)
        assert len(data["modelProfiles"]) >= 1

    def test_health_active_prompt_versions_has_all_types(self, client_live):
        data = client_live.get("/v1/health").json()
        versions = data["activePromptVersions"]
        for task_type in ALL_TASK_TYPES:
            assert task_type in versions, f"missing prompt version for: {task_type}"

    def test_health_rag_field_structure(self, client_live):
        data = client_live.get("/v1/health").json()
        rag = data["rag"]
        assert isinstance(rag["enabled"], bool)
        assert isinstance(rag["qdrantPath"], str)
        assert isinstance(rag["status"], str)

    def test_health_mock_mode_no_llm_backend(self, client_live):
        data = client_live.get("/v1/health").json()
        assert data["llmMode"] == "mock"
        assert "llmBackend" not in data


# ---------------------------------------------------------------------------
# GET /v1/models
# ---------------------------------------------------------------------------

class TestModelsEndpoint:
    def test_models_response_structure(self, client_live):
        resp = client_live.get("/v1/models")
        assert resp.status_code == 200
        data = resp.json()
        assert "profiles" in data
        assert isinstance(data["profiles"], list)
        assert len(data["profiles"]) >= 1
        profile = data["profiles"][0]
        for field in ("profileId", "modelName", "contextLimit",
                      "allowedTaskTypes", "status"):
            assert field in profile, f"missing field in profile: {field}"

    def test_models_allowed_task_types_are_strings(self, client_live):
        data = client_live.get("/v1/models").json()
        for profile in data["profiles"]:
            assert isinstance(profile["allowedTaskTypes"], list)
            for t in profile["allowedTaskTypes"]:
                assert isinstance(t, str)


# ---------------------------------------------------------------------------
# GET /v1/prompts
# ---------------------------------------------------------------------------

class TestPromptsEndpoint:
    def test_prompts_response_structure(self, client_live):
        resp = client_live.get("/v1/prompts")
        assert resp.status_code == 200
        data = resp.json()
        assert "prompts" in data
        assert isinstance(data["prompts"], list)
        assert len(data["prompts"]) >= 1
        prompt = data["prompts"][0]
        for field in ("promptId", "version", "taskType", "description"):
            assert field in prompt, f"missing field in prompt: {field}"

    def test_prompts_covers_all_task_types(self, client_live):
        data = client_live.get("/v1/prompts").json()
        registered_types = {p["taskType"] for p in data["prompts"]}
        for task_type in ALL_TASK_TYPES:
            assert task_type in registered_types, f"missing prompt for: {task_type}"
