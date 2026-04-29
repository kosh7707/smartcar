"""AgentSession 단위 테스트."""

import time

from app.core.agent_session import AgentSession
from app.agent_runtime.schemas.agent import BudgetState, LlmResponse, ToolResult
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


def test_record_recovery_turn_does_not_consume_progress_slot_but_counts_tokens():
    s = AgentSession(_make_request(), BudgetState())
    resp = LlmResponse(content="malformed", prompt_tokens=20, completion_tokens=5)

    s.record_recovery_turn(resp)

    assert s.turn_count == 0
    assert s.recovery_turns[0].llm_response_type == "recovery_content"
    assert s.recovery_turns[0].audit_order == 1
    assert s.total_prompt_tokens() == 20
    assert s.total_completion_tokens() == 5


def test_audit_order_preserves_recovery_then_content_chronology_with_duplicate_turn_numbers():
    s = AgentSession(_make_request(), BudgetState())

    s.record_recovery_turn(LlmResponse(content="not-json", prompt_tokens=20, completion_tokens=5))
    s.record_content_turn(LlmResponse(content="{}", prompt_tokens=30, completion_tokens=7))

    combined = sorted([*s.turns, *s.recovery_turns], key=lambda turn: turn.audit_order)
    assert [(turn.audit_order, turn.turn_number, turn.llm_response_type) for turn in combined] == [
        (1, 1, "recovery_content"),
        (2, 1, "content"),
    ]


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


def test_live_recovery_trace_summary_truncates_first_and_last_attempts():
    s = AgentSession(_make_request(), BudgetState())
    for i in range(12):
        s.evidence_catalog.add_negative(
            "knowledge.search",
            {"query": f"CWE-{i}"},
            f"no_hits_{i}",
        )

    summary = s.live_recovery_trace_summary()

    assert summary["totalAttempts"] == 12
    assert summary["negativeCount"] == 12
    assert summary["operationalCount"] == 0
    assert summary["truncated"] is True
    assert len(summary["shownAttempts"]) == 10
    assert summary["shownAttempts"][0]["toolArguments"] == {"query": "CWE-0"}
    assert summary["shownAttempts"][4]["toolArguments"] == {"query": "CWE-4"}
    assert summary["shownAttempts"][5]["toolArguments"] == {"query": "CWE-7"}
    assert summary["shownAttempts"][-1]["toolArguments"] == {"query": "CWE-11"}


def test_live_recovery_trace_summary_indices_are_contiguous_with_recovery_turns():
    s = AgentSession(_make_request(), BudgetState())
    s.evidence_catalog.add_negative("knowledge.search", {"query": "CWE-78"}, "no_hits")
    s.evidence_catalog.add_operational("code_graph.callers", {"function": "popen"}, "timeout")
    s.record_recovery_turn(LlmResponse(content="not json", prompt_tokens=3, completion_tokens=2))

    summary = s.live_recovery_trace_summary()

    assert [item["index"] for item in summary["shownAttempts"]] == [0, 1, 2]
    assert summary["totalAttempts"] == 3
