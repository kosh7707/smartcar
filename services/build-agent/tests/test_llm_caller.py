"""Build Agent LlmCaller request-contract tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agent_runtime.llm.caller import LlmCaller


def _make_response(data: dict, status_code: int = 200):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.text = ""
    return resp


def _content_response(content: str = '{"summary":"ok"}') -> dict:
    return {
        "choices": [{
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1},
    }


@pytest.mark.asyncio
async def test_build_llm_caller_defaults_to_thinking_for_tool_turns():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_response(_content_response()))

    await caller.call(
        [{"role": "user", "content": "build"}],
        tools=[{"type": "function", "function": {"name": "try_build"}}],
    )

    body = caller._client.post.await_args.kwargs["json"]
    headers = caller._client.post.await_args.kwargs["headers"]
    assert body["chat_template_kwargs"] == {"enable_thinking": True}
    assert "response_format" not in body
    assert "X-AEGIS-Strict-JSON" not in headers


@pytest.mark.asyncio
async def test_build_llm_caller_defaults_to_thinking_for_strict_json_finalizer():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_response(_content_response()))

    await caller.call([{"role": "user", "content": "final"}])

    body = caller._client.post.await_args.kwargs["json"]
    headers = caller._client.post.await_args.kwargs["headers"]
    assert body["chat_template_kwargs"] == {"enable_thinking": True}
    assert body["response_format"] == {"type": "json_object"}
    assert headers["X-AEGIS-Strict-JSON"] == "true"
