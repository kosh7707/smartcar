"""ToolFailurePolicy 단위 테스트."""

import json
from unittest.mock import MagicMock

from app.policy.tool_failure import ToolFailurePolicy
from agent_shared.schemas.agent import ToolCallRequest


def test_handle_returns_error_result():
    policy = ToolFailurePolicy()
    call = ToolCallRequest(id="call_1", name="sast.scan", arguments={"target": "main.c"})
    session = MagicMock()

    result = policy.handle(call, "Connection refused", session)

    assert result.success is False
    assert result.tool_call_id == "call_1"
    assert result.name == "sast.scan"
    assert "Connection refused" in result.content
    assert result.error == "Connection refused"


def test_handle_content_is_parseable_json():
    policy = ToolFailurePolicy()
    call = ToolCallRequest(id="call_2", name="knowledge.search", arguments={})
    session = MagicMock()

    result = policy.handle(call, "timeout", session)
    parsed = json.loads(result.content)
    assert "error" in parsed
    assert "suggestion" in parsed


def test_handle_preserves_tool_name():
    policy = ToolFailurePolicy()
    call = ToolCallRequest(id="call_3", name="source.get_span", arguments={"file": "a.c"})
    session = MagicMock()

    result = policy.handle(call, "404", session)
    assert "source.get_span" in result.content
