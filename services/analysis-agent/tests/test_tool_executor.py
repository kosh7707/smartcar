"""ToolExecutor 단위 테스트."""

import asyncio

import pytest

from agent_shared.schemas.agent import ToolCallRequest, ToolResult
from agent_shared.tools.executor import ToolExecutor


class _SlowTool:
    async def execute(self, arguments: dict) -> ToolResult:
        await asyncio.sleep(10)
        return ToolResult(tool_call_id="", name="", success=True, content="{}")


class _SuccessTool:
    async def execute(self, arguments: dict) -> ToolResult:
        return ToolResult(tool_call_id="", name="", success=True, content='{"ok": true}')


class _ErrorTool:
    async def execute(self, arguments: dict) -> ToolResult:
        raise ValueError("boom")


@pytest.mark.asyncio
async def test_successful_execution():
    executor = ToolExecutor(timeout_ms=5000)
    call = ToolCallRequest(id="call_1", name="test", arguments={})
    result = await executor.execute(_SuccessTool(), call)
    assert result.success is True
    assert result.tool_call_id == "call_1"
    assert result.name == "test"
    assert result.duration_ms >= 0


@pytest.mark.asyncio
async def test_timeout():
    executor = ToolExecutor(timeout_ms=100)
    call = ToolCallRequest(id="call_1", name="slow", arguments={})
    result = await executor.execute(_SlowTool(), call)
    assert result.success is False
    assert "timed out" in result.content.lower()


@pytest.mark.asyncio
async def test_exception_caught():
    executor = ToolExecutor(timeout_ms=5000)
    call = ToolCallRequest(id="call_1", name="bad", arguments={})
    result = await executor.execute(_ErrorTool(), call)
    assert result.success is False
    assert "boom" in result.content
    assert result.error == "boom"
