from app.config import Settings


def test_default_llm_endpoint_targets_s7_gateway(monkeypatch):
    monkeypatch.delenv("AEGIS_LLM_ENDPOINT", raising=False)

    settings = Settings(_env_file=None)

    assert settings.llm_endpoint == "http://localhost:8000"
