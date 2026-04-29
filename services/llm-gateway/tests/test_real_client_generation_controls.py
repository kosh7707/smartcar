"""RealLlmClient generation-control forwarding contract tests."""

from __future__ import annotations

import json
import logging
from unittest.mock import AsyncMock

import httpx
import pytest

from app.clients.real import RealLlmClient


class _ListLogHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    def emit(self, record):
        self.messages.append(record.getMessage())


def _capture_exchange_logs():
    logger = logging.getLogger("llm_exchange")
    handler = _ListLogHandler()
    logger.addHandler(handler)
    return logger, handler


def _release_exchange_logs(logger, handler):
    logger.removeHandler(handler)


def _ok_response() -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": "{\"ok\": true}"}}],
            "usage": {"prompt_tokens": 11, "completion_tokens": 7},
        },
        request=httpx.Request("POST", "http://llm.test/v1/chat/completions"),
    )


@pytest.mark.asyncio
async def test_real_client_forwards_full_generation_tuple():
    client = RealLlmClient(endpoint="http://llm.test", model="Qwen/Qwen3.6-27B")
    await client._client.aclose()
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=_ok_response())
    client._client = mock_client

    result = await client.generate(
        [{"role": "user", "content": "hello"}],
        max_tokens=4096,
        temperature=1.0,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
        presence_penalty=0.0,
        repetition_penalty=1.0,
        enable_thinking=True,
        task_type="static-explain",
    )

    assert result == '{"ok": true}'
    call_kwargs = mock_client.post.call_args.kwargs
    body = call_kwargs["json"]
    assert body["max_tokens"] == 4096
    assert body["temperature"] == 1.0
    assert body["top_p"] == 0.95
    assert body["top_k"] == 20
    assert body["min_p"] == 0.0
    assert body["presence_penalty"] == 0.0
    assert body["repetition_penalty"] == 1.0
    assert body["chat_template_kwargs"]["enable_thinking"] is True
    assert body["task_type"] == "static-explain"


@pytest.mark.asyncio
async def test_real_client_uses_per_request_enable_thinking_in_body_and_log():
    client = RealLlmClient(endpoint="http://llm.test", model="Qwen/Qwen3.6-27B")
    await client._client.aclose()
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=_ok_response())
    client._client = mock_client

    logger, handler = _capture_exchange_logs()
    try:
        await client.generate(
            [{"role": "user", "content": "hello"}],
            max_tokens=128,
            temperature=0.6,
            top_p=0.9,
            top_k=30,
            min_p=0.01,
            presence_penalty=0.2,
            repetition_penalty=1.1,
            enable_thinking=False,
            task_type="report-draft",
        )
    finally:
        _release_exchange_logs(logger, handler)

    body = mock_client.post.call_args.kwargs["json"]
    assert body["chat_template_kwargs"]["enable_thinking"] is False

    entries = [json.loads(m) for m in handler.messages]
    entry = next(e for e in entries if e.get("status") == "ok")
    assert entry["effectiveThinking"] is False
    assert entry["generation"] == {
        "maxTokens": 128,
        "temperature": 0.6,
        "topP": 0.9,
        "topK": 30,
        "minP": 0.01,
        "presencePenalty": 0.2,
        "repetitionPenalty": 1.1,
        "enableThinking": False,
        "taskType": "report-draft",
    }
