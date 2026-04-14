from __future__ import annotations

import threading
import time
from copy import deepcopy
from typing import Any


_RETENTION_SECONDS = 300


def _now_ms() -> int:
    return int(time.time() * 1000)


def _idle_summary() -> dict[str, Any]:
    return {
        "requestId": None,
        "endpoint": "scan",
        "state": "idle",
        "ackStatus": "idle",
        "lastAckAt": None,
        "lastAckSource": None,
        "localAckSources": [
            "semaphore-acquire",
            "tool-progress",
            "file-progress",
            "runtime-state",
            "terminal-result",
        ],
        "degraded": False,
        "degradeReasons": [],
        "activeTools": [],
        "completedTools": [],
        "findingsCount": 0,
        "filesCompleted": 0,
        "filesTotal": 0,
        "currentFile": None,
        "blockedReason": None,
    }


class RequestSummaryTracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, dict[str, Any]] = {}

    def reset(self) -> None:
        with self._lock:
            self._entries = {}

    def _prune_locked(self) -> None:
        cutoff = _now_ms() - (_RETENTION_SECONDS * 1000)
        expired = [
            request_id
            for request_id, entry in self._entries.items()
            if entry.get("state") in {"completed", "failed"} and (entry.get("lastAckAt") or 0) < cutoff
        ]
        for request_id in expired:
            self._entries.pop(request_id, None)

    def register(self, request_id: str, *, endpoint: str = "scan") -> None:
        with self._lock:
            self._prune_locked()
            summary = _idle_summary()
            now = _now_ms()
            summary.update(
                {
                    "requestId": request_id,
                    "endpoint": endpoint,
                    "state": "queued",
                    "ackStatus": "active",
                    "lastAckAt": now,
                    "lastAckSource": "request-accepted",
                },
            )
            self._entries[request_id] = summary

    def mark_started(self, request_id: str) -> None:
        self._update(request_id, state="running", ackStatus="active", lastAckSource="semaphore-acquired")

    def mark_progress(self, request_id: str, tool: str, status: str, count: int) -> None:
        with self._lock:
            entry = self._entries.get(request_id)
            if not entry:
                return
            if status == "started" and tool not in entry["activeTools"]:
                entry["activeTools"].append(tool)
            elif status in {"completed", "failed"}:
                if tool in entry["activeTools"]:
                    entry["activeTools"].remove(tool)
                if tool not in entry["completedTools"]:
                    entry["completedTools"].append(tool)
                if status == "completed":
                    entry["findingsCount"] = max(entry["findingsCount"], count)
            entry["state"] = "running"
            entry["ackStatus"] = "active"
            entry["lastAckAt"] = _now_ms()
            entry["lastAckSource"] = "tool-progress"

    def mark_file_progress(self, request_id: str, file: str, done: int, total: int) -> None:
        self._update(
            request_id,
            state="running",
            ackStatus="active",
            filesCompleted=done,
            filesTotal=total,
            currentFile=file,
            lastAckSource="file-progress",
        )

    def mark_runtime_state(self, request_id: str, tool_state: dict[str, Any]) -> None:
        self._update(
            request_id,
            state="running",
            ackStatus="active",
            degraded=bool(tool_state.get("degraded", False) or tool_state.get("degradeReasons")),
            degradeReasons=list(tool_state.get("degradeReasons", [])),
            lastAckSource="runtime-state",
        )

    def mark_completed(self, request_id: str) -> None:
        self._update(
            request_id,
            state="completed",
            ackStatus="idle",
            blockedReason=None,
            lastAckSource="terminal-result",
        )

    def mark_failed(self, request_id: str, reason: str) -> None:
        self._update(
            request_id,
            state="failed",
            ackStatus="broken",
            blockedReason=reason,
            activeTools=[],
            lastAckSource="ack-break",
        )

    def _update(self, request_id: str, **updates: Any) -> None:
        with self._lock:
            entry = self._entries.get(request_id)
            if not entry:
                return
            entry.update(updates)
            entry["lastAckAt"] = _now_ms()

    def active_request_count(self) -> int:
        with self._lock:
            self._prune_locked()
            return sum(1 for entry in self._entries.values() if entry.get("state") in {"queued", "running"})

    def get_summary(self, request_id: str | None = None) -> dict[str, Any]:
        with self._lock:
            self._prune_locked()
            if request_id:
                entry = self._entries.get(request_id)
                return deepcopy(entry) if entry else _idle_summary()

            active_entries = [
                entry
                for entry in self._entries.values()
                if entry.get("state") in {"queued", "running"}
            ]
            if active_entries:
                active_entries.sort(
                    key=lambda entry: (
                        0 if entry.get("state") == "running" else 1,
                        -(entry.get("lastAckAt") or 0),
                    ),
                )
                return deepcopy(active_entries[0])

            if self._entries:
                latest = max(self._entries.values(), key=lambda entry: entry.get("lastAckAt") or 0)
                return deepcopy(latest)

            return _idle_summary()


request_summary_tracker = RequestSummaryTracker()
