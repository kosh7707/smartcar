from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from agent_shared.schemas.agent import LlmResponse
from app.core.agent_loop import AgentLoop


def _make_loop(llm_caller):
    message_manager = MagicMock()
    message_manager.get_token_estimate.return_value = 0
    message_manager.get_messages.return_value = [{"role": "user", "content": "hi"}]
    message_manager.compact = AsyncMock(return_value=0)

    retry_policy = MagicMock()
    retry_policy._max_retries = 0

    return AgentLoop(
        llm_caller=llm_caller,
        message_manager=message_manager,
        tool_registry=MagicMock(),
        tool_router=MagicMock(),
        termination_policy=MagicMock(),
        budget_manager=MagicMock(),
        token_counter=MagicMock(),
        result_assembler=MagicMock(),
        turn_summarizer=MagicMock(),
        retry_policy=retry_policy,
    )


def _make_session():
    session = MagicMock()
    session.turn_count = 0
    session.build_state_summary.return_value = "state"
    return session


@pytest.mark.asyncio
async def test_call_with_retry_prefers_async_ownership_when_no_tools():
    llm_caller = MagicMock()
    llm_caller.call = AsyncMock(return_value=LlmResponse(content='{"summary":"ok"}'))
    loop = _make_loop(llm_caller)

    await loop._call_with_retry(_make_session(), None)

    kwargs = llm_caller.call.await_args.kwargs
    assert kwargs["prefer_async_ownership"] is True


@pytest.mark.asyncio
async def test_call_with_retry_keeps_sync_path_when_tools_present():
    llm_caller = MagicMock()
    llm_caller.call = AsyncMock(return_value=LlmResponse(content=None, tool_calls=[]))
    loop = _make_loop(llm_caller)

    await loop._call_with_retry(_make_session(), [{"type": "function", "function": {"name": "tool"}}])

    kwargs = llm_caller.call.await_args.kwargs
    assert kwargs["prefer_async_ownership"] is False
