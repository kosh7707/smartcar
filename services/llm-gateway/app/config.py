from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_mode: Literal["mock", "real"] = "mock"
    llm_endpoint: str = "http://localhost:8080"
    llm_model: str = "qwen-14b"
    llm_api_key: str = ""
    llm_concurrency: int = 4
    llm_max_input_chars: int = 800_000  # 프롬프트 문자 수 상한 (~200K 토큰 추정)
    llm_max_retries: int = 2  # LLM 출력 품질 재시도 (총 시도 = 1 + max_retries)

    # RAG (S5 Knowledge Base 연동)
    rag_enabled: bool = True
    kb_endpoint: str = "http://localhost:8002"
    rag_top_k: int = 5
    rag_min_score: float = 0.35  # 이 점수 미만의 RAG 결과는 제외

    model_config = {"env_prefix": "AEGIS_", "env_file": ".env"}


settings = Settings()
