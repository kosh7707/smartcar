from __future__ import annotations

import asyncio
import logging
import time
from enum import StrEnum

from app.config import settings
from app.errors import LlmCircuitOpenError
from app.metrics.prom import CIRCUIT_BREAKER_STATE

_STATE_GAUGE = {"closed": 0, "half_open": 0.5, "open": 1}

logger = logging.getLogger(__name__)


class _State(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """LLM Engine 장애 시 빠른 실패 + 자동 복구 감지.

    CLOSED  → 연속 threshold회 실패 → OPEN
    OPEN    → recovery_seconds 경과 → HALF_OPEN (탐침 1회 허용)
    HALF_OPEN → 성공 → CLOSED / 실패 → OPEN
    """

    def __init__(
        self,
        threshold: int | None = None,
        recovery_seconds: float | None = None,
    ):
        self._threshold = threshold or settings.circuit_breaker_threshold
        self._recovery_seconds = recovery_seconds or settings.circuit_breaker_recovery_seconds
        self._state = _State.CLOSED
        self._consecutive_failures = 0
        self._opened_at: float = 0.0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> str:
        if self._state == _State.OPEN and self._recovery_elapsed():
            return _State.HALF_OPEN
        return self._state

    @property
    def consecutive_failures(self) -> int:
        return self._consecutive_failures

    def _recovery_elapsed(self) -> bool:
        return time.monotonic() - self._opened_at >= self._recovery_seconds

    async def check(self) -> None:
        """호출 전 상태 확인. OPEN이면 LlmCircuitOpenError를 발생시킨다."""
        async with self._lock:
            if self._state == _State.CLOSED:
                return
            if self._state == _State.OPEN:
                if self._recovery_elapsed():
                    self._state = _State.HALF_OPEN
                    CIRCUIT_BREAKER_STATE.set(_STATE_GAUGE["half_open"])
                    logger.info(
                        "[CircuitBreaker] OPEN → HALF_OPEN (탐침 허용, %.0f초 경과)",
                        time.monotonic() - self._opened_at,
                    )
                    return
                raise LlmCircuitOpenError()
            # HALF_OPEN: 탐침 1회 허용
            return

    async def record_success(self) -> None:
        async with self._lock:
            if self._state == _State.HALF_OPEN:
                logger.info("[CircuitBreaker] HALF_OPEN → CLOSED (복구 확인)")
            self._state = _State.CLOSED
            self._consecutive_failures = 0
            CIRCUIT_BREAKER_STATE.set(_STATE_GAUGE["closed"])

    async def record_failure(self) -> None:
        async with self._lock:
            self._consecutive_failures += 1
            if self._state == _State.HALF_OPEN:
                self._state = _State.OPEN
                self._opened_at = time.monotonic()
                CIRCUIT_BREAKER_STATE.set(_STATE_GAUGE["open"])
                logger.warning(
                    "[CircuitBreaker] HALF_OPEN → OPEN (탐침 실패, %d회 연속)",
                    self._consecutive_failures,
                )
            elif self._consecutive_failures >= self._threshold:
                self._state = _State.OPEN
                self._opened_at = time.monotonic()
                CIRCUIT_BREAKER_STATE.set(_STATE_GAUGE["open"])
                logger.warning(
                    "[CircuitBreaker] CLOSED → OPEN (%d회 연속 실패)",
                    self._consecutive_failures,
                )

    def snapshot(self) -> dict:
        return {
            "state": self.state,
            "consecutiveFailures": self._consecutive_failures,
            "threshold": self._threshold,
            "recoverySeconds": self._recovery_seconds,
        }
