"""타임아웃 유틸리티 — X-Timeout-Ms 헤더 파싱 + 데드라인 체크."""

from __future__ import annotations

import time

from fastapi import HTTPException


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


def check_deadline(deadline: float, stage: str) -> None:
    """데드라인 초과 시 408 Timeout을 발생시킨다.

    자연스러운 체크포인트(Neo4j 완료 후, 벡터 적재 전 등)에서 호출한다.

    Args:
        deadline: time.monotonic() 기준 절대 데드라인.
        stage: 현재 처리 단계 (에러 메시지용).

    Raises:
        HTTPException 408: 데드라인 초과.
    """
    if time.monotonic() > deadline:
        raise HTTPException(
            408,
            f"Client timeout exceeded before completing stage: {stage}",
        )
