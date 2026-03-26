"""TurnSummarizer 단위 테스트."""

import pytest

from agent_shared.llm.turn_summarizer import TurnSummarizer


@pytest.mark.asyncio
async def test_short_conversation_unchanged():
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "usr"},
        {"role": "assistant", "content": "ok"},
    ]
    result = await s.summarize(msgs, keep_last_n=4)
    assert len(result) == 3


@pytest.mark.asyncio
async def test_long_conversation_truncated():
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "msg1"},
        {"role": "assistant", "content": "msg2"},
        {"role": "user", "content": "msg3"},
        {"role": "assistant", "content": "msg4"},
        {"role": "user", "content": "msg5"},
        {"role": "assistant", "content": "msg6"},
    ]
    result = await s.summarize(msgs, keep_last_n=2)
    # system + 생략 안내 + last 2
    assert len(result) == 4
    assert result[0]["role"] == "system"
    assert "생략" in result[1]["content"]
    assert result[2]["content"] == "msg5"
    assert result[3]["content"] == "msg6"


@pytest.mark.asyncio
async def test_preserves_system_prompt():
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "important system"},
    ] + [{"role": "user", "content": f"m{i}"} for i in range(10)]
    result = await s.summarize(msgs, keep_last_n=3)
    assert result[0]["content"] == "important system"
