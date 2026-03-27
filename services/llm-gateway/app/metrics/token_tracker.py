"""누적 토큰/요청 통계 추적기."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from app.metrics import prom


class TokenTracker:
    """프로세스 수명 동안 LLM 사용량을 누적 추적한다.

    record() 호출 시 내부 카운터와 Prometheus 메트릭을 동시에 갱신한다.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._prompt_tokens = 0
        self._completion_tokens = 0
        self._request_count = 0
        self._error_count = 0
        self._by_endpoint: dict[str, dict] = defaultdict(
            lambda: {"prompt": 0, "completion": 0, "count": 0, "errors": 0},
        )
        self._by_task_type: dict[str, dict] = defaultdict(
            lambda: {"prompt": 0, "completion": 0, "count": 0},
        )
        self._started_at = datetime.now(timezone.utc).isoformat()

    async def record(
        self,
        *,
        endpoint: str,
        task_type: str | None = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        success: bool = True,
        duration_s: float = 0.0,
        error_type: str | None = None,
    ) -> None:
        async with self._lock:
            self._prompt_tokens += prompt_tokens
            self._completion_tokens += completion_tokens
            self._request_count += 1

            ep = self._by_endpoint[endpoint]
            ep["prompt"] += prompt_tokens
            ep["completion"] += completion_tokens
            ep["count"] += 1

            if task_type:
                tt = self._by_task_type[task_type]
                tt["prompt"] += prompt_tokens
                tt["completion"] += completion_tokens
                tt["count"] += 1

            if not success:
                self._error_count += 1
                ep["errors"] += 1

        # Prometheus 메트릭 갱신
        status = "ok" if success else "error"
        prom.REQUEST_COUNT.labels(endpoint=endpoint, status=status).inc()
        prom.TOKEN_COUNT.labels(type="prompt").inc(prompt_tokens)
        prom.TOKEN_COUNT.labels(type="completion").inc(completion_tokens)
        if duration_s > 0:
            prom.REQUEST_DURATION.labels(endpoint=endpoint).observe(duration_s)
        if not success and error_type:
            prom.ERROR_COUNT.labels(endpoint=endpoint, error_type=error_type).inc()

    async def snapshot(self) -> dict:
        async with self._lock:
            return {
                "startedAt": self._started_at,
                "totalRequests": self._request_count,
                "totalErrors": self._error_count,
                "tokens": {
                    "prompt": self._prompt_tokens,
                    "completion": self._completion_tokens,
                    "total": self._prompt_tokens + self._completion_tokens,
                },
                "byEndpoint": dict(self._by_endpoint),
                "byTaskType": dict(self._by_task_type),
            }
