from app.config import Settings


def test_default_agent_generation_caps_align_with_s7_contract(monkeypatch):
    monkeypatch.delenv("AEGIS_AGENT_LLM_MAX_TOKENS", raising=False)
    monkeypatch.delenv("AEGIS_AGENT_MAX_COMPLETION_TOKENS", raising=False)

    settings = Settings(_env_file=None)

    assert settings.agent_llm_max_tokens == 32768
    assert settings.agent_max_completion_tokens == 32768


def test_default_tool_timeout_aligns_with_s7_timeout_defaults(monkeypatch):
    monkeypatch.delenv("AEGIS_AGENT_TOOL_TIMEOUT_MS", raising=False)

    settings = Settings(_env_file=None)

    assert settings.agent_tool_timeout_ms == 120_000
