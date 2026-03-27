"""MessageManager 단위 테스트."""

import json

import pytest

from agent_shared.llm.message_manager import MessageManager
from agent_shared.llm.turn_summarizer import TurnSummarizer
from agent_shared.schemas.agent import ToolCallRequest, ToolResult


def test_initial_messages():
    mm = MessageManager("system prompt", "user message")
    msgs = mm.get_messages()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[0]["content"] == "system prompt"
    assert msgs[1]["role"] == "user"
    assert msgs[1]["content"] == "user message"


def test_add_assistant_content():
    mm = MessageManager("sys", "usr")
    mm.add_assistant_content("hello")
    msgs = mm.get_messages()
    assert len(msgs) == 3
    assert msgs[2]["role"] == "assistant"
    assert msgs[2]["content"] == "hello"


def test_add_assistant_tool_calls():
    mm = MessageManager("sys", "usr")
    tool_calls = [
        ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"}),
    ]
    mm.add_assistant_tool_calls(tool_calls)
    msgs = mm.get_messages()
    assert len(msgs) == 3
    assert msgs[2]["role"] == "assistant"
    assert msgs[2]["content"] is None
    assert len(msgs[2]["tool_calls"]) == 1
    assert msgs[2]["tool_calls"][0]["function"]["name"] == "knowledge.search"
    # arguments는 JSON string
    args = json.loads(msgs[2]["tool_calls"][0]["function"]["arguments"])
    assert args == {"query": "CWE-78"}


def test_add_tool_results():
    mm = MessageManager("sys", "usr")
    results = [
        ToolResult(tool_call_id="call_1", name="knowledge.search", success=True, content='{"hits": []}'),
    ]
    mm.add_tool_results(results)
    msgs = mm.get_messages()
    assert len(msgs) == 3
    assert msgs[2]["role"] == "tool"
    assert msgs[2]["tool_call_id"] == "call_1"
    assert msgs[2]["content"] == '{"hits": []}'


def test_full_conversation_round_trip():
    mm = MessageManager("system", "analyze this code")
    # Turn 1: assistant requests tool
    mm.add_assistant_tool_calls([
        ToolCallRequest(id="call_1", name="sast.scan", arguments={"file": "main.c"}),
    ])
    # Turn 1: tool result
    mm.add_tool_results([
        ToolResult(tool_call_id="call_1", name="sast.scan", success=True, content='{"findings": []}'),
    ])
    # Turn 2: assistant responds with content
    mm.add_assistant_content('{"summary": "No issues found"}')

    msgs = mm.get_messages()
    assert len(msgs) == 5
    roles = [m["role"] for m in msgs]
    assert roles == ["system", "user", "assistant", "tool", "assistant"]


def test_get_messages_returns_deep_copy():
    mm = MessageManager("sys", "usr")
    msgs1 = mm.get_messages()
    msgs1.append({"role": "extra"})
    msgs2 = mm.get_messages()
    assert len(msgs2) == 2  # original unchanged


def test_message_count():
    mm = MessageManager("sys", "usr")
    assert mm.message_count() == 2
    mm.add_assistant_content("ok")
    assert mm.message_count() == 3


def test_token_estimate():
    mm = MessageManager("a" * 100, "b" * 200)
    est = mm.get_token_estimate()
    assert est == 75  # (100 + 200) / 4


@pytest.mark.asyncio
async def test_compact_reduces_messages():
    """compact()가 오래된 메시지를 제거하고 제거 수를 반환하는지 확인."""
    mm = MessageManager("sys", "usr")
    # 6개 턴 추가 (assistant + tool 쌍)
    for i in range(6):
        mm.add_assistant_tool_calls([
            ToolCallRequest(id=f"c{i}", name="tool", arguments={"i": i}),
        ])
        mm.add_tool_results([
            ToolResult(tool_call_id=f"c{i}", name="tool", success=True, content=f"r{i}"),
        ])
    mm.add_assistant_content("done")

    before = mm.message_count()  # 2 + 12 + 1 = 15
    assert before == 15

    summarizer = TurnSummarizer()
    removed = await mm.compact(summarizer, keep_last_n=4)

    assert removed > 0
    assert mm.message_count() < before
    # 압축 후에도 마지막 assistant 응답은 유지
    msgs = mm.get_messages()
    assert msgs[-1]["content"] == "done"
