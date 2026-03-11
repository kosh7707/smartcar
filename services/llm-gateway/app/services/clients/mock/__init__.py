from __future__ import annotations

from app.models.analysis import AnalysisResult
from app.services.clients.base import LlmClient
from app.services.clients.mock.dynamic_analyzer import analyze_dynamic
from app.services.clients.mock.static_analyzer import analyze_static
from app.services.clients.mock.testing_analyzer import analyze_testing


class MockLlmClient(LlmClient):
    """데모/스크린샷용 맥락 기반 응답 생성."""

    async def generate(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        system_content = ""
        user_content = ""
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
            elif msg["role"] == "user":
                user_content = msg["content"]

        if "소스코드" in system_content:
            result = analyze_static(user_content)
        elif "CAN" in system_content:
            result = analyze_dynamic(user_content)
        elif "침투" in system_content:
            result = analyze_testing(user_content)
        else:
            result = analyze_static(user_content)

        return result.to_json()
