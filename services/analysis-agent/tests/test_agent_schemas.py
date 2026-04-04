"""에이전트 DTO 테스트."""

import warnings

from agent_shared.schemas.agent import (
    AgentAuditInfo,
    BudgetState,
    LlmResponse,
    ToolCallRequest,
    ToolCostTier,
    ToolResult,
    ToolTraceStep,
    TurnRecord,
)


def test_tool_call_request_auto_hash():
    req = ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})
    assert req.args_hash != ""
    assert len(req.args_hash) == 16


def test_tool_call_request_same_args_same_hash():
    a = ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})
    b = ToolCallRequest(id="call_2", name="knowledge.search", arguments={"query": "CWE-78"})
    assert a.args_hash == b.args_hash


def test_tool_call_request_different_args_different_hash():
    a = ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})
    b = ToolCallRequest(id="call_2", name="knowledge.search", arguments={"query": "CWE-79"})
    assert a.args_hash != b.args_hash


def test_llm_response_has_tool_calls():
    r = LlmResponse(tool_calls=[
        ToolCallRequest(id="call_1", name="test", arguments={}),
    ])
    assert r.has_tool_calls() is True


def test_llm_response_no_tool_calls():
    r = LlmResponse(content="done")
    assert r.has_tool_calls() is False


def test_budget_state_defaults():
    b = BudgetState()
    assert b.max_steps == 6
    assert b.max_completion_tokens == 2000
    assert b.max_cheap_calls == 3
    assert b.max_medium_calls == 2
    assert b.max_expensive_calls == 1
    assert b.max_consecutive_no_evidence == 2


def test_tool_result_serialization():
    r = ToolResult(
        tool_call_id="call_1",
        name="knowledge.search",
        success=True,
        content='{"hits": []}',
        new_evidence_refs=["eref-100"],
        duration_ms=42,
    )
    d = r.model_dump()
    assert d["new_evidence_refs"] == ["eref-100"]
    assert d["duration_ms"] == 42


def test_turn_record_with_steps():
    step = ToolTraceStep(
        step_id="step_01",
        turn_number=1,
        tool="knowledge.search",
        args_hash="abc123",
        cost_tier=ToolCostTier.CHEAP,
        duration_ms=100,
        new_evidence_refs=["eref-200"],
    )
    turn = TurnRecord(
        turn_number=1,
        llm_response_type="tool_calls",
        prompt_tokens=500,
        completion_tokens=100,
        tool_steps=[step],
    )
    assert len(turn.tool_steps) == 1
    assert turn.tool_steps[0].cost_tier == ToolCostTier.CHEAP


def test_agent_audit_info_no_protected_namespace_warning():
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        audit = AgentAuditInfo(input_hash="sha256:test", model_name="demo-model")

    assert audit.model_name == "demo-model"
    assert all("protected namespace" not in str(w.message) for w in caught)
