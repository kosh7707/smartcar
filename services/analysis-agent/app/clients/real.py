from __future__ import annotations

import asyncio
import json
import logging
import time

import httpx

from agent_shared.context import get_request_id
from agent_shared.errors import LlmHttpError, LlmInputTooLargeError, LlmTimeoutError, LlmUnavailableError
from app.clients.base import LlmClient

logger = logging.getLogger(__name__)
_exchange = logging.getLogger("llm_exchange")


class RealLlmClient(LlmClient):
    """S7 Gateway 경유 LLM 클라이언트.

    인스턴스 레벨에서 httpx.AsyncClient를 유지하여
    connection pooling + keep-alive를 활용한다.
    """

    def __init__(
        self,
        endpoint: str,
        model: str,
        api_key: str = "",
        *,
        enable_thinking: bool = False,
        json_mode: bool = True,
    ):
        self.endpoint = endpoint.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.enable_thinking = enable_thinking
        self.json_mode = json_mode
        self.last_prompt_tokens: int = 0
        self.last_completion_tokens: int = 0
        self._async_surface_retry_at = 0.0
        self._client = httpx.AsyncClient(
            timeout=120.0,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=4),
        )
        self._async_submit_timeout = 30.0
        self._async_poll_interval = 1.0
        self._async_unsupported_retry_seconds = 60.0

    async def generate(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> str:
        request_id = get_request_id()

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if request_id:
            headers["X-Request-Id"] = request_id

        body: dict = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "chat_template_kwargs": {
                "enable_thinking": self.enable_thinking,
            },
        }
        if self.json_mode:
            body["response_format"] = {"type": "json_object"}
            headers["X-AEGIS-Strict-JSON"] = "true"

        async_result = await self._generate_via_async_ownership(body, headers)
        if async_result is not None:
            return async_result

        logger.info(
            "[S4 호출 시작] requestId=%s, model=%s, maxTokens=%d",
            request_id, self.model, max_tokens,
        )
        start = time.time()

        try:
            resp = await self._client.post(
                f"{self.endpoint}/v1/chat",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            usage = data.get("usage", {})
            self.last_prompt_tokens = usage.get("prompt_tokens", 0)
            self.last_completion_tokens = usage.get("completion_tokens", 0)

            latency_ms = int((time.time() - start) * 1000)
            logger.info(
                "[S4 호출 완료] requestId=%s, latencyMs=%d, promptTokens=%d, completionTokens=%d",
                request_id, latency_ms,
                self.last_prompt_tokens, self.last_completion_tokens,
            )
            _exchange.info(json.dumps({
                "time": int(time.time() * 1000),
                "requestId": request_id,
                "latencyMs": latency_ms,
                "status": "ok",
                "request": body,
                "response": data,
            }, ensure_ascii=False))

            return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException as e:
            latency_ms = int((time.time() - start) * 1000)
            logger.error(
                "[S4 호출 실패] requestId=%s, error=TIMEOUT, latencyMs=%d",
                request_id, latency_ms,
            )
            _exchange.info(json.dumps({
                "time": int(time.time() * 1000),
                "requestId": request_id,
                "latencyMs": latency_ms,
                "status": "error",
                "error": "TIMEOUT",
                "request": body,
                "response": None,
            }, ensure_ascii=False))
            raise LlmTimeoutError() from e
        except httpx.ConnectError as e:
            latency_ms = int((time.time() - start) * 1000)
            logger.error(
                "[S4 호출 실패] requestId=%s, error=UNAVAILABLE, latencyMs=%d",
                request_id, latency_ms,
            )
            _exchange.info(json.dumps({
                "time": int(time.time() * 1000),
                "requestId": request_id,
                "latencyMs": latency_ms,
                "status": "error",
                "error": "UNAVAILABLE",
                "request": body,
                "response": None,
            }, ensure_ascii=False))
            raise LlmUnavailableError() from e
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start) * 1000)
            status = e.response.status_code
            resp_text = e.response.text[:2000] if e.response.text else ""
            logger.error(
                "[S4 호출 실패] requestId=%s, error=HTTP_%d, latencyMs=%d, body=%s",
                request_id, status, latency_ms, resp_text[:200],
            )
            _exchange.info(json.dumps({
                "time": int(time.time() * 1000),
                "requestId": request_id,
                "latencyMs": latency_ms,
                "status": "error",
                "error": f"HTTP_{status}",
                "request": body,
                "response": resp_text,
            }, ensure_ascii=False))
            # S4가 400으로 입력 한도 초과를 알려줌
            if status == 400:
                prompt_chars = sum(len(m.get("content", "")) for m in messages)
                raise LlmInputTooLargeError(prompt_chars, 0) from e
            raise LlmHttpError(status) from e
        except (KeyError, IndexError) as e:
            latency_ms = int((time.time() - start) * 1000)
            logger.error(
                "[S4 호출 실패] requestId=%s, error=RESPONSE_MISMATCH, latencyMs=%d",
                request_id, latency_ms,
            )
            raise LlmHttpError(
                502, "LLM 응답 구조가 예상과 다릅니다"
            ) from e

    async def _generate_via_async_ownership(self, body: dict, headers: dict[str, str]) -> str | None:
        request_id = get_request_id()
        if time.monotonic() < self._async_surface_retry_at:
            logger.debug("[S7 async ownership cooldown] requestId=%s", request_id)
            return None
        submit_url = f"{self.endpoint}/v1/async-chat-requests"
        submit_headers = dict(headers)

        try:
            submit_resp = await self._client.post(
                submit_url,
                headers=submit_headers,
                json=body,
                timeout=httpx.Timeout(
                    connect=10.0,
                    read=self._async_submit_timeout,
                    write=10.0,
                    pool=10.0,
                ),
            )
        except httpx.TimeoutException as e:
            raise LlmTimeoutError("LLM async submit 시간 초과") from e
        except httpx.ConnectError as e:
            raise LlmUnavailableError() from e

        if submit_resp.status_code in (404, 405, 501):
            self._async_surface_retry_at = time.monotonic() + self._async_unsupported_retry_seconds
            logger.warning("[S7 async ownership 폴백] status=%s", submit_resp.status_code)
            return None

        if submit_resp.status_code not in (200, 202):
            text = submit_resp.text[:2000] if submit_resp.text else ""
            raise LlmHttpError(submit_resp.status_code, text)

        try:
            submit_data = submit_resp.json()
        except Exception as e:
            raise LlmHttpError(502, "LLM async submit 응답 구조가 예상과 다릅니다") from e

        async_request_id = submit_data.get("requestId")
        if not async_request_id:
            raise LlmHttpError(502, "LLM async submit 응답에 requestId가 없습니다")

        status_url = self._resolve_async_url(
            submit_data.get("statusUrl"),
            f"/v1/async-chat-requests/{async_request_id}",
        )
        result_url = self._resolve_async_url(
            submit_data.get("resultUrl"),
            f"/v1/async-chat-requests/{async_request_id}/result",
        )

        poll_headers = {k: v for k, v in submit_headers.items() if k != "Content-Type"}
        start = time.time()

        while True:
            status_data = await self._get_async_json(status_url, poll_headers)
            state = status_data.get("state")
            local_ack_state = status_data.get("localAckState")
            blocked_reason = status_data.get("blockedReason")
            result_ready = bool(status_data.get("resultReady"))

            logger.info(
                "[S7 async ownership 상태] requestId=%s asyncRequestId=%s state=%s localAckState=%s",
                request_id, async_request_id, state, local_ack_state,
            )

            if blocked_reason or local_ack_state == "ack-break":
                raise LlmHttpError(409, blocked_reason or "Async chat request reached ack-break")

            if state in {"queued", "running"} and not result_ready:
                await asyncio.sleep(self._async_poll_interval)
                continue

            if state == "completed" or result_ready:
                result_resp = await self._client.get(
                    result_url,
                    headers=poll_headers,
                    timeout=httpx.Timeout(
                        connect=10.0,
                        read=self._async_submit_timeout,
                        write=10.0,
                        pool=10.0,
                    ),
                )
                if result_resp.status_code == 409:
                    await asyncio.sleep(self._async_poll_interval)
                    continue
                if result_resp.status_code == 410:
                    raise LlmHttpError(410, result_resp.text[:2000] or "Async result expired")
                if result_resp.status_code != 200:
                    raise LlmHttpError(result_resp.status_code, result_resp.text[:2000])

                try:
                    result_data = result_resp.json()
                except Exception as e:
                    raise LlmHttpError(502, "LLM async result 응답 구조가 예상과 다릅니다") from e

                wrapped = result_data.get("response")
                if not isinstance(wrapped, dict):
                    raise LlmHttpError(502, "LLM async result 응답에 response가 없습니다")

                usage = wrapped.get("usage", {})
                self.last_prompt_tokens = usage.get("prompt_tokens", 0)
                self.last_completion_tokens = usage.get("completion_tokens", 0)

                latency_ms = int((time.time() - start) * 1000)
                logger.info(
                    "[S7 async ownership 완료] requestId=%s asyncRequestId=%s latencyMs=%d",
                    request_id, async_request_id, latency_ms,
                )
                _exchange.info(json.dumps({
                    "time": int(time.time() * 1000),
                    "requestId": request_id,
                    "asyncRequestId": async_request_id,
                    "latencyMs": latency_ms,
                    "status": "ok",
                    "request": body,
                    "response": result_data,
                }, ensure_ascii=False))
                return wrapped["choices"][0]["message"]["content"]

            if state in {"failed", "cancelled", "expired"}:
                raise LlmHttpError(409, blocked_reason or f"Async chat request ended with state={state}")

            raise LlmHttpError(502, f"알 수 없는 async chat 상태: {state}")

    async def _get_async_json(self, url: str, headers: dict[str, str]) -> dict:
        try:
            resp = await self._client.get(
                url,
                headers=headers,
                timeout=httpx.Timeout(
                    connect=10.0,
                    read=self._async_submit_timeout,
                    write=10.0,
                    pool=10.0,
                ),
            )
        except httpx.TimeoutException as e:
            raise LlmTimeoutError("LLM async 상태 조회 시간 초과") from e
        except httpx.ConnectError as e:
            raise LlmUnavailableError() from e

        if resp.status_code != 200:
            raise LlmHttpError(resp.status_code, resp.text[:2000])
        try:
            return resp.json()
        except Exception as e:
            raise LlmHttpError(502, "LLM async status 응답 구조가 예상과 다릅니다") from e

    def _resolve_async_url(self, value: str | None, fallback_path: str) -> str:
        if isinstance(value, str) and value:
            if value.startswith("http://") or value.startswith("https://"):
                return value
            if value.startswith("/"):
                return f"{self.endpoint}{value}"
        return f"{self.endpoint}{fallback_path}"

    async def aclose(self) -> None:
        """httpx 클라이언트를 종료한다."""
        await self._client.aclose()
