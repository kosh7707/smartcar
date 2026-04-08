from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings


_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # --- LLM (llm-gateway 동일) ---
    llm_mode: Literal["mock", "real"] = "mock"
    llm_endpoint: str = "http://localhost:8080"
    llm_model: str = "qwen-14b"
    llm_api_key: str = ""
    llm_concurrency: int = 4
    llm_max_input_chars: int = 800_000
    llm_max_retries: int = 2

    # --- S4 SAST Runner ---
    sast_endpoint: str = "http://localhost:9000"

    # --- RAG (S5 Knowledge Base 연동) ---
    rag_enabled: bool = True
    kb_endpoint: str = "http://localhost:8002"
    rag_top_k: int = 5
    rag_min_score: float = 0.35

    # --- Agent loop (신규) ---
    agent_max_steps: int = 6
    agent_max_completion_tokens: int = 20000
    agent_max_cheap_calls: int = 3
    agent_max_medium_calls: int = 2
    agent_max_expensive_calls: int = 1
    agent_no_evidence_threshold: int = 2
    agent_tool_timeout_ms: int = 30_000
    agent_llm_max_tokens: int = 16384
    agent_llm_retry_max: int = 1
    agent_graph_depth: int = 2
    agent_max_prompt_tokens: int = 100_000

    # --- Phase 1 truncation 상한 ---
    phase1_max_cve_libraries: int = 20
    phase1_max_threat_cwes: int = 10

    model_config = {
        "env_prefix": "AEGIS_",
        "env_file": str(_ENV_FILE),
        "extra": "ignore",
    }


settings = Settings()
