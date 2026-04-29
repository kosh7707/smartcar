from __future__ import annotations

from abc import ABC, abstractmethod


class LlmClient(ABC):
    """LLM 호출 추상 인터페이스. Mock/Real 구현을 교체할 수 있다."""

    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int,
        temperature: float,
        top_p: float,
        top_k: int,
        min_p: float,
        presence_penalty: float,
        repetition_penalty: float,
        enable_thinking: bool,
        task_type: str | None = None,
    ) -> str:
        """메시지를 LLM에 전달하고 응답 텍스트(JSON)를 반환한다."""
