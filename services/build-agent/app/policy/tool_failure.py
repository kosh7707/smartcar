"""ToolFailurePolicy — tool 실행 실패 시 대응 전략."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.agent_runtime.schemas.agent import ToolCallRequest, ToolResult

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession


class ToolFailurePolicy:
    """tool 실패 시 LLM에게 에러를 알리는 ToolResult를 생성한다."""

    def handle(
        self,
        call: ToolCallRequest,
        error: str,
        session: AgentSession,
    ) -> ToolResult:
        return ToolResult(
            tool_call_id=call.id,
            name=call.name,
            success=False,
            content=f'{{"error": "Tool execution failed: {error}", "tool": "{call.name}", "suggestion": "Try an alternative approach or skip this tool."}}',
            error=error,
        )
