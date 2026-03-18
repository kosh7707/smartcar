"""TurnSummarizer — 컨텍스트 압축. Phase 1에서는 단순 truncation."""

from __future__ import annotations


class TurnSummarizer:
    """긴 대화를 압축한다. Phase 1: system + last N turns 유지."""

    async def summarize(
        self,
        messages: list[dict],
        keep_last_n: int = 4,
    ) -> list[dict]:
        """system prompt + 마지막 N개 메시지만 유지한다.

        Phase 2에서 LLM 기반 요약으로 업그레이드 예정.
        """
        if len(messages) <= keep_last_n + 1:
            return messages

        system = messages[0] if messages and messages[0].get("role") == "system" else None
        tail = messages[-keep_last_n:]

        result = []
        if system:
            result.append(system)
            result.append({
                "role": "user",
                "content": f"[이전 {len(messages) - keep_last_n - 1}개 메시지 생략]",
            })
        result.extend(tail)
        return result
