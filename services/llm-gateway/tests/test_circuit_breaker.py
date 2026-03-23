"""Circuit Breaker 단위 테스트."""
import asyncio
import time

import pytest

from app.circuit_breaker import CircuitBreaker
from app.errors import LlmCircuitOpenError


@pytest.fixture()
def cb():
    return CircuitBreaker(threshold=3, recovery_seconds=0.2)


@pytest.mark.asyncio
async def test_initial_state_is_closed(cb):
    assert cb.state == "closed"
    assert cb.consecutive_failures == 0


@pytest.mark.asyncio
async def test_check_passes_when_closed(cb):
    await cb.check()  # should not raise


@pytest.mark.asyncio
async def test_opens_after_threshold_failures(cb):
    for _ in range(3):
        await cb.record_failure()
    assert cb.state == "open"
    with pytest.raises(LlmCircuitOpenError):
        await cb.check()


@pytest.mark.asyncio
async def test_stays_closed_below_threshold(cb):
    await cb.record_failure()
    await cb.record_failure()
    assert cb.state == "closed"
    await cb.check()  # should not raise


@pytest.mark.asyncio
async def test_success_resets_failure_count(cb):
    await cb.record_failure()
    await cb.record_failure()
    await cb.record_success()
    assert cb.consecutive_failures == 0
    assert cb.state == "closed"


@pytest.mark.asyncio
async def test_transitions_to_half_open_after_recovery(cb):
    for _ in range(3):
        await cb.record_failure()
    assert cb.state == "open"
    await asyncio.sleep(0.25)
    assert cb.state == "half_open"
    await cb.check()  # should not raise (probe allowed)


@pytest.mark.asyncio
async def test_half_open_success_closes(cb):
    for _ in range(3):
        await cb.record_failure()
    await asyncio.sleep(0.25)
    await cb.check()
    await cb.record_success()
    assert cb.state == "closed"
    assert cb.consecutive_failures == 0


@pytest.mark.asyncio
async def test_half_open_failure_reopens(cb):
    for _ in range(3):
        await cb.record_failure()
    await asyncio.sleep(0.25)
    await cb.check()
    await cb.record_failure()
    assert cb.state == "open"


@pytest.mark.asyncio
async def test_snapshot(cb):
    snap = cb.snapshot()
    assert snap["state"] == "closed"
    assert snap["consecutiveFailures"] == 0
    assert snap["threshold"] == 3
    assert snap["recoverySeconds"] == 0.2


@pytest.mark.asyncio
async def test_circuit_open_error_is_retryable():
    err = LlmCircuitOpenError()
    assert err.retryable is True
    assert err.code == "LLM_CIRCUIT_OPEN"
