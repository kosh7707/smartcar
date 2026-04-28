from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from eval.eval_runner import _call_llm


def _response(data: dict, status_code: int = 200):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.text = ""
    resp.raise_for_status = MagicMock()
    return resp


@pytest.mark.asyncio
async def test_eval_runner_prefers_async_ownership_when_available():
    client = MagicMock()

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _response({
                "requestId": "acr_001",
                "status": "accepted",
                "statusUrl": "/v1/async-chat-requests/acr_001",
                "resultUrl": "/v1/async-chat-requests/acr_001/result",
            }, status_code=202)
        raise AssertionError(f"unexpected POST url: {url}")

    async def fake_get(url, **kwargs):
        if url.endswith("/v1/async-chat-requests/acr_001"):
            return _response({
                "requestId": "acr_001",
                "state": "completed",
                "resultReady": True,
                "localAckState": None,
            })
        if url.endswith("/v1/async-chat-requests/acr_001/result"):
            return _response({
                "requestId": "acr_001",
                "state": "completed",
                "response": {
                    "choices": [{"message": {"content": '{"summary":"async ok"}'}}],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 2},
                },
            })
        raise AssertionError(f"unexpected GET url: {url}")

    client.post = AsyncMock(side_effect=fake_post)
    client.get = AsyncMock(side_effect=fake_get)

    result = await _call_llm(
        client,
        "http://localhost:8000",
        "system",
        "user",
        "test-model",
    )

    assert result["choices"][0]["message"]["content"] == '{"summary":"async ok"}'
    submit_args = client.post.await_args_list[0]
    assert submit_args.kwargs["json"]["chat_template_kwargs"] == {"enable_thinking": True}
    assert submit_args.kwargs["headers"]["X-AEGIS-Strict-JSON"] == "true"


@pytest.mark.asyncio
async def test_eval_runner_falls_back_to_sync_chat_when_async_unavailable():
    client = MagicMock()

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _response({"error": "not found"}, status_code=404)
        if url.endswith("/v1/chat"):
            return _response({
                "choices": [{"message": {"content": '{"summary":"sync ok"}'}}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2},
            })
        raise AssertionError(f"unexpected POST url: {url}")

    client.post = AsyncMock(side_effect=fake_post)
    client.get = AsyncMock()

    result = await _call_llm(
        client,
        "http://localhost:8000",
        "system",
        "user",
        "test-model",
    )

    assert result["choices"][0]["message"]["content"] == '{"summary":"sync ok"}'
    assert client.post.await_count == 2
    sync_args = client.post.await_args_list[1]
    assert sync_args.kwargs["json"]["chat_template_kwargs"] == {"enable_thinking": True}
    assert sync_args.kwargs["headers"]["X-AEGIS-Strict-JSON"] == "true"


@pytest.mark.asyncio
async def test_eval_runner_caches_unsupported_async_surface_temporarily():
    client = MagicMock()

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _response({"error": "not found"}, status_code=404)
        if url.endswith("/v1/chat"):
            return _response({
                "choices": [{"message": {"content": '{"summary":"sync ok"}'}}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2},
            })
        raise AssertionError(f"unexpected POST url: {url}")

    client.post = AsyncMock(side_effect=fake_post)
    client.get = AsyncMock()

    first = await _call_llm(
        client,
        "http://localhost:8000",
        "system",
        "user",
        "test-model",
    )
    second = await _call_llm(
        client,
        "http://localhost:8000",
        "system",
        "user 2",
        "test-model",
    )

    async_calls = [
        args.args[0] for args in client.post.await_args_list
        if args.args and args.args[0].endswith("/v1/async-chat-requests")
    ]
    sync_calls = [
        args.args[0] for args in client.post.await_args_list
        if args.args and args.args[0].endswith("/v1/chat")
    ]

    assert first["choices"][0]["message"]["content"] == '{"summary":"sync ok"}'
    assert second["choices"][0]["message"]["content"] == '{"summary":"sync ok"}'
    assert len(async_calls) == 1
    assert len(sync_calls) == 2
