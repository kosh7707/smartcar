from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings


_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

class Settings(BaseSettings):
    llm_mode: Literal["mock", "real"] = "mock"
    llm_endpoint: str = "http://localhost:8000"
    llm_model: str = "qwen-14b"
    llm_api_key: str = ""
    llm_concurrency: int = 4

    sast_endpoint: str = "http://localhost:9000"

    agent_max_steps: int = 10
    agent_max_completion_tokens: int = 20000
    agent_max_cheap_calls: int = 20
    agent_max_medium_calls: int = 0
    agent_max_expensive_calls: int = 5
    agent_no_evidence_threshold: int = 6
    agent_tool_timeout_ms: int = 180000
    agent_llm_max_tokens: int = 16384
    agent_llm_retry_max: int = 1

    model_config = {
        "env_prefix": "AEGIS_",
        "env_file": str(_ENV_FILE),
        "extra": "ignore",
    }

settings = Settings()
