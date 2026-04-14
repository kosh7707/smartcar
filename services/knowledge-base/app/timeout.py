"""타임아웃 유틸리티 — X-Timeout-Ms 헤더 파싱 + 데드라인 체크."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import HTTPException

_T = TypeVar("_T")


def parse_timeout(x_timeout_ms: int | None) -> tuple[float, float]:
    """X-Timeout-Ms 헤더를 파싱하여 (deadline, timeout_sec)을 반환한다.

    Args:
        x_timeout_ms: 클라이언트가 지정한 타임아웃 (밀리초). 필수.

    Returns:
        (deadline, timeout_sec): deadline은 time.monotonic() 기준 절대 시각,
        timeout_sec은 원래 타임아웃 초 단위.

    Raises:
        HTTPException 400: 헤더 누락 또는 유효하지 않은 값.
    """
    if x_timeout_ms is None or x_timeout_ms <= 0:
        raise HTTPException(
            400,
            "X-Timeout-Ms header is required and must be a positive integer",
        )
    timeout_sec = x_timeout_ms / 1000.0
    deadline = time.monotonic() + timeout_sec
    return deadline, timeout_sec


def _raise_timeout(stage: str) -> None:
    raise HTTPException(
        408,
        f"Client timeout exceeded before completing stage: {stage}",
    )


def remaining_timeout(deadline: float, stage: str) -> float:
    """데드라인까지 남은 시간을 초 단위로 반환한다."""
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        _raise_timeout(stage)
    return remaining


def check_deadline(deadline: float, stage: str) -> None:
    """데드라인 초과 시 408 Timeout을 발생시킨다.

    자연스러운 체크포인트(Neo4j 완료 후, 벡터 적재 전 등)에서 호출한다.

    Args:
        deadline: time.monotonic() 기준 절대 데드라인.
        stage: 현재 처리 단계 (에러 메시지용).

    Raises:
        HTTPException 408: 데드라인 초과.
    """
    remaining_timeout(deadline, stage)


async def run_sync_with_deadline(
    deadline: float,
    stage: str,
    fn: Callable[..., _T],
    *args,
    **kwargs,
) -> _T:
    """동기 함수를 별도 스레드에서 실행하고 데드라인을 강제한다."""
    timeout = remaining_timeout(deadline, stage)
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(fn, *args, **kwargs),
            timeout=timeout,
        )
    except asyncio.TimeoutError as exc:
        _raise_timeout(stage)
        raise AssertionError("unreachable") from exc


async def run_async_with_deadline(
    deadline: float,
    stage: str,
    awaitable: Awaitable[_T],
) -> _T:
    """비동기 작업에 남은 데드라인을 강제한다."""
    timeout = remaining_timeout(deadline, stage)
    try:
        return await asyncio.wait_for(awaitable, timeout=timeout)
    except asyncio.TimeoutError as exc:
        _raise_timeout(stage)
        raise AssertionError("unreachable") from exc
