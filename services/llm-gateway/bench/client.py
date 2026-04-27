from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx

from bench.models import BenchTask, RequestPath


@dataclass
class ChatResult:
    response: dict[str, Any] | None
    latency_ms: int
    error_type: str | None = None
    error: str | None = None
    status_code: int | None = None


class BenchmarkClient:
    def __init__(self, base_url: str, request_path: RequestPath = "direct", timeout_s: float = 1800.0):
        self.base_url = base_url.rstrip("/")
        self.request_path = request_path
        self.timeout_s = timeout_s
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=timeout_s, write=10.0, pool=10.0))

    async def aclose(self) -> None:
        await self._client.aclose()

    async def model_metadata(self) -> dict[str, Any]:
        path = "/v1/models"
        start = time.monotonic()
        try:
            resp = await self._client.get(f"{self.base_url}{path}", timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            return {"status": "unreachable", "error": str(exc), "latencyMs": int((time.monotonic() - start) * 1000)}
        return {"status": "ok", "response": data, "latencyMs": int((time.monotonic() - start) * 1000), "servedModel": extract_served_model(data), "maxModelLen": extract_max_model_len(data)}

    async def server_metadata(self) -> dict[str, Any]:
        metadata: dict[str, Any] = {}
        version_start = time.monotonic()
        try:
            resp = await self._client.get(f"{self.base_url}/version", timeout=5.0)
            if resp.status_code < 400:
                data = resp.json()
                metadata["version"] = data.get("version") if isinstance(data, dict) else data
                metadata["versionStatus"] = "ok"
            else:
                metadata["versionStatus"] = f"HTTP_{resp.status_code}"
        except Exception as exc:
            metadata["versionStatus"] = "unreachable"
            metadata["versionError"] = str(exc)
        metadata["versionLatencyMs"] = int((time.monotonic() - version_start) * 1000)

        health_start = time.monotonic()
        try:
            resp = await self._client.get(f"{self.base_url}/health", timeout=5.0)
            metadata["healthStatusCode"] = resp.status_code
            metadata["healthOk"] = resp.status_code < 400
        except Exception as exc:
            metadata["healthOk"] = False
            metadata["healthError"] = str(exc)
        metadata["healthLatencyMs"] = int((time.monotonic() - health_start) * 1000)
        return metadata

    async def chat(self, task: BenchTask, model: str, request_id: str) -> ChatResult:
        body: dict[str, Any] = {
            "model": model,
            "messages": task.messages,
            "max_tokens": task.max_tokens,
            "temperature": task.temperature,
        }
        if task.top_p is not None:
            body["top_p"] = task.top_p
        if task.top_k is not None:
            body["top_k"] = task.top_k
        if task.tools:
            body["tools"] = task.tools
        if task.tool_choice is not None:
            body["tool_choice"] = task.tool_choice
        if task.response_format is not None:
            body["response_format"] = task.response_format
        if task.enable_thinking is not None:
            body["chat_template_kwargs"] = {"enable_thinking": task.enable_thinking}

        url = f"{self.base_url}/v1/chat/completions" if self.request_path == "direct" else f"{self.base_url}/v1/chat"
        headers = {"Content-Type": "application/json", "X-Request-Id": request_id}
        if self.request_path == "gateway" and task.mode == "strict-format":
            headers["X-AEGIS-Strict-JSON"] = "true"

        start = time.monotonic()
        try:
            resp = await self._client.post(url, json=body, headers=headers)
            latency_ms = int((time.monotonic() - start) * 1000)
            if resp.status_code >= 400:
                return ChatResult(None, latency_ms, error_type=f"HTTP_{resp.status_code}", error=resp.text[:1000], status_code=resp.status_code)
            return ChatResult(resp.json(), latency_ms, status_code=resp.status_code)
        except httpx.TimeoutException as exc:
            return ChatResult(None, int((time.monotonic() - start) * 1000), error_type="TIMEOUT", error=str(exc))
        except httpx.ConnectError as exc:
            return ChatResult(None, int((time.monotonic() - start) * 1000), error_type="CONNECT", error=str(exc))
        except Exception as exc:
            return ChatResult(None, int((time.monotonic() - start) * 1000), error_type=type(exc).__name__, error=str(exc))


def extract_served_model(models_response: dict[str, Any]) -> str | None:
    data = models_response.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0].get("id") or data[0].get("modelName")
    profiles = models_response.get("profiles")
    if isinstance(profiles, list) and profiles and isinstance(profiles[0], dict):
        return profiles[0].get("modelName") or profiles[0].get("profileId")
    return None


def extract_max_model_len(models_response: dict[str, Any]) -> int | None:
    data = models_response.get("data")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        value = data[0].get("max_model_len")
        return int(value) if value is not None else None
    return None
