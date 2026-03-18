"""AgentSession 단위 테스트."""

import time

from app.core.agent_session import AgentSession
from app.schemas.agent import BudgetState, LlmResponse, ToolResult
from app.schemas.request import Context, TaskRequest
from app.types import TaskType


def _make_request() -> TaskRequest:
    return TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="test-001",
        context=Context(trusted={"findings": []}),
    )


def test_initial_state():
    s = AgentSession(_make_request(), BudgetState())
    assert s.turn_count == 0
    assert s.termination_reason == ""
    assert s.total_prompt_tokens() == 0
    assert s.total_tool_calls() == 0


def test_record_tool_turn():
    s = AgentSession(_make_request(), BudgetState())
    resp = LlmResponse(prompt_tokens=100, completion_tokens=50)
    results = [ToolResult(tool_call_id="c1", name="t", success=True, content="{}")]
    s.record_tool_turn(resp, results)
    assert s.turn_count == 1
    assert s.turns[0].llm_response_type == "tool_calls"


def test_record_content_turn():
    s = AgentSession(_make_request(), BudgetState())
    resp = LlmResponse(content="done", prompt_tokens=200, completion_tokens=100)
    s.record_content_turn(resp)
    assert s.turn_count == 1
    assert s.turns[0].llm_response_type == "content"


def test_total_tokens():
    s = AgentSession(_make_request(), BudgetState())
    s.record_content_turn(LlmResponse(prompt_tokens=100, completion_tokens=50))
    s.record_content_turn(LlmResponse(prompt_tokens=200, completion_tokens=80))
    assert s.total_prompt_tokens() == 300
    assert s.total_completion_tokens() == 130


def test_set_termination_reason():
    s = AgentSession(_make_request(), BudgetState())
    s.set_termination_reason("max_steps")
    assert s.termination_reason == "max_steps"


def test_elapsed_ms():
    s = AgentSession(_make_request(), BudgetState())
    assert s.elapsed_ms() >= 0
