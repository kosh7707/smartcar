"""LlmCaller 단위 테스트 — HTTP 호출을 mock하여 파싱 로직 검증."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError
from app.llm.caller import LlmCaller


def _make_httpx_response(data: dict, status_code: int = 200):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.text = json.dumps(data)
    return resp


def _content_response(content: str, prompt_tokens=100, completion_tokens=50):
    return {
        "choices": [{
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens},
    }


def _tool_calls_response(tool_calls: list[dict], prompt_tokens=100, completion_tokens=50):
    return {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": None,
                "tool_calls": tool_calls,
            },
            "finish_reason": "tool_calls",
        }],
        "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens},
    }


@pytest.mark.asyncio
async def test_parse_content_response():
    caller = LlmCaller("http://fake:8000", "qwen")
    resp_data = _content_response('{"summary": "test"}')
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(resp_data))

    result = await caller.call([{"role": "user", "content": "hi"}])
    assert result.content == '{"summary": "test"}'
    assert result.has_tool_calls() is False
    assert result.finish_reason == "stop"
    assert result.prompt_tokens == 100
    assert result.completion_tokens == 50


@pytest.mark.asyncio
async def test_parse_tool_calls_response():
    caller = LlmCaller("http://fake:8000", "qwen")
    resp_data = _tool_calls_response([{
        "id": "call_001",
        "type": "function",
        "function": {
            "name": "knowledge.search",
            "arguments": '{"query": "CWE-78"}',
        },
    }])
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(resp_data))

    result = await caller.call(
        [{"role": "user", "content": "analyze"}],
        tools=[{"type": "function", "function": {"name": "knowledge.search"}}],
    )
    assert result.has_tool_calls() is True
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "knowledge.search"
    assert result.tool_calls[0].arguments == {"query": "CWE-78"}
    assert result.tool_calls[0].id == "call_001"
    assert result.finish_reason == "tool_calls"


@pytest.mark.asyncio
async def test_parse_multiple_tool_calls():
    caller = LlmCaller("http://fake:8000", "qwen")
    resp_data = _tool_calls_response([
        {"id": "call_1", "type": "function", "function": {"name": "a", "arguments": "{}"}},
        {"id": "call_2", "type": "function", "function": {"name": "b", "arguments": '{"x": 1}'}},
    ])
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(resp_data))

    result = await caller.call([{"role": "user", "content": "go"}])
    assert len(result.tool_calls) == 2
    assert result.tool_calls[1].arguments == {"x": 1}


@pytest.mark.asyncio
async def test_malformed_tool_call_arguments_skipped():
    caller = LlmCaller("http://fake:8000", "qwen")
    resp_data = _tool_calls_response([
        {"id": "call_1", "type": "function", "function": {"name": "a", "arguments": "not json"}},
        {"id": "call_2", "type": "function", "function": {"name": "b", "arguments": "{}"}},
    ])
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(resp_data))

    result = await caller.call([{"role": "user", "content": "go"}])
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "b"


@pytest.mark.asyncio
async def test_tools_included_in_request_body():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(_content_response("ok")))

    tools = [{"type": "function", "function": {"name": "test_tool"}}]
    await caller.call([{"role": "user", "content": "hi"}], tools=tools)

    call_args = caller._client.post.call_args
    body = call_args.kwargs.get("json") or call_args[1].get("json")
    assert "tools" in body
    assert body["tool_choice"] == "auto"
    assert "response_format" not in body


@pytest.mark.asyncio
async def test_no_tools_uses_json_mode():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(_content_response("ok")))

    await caller.call([{"role": "user", "content": "hi"}])

    call_args = caller._client.post.call_args
    body = call_args.kwargs.get("json") or call_args[1].get("json")
    assert "tools" not in body
    assert body["response_format"] == {"type": "json_object"}


@pytest.mark.asyncio
async def test_timeout_raises_llm_timeout():
    import httpx as _httpx
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(side_effect=_httpx.TimeoutException("timeout"))

    with pytest.raises(LlmTimeoutError):
        await caller.call([{"role": "user", "content": "hi"}])


@pytest.mark.asyncio
async def test_connect_error_raises_unavailable():
    import httpx as _httpx
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(side_effect=_httpx.ConnectError("refused"))

    with pytest.raises(LlmUnavailableError):
        await caller.call([{"role": "user", "content": "hi"}])


@pytest.mark.asyncio
async def test_http_429_raises_retryable():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    resp = MagicMock()
    resp.status_code = 429
    resp.text = "rate limited"
    caller._client.post = AsyncMock(return_value=resp)

    with pytest.raises(LlmHttpError) as exc_info:
        await caller.call([{"role": "user", "content": "hi"}])
    assert exc_info.value.retryable is True


@pytest.mark.asyncio
async def test_token_usage_extracted():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(
        return_value=_make_httpx_response(_content_response("ok", 500, 200))
    )

    result = await caller.call([{"role": "user", "content": "hi"}])
    assert result.prompt_tokens == 500
    assert result.completion_tokens == 200


@pytest.mark.asyncio
async def test_aclose():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.aclose = AsyncMock()
    await caller.aclose()
    caller._client.aclose.assert_awaited_once()
