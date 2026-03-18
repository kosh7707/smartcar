from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- LLM (llm-gateway 동일) ---
    llm_mode: Literal["mock", "real"] = "mock"
    llm_endpoint: str = "http://localhost:8080"
    llm_model: str = "qwen-14b"
    llm_api_key: str = ""
    llm_concurrency: int = 4
    llm_max_input_chars: int = 800_000
    llm_max_retries: int = 2

    # --- RAG (llm-gateway 동일) ---
    rag_enabled: bool = True
    qdrant_path: str = "data/qdrant"
    rag_top_k: int = 5
    rag_min_score: float = 0.35

    # --- Agent loop (신규) ---
    agent_max_steps: int = 6
    agent_max_completion_tokens: int = 2000
    agent_max_cheap_calls: int = 3
    agent_max_medium_calls: int = 2
    agent_max_expensive_calls: int = 1
    agent_no_evidence_threshold: int = 2
    agent_tool_timeout_ms: int = 30_000
    agent_llm_max_tokens: int = 4096
    agent_llm_retry_max: int = 1
    agent_graph_depth: int = 2

    model_config = {"env_prefix": "SMARTCAR_", "env_file": ".env"}


settings = Settings()
