"""AgentLoop 통합 테스트 — mock LlmCaller로 전체 루프 검증."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.budget.manager import BudgetManager
from app.budget.token_counter import TokenCounter
from app.core.agent_loop import AgentLoop
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from agent_shared.llm.message_manager import MessageManager
from agent_shared.llm.turn_summarizer import TurnSummarizer
from agent_shared.policy.retry import RetryPolicy
from app.policy.termination import TerminationPolicy
from app.policy.tool_failure import ToolFailurePolicy
from agent_shared.schemas.agent import BudgetState, LlmResponse, ToolCallRequest, ToolCostTier
from app.schemas.request import Context, EvidenceRef, TaskRequest
from agent_shared.tools.executor import ToolExecutor
from app.tools.implementations.mock_tools import MockKnowledgeTool
from agent_shared.tools.registry import ToolRegistry, ToolSchema
from app.tools.router import ToolRouter
from app.types import TaskType


def _make_request(**overrides) -> TaskRequest:
    defaults = dict(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="test-001",
        context=Context(trusted={"findings": [{"ruleId": "CWE-78"}]}),
        evidenceRefs=[
            EvidenceRef(
                refId="eref-001", artifactId="art-1",
                artifactType="source", locatorType="lineRange",
                locator={"file": "main.c", "fromLine": 1, "toLine": 50},
            ),
        ],
    )
    defaults.update(overrides)
    return TaskRequest(**defaults)


def _final_assessment_json() -> str:
    return json.dumps({
        "summary": "CWE-78 OS Command Injection detected",
        "claims": [{
            "statement": "User input flows to popen()",
            "supportingEvidenceRefs": ["eref-001"],
        }],
        "caveats": ["Requires runtime verification"],
        "usedEvidenceRefs": ["eref-001"],
        "suggestedSeverity": "critical",
        "needsHumanReview": True,
        "recommendedNextSteps": ["Replace popen with execve"],
        "policyFlags": [],
    })


def _build_agent_loop(
    llm_responses: list[LlmResponse],
    budget_overrides: dict | None = None,
) -> tuple[AgentLoop, AgentSession]:
    """mock LlmCaller로 AgentLoop를 구성한다."""
    llm_caller = MagicMock()
    llm_caller.call = AsyncMock(side_effect=llm_responses)

    mm = MessageManager("You are a security analyst.", "Analyze the findings.")

    registry = ToolRegistry()
    registry.register(ToolSchema(
        name="knowledge.search",
        description="Search threat knowledge",
        parameters={"type": "object", "properties": {"query": {"type": "string"}}},
        cost_tier=ToolCostTier.CHEAP,
    ))

    budget = BudgetState(**(budget_overrides or {}))
    bm = BudgetManager(budget)
    executor = ToolExecutor(timeout_ms=5000)
    failure_policy = ToolFailurePolicy()

    router = ToolRouter(registry, executor, bm, failure_policy)
    router.register_implementation("knowledge.search", MockKnowledgeTool())

    session = AgentSession(_make_request(), budget)

    loop = AgentLoop(
        llm_caller=llm_caller,
        message_manager=mm,
        tool_registry=registry,
        tool_router=router,
        termination_policy=TerminationPolicy(timeout_ms=300_000),
        budget_manager=bm,
        token_counter=TokenCounter(),
        result_assembler=ResultAssembler(),
        turn_summarizer=TurnSummarizer(),
        retry_policy=RetryPolicy(max_retries=1),
    )
    return loop, session


@pytest.mark.asyncio
async def test_single_turn_content_only():
    """LLM이 즉시 content를 반환하면 1턴에 종료."""
    responses = [
        LlmResponse(content=_final_assessment_json(), prompt_tokens=100, completion_tokens=50),
    ]
    loop, session = _build_agent_loop(responses)
    result = await loop.run(session)

    assert result.status == "completed"
    assert result.result.summary == "CWE-78 OS Command Injection detected"
    assert session.turn_count == 1


@pytest.mark.asyncio
async def test_two_turn_tool_then_content():
    """Turn 1: tool_call → Turn 2: content."""
    responses = [
        # Turn 1: tool call
        LlmResponse(
            tool_calls=[ToolCallRequest(id="call_1", name="knowledge.search", arguments={"query": "CWE-78"})],
            finish_reason="tool_calls",
            prompt_tokens=100, completion_tokens=30,
        ),
        # Turn 2: final content
        LlmResponse(
            content=_final_assessment_json(),
            prompt_tokens=200, completion_tokens=80,
        ),
    ]
    loop, session = _build_agent_loop(responses)
    result = await loop.run(session)

    assert result.status == "completed"
    assert session.turn_count == 2
    assert len(session.trace) >= 1  # at least one tool trace


@pytest.mark.asyncio
async def test_three_turn_scenario():
    """Turn 1: tool → Turn 2: tool → Turn 3: content."""
    responses = [
        LlmResponse(
            tool_calls=[ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "CWE-78"})],
            finish_reason="tool_calls", prompt_tokens=100, completion_tokens=20,
        ),
        LlmResponse(
            tool_calls=[ToolCallRequest(id="c2", name="knowledge.search", arguments={"query": "CAPEC-88"})],
            finish_reason="tool_calls", prompt_tokens=200, completion_tokens=25,
        ),
        LlmResponse(content=_final_assessment_json(), prompt_tokens=300, completion_tokens=100),
    ]
    loop, session = _build_agent_loop(responses)
    result = await loop.run(session)

    assert result.status == "completed"
    assert session.turn_count == 3


@pytest.mark.asyncio
async def test_max_steps_exhaustion():
    """max_steps에 도달하면 루프 강제 종료."""
    # max_steps=2인데 계속 tool_call만 반환
    responses = [
        LlmResponse(
            tool_calls=[ToolCallRequest(id=f"c{i}", name="knowledge.search", arguments={"query": f"q{i}"})],
            finish_reason="tool_calls", prompt_tokens=100, completion_tokens=20,
        )
        for i in range(5)
    ]
    loop, session = _build_agent_loop(responses, {"max_steps": 2})
    result = await loop.run(session)

    assert result.status == "budget_exceeded"
    assert session.termination_reason == "max_steps"


@pytest.mark.asyncio
async def test_token_budget_exhaustion():
    """completion token 예산 초과 시 종료."""
    responses = [
        LlmResponse(
            tool_calls=[ToolCallRequest(id="c1", name="knowledge.search", arguments={"query": "a"})],
            finish_reason="tool_calls", prompt_tokens=100, completion_tokens=1500,
        ),
        LlmResponse(
            tool_calls=[ToolCallRequest(id="c2", name="knowledge.search", arguments={"query": "b"})],
            finish_reason="tool_calls", prompt_tokens=100, completion_tokens=600,
        ),
    ]
    loop, session = _build_agent_loop(responses, {"max_completion_tokens": 2000})
    result = await loop.run(session)

    assert result.status == "budget_exceeded"
    assert session.termination_reason == "budget_exhausted"


@pytest.mark.asyncio
async def test_llm_error_returns_failure():
    """LLM 호출이 재시도 후에도 실패하면 MODEL_ERROR 반환."""
    from agent_shared.errors import LlmUnavailableError

    llm_caller = MagicMock()
    llm_caller.call = AsyncMock(side_effect=LlmUnavailableError())

    budget = BudgetState()
    bm = BudgetManager(budget)
    registry = ToolRegistry()

    loop = AgentLoop(
        llm_caller=llm_caller,
        message_manager=MessageManager("sys", "usr"),
        tool_registry=registry,
        tool_router=ToolRouter(registry, ToolExecutor(), bm, ToolFailurePolicy()),
        termination_policy=TerminationPolicy(),
        budget_manager=bm,
        token_counter=TokenCounter(),
        result_assembler=ResultAssembler(),
        turn_summarizer=TurnSummarizer(),
        retry_policy=RetryPolicy(max_retries=1),
    )
    session = AgentSession(_make_request(), budget)
    result = await loop.run(session)

    assert result.status == "model_error"
    assert result.retryable is True


@pytest.mark.asyncio
async def test_audit_info_populated():
    """성공 응답의 audit에 agentAudit가 포함되는지 확인."""
    responses = [
        LlmResponse(content=_final_assessment_json(), prompt_tokens=100, completion_tokens=50),
    ]
    loop, session = _build_agent_loop(responses)
    result = await loop.run(session)

    assert result.audit.agentAudit is not None
    agent_audit = result.audit.agentAudit
    assert agent_audit["turn_count"] == 1
    assert agent_audit["termination_reason"] == "content_returned"
