"""CodeGraphCalleesTool 단위 테스트."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.tools.implementations.codegraph_callees_tool import CodeGraphCalleesTool


@pytest.fixture
def tool():
    t = CodeGraphCalleesTool(base_url="http://localhost:8002", project_id="proj-1")
    return t


@pytest.mark.asyncio
async def test_success(tool):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "function": "postJson",
        "callees": [
            {"name": "popen", "file": None, "line": None},
            {"name": "fgets", "file": None, "line": None},
        ],
    }
    tool._client = MagicMock()
    tool._client.get = AsyncMock(return_value=mock_resp)

    result = await tool.execute({"function_name": "postJson"})
    assert result.success is True
    assert "popen" in result.content
    assert "eref-callee-popen" in result.new_evidence_refs
    assert "eref-callee-fgets" in result.new_evidence_refs


@pytest.mark.asyncio
async def test_missing_function_name(tool):
    result = await tool.execute({})
    assert result.success is False
    assert "function_name" in result.content


@pytest.mark.asyncio
async def test_no_project_id():
    tool = CodeGraphCalleesTool(base_url="http://localhost:8002")
    result = await tool.execute({"function_name": "popen"})
    assert result.success is False
    assert "project_id" in result.content


@pytest.mark.asyncio
async def test_http_error(tool):
    tool._client = MagicMock()
    tool._client.get = AsyncMock(side_effect=httpx.ConnectError("connection refused"))

    result = await tool.execute({"function_name": "popen"})
    assert result.success is False
    assert "unavailable" in result.content.lower() or "error" in result.content.lower()


@pytest.mark.asyncio
async def test_set_project_id():
    tool = CodeGraphCalleesTool()
    assert tool._project_id == ""
    tool.set_project_id("proj-123")
    assert tool._project_id == "proj-123"
