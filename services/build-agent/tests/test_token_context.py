"""T-4: 토큰/컨텍스트 테스트 — 토큰 추정, compaction 상태, timeout."""

from __future__ import annotations

import pytest

from app.agent_runtime.llm.message_manager import MessageManager
from app.agent_runtime.llm.turn_summarizer import TurnSummarizer
from app.agent_runtime.schemas.agent import BudgetState
from app.budget.manager import BudgetManager


class TestTokenEstimate:
    def test_tool_calls_included(self):
        """tool_calls JSON이 토큰 추정에 포함된다."""
        mm = MessageManager("system prompt", "user msg")
        # tool_calls가 포함된 assistant 메시지 직접 추가
        mm._messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {"id": "tc1", "function": {"name": "read_file", "arguments": '{"path": "src/main.c"}'}}
            ],
        })
        est = mm.get_token_estimate()
        # tool_calls JSON이 포함되었으므로 system+user만 있는 것보다 크다
        mm2 = MessageManager("system prompt", "user msg")
        assert est > mm2.get_token_estimate()

    def test_basic_estimate(self):
        mm = MessageManager("short", "hi")
        assert mm.get_token_estimate() > 0


class TestCompactionWithStateSummary:
    @pytest.mark.asyncio
    async def test_state_summary_in_compacted(self):
        """compaction 후 상태 요약이 메시지에 포함된다."""
        mm = MessageManager("system prompt", "initial user msg")
        for i in range(10):
            mm.add_user_message(f"user msg {i}")
            mm.add_assistant_content(f"assistant msg {i}")

        summarizer = TurnSummarizer()
        state = {"files_read_count": 3, "build_attempts": 2}
        removed = await mm.compact(summarizer, keep_last_n=4, state_summary=state)

        assert removed > 0
        # 세션 상태가 포함된 system 메시지가 있는지 확인
        found = False
        for msg in mm._messages:
            if msg.get("role") == "system" and "세션 상태" in msg.get("content", ""):
                found = True
                assert "files_read_count" in msg["content"]
                assert "build_attempts" in msg["content"]
        assert found, "compaction 후 세션 상태 메시지가 없음"


class TestPromptTokenTracking:
    def test_both_tokens_accumulated(self):
        """prompt + completion 토큰이 모두 누적된다."""
        bm = BudgetManager(BudgetState(max_steps=10, max_cheap_calls=10))
        bm.record_tokens(prompt=1500, completion=200, turn=1)
        bm.record_tokens(prompt=2000, completion=300, turn=2)

        snap = bm.snapshot()
        assert snap["tokens"] == 500  # completion total
        assert snap["prompt_tokens"] == 3500  # prompt total

    def test_prompt_budget_state(self):
        """BudgetState에 prompt 토큰 필드가 존재한다."""
        bs = BudgetState()
        assert bs.total_prompt_tokens == 0
        assert bs.max_prompt_tokens == 100_000
