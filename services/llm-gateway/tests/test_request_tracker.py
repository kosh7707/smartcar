from app.request_tracker import RequestTracker


class TestRequestTracker:
    def test_snapshot_returns_idle_when_empty(self):
        tracker = RequestTracker()

        snapshot = tracker.snapshot()

        assert snapshot["activeRequestCount"] == 0
        assert snapshot["requestSummary"]["state"] == "idle"
        assert snapshot["requestSummary"]["requestId"] is None

    def test_snapshot_tracks_oldest_active_request(self):
        tracker = RequestTracker()
        tracker.register("gw-1", endpoint="tasks", task_type="static-explain")
        tracker.register("gw-2", endpoint="chat")
        tracker.mark_phase("gw-1", phase="prompt-build", state="running", ack_source="prompt-build")
        tracker.mark_phase("gw-2", phase="llm-inference", state="running", ack_source="queue-exit")
        tracker.mark_transport_only("gw-2", phase="llm-inference")

        snapshot = tracker.snapshot()

        assert snapshot["activeRequestCount"] == 2
        assert snapshot["requestSummary"]["requestId"] == "gw-1"
        assert snapshot["requestSummary"]["taskType"] == "static-explain"

    def test_snapshot_can_target_specific_request(self):
        tracker = RequestTracker()
        tracker.register("gw-1", endpoint="tasks", task_type="report-draft")
        tracker.mark_phase("gw-1", phase="validation", state="running", ack_source="validation-start")

        snapshot = tracker.snapshot(request_id="gw-1")

        assert snapshot["requestSummary"]["requestId"] == "gw-1"
        assert snapshot["requestSummary"]["phase"] == "validation"
        assert snapshot["requestSummary"]["localAckState"] == "phase-advancing"

    def test_ack_break_is_not_reported_after_clear(self):
        tracker = RequestTracker()
        tracker.register("gw-1", endpoint="chat")
        tracker.mark_ack_break("gw-1", blocked_reason="transport_timeout")
        tracker.clear("gw-1")

        snapshot = tracker.snapshot(request_id="gw-1")

        assert snapshot["activeRequestCount"] == 0
        assert snapshot["requestSummary"]["state"] == "idle"
