from __future__ import annotations

from app.services.clients.base import LlmClient


def create_llm_client() -> LlmClient:
    from app.config import settings

    if settings.llm_mode == "real":
        from app.services.clients.real import RealLlmClient

        return RealLlmClient(
            endpoint=settings.llm_endpoint,
            model=settings.llm_model,
            api_key=settings.llm_api_key,
        )

    from app.services.clients.mock import MockLlmClient

    return MockLlmClient()
