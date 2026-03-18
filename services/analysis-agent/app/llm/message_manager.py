"""MessageManager — 멀티 턴 대화의 messages 배열 관리."""

from __future__ import annotations

import copy

from app.schemas.agent import ToolCallRequest, ToolResult


class MessageManager:
    """messages 배열을 누적 관리한다. tool result 주입을 포함."""

    def __init__(self, system_prompt: str, initial_user_message: str) -> None:
        self._messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": initial_user_message},
        ]

    def get_messages(self) -> list[dict]:
        """현재 messages 배열의 deep copy를 반환한다."""
        return copy.deepcopy(self._messages)

    def add_assistant_content(self, content: str) -> None:
        """assistant의 텍스트 응답을 추가한다."""
        self._messages.append({"role": "assistant", "content": content})

    def add_assistant_tool_calls(self, tool_calls: list[ToolCallRequest]) -> None:
        """assistant의 tool_calls 응답을 추가한다 (content=null)."""
        self._messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": __import__("json").dumps(tc.arguments, ensure_ascii=False),
                    },
                }
                for tc in tool_calls
            ],
        })

    def add_tool_results(self, results: list[ToolResult]) -> None:
        """tool 실행 결과를 role='tool' 메시지로 추가한다."""
        for result in results:
            self._messages.append({
                "role": "tool",
                "tool_call_id": result.tool_call_id,
                "content": result.content,
            })

    def message_count(self) -> int:
        return len(self._messages)

    def get_token_estimate(self) -> int:
        """대략적 토큰 추정 (4자 = 1토큰)."""
        total_chars = sum(
            len(str(m.get("content", "")))
            for m in self._messages
        )
        return total_chars // 4
