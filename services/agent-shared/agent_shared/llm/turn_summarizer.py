"""TurnSummarizer — 컨텍스트 압축. Phase 1에서는 단순 truncation."""

from __future__ import annotations


class TurnSummarizer:
    """긴 대화를 압축한다. tool_call/tool 쌍을 보존하면서 truncation."""

    async def summarize(
        self,
        messages: list[dict],
        keep_last_n: int = 4,
    ) -> list[dict]:
        """system prompt + 마지막 N개 메시지를 유지한다.

        tool_call/tool 쌍이 깨지지 않도록, 절단점이 'tool' 메시지에
        걸리면 해당 assistant 메시지까지 포함하여 보존한다.
        Phase 2에서 LLM 기반 요약으로 업그레이드 예정.
        """
        if len(messages) <= keep_last_n + 1:
            return messages

        system = messages[0] if messages and messages[0].get("role") == "system" else None
        prefix_len = 1 if system else 0

        cut_idx = len(messages) - keep_last_n

        # tool 메시지에서 시작하면 해당 assistant(tool_calls)까지 후퇴
        while cut_idx > prefix_len and messages[cut_idx].get("role") == "tool":
            cut_idx -= 1

        # 후퇴해도 prefix 경계까지 도달하면 압축 불가 → 원본 반환
        if cut_idx <= prefix_len:
            return messages

        tail = messages[cut_idx:]
        omitted = cut_idx - prefix_len

        result = []
        if system:
            result.append(system)
        result.append({
            "role": "system",
            "content": f"[이전 {omitted}개 메시지 생략]",
        })
        result.extend(tail)
        return result
