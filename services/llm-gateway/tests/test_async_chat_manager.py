import asyncio

import pytest

from app.async_chat_manager import AsyncChatRequestManager


class TestAsyncChatRequestManager:
    @pytest.mark.asyncio
    async def test_submit_and_complete(self):
        manager = AsyncChatRequestManager()

        async def runner(record):
            await manager.mark_phase(
                record.request_id,
                phase="llm-inference",
                state="running",
                ack_source="queue-exit",
            )
            await manager.mark_transport_only(record.request_id, phase="llm-inference")
            await manager.complete(record.request_id, response_payload={"choices": [], "usage": {}})

        record = await manager.submit(
            trace_request_id="gw-trace-1",
            runner=runner,
        )

        await asyncio.sleep(0)
        status = await manager.status(record.request_id)

        assert status is not None
        assert status["state"] == "completed"
        assert status["resultReady"] is True

    @pytest.mark.asyncio
    async def test_cancel_marks_request_cancelled(self):
        manager = AsyncChatRequestManager()
        started = asyncio.Event()

        async def runner(record):
            await manager.mark_phase(
                record.request_id,
                phase="llm-inference",
                state="running",
                ack_source="queue-exit",
            )
            started.set()
            await asyncio.sleep(60)

        record = await manager.submit(
            trace_request_id="gw-trace-2",
            runner=runner,
        )

        await started.wait()
        cancelled = await manager.cancel(record.request_id)

        assert cancelled is not None
        assert cancelled.state == "cancelled"
        assert cancelled.local_ack_state == "ack-break"

    @pytest.mark.asyncio
    async def test_status_expires_terminal_record(self):
        manager = AsyncChatRequestManager()

        async def runner(record):
            await manager.complete(record.request_id, response_payload={"choices": [], "usage": {}})

        record = await manager.submit(
            trace_request_id="gw-trace-3",
            runner=runner,
        )

        await asyncio.sleep(0)
        current = await manager.get_record(record.request_id)
        assert current is not None
        current.expires_at_ms = 0

        status = await manager.status(record.request_id)

        assert status is not None
        assert status["state"] == "expired"
        assert status["resultReady"] is False
