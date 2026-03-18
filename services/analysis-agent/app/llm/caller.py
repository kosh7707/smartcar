"""LlmCaller — vLLM HTTP 호출 + tool_calls 파싱. 분기 판단은 하지 않음."""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING

import httpx

from app.context import get_request_id
from app.errors import LlmHttpError, LlmInputTooLargeError, LlmTimeoutError, LlmUnavailableError
from app.observability import agent_log, get_log_dir
from app.schemas.agent import LlmResponse, ToolCallRequest

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession

logger = logging.getLogger(__name__)
_exchange_logger = logging.getLogger("s4_exchange")


class LlmCaller:
    """vLLM OpenAI-compatible API 호출. tool_calls 파싱을 지원한다."""

    def __init__(
        self,
        endpoint: str,
        model: str,
        api_key: str = "",
        *,
        enable_thinking: bool = False,
        timeout: float = 120.0,
        default_max_tokens: int = 4096,
    ) -> None:
        self._endpoint = endpoint
        self._model = model
        self._api_key = api_key
        self._enable_thinking = enable_thinking
        self._default_max_tokens = default_max_tokens
        self._client = httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=4),
        )

    async def call(
        self,
        messages: list[dict],
        session: AgentSession | None = None,
        *,
        tools: list[dict] | None = None,
        tool_choice: str = "auto",
        max_tokens: int | None = None,
        temperature: float = 0.3,
    ) -> LlmResponse:
        """LLM에 messages를 보내고 LlmResponse를 반환한다."""
        if max_tokens is None:
            max_tokens = self._default_max_tokens

        body: dict = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "chat_template_kwargs": {"enable_thinking": self._enable_thinking},
        }

        if tools:
            body["tools"] = tools
            body["tool_choice"] = tool_choice
        else:
            body["response_format"] = {"type": "json_object"}

        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        request_id = get_request_id()
        if request_id:
            headers["X-Request-Id"] = request_id

        turn = (session.turn_count + 1) if session else None

        agent_log(
            logger, "LLM 호출",
            component="llm_caller", phase="llm_request",
            turn=turn, messageCount=len(messages),
            hasTools=bool(tools), toolCount=len(tools) if tools else 0,
        )

        url = f"{self._endpoint}/v1/chat/completions"
        start = time.monotonic()

        try:
            resp = await self._client.post(url, json=body, headers=headers)
        except httpx.TimeoutException:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            agent_log(
                logger, "LLM 에러",
                component="llm_caller", phase="llm_error",
                turn=turn, errorCode="LLM_TIMEOUT", retryable=True,
                latencyMs=elapsed_ms, level=logging.ERROR,
            )
            self._write_exchange_and_dump(
                request_id, turn, elapsed_ms, "error",
                error_code="LLM_TIMEOUT", body=body, data=None,
            )
            raise LlmTimeoutError()
        except httpx.ConnectError:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            agent_log(
                logger, "LLM 에러",
                component="llm_caller", phase="llm_error",
                turn=turn, errorCode="LLM_UNAVAILABLE", retryable=True,
                latencyMs=elapsed_ms, level=logging.ERROR,
            )
            self._write_exchange_and_dump(
                request_id, turn, elapsed_ms, "error",
                error_code="LLM_UNAVAILABLE", body=body, data=None,
            )
            raise LlmUnavailableError()

        elapsed_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code != 200:
            text = resp.text[:500]
            error_code = f"HTTP_{resp.status_code}"
            agent_log(
                logger, "LLM 에러",
                component="llm_caller", phase="llm_error",
                turn=turn, errorCode=error_code, retryable=False,
                latencyMs=elapsed_ms, level=logging.ERROR,
            )
            self._write_exchange_and_dump(
                request_id, turn, elapsed_ms, "error",
                error_code=error_code, body=body, data=None,
            )
            if resp.status_code == 400 and "too large" in text.lower():
                raise LlmInputTooLargeError(chars=0, limit=0)
            raise LlmHttpError(resp.status_code, text)

        try:
            data = resp.json()
        except Exception:
            self._write_exchange_and_dump(
                request_id, turn, elapsed_ms, "error",
                error_code="INVALID_JSON", body=body, data=None,
            )
            raise LlmHttpError(502, "Invalid JSON from LLM")

        # 파싱
        result = self._parse_response(data, turn)

        # 구조화된 로그
        tool_names = [tc.name for tc in result.tool_calls]
        agent_log(
            logger, "LLM 응답",
            component="llm_caller", phase="llm_response",
            turn=turn, finishReason=result.finish_reason,
            toolCallCount=len(result.tool_calls),
            promptTokens=result.prompt_tokens,
            completionTokens=result.completion_tokens,
            latencyMs=elapsed_ms,
        )

        # 교환 로그 + 전문 덤프
        self._write_exchange_and_dump(
            request_id, turn, elapsed_ms, "ok",
            finish_reason=result.finish_reason,
            tool_calls=tool_names or None,
            usage={"prompt": result.prompt_tokens, "completion": result.completion_tokens},
            body=body, data=data,
        )

        return result

    def _write_exchange_and_dump(
        self,
        request_id: str | None,
        turn: int | None,
        latency_ms: int,
        status: str,
        *,
        error_code: str | None = None,
        finish_reason: str | None = None,
        tool_calls: list[str] | None = None,
        usage: dict | None = None,
        body: dict | None = None,
        data: dict | None = None,
    ) -> None:
        """S4 교환 JSONL 요약 + LLM 호출별 전문 덤프 기록."""
        ts = int(time.time() * 1000)
        turn_str = f"{(turn or 0):02d}"
        rid = request_id or "unknown"
        dump_filename = f"{rid}_turn-{turn_str}_{ts}.json"
        dump_relative = f"logs/llm-dumps/{dump_filename}"

        # JSONL 요약
        entry: dict = {
            "time": ts,
            "requestId": request_id,
            "turn": turn,
            "type": "llm_call",
            "latencyMs": latency_ms,
            "status": status,
        }
        if finish_reason:
            entry["finishReason"] = finish_reason
        if tool_calls:
            entry["toolCalls"] = tool_calls
        if usage:
            entry["usage"] = usage
        if error_code:
            entry["errorCode"] = error_code
        entry["dumpFile"] = dump_relative

        _exchange_logger.info(json.dumps(entry, ensure_ascii=False))

        # 전문 덤프
        try:
            log_dir = get_log_dir()
            dump_path = log_dir / "llm-dumps" / dump_filename
            dump_path.parent.mkdir(parents=True, exist_ok=True)
            dump = {
                "meta": {
                    "requestId": request_id,
                    "turn": turn,
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "latencyMs": latency_ms,
                    "status": status,
                },
                "request": body,
                "response": data,
            }
            dump_path.write_text(json.dumps(dump, ensure_ascii=False, indent=2))
        except Exception:
            logger.debug("LLM dump 쓰기 실패: %s", dump_filename)

    def _parse_response(self, data: dict, turn: int | None = None) -> LlmResponse:
        """OpenAI-format 응답을 LlmResponse로 파싱한다."""
        try:
            choice = data["choices"][0]
            message = choice["message"]
            finish_reason = choice.get("finish_reason", "stop")
            usage = data.get("usage", {})
        except (KeyError, IndexError):
            raise LlmHttpError(502, "Malformed LLM response structure")

        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        # tool_calls 파싱
        raw_tool_calls = message.get("tool_calls") or []
        tool_calls = []
        for tc in raw_tool_calls:
            try:
                func = tc["function"]
                args_str = func.get("arguments", "{}")
                arguments = json.loads(args_str) if isinstance(args_str, str) else args_str
                tool_calls.append(ToolCallRequest(
                    id=tc.get("id", ""),
                    name=func["name"],
                    arguments=arguments,
                ))
            except (json.JSONDecodeError, KeyError) as e:
                agent_log(
                    logger, "tool_call 파싱 실패",
                    component="llm_caller", phase="tool_parse_fail",
                    turn=turn, rawToolCall=str(tc)[:200],
                    level=logging.WARNING,
                )
                continue

        content = message.get("content")

        return LlmResponse(
            content=content,
            tool_calls=tool_calls,
            finish_reason=finish_reason,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )

    async def aclose(self) -> None:
        await self._client.aclose()
