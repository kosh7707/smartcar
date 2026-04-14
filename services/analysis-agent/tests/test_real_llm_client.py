from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.clients.real import RealLlmClient
from agent_shared.errors import LlmHttpError


def _response(data: dict, status_code: int = 200):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.text = ""
    resp.raise_for_status = MagicMock()
    return resp


@pytest.mark.asyncio
async def test_generate_uses_async_ownership_when_available():
    client = RealLlmClient("http://fake:8000", "test-model")

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
                    "choices": [{
                        "message": {"content": '{"summary":"async ok"}'},
                    }],
                    "usage": {"prompt_tokens": 11, "completion_tokens": 7},
                },
            })
        raise AssertionError(f"unexpected GET url: {url}")

    client._client = MagicMock()
    client._client.post = AsyncMock(side_effect=fake_post)
    client._client.get = AsyncMock(side_effect=fake_get)

    content = await client.generate([{"role": "user", "content": "hi"}], max_tokens=10)

    assert content == '{"summary":"async ok"}'
    assert client.last_prompt_tokens == 11
    assert client.last_completion_tokens == 7


@pytest.mark.asyncio
async def test_generate_falls_back_to_sync_when_async_surface_missing():
    client = RealLlmClient("http://fake:8000", "test-model")

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _response({"error": "not found"}, status_code=404)
        if url.endswith("/v1/chat"):
            return _response({
                "choices": [{
                    "message": {"content": '{"summary":"sync ok"}'},
                }],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2},
            })
        raise AssertionError(f"unexpected POST url: {url}")

    client._client = MagicMock()
    client._client.post = AsyncMock(side_effect=fake_post)

    content = await client.generate([{"role": "user", "content": "hi"}], max_tokens=10)

    assert content == '{"summary":"sync ok"}'
    assert client._client.post.await_count == 2


@pytest.mark.asyncio
async def test_generate_caches_unsupported_async_surface_temporarily():
    client = RealLlmClient("http://fake:8000", "test-model")

    async def fake_post(url, **kwargs):
        if url.endswith("/v1/async-chat-requests"):
            return _response({"error": "not found"}, status_code=404)
        if url.endswith("/v1/chat"):
            return _response({
                "choices": [{
                    "message": {"content": '{"summary":"sync ok"}'},
                }],
                "usage": {"prompt_tokens": 3, "completion_tokens": 2},
            })
        raise AssertionError(f"unexpected POST url: {url}")

    client._client = MagicMock()
    client._client.post = AsyncMock(side_effect=fake_post)

    await client.generate([{"role": "user", "content": "hi"}], max_tokens=10)
    await client.generate([{"role": "user", "content": "hi again"}], max_tokens=10)

    async_calls = [
        args.args[0] for args in client._client.post.await_args_list
        if args.args and args.args[0].endswith("/v1/async-chat-requests")
    ]
    sync_calls = [
        args.args[0] for args in client._client.post.await_args_list
        if args.args and args.args[0].endswith("/v1/chat")
    ]
    assert len(async_calls) == 1
    assert len(sync_calls) == 2


@pytest.mark.asyncio
async def test_generate_async_failure_raises_http_error():
    client = RealLlmClient("http://fake:8000", "test-model")

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
                "state": "failed",
                "localAckState": "ack-break",
                "blockedReason": "MODEL_UNAVAILABLE",
            })
        raise AssertionError(f"unexpected GET url: {url}")

    client._client = MagicMock()
    client._client.post = AsyncMock(side_effect=fake_post)
    client._client.get = AsyncMock(side_effect=fake_get)

    with pytest.raises(LlmHttpError) as exc_info:
        await client.generate([{"role": "user", "content": "hi"}], max_tokens=10)

    assert exc_info.value.upstream_status == 409
