from __future__ import annotations

import json

import pytest

from app.agent_runtime.schemas.agent import LlmResponse, ToolCallRequest
from app.agent_runtime.tools.tool_intent import (
    ToolIntentError,
    parse_tool_intent,
    tool_intent_to_request,
)
from tests.test_agent_loop import _build_agent_loop, _final_assessment_json


def test_tool_intent_parser_accepts_registered_analysis_tool() -> None:
    intent = parse_tool_intent(
        json.dumps({
            "action": "call_tool",
            "tool_name": "knowledge.search",
            "arguments": {"query": "CWE-78", "top_k": 3},
            "rationale": "Need external CWE context before final severity judgment.",
        }),
        available_tool_names={"knowledge.search"},
    )

    assert intent.tool_name == "knowledge.search"
    assert intent.arguments["query"] == "CWE-78"


def test_tool_intent_parser_rejects_malformed_json_and_unsupported_action() -> None:
    with pytest.raises(ToolIntentError, match="valid JSON"):
        parse_tool_intent("not json", available_tool_names={"knowledge.search"})

    with pytest.raises(ToolIntentError, match="unsupported action"):
        parse_tool_intent(
            '{"action":"final_answer","tool_name":"knowledge.search","arguments":{}}',
            available_tool_names={"knowledge.search"},
        )


def test_tool_intent_to_request_preserves_dotted_tool_name() -> None:
    intent = parse_tool_intent(
        '{"action":"call_tool","tool_name":"code_graph.search","arguments":{"query":"popen callers"}}',
        available_tool_names={"code_graph.search"},
    )

    request = tool_intent_to_request(intent, turn=5)

    assert request.id == "runtime-toolintent-05"
    assert request.name == "code_graph.search"
    assert request.arguments == {"query": "popen callers"}


@pytest.mark.asyncio
async def test_analysis_loop_dispatches_initial_required_acquisition_via_tool_intent() -> None:
    responses = [
        LlmResponse(
            content=json.dumps({
                "action": "call_tool",
                "tool_name": "knowledge.search",
                "arguments": {"query": "CWE-78"},
                "rationale": "Need CWE context before accepting or rejecting the finding.",
            }),
            prompt_tokens=100,
            completion_tokens=20,
        ),
        LlmResponse(
            content=_final_assessment_json(include_retrieval_ref=True),
            prompt_tokens=140,
            completion_tokens=90,
        ),
    ]
    loop, session = _build_agent_loop(responses, {"max_steps": 10, "max_cheap_calls": 6})

    result = await loop.run(session)

    assert result.status == "completed"
    first_call = loop._llm_caller.call.await_args_list[0]
    assert first_call.kwargs["tools"] is None
    assert "tool_choice" not in first_call.kwargs
    assert first_call.kwargs["generation"].enable_thinking is True
    assert session.trace[0].tool == "knowledge.search"
    assert session.trace[0].success is True


def test_legacy_llm_tool_call_objects_remain_supported_after_successful_acquisition() -> None:
    # The runtime-dispatch work removes `required` from mandatory acquisition.
    # It does not ban already-parsed tool calls from later auto/tool-parser turns.
    call = ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})
    assert call.name == "knowledge.search"
