"""TokenCounter — LLM 응답에서 토큰 사용량을 추출하여 세션/예산에 기록."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession
    from app.schemas.agent import LlmResponse


class TokenCounter:
    """LLM 응답의 usage 정보를 세션과 예산에 반영한다."""

    def record(self, response: LlmResponse, session: AgentSession) -> None:
        session.budget.total_completion_tokens += response.completion_tokens
