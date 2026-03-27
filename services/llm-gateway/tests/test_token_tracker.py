"""TokenTracker 단위 테스트."""
import pytest

from app.metrics.token_tracker import TokenTracker


@pytest.fixture()
def tracker():
    return TokenTracker()


@pytest.mark.asyncio
async def test_initial_snapshot(tracker):
    snap = await tracker.snapshot()
    assert snap["totalRequests"] == 0
    assert snap["totalErrors"] == 0
    assert snap["tokens"]["total"] == 0
    assert "startedAt" in snap


@pytest.mark.asyncio
async def test_record_success(tracker):
    await tracker.record(
        endpoint="tasks", task_type="static-explain",
        prompt_tokens=100, completion_tokens=50, success=True,
    )
    snap = await tracker.snapshot()
    assert snap["totalRequests"] == 1
    assert snap["totalErrors"] == 0
    assert snap["tokens"]["prompt"] == 100
    assert snap["tokens"]["completion"] == 50
    assert snap["tokens"]["total"] == 150


@pytest.mark.asyncio
async def test_record_error(tracker):
    await tracker.record(
        endpoint="chat", success=False, error_type="TIMEOUT",
    )
    snap = await tracker.snapshot()
    assert snap["totalRequests"] == 1
    assert snap["totalErrors"] == 1


@pytest.mark.asyncio
async def test_by_endpoint(tracker):
    await tracker.record(endpoint="tasks", task_type="static-explain",
                         prompt_tokens=10, completion_tokens=5, success=True)
    await tracker.record(endpoint="chat",
                         prompt_tokens=20, completion_tokens=10, success=True)
    snap = await tracker.snapshot()
    assert snap["byEndpoint"]["tasks"]["count"] == 1
    assert snap["byEndpoint"]["chat"]["count"] == 1
    assert snap["byEndpoint"]["tasks"]["prompt"] == 10
    assert snap["byEndpoint"]["chat"]["prompt"] == 20


@pytest.mark.asyncio
async def test_by_task_type(tracker):
    await tracker.record(endpoint="tasks", task_type="static-explain",
                         prompt_tokens=10, completion_tokens=5, success=True)
    await tracker.record(endpoint="tasks", task_type="static-cluster",
                         prompt_tokens=20, completion_tokens=10, success=True)
    await tracker.record(endpoint="tasks", task_type="static-explain",
                         prompt_tokens=30, completion_tokens=15, success=True)
    snap = await tracker.snapshot()
    assert snap["byTaskType"]["static-explain"]["count"] == 2
    assert snap["byTaskType"]["static-explain"]["prompt"] == 40
    assert snap["byTaskType"]["static-cluster"]["count"] == 1


@pytest.mark.asyncio
async def test_accumulation(tracker):
    for i in range(5):
        await tracker.record(endpoint="tasks", prompt_tokens=10, completion_tokens=5, success=True)
    snap = await tracker.snapshot()
    assert snap["totalRequests"] == 5
    assert snap["tokens"]["prompt"] == 50
    assert snap["tokens"]["completion"] == 25


@pytest.mark.asyncio
async def test_chat_no_task_type(tracker):
    await tracker.record(endpoint="chat", prompt_tokens=100, completion_tokens=50, success=True)
    snap = await tracker.snapshot()
    assert len(snap["byTaskType"]) == 0
    assert snap["byEndpoint"]["chat"]["count"] == 1
