"""T-4: Analysis Agent 토큰/컨텍스트 테스트."""

from __future__ import annotations

import pytest

from agent_shared.llm.turn_summarizer import TurnSummarizer
from agent_shared.schemas.agent import BudgetState
from app.budget.manager import BudgetManager


class TestPromptTokenTracking:
    def test_both_tokens_accumulated(self):
        """prompt + completion 토큰이 모두 누적된다."""
        bm = BudgetManager(BudgetState(max_steps=6, max_cheap_calls=3))
        bm.record_tokens(prompt=1000, completion=100, turn=1)
        bm.record_tokens(prompt=1500, completion=150, turn=2)

        snap = bm.snapshot()
        assert snap["tokens"] == 250
        assert snap["prompt_tokens"] == 2500


class TestTurnSummarizer:
    @pytest.mark.asyncio
    async def test_no_state_summary(self):
        """state_summary 없으면 기존 동작 유지."""
        ts = TurnSummarizer()
        messages = [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "u2"},
            {"role": "assistant", "content": "a2"},
            {"role": "user", "content": "u3"},
            {"role": "assistant", "content": "a3"},
        ]
        result = await ts.summarize(messages, keep_last_n=2)
        # 압축 메시지에 '세션 상태' 없어야 함
        for msg in result:
            if "컨텍스트 압축" in msg.get("content", ""):
                assert "세션 상태" not in msg["content"]

    @pytest.mark.asyncio
    async def test_with_state_summary(self):
        """state_summary 있으면 압축 메시지에 포함."""
        ts = TurnSummarizer()
        messages = [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "u1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "u2"},
            {"role": "assistant", "content": "a2"},
            {"role": "user", "content": "u3"},
            {"role": "assistant", "content": "a3"},
        ]
        state = {"files_read_count": 5}
        result = await ts.summarize(messages, keep_last_n=2, state_summary=state)
        found = any("세션 상태" in m.get("content", "") for m in result)
        assert found
