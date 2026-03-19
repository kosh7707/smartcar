"""엔드포인트 계약 테스트 (/v1/health, /v1/models, /v1/prompts, /v1/chat)."""
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

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
        assert data["service"] == "aegis-llm-gateway"

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
        assert isinstance(rag["kbEndpoint"], str)
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


# ---------------------------------------------------------------------------
# POST /v1/chat — LLM Engine 프록시
# ---------------------------------------------------------------------------

class TestChatProxy:
    """POST /v1/chat 프록시 엔드포인트 계약 테스트."""

    def test_chat_proxy_forwards_request(self, client_live):
        """프록시가 요청을 LLM Engine에 전달하고 응답을 반환한다."""
        mock_llm_response = {
            "choices": [{"message": {"content": '{"test": true}'}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }
        mock_resp = httpx.Response(200, json=mock_llm_response)

        with patch("app.routers.tasks._proxy_client") as mock_client:
            mock_client.post = AsyncMock(return_value=mock_resp)

            resp = client_live.post("/v1/chat", json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "hello"}],
                "max_tokens": 100,
            })

        assert resp.status_code == 200
        data = resp.json()
        assert "choices" in data
        assert data["choices"][0]["message"]["content"] == '{"test": true}'
        assert data["usage"]["prompt_tokens"] == 10

    def test_chat_proxy_503_on_connect_error(self, client_live):
        """LLM Engine 연결 실패 시 503 반환."""
        with patch("app.routers.tasks._proxy_client") as mock_client:
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))

            resp = client_live.post("/v1/chat", json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "hello"}],
            })

        assert resp.status_code == 503
        assert resp.json()["retryable"] is True

    def test_chat_proxy_504_on_timeout(self, client_live):
        """LLM Engine 타임아웃 시 504 반환."""
        with patch("app.routers.tasks._proxy_client") as mock_client:
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

            resp = client_live.post("/v1/chat", json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "hello"}],
            })

        assert resp.status_code == 504
        assert resp.json()["retryable"] is True

    def test_chat_proxy_passes_tool_calls(self, client_live):
        """tool_calls가 포함된 응답을 그대로 전달한다."""
        mock_llm_response = {
            "choices": [{
                "message": {
                    "content": None,
                    "tool_calls": [{
                        "id": "tc-1",
                        "type": "function",
                        "function": {"name": "knowledge.search", "arguments": '{"query":"CWE-78"}'},
                    }],
                },
                "finish_reason": "tool_calls",
            }],
            "usage": {"prompt_tokens": 20, "completion_tokens": 15},
        }
        mock_resp = httpx.Response(200, json=mock_llm_response)

        with patch("app.routers.tasks._proxy_client") as mock_client:
            mock_client.post = AsyncMock(return_value=mock_resp)

            resp = client_live.post("/v1/chat", json={
                "model": "test-model",
                "messages": [{"role": "user", "content": "analyze"}],
                "tools": [{"type": "function", "function": {"name": "knowledge.search"}}],
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["choices"][0]["message"]["tool_calls"][0]["function"]["name"] == "knowledge.search"
