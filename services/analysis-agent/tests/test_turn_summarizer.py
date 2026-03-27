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
    assert result[1]["role"] == "system"
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


@pytest.mark.asyncio
async def test_tool_pairs_preserved():
    """tool_call/tool 쌍이 깨지지 않고 보존되는지 검증."""
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "task"},
        # turn 1: assistant → 2 tool results
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "1", "type": "function", "function": {"name": "read_file", "arguments": "{}"}},
            {"id": "2", "type": "function", "function": {"name": "read_file", "arguments": "{}"}},
        ]},
        {"role": "tool", "tool_call_id": "1", "content": "file content 1"},
        {"role": "tool", "tool_call_id": "2", "content": "file content 2"},
        # turn 2: assistant → 1 tool result
        {"role": "assistant", "content": None, "tool_calls": [
            {"id": "3", "type": "function", "function": {"name": "write_file", "arguments": "{}"}},
        ]},
        {"role": "tool", "tool_call_id": "3", "content": "ok"},
        # turn 3: final content
        {"role": "assistant", "content": "final report"},
    ]
    # keep_last_n=2 → cut_idx=6, messages[6]=tool → 후퇴 → messages[5]=assistant
    result = await s.summarize(msgs, keep_last_n=2)
    assert result[0]["role"] == "system"
    assert result[1]["role"] == "system"
    assert "생략" in result[1]["content"]
    # turn 2 의 assistant(tool_calls) + tool(ok) 가 함께 보존
    assert result[2]["role"] == "assistant"
    assert result[2].get("tool_calls") is not None
    assert result[3]["role"] == "tool"
    assert result[3]["content"] == "ok"
    # turn 3
    assert result[4]["role"] == "assistant"
    assert result[4]["content"] == "final report"


@pytest.mark.asyncio
async def test_no_compaction_when_all_tools():
    """모든 body가 하나의 tool_call/tool 쌍이면 압축 불가 → 원본 반환."""
    s = TurnSummarizer()
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "assistant", "content": None, "tool_calls": [{"id": "1"}]},
        {"role": "tool", "tool_call_id": "1", "content": "r1"},
        {"role": "tool", "tool_call_id": "2", "content": "r2"},
    ]
    result = await s.summarize(msgs, keep_last_n=1)
    # 후퇴 시 prefix 경계 도달 → 원본 반환
    assert len(result) == len(msgs)
