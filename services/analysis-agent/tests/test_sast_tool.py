"""SastScanTool 단위 테스트 — NDJSON 스트리밍 + 동기 fallback."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.tools.implementations.sast_tool import SastScanTool


def _make_ndjson_response(events: list[dict]) -> str:
    """NDJSON 이벤트 목록을 줄 단위 문자열로 변환."""
    return "\n".join(json.dumps(e) for e in events) + "\n"


class _MockStreamResponse:
    """httpx 스트리밍 응답 mock."""

    def __init__(self, lines: list[str], content_type: str = "application/x-ndjson", status_code: int = 200):
        self.headers = {"content-type": content_type}
        self.status_code = status_code
        self._lines = lines

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=MagicMock(), response=self)

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def aread(self):
        return "\n".join(self._lines).encode()

    async def aclose(self):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


@pytest.mark.asyncio
async def test_ndjson_streaming_success():
    """progress → heartbeat → result 정상 파싱."""
    events = [
        {"type": "progress", "tool": "semgrep", "status": "completed", "findingsCount": 5, "elapsedMs": 3000},
        {"type": "heartbeat", "timestamp": 1711900030000},
        {"type": "progress", "tool": "cppcheck", "status": "completed", "findingsCount": 3, "elapsedMs": 8000},
        {"type": "result", "data": {
            "success": True,
            "findings": [
                {"toolId": "semgrep", "ruleId": "cmd-injection", "severity": "error",
                 "message": "command injection", "location": {"file": "main.c", "line": 10}},
            ],
            "stats": {"findingsTotal": 1},
        }},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is True
    data = json.loads(result.content)
    assert data["success"] is True
    assert len(data["findings"]) == 1
    assert "eref-sast-cmd-injection" in result.new_evidence_refs


@pytest.mark.asyncio
async def test_ndjson_error_event():
    """error 이벤트 처리."""
    events = [
        {"type": "progress", "tool": "semgrep", "status": "completed", "findingsCount": 0, "elapsedMs": 100},
        {"type": "error", "code": "SCAN_TIMEOUT", "message": "Scan timed out", "retryable": True},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is False
    assert "SCAN_TIMEOUT" in result.content


@pytest.mark.asyncio
async def test_ndjson_http_503_error_event_preserved():
    """NDJSON 응답이 HTTP 503이어도 final error 이벤트를 소비한다."""
    events = [
        {
            "type": "error",
            "code": "DISALLOWED_TOOL_OMISSION",
            "message": "tool omission policy violation",
            "retryable": False,
            "execution": {"toolResults": {"semgrep": {"status": "skipped", "skipReason": "environment-drift"}}},
        },
    ]
    mock_resp = _MockStreamResponse([json.dumps(e) for e in events], status_code=503)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is False
    assert "DISALLOWED_TOOL_OMISSION" in result.content


@pytest.mark.asyncio
async def test_sync_503_json_error_preserved():
    """동기 JSON 503도 generic unavailable이 아니라 S4 payload를 보존한다."""
    payload = {
        "success": False,
        "status": "failed",
        "error": "policy violation",
        "errorDetail": {"code": "DISALLOWED_TOOL_OMISSION", "message": "tool omission policy violation"},
    }
    mock_resp = _MockStreamResponse([json.dumps(payload)], content_type="application/json", status_code=503)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is False
    assert "DISALLOWED_TOOL_OMISSION" in result.content
    assert "tool omission policy violation" in (result.error or "")


@pytest.mark.asyncio
async def test_sync_fallback():
    """Content-Type이 ndjson이 아니면 동기 fallback."""
    data = {
        "success": True,
        "findings": [
            {"toolId": "flawfinder", "ruleId": "buffer-overflow", "severity": "warning",
             "message": "buffer overflow", "location": {"file": "buf.c", "line": 5}},
        ],
        "stats": {"findingsTotal": 1},
    }
    mock_resp = _MockStreamResponse(
        [json.dumps(data)],
        content_type="application/json",
    )

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is True
    assert "eref-sast-buffer-overflow" in result.new_evidence_refs


@pytest.mark.asyncio
async def test_stream_no_result():
    """result 없이 스트림 종료 시 실패 반환."""
    events = [
        {"type": "progress", "tool": "semgrep", "status": "completed", "findingsCount": 0, "elapsedMs": 100},
        {"type": "heartbeat", "timestamp": 1711900030000},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is False
    assert "no_result" in (result.error or "")


@pytest.mark.asyncio
async def test_connection_error():
    """연결 실패 시 graceful 에러."""
    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(side_effect=httpx.ConnectError("refused"))

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is False
    assert "unavailable" in result.content.lower() or "error" in result.content.lower()


@pytest.mark.asyncio
async def test_accept_header_sent():
    """Accept: application/x-ndjson 헤더 전송 확인."""
    events = [{"type": "result", "data": {"success": True, "findings": [], "stats": {}}}]
    mock_resp = _MockStreamResponse([json.dumps(e) for e in events])

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    await tool.execute({"scanId": "test", "projectId": "p1"})

    call_kwargs = tool._client.stream.call_args
    headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers", {})
    assert headers.get("Accept") == "application/x-ndjson"


@pytest.mark.asyncio
async def test_queued_heartbeat_no_stall():
    """queued 상태 heartbeat는 stall 감지를 트리거하지 않는다."""
    events = [
        {"type": "heartbeat", "timestamp": 1, "status": "queued"},
        {"type": "heartbeat", "timestamp": 2, "status": "queued"},
        {"type": "heartbeat", "timestamp": 3, "status": "queued"},
        {"type": "heartbeat", "timestamp": 4, "status": "running", "progress": {
            "activeTools": ["semgrep"], "completedTools": [], "findingsCount": 0,
            "filesCompleted": 0, "filesTotal": 10, "currentFile": None,
        }},
        {"type": "result", "data": {"success": True, "findings": [], "stats": {}}},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is True
    data = json.loads(result.content)
    assert "_sast_caveats" not in data


@pytest.mark.asyncio
async def test_stall_detection():
    """filesCompleted가 3회 연속 동일하면 stall 감지."""
    events = [
        {"type": "heartbeat", "timestamp": 1, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": ["semgrep"],
            "findingsCount": 5, "filesCompleted": 3, "filesTotal": 50,
            "currentFile": "big_file.c",
        }},
        {"type": "heartbeat", "timestamp": 2, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": ["semgrep"],
            "findingsCount": 5, "filesCompleted": 3, "filesTotal": 50,
            "currentFile": "big_file.c",
        }},
        {"type": "heartbeat", "timestamp": 3, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": ["semgrep"],
            "findingsCount": 5, "filesCompleted": 3, "filesTotal": 50,
            "currentFile": "big_file.c",
        }},
        {"type": "heartbeat", "timestamp": 4, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": ["semgrep"],
            "findingsCount": 5, "filesCompleted": 3, "filesTotal": 50,
            "currentFile": "big_file.c",
        }},
        {"type": "result", "data": {"success": True, "findings": [
            {"toolId": "semgrep", "ruleId": "xss", "severity": "warning",
             "message": "xss", "location": {"file": "a.c", "line": 1}},
        ], "stats": {}}},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is True
    data = json.loads(result.content)
    assert data.get("_sast_caveats", {}).get("stallDetected") is True


@pytest.mark.asyncio
async def test_no_stall_when_progress_advances():
    """filesCompleted가 계속 증가하면 stall이 아님."""
    events = [
        {"type": "heartbeat", "timestamp": 1, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": [],
            "findingsCount": 0, "filesCompleted": 1, "filesTotal": 10,
        }},
        {"type": "heartbeat", "timestamp": 2, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": [],
            "findingsCount": 2, "filesCompleted": 2, "filesTotal": 10,
        }},
        {"type": "heartbeat", "timestamp": 3, "status": "running", "progress": {
            "activeTools": ["gcc-fanalyzer"], "completedTools": [],
            "findingsCount": 3, "filesCompleted": 3, "filesTotal": 10,
        }},
        {"type": "result", "data": {"success": True, "findings": [], "stats": {}}},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is True
    data = json.loads(result.content)
    assert "_sast_caveats" not in data


@pytest.mark.asyncio
async def test_failed_tool_caveats():
    """toolResults에 failed 도구가 있으면 _sast_caveats에 포함."""
    events = [
        {"type": "result", "data": {
            "success": True,
            "findings": [
                {"toolId": "semgrep", "ruleId": "sqli", "severity": "error",
                 "message": "sql injection", "location": {"file": "db.c", "line": 42}},
            ],
            "stats": {},
            "execution": {
                "toolResults": {
                    "semgrep": {"status": "ok", "findingsCount": 1},
                    "gcc-fanalyzer": {"status": "failed", "findingsCount": 0, "skipReason": "OOM killed"},
                    "scan-build": {"status": "partial", "findingsCount": 2, "timedOutFiles": 3},
                }
            },
        }},
    ]
    lines = [json.dumps(e) for e in events]
    mock_resp = _MockStreamResponse(lines)

    tool = SastScanTool()
    tool._client = MagicMock()
    tool._client.stream = MagicMock(return_value=mock_resp)

    result = await tool.execute({"scanId": "test", "projectId": "p1"})
    assert result.success is True
    data = json.loads(result.content)
    caveats = data.get("_sast_caveats", {})
    assert len(caveats.get("incompleteTools", [])) == 2
    assert any("gcc-fanalyzer" in t for t in caveats["incompleteTools"])
    assert any("scan-build" in t for t in caveats["incompleteTools"])
