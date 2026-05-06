"""Build Agent LlmCaller request-contract tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agent_runtime.llm.caller import LlmCaller
from app.agent_runtime.llm.generation_policy import THINKING_CODING


def _make_response(data: dict, status_code: int = 200):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.text = ""
    return resp



def _assert_complete_generation_tuple(body: dict, *, temperature: float = 1.0, enable_thinking: bool = True) -> None:
    assert body["temperature"] == temperature
    assert body["top_p"] == 0.95
    assert body["top_k"] == 20
    assert body["min_p"] == 0.0
    assert body["presence_penalty"] == 0.0
    assert body["repetition_penalty"] == 1.0
    assert body["chat_template_kwargs"] == {"enable_thinking": enable_thinking}


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
    _assert_complete_generation_tuple(body)
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
    _assert_complete_generation_tuple(body)
    assert body["response_format"] == {"type": "json_object"}
    assert headers["X-AEGIS-Strict-JSON"] == "true"


@pytest.mark.asyncio
async def test_build_llm_caller_scalar_temperature_compatibility_warns():
    caller = LlmCaller("http://fake:8000", "qwen")
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_response(_content_response()))

    with pytest.warns(DeprecationWarning, match="GenerationControls"):
        await caller.call([{ "role": "user", "content": "build" }], temperature=0.25)

    body = caller._client.post.await_args.kwargs["json"]
    assert body["temperature"] == 0.25


@pytest.mark.asyncio
async def test_build_llm_caller_accepts_explicit_generation_controls():
    caller = LlmCaller("http://fake:8000", "qwen", enable_thinking=False)
    caller._client = MagicMock()
    caller._client.post = AsyncMock(return_value=_make_response(_content_response()))

    await caller.call(
        [{"role": "user", "content": "build"}],
        generation=THINKING_CODING,
        max_tokens=1234,
    )

    body = caller._client.post.await_args.kwargs["json"]
    assert body["max_tokens"] == 1234
    assert body["temperature"] == 0.6
    assert body["top_p"] == 0.95
    assert body["top_k"] == 20
    assert body["chat_template_kwargs"] == {"enable_thinking": True}
