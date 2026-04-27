"""Compatibility wrapper for the shared ToolRouter core."""

from app.agent_runtime.schemas.agent import ToolCallRequest, ToolResult
from app.agent_runtime.tools.registry import ToolSchema, ToolSideEffect
from app.agent_runtime.tools.router_core import SharedToolRouter


class ToolRouter(SharedToolRouter):
    """Build-agent ToolRouter with explicit build-only seams."""

    def _duplicate_call_message(self, call: ToolCallRequest) -> str:
        return (
            '{"error": "이전과 동일한 호출이 차단됨. 다른 인자 또는 다른 도구를 사용하라. '
            '빌드 실패 후라면 에러 원인을 분석하고 다른 전략을 시도하라."}'
        )

    def _should_clear_duplicate_hashes(
        self,
        *,
        schema: ToolSchema,
        result: ToolResult,
    ) -> bool:
        return result.success and schema.side_effect == ToolSideEffect.WRITE
