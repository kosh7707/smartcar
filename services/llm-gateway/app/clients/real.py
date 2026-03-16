from __future__ import annotations

import logging
import time

import httpx

from app.context import get_request_id
from app.errors import LlmHttpError, LlmInputTooLargeError, LlmTimeoutError, LlmUnavailableError
from app.clients.base import LlmClient

logger = logging.getLogger(__name__)


class RealLlmClient(LlmClient):
    """OpenAI-compatible LLM 클라이언트 (vLLM 대상).

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
        self._client = httpx.AsyncClient(
            timeout=120.0,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=4),
        )

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

        logger.info(
            "[S4 호출 시작] requestId=%s, model=%s, maxTokens=%d",
            request_id, self.model, max_tokens,
        )
        start = time.time()

        try:
            resp = await self._client.post(
                f"{self.endpoint}/v1/chat/completions",
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

            return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException as e:
            latency_ms = int((time.time() - start) * 1000)
            logger.error(
                "[S4 호출 실패] requestId=%s, error=TIMEOUT, latencyMs=%d",
                request_id, latency_ms,
            )
            raise LlmTimeoutError() from e
        except httpx.ConnectError as e:
            latency_ms = int((time.time() - start) * 1000)
            logger.error(
                "[S4 호출 실패] requestId=%s, error=UNAVAILABLE, latencyMs=%d",
                request_id, latency_ms,
            )
            raise LlmUnavailableError() from e
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.time() - start) * 1000)
            status = e.response.status_code
            logger.error(
                "[S4 호출 실패] requestId=%s, error=HTTP_%d, latencyMs=%d, body=%s",
                request_id, status, latency_ms,
                e.response.text[:200] if e.response.text else "",
            )
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

    async def aclose(self) -> None:
        """httpx 클라이언트를 종료한다."""
        await self._client.aclose()
