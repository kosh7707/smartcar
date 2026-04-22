"""LlmCaller 단위 테스트 — HTTP 호출을 mock하여 파싱 로직 검증."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent_shared.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError, StrictJsonContractError
from agent_shared.llm.caller import LlmCaller


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
    headers = call_args.kwargs.get("headers") or call_args[1].get("headers")
    assert headers["X-AEGIS-Strict-JSON"] == "true"


@pytest.mark.asyncio
async def test_async_ownership_returns_wrapped_result_for_toolless_calls():
    caller = LlmCaller("http://fake:8000", "qwen")

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _make_httpx_response({
                "requestId": "acr_001",
                "traceRequestId": "gw-001",
                "status": "accepted",
                "statusUrl": "/v1/async-chat-requests/acr_001",
                "resultUrl": "/v1/async-chat-requests/acr_001/result",
                "expiresAt": "2026-04-14T03:45:00Z",
            }, status_code=202)
        raise AssertionError(f"unexpected POST url: {url}")

    async def fake_get(url, **kwargs):
        if url.endswith("/v1/async-chat-requests/acr_001"):
            return _make_httpx_response({
                "requestId": "acr_001",
                "state": "completed",
                "localAckState": None,
                "resultReady": True,
            })
        if url.endswith("/v1/async-chat-requests/acr_001/result"):
            return _make_httpx_response({
                "requestId": "acr_001",
                "state": "completed",
                "response": _content_response('{"summary":"async ok"}'),
            })
        raise AssertionError(f"unexpected GET url: {url}")

    caller._client = MagicMock()
    caller._client.post = AsyncMock(side_effect=fake_post)
    caller._client.get = AsyncMock(side_effect=fake_get)

    result = await caller.call(
        [{"role": "user", "content": "hi"}],
        prefer_async_ownership=True,
    )

    assert result.content == '{"summary":"async ok"}'
    assert result.has_tool_calls() is False


@pytest.mark.asyncio
async def test_async_ownership_strict_json_violation_raises_enriched_error():
    caller = LlmCaller("http://fake:8000", "qwen")

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _make_httpx_response({
                "requestId": "acr_strict",
                "traceRequestId": "gw-strict",
                "status": "accepted",
                "statusUrl": "/v1/async-chat-requests/acr_strict",
                "resultUrl": "/v1/async-chat-requests/acr_strict/result",
            }, status_code=202)
        raise AssertionError(f"unexpected POST url: {url}")

    async def fake_get(url, **kwargs):
        if url.endswith("/v1/async-chat-requests/acr_strict"):
            return _make_httpx_response({
                "requestId": "acr_strict",
                "state": "failed",
                "localAckState": "ack-break",
                "blockedReason": "strict_json_contract_violation",
                "errorDetail": "invalid json",
            })
        raise AssertionError(f"unexpected GET url: {url}")

    caller._client = MagicMock()
    caller._client.post = AsyncMock(side_effect=fake_post)
    caller._client.get = AsyncMock(side_effect=fake_get)

    with pytest.raises(StrictJsonContractError) as exc_info:
        await caller.call(
            [{"role": "user", "content": "hi"}],
            prefer_async_ownership=True,
        )

    assert exc_info.value.blocked_reason == "strict_json_contract_violation"
    assert exc_info.value.async_request_id == "acr_strict"
    assert exc_info.value.error_detail == "invalid json"


@pytest.mark.asyncio
async def test_async_ownership_falls_back_to_sync_when_endpoint_unavailable():
    caller = LlmCaller("http://fake:8000", "qwen")

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _make_httpx_response({"error": "not found"}, status_code=404)
        if url.endswith("/v1/chat"):
            return _make_httpx_response(_content_response('{"summary":"sync fallback"}'))
        raise AssertionError(f"unexpected POST url: {url}")

    caller._client = MagicMock()
    caller._client.post = AsyncMock(side_effect=fake_post)

    result = await caller.call(
        [{"role": "user", "content": "hi"}],
        prefer_async_ownership=True,
    )

    assert result.content == '{"summary":"sync fallback"}'
    assert caller._client.post.await_count == 2


@pytest.mark.asyncio
async def test_async_ownership_unsupported_surface_is_temporarily_cached():
    caller = LlmCaller("http://fake:8000", "qwen")

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _make_httpx_response({"error": "not found"}, status_code=404)
        if url.endswith("/v1/chat"):
            return _make_httpx_response(_content_response('{"summary":"sync fallback"}'))
        raise AssertionError(f"unexpected POST url: {url}")

    caller._client = MagicMock()
    caller._client.post = AsyncMock(side_effect=fake_post)

    await caller.call(
        [{"role": "user", "content": "hi"}],
        prefer_async_ownership=True,
    )
    await caller.call(
        [{"role": "user", "content": "hi again"}],
        prefer_async_ownership=True,
    )

    async_calls = [
        args.args[0] for args in caller._client.post.await_args_list
        if args.args and args.args[0].endswith("/v1/async-chat-requests")
    ]
    sync_calls = [
        args.args[0] for args in caller._client.post.await_args_list
        if args.args and args.args[0].endswith("/v1/chat")
    ]
    assert len(async_calls) == 1
    assert len(sync_calls) == 2


@pytest.mark.asyncio
async def test_tools_request_does_not_force_strict_json_header():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_httpx_response(_tool_calls_response([])))

    await caller.call(
        [{"role": "user", "content": "hi"}],
        tools=[{"type": "function", "function": {"name": "tool"}}],
    )

    call_args = caller._client.post.call_args
    headers = call_args.kwargs.get("headers") or call_args[1].get("headers")
    assert "X-AEGIS-Strict-JSON" not in headers


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


# ───────────────────────────────────────────────
# Adaptive Timeout
# ───────────────────────────────────────────────

class TestAdaptiveTimeout:
    def test_tool_call_turn_generous_timeout(self):
        """도구 호출 턴은 느슨한 타임아웃."""
        caller = LlmCaller("http://fake:8000", "qwen")
        messages = [{"role": "user", "content": "x" * 3000}]  # ~1500 토큰 (÷2)
        timeout = caller._estimate_timeout(messages, max_tokens=8192, has_tools=True)
        # 병렬 부하 반영: 7 tok/s, prefill 15s/1K → 더 큰 값, min 120s
        assert 120 <= timeout <= 600

    def test_large_prompt_tool_call_gets_more_time(self):
        """큰 프롬프트의 도구 호출은 prefill 반영으로 더 긴 타임아웃."""
        caller = LlmCaller("http://fake:8000", "qwen")
        messages = [{"role": "user", "content": "x" * 13000}]  # ~6500 토큰 (÷2)
        timeout = caller._estimate_timeout(messages, max_tokens=16384, has_tools=True)
        # 병렬 부하 반영: prefill ~97s + generation ~143s + overhead 60s → *2.0 ≈ 600s
        assert 400 <= timeout <= 900

    def test_final_report_long_timeout(self):
        """최종 보고서 턴은 긴 타임아웃 (max_tokens 전체 생성 기대)."""
        caller = LlmCaller("http://fake:8000", "qwen")
        messages = [{"role": "user", "content": "x" * 18000}]  # ~9000 토큰 (÷2)
        timeout = caller._estimate_timeout(messages, max_tokens=16384, has_tools=False)
        # 병렬 부하 반영: capped at 900s
        assert timeout == 900.0

    def test_small_request_gets_minimum(self):
        """작은 요청도 최소 120초는 보장된다."""
        caller = LlmCaller("http://fake:8000", "qwen")
        messages = [{"role": "user", "content": "hello"}]
        timeout = caller._estimate_timeout(messages, max_tokens=100, has_tools=True)
        assert timeout >= 120.0

    def test_empty_content_handled(self):
        """content가 None인 메시지도 안전하게 처리된다."""
        caller = LlmCaller("http://fake:8000", "qwen")
        messages = [{"role": "assistant", "content": None}, {"role": "user", "content": "hi"}]
        timeout = caller._estimate_timeout(messages, max_tokens=4096, has_tools=False)
        assert timeout >= 30.0
