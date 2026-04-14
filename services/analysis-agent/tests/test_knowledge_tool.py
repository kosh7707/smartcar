import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.tools.implementations.knowledge_tool import KnowledgeTool


@pytest.fixture
def tool():
    return KnowledgeTool(base_url="http://localhost:8002")


@pytest.mark.asyncio
async def test_timeout_returns_explicit_timeout_error(tool):
    mock_response = MagicMock()
    mock_response.status_code = 408
    mock_response.json.return_value = {"errorDetail": {"code": "TIMEOUT"}}
    tool._client = MagicMock()
    tool._client.post = AsyncMock(
        side_effect=httpx.HTTPStatusError("timeout", request=MagicMock(), response=mock_response)
    )

    result = await tool.execute({"query": "CWE-78"})

    assert result.success is False
    assert result.error == "TIMEOUT"
    payload = json.loads(result.content)
    assert payload["error"] == "TIMEOUT"


@pytest.mark.asyncio
async def test_kb_not_ready_returns_explicit_code(tool):
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.json.return_value = {"errorDetail": {"code": "KB_NOT_READY"}}
    tool._client = MagicMock()
    tool._client.post = AsyncMock(
        side_effect=httpx.HTTPStatusError("not ready", request=MagicMock(), response=mock_response)
    )

    result = await tool.execute({"query": "CWE-78"})

    assert result.success is False
    assert result.error == "KB_NOT_READY"
    payload = json.loads(result.content)
    assert payload["error"] == "KB_NOT_READY"
