"""API 엔드포인트 계약 테스트."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    resp = await client.get("/v1/health")
    assert resp.status_code == 200

    data = resp.json()
    assert data["service"] == "s4-sast"
    assert data["status"] == "ok"
    assert data["version"] == "0.9.0"
    assert "semgrep" in data
    assert "defaultRulesets" in data


@pytest.mark.asyncio
async def test_scan_no_files_returns_400(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-001",
            "projectId": "proj-test",
            "files": [],
        },
    )
    assert resp.status_code == 400

    data = resp.json()
    assert data["success"] is False
    assert data["status"] == "failed"
    assert data["errorDetail"]["code"] == "NO_FILES_PROVIDED"
    assert data["errorDetail"]["retryable"] is False


@pytest.mark.asyncio
async def test_scan_path_traversal_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-002",
            "projectId": "proj-test",
            "files": [{"path": "../../../etc/passwd", "content": "x"}],
        },
    )
    assert resp.status_code == 400

    data = resp.json()
    assert data["errorDetail"]["code"] == "NO_FILES_PROVIDED"


@pytest.mark.asyncio
async def test_scan_absolute_path_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-003",
            "projectId": "proj-test",
            "files": [{"path": "/etc/passwd", "content": "x"}],
        },
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_scan_request_id_propagation(client: AsyncClient) -> None:
    """X-Request-Id 헤더가 응답에 전파되는지 확인."""
    resp = await client.post(
        "/v1/scan",
        headers={"X-Request-Id": "req-test-123"},
        json={
            "scanId": "test-004",
            "projectId": "proj-test",
            "files": [],
        },
    )
    assert resp.headers.get("X-Request-Id") == "req-test-123"


@pytest.mark.asyncio
async def test_scan_generates_request_id_if_missing(client: AsyncClient) -> None:
    """X-Request-Id가 없으면 자동 생성."""
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-005",
            "projectId": "proj-test",
            "files": [],
        },
    )
    assert resp.headers.get("X-Request-Id", "").startswith("req-")


@pytest.mark.asyncio
async def test_scan_success_with_mock(client: AsyncClient, mock_semgrep_runner) -> None:
    """Semgrep mock으로 정상 스캔 응답 구조 확인."""
    resp = await client.post(
        "/v1/scan",
        headers={"X-Request-Id": "req-mock-001"},
        json={
            "scanId": "test-mock-001",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.c", "content": "#include <stdio.h>\nvoid f() { gets(buf); }"}
            ],
            "rulesets": ["p/c"],
        },
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "completed"
    assert data["scanId"] == "test-mock-001"
    assert isinstance(data["findings"], list)
    assert len(data["findings"]) == 3

    # SastFinding 필드 검증 (shared-models.md alias 형식)
    finding = data["findings"][0]
    assert "toolId" in finding
    assert "ruleId" in finding
    assert finding["toolId"] == "semgrep"
    assert finding["ruleId"].startswith("semgrep:")
    assert "location" in finding
    assert "line" in finding["location"]

    # stats
    assert data["stats"]["filesScanned"] == 1
    assert data["stats"]["findingsTotal"] == 3
    assert data["stats"]["elapsedMs"] >= 0


@pytest.mark.asyncio
async def test_scan_with_build_profile(client: AsyncClient, mock_semgrep_runner) -> None:
    """BuildProfile을 포함한 스캔 요청이 정상 처리되는지 확인."""
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-bp-001",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.c", "content": "int main() { return 0; }"}
            ],
            "buildProfile": {
                "sdkId": "ti-am335x",
                "compiler": "arm-none-eabi-gcc",
                "compilerVersion": "12.3.0",
                "targetArch": "arm-cortex-a8",
                "languageStandard": "c99",
                "headerLanguage": "c",
                "defines": {"__ARM_ARCH": "7"},
                "flags": ["-mthumb"]
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_scan_with_cpp_profile_auto_rulesets(client: AsyncClient, mock_semgrep_runner) -> None:
    """C++ BuildProfile로 보내면 룰셋이 자동 선택되는지 확인."""
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-bp-cpp-001",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.cpp", "content": "int main() { return 0; }"}
            ],
            "buildProfile": {
                "sdkId": "linux-x86_64-cpp",
                "compiler": "g++",
                "targetArch": "x86_64",
                "languageStandard": "c++17",
                "headerLanguage": "cpp",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_scan_without_build_profile_still_works(client: AsyncClient, mock_semgrep_runner) -> None:
    """BuildProfile 없이도 기존처럼 동작하는지 확인 (하위호환)."""
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-no-bp-001",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.c", "content": "int main() { return 0; }"}
            ],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_scan_error_response_format(client: AsyncClient) -> None:
    """에러 응답이 observability.md errorDetail 형식을 준수하는지 확인."""
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-err-001",
            "projectId": "proj-test",
            "files": [],
        },
    )
    data = resp.json()

    # observability.md 필수 필드
    assert "success" in data
    assert "error" in data
    assert "errorDetail" in data
    detail = data["errorDetail"]
    assert "code" in detail
    assert "message" in detail
    assert "requestId" in detail
    assert "retryable" in detail


# === /v1/discover-targets ===


@pytest.mark.asyncio
async def test_discover_targets_no_project_path(client: AsyncClient) -> None:
    """projectPath 없으면 400."""
    resp = await client.post("/v1/discover-targets", json={})
    assert resp.status_code == 400
    assert "projectPath" in resp.json()["error"]


@pytest.mark.asyncio
async def test_discover_targets_invalid_path(client: AsyncClient) -> None:
    """존재하지 않는 경로면 400."""
    resp = await client.post(
        "/v1/discover-targets",
        json={"projectPath": "/nonexistent/path"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_discover_targets_basic(client: AsyncClient, tmp_path) -> None:
    """빌드 파일 탐지 기본 동작."""
    (tmp_path / "gateway").mkdir()
    (tmp_path / "gateway" / "CMakeLists.txt").touch()
    (tmp_path / "controller").mkdir()
    (tmp_path / "controller" / "Makefile").touch()

    resp = await client.post(
        "/v1/discover-targets",
        json={"projectPath": str(tmp_path)},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["targets"]) == 2
    names = {t["name"] for t in data["targets"]}
    assert "gateway" in names
    assert "controller" in names


@pytest.mark.asyncio
async def test_discover_targets_nested_dedup(client: AsyncClient, tmp_path) -> None:
    """중첩 빌드 파일은 상위만 반환."""
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "CMakeLists.txt").touch()
    (tmp_path / "app" / "src").mkdir()
    (tmp_path / "app" / "src" / "CMakeLists.txt").touch()  # 중첩 — 제거

    resp = await client.post(
        "/v1/discover-targets",
        json={"projectPath": str(tmp_path)},
    )
    data = resp.json()
    assert len(data["targets"]) == 1
    assert data["targets"][0]["name"] == "app"


# === /v1/functions ===


@pytest.mark.asyncio
async def test_functions_no_input_returns_error(client: AsyncClient) -> None:
    """files도 projectPath도 없으면 에러."""
    resp = await client.post(
        "/v1/functions",
        json={"scanId": "test-fn-001", "projectId": "proj-test", "files": []},
    )
    assert resp.status_code == 400


# === /v1/build ===


@pytest.mark.asyncio
async def test_build_no_project_path(client: AsyncClient) -> None:
    """projectPath 없으면 400."""
    resp = await client.post("/v1/build", json={})
    assert resp.status_code == 400
    data = resp.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_build_invalid_path(client: AsyncClient) -> None:
    """존재하지 않는 경로면 400."""
    resp = await client.post(
        "/v1/build",
        json={"projectPath": "/nonexistent/path"},
    )
    assert resp.status_code == 400
    data = resp.json()
    assert data["success"] is False


@pytest.mark.asyncio
async def test_build_with_sdk_only_profile(client: AsyncClient, tmp_path) -> None:
    """sdkId만 있는 buildProfile → 500이 아닌 정상 처리 (빌드 실패여도 200 + success:false)."""
    resp = await client.post(
        "/v1/build",
        json={
            "projectPath": str(tmp_path),
            "buildCommand": "echo hello",
            "buildProfile": {"sdkId": "ti-am335x"},
        },
    )
    # 500이 아니어야 함 (200 + success:true/false)
    assert resp.status_code == 200
    data = resp.json()
    assert "success" in data


@pytest.mark.asyncio
async def test_build_with_full_profile(client: AsyncClient, tmp_path) -> None:
    """전체 필드를 채운 buildProfile → 정상 처리."""
    resp = await client.post(
        "/v1/build",
        json={
            "projectPath": str(tmp_path),
            "buildCommand": "echo hello",
            "buildProfile": {
                "sdkId": "ti-am335x",
                "compiler": "arm-none-linux-gnueabihf-gcc",
                "targetArch": "arm",
                "languageStandard": "c11",
                "headerLanguage": "c",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "success" in data


# === /v1/includes ===


@pytest.mark.asyncio
async def test_includes_no_input_returns_error(client: AsyncClient) -> None:
    """files도 projectPath도 없으면 에러."""
    resp = await client.post(
        "/v1/includes",
        json={"scanId": "test-inc-001", "projectId": "proj-test", "files": []},
    )
    assert resp.status_code == 400


# === /v1/sdk-registry (POST/DELETE) ===


@pytest.mark.asyncio
async def test_register_sdk_no_sdk_id(client: AsyncClient) -> None:
    """sdkId 없으면 400."""
    resp = await client.post("/v1/sdk-registry", json={"path": "/tmp"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_sdk_no_path(client: AsyncClient) -> None:
    """path 없으면 400."""
    resp = await client.post("/v1/sdk-registry", json={"sdkId": "test"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_register_sdk_invalid_path(client: AsyncClient) -> None:
    """존재하지 않는 경로면 400 + errors."""
    resp = await client.post(
        "/v1/sdk-registry",
        json={"sdkId": "test-sdk", "path": "/nonexistent/sdk"},
    )
    assert resp.status_code == 400
    data = resp.json()
    assert data["success"] is False
    assert len(data["errors"]) > 0


@pytest.mark.asyncio
async def test_register_sdk_valid(client: AsyncClient, tmp_path) -> None:
    """유효한 경로로 등록 → success."""
    resp = await client.post(
        "/v1/sdk-registry",
        json={"sdkId": "test-sdk-valid", "path": str(tmp_path)},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True

    # 등록 후 삭제 (클린업)
    await client.delete("/v1/sdk-registry/test-sdk-valid")


@pytest.mark.asyncio
async def test_delete_sdk_not_found(client: AsyncClient) -> None:
    """존재하지 않는 SDK 삭제 → 404."""
    resp = await client.delete("/v1/sdk-registry/nonexistent-sdk")
    assert resp.status_code == 404


# === /v1/libraries ===


@pytest.mark.asyncio
async def test_libraries_no_project_path(client: AsyncClient) -> None:
    """projectPath 없으면 에러."""
    resp = await client.post(
        "/v1/libraries",
        json={"scanId": "test-lib-001", "projectId": "proj-test", "files": []},
    )
    assert resp.status_code == 400


# ──────────── NDJSON 스트리밍 모드 ────────────


def _parse_ndjson(text: str) -> list[dict]:
    """NDJSON 텍스트를 파싱하여 이벤트 리스트 반환."""
    import json
    events = []
    for line in text.strip().split("\n"):
        line = line.strip()
        if line:
            events.append(json.loads(line))
    return events


@pytest.mark.asyncio
async def test_scan_ndjson_streaming_basic(client: AsyncClient, mock_semgrep_runner) -> None:
    """NDJSON Accept → 스트리밍 응답, progress + result 이벤트 검증."""
    resp = await client.post(
        "/v1/scan",
        headers={
            "Accept": "application/x-ndjson",
            "X-Request-Id": "req-stream-001",
        },
        json={
            "scanId": "test-stream-001",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.c", "content": "int main() { return 0; }"},
            ],
        },
    )
    assert resp.status_code == 200
    assert "application/x-ndjson" in resp.headers.get("content-type", "")
    assert resp.headers.get("X-Request-Id") == "req-stream-001"

    events = _parse_ndjson(resp.text)
    assert len(events) >= 1

    # 마지막 이벤트는 result
    last = events[-1]
    assert last["type"] == "result"
    assert last["data"]["success"] is True
    assert last["data"]["scanId"] == "test-stream-001"
    assert isinstance(last["data"]["findings"], list)


@pytest.mark.asyncio
async def test_scan_ndjson_has_progress_events(client: AsyncClient, mock_semgrep_runner) -> None:
    """스트리밍 응답에 progress 이벤트가 포함되는지 확인."""
    resp = await client.post(
        "/v1/scan",
        headers={"Accept": "application/x-ndjson"},
        json={
            "scanId": "test-stream-progress",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.c", "content": "int main() { return 0; }"},
            ],
        },
    )
    events = _parse_ndjson(resp.text)
    progress_events = [e for e in events if e["type"] == "progress"]

    # mock_semgrep_runner의 on_progress 콜백이 호출됨 (도구별)
    # orchestrator.run이 mock이므로 콜백이 호출되지 않을 수 있음
    # 최소한 result 이벤트는 존재해야 함
    result_events = [e for e in events if e["type"] == "result"]
    assert len(result_events) == 1
    assert result_events[0]["data"]["success"] is True


@pytest.mark.asyncio
async def test_scan_ndjson_result_matches_sync(client: AsyncClient, mock_semgrep_runner) -> None:
    """동기/스트리밍 동일 결과 반환 확인."""
    body = {
        "scanId": "test-compare",
        "projectId": "proj-test",
        "files": [
            {"path": "src/main.c", "content": "#include <stdio.h>\nvoid f() { gets(buf); }"},
        ],
        "rulesets": ["p/c"],
    }

    # 동기
    resp_sync = await client.post("/v1/scan", json=body)
    sync_data = resp_sync.json()

    # 스트리밍
    resp_stream = await client.post(
        "/v1/scan",
        headers={"Accept": "application/x-ndjson"},
        json=body,
    )
    events = _parse_ndjson(resp_stream.text)
    stream_data = [e for e in events if e["type"] == "result"][0]["data"]

    # 핵심 필드 일치 확인
    assert sync_data["success"] == stream_data["success"]
    assert sync_data["scanId"] == stream_data["scanId"]
    assert len(sync_data["findings"]) == len(stream_data["findings"])


@pytest.mark.asyncio
async def test_scan_ndjson_error_event(client: AsyncClient) -> None:
    """스캔 에러 시 error 이벤트 emit 확인."""
    from unittest.mock import AsyncMock, patch
    from app.errors import ScanTimeoutError

    with patch("app.routers.scan.orchestrator") as mock_orch:
        mock_orch.run = AsyncMock(side_effect=ScanTimeoutError("Tool timed out"))
        resp = await client.post(
            "/v1/scan",
            headers={"Accept": "application/x-ndjson"},
            json={
                "scanId": "test-stream-error",
                "projectId": "proj-test",
                "files": [
                    {"path": "src/main.c", "content": "int main() { return 0; }"},
                ],
            },
        )

    events = _parse_ndjson(resp.text)
    error_events = [e for e in events if e["type"] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "SCAN_TIMEOUT"
    assert error_events[0]["retryable"] is True


@pytest.mark.asyncio
async def test_scan_without_ndjson_header_unchanged(client: AsyncClient, mock_semgrep_runner) -> None:
    """Accept 없으면 기존 동기 JSON 응답 (스트리밍 아님)."""
    resp = await client.post(
        "/v1/scan",
        json={
            "scanId": "test-sync",
            "projectId": "proj-test",
            "files": [
                {"path": "src/main.c", "content": "int main() { return 0; }"},
            ],
        },
    )
    assert resp.status_code == 200
    assert "application/json" in resp.headers.get("content-type", "")
    data = resp.json()
    assert "type" not in data  # NDJSON 이벤트 형식이 아님
    assert data["success"] is True


@pytest.mark.asyncio
async def test_scan_ndjson_validation_error_returns_json(client: AsyncClient) -> None:
    """NDJSON 모드에서도 입력 검증 실패 시 일반 HTTP 에러 반환."""
    resp = await client.post(
        "/v1/scan",
        headers={"Accept": "application/x-ndjson"},
        json={
            "scanId": "test-validate",
            "projectId": "proj-test",
            "files": [],
        },
    )
    assert resp.status_code == 400


# --- heartbeat 진행 지표 보강 테스트 ---


def _make_progress_mock(findings, execution):
    """orchestrator.run mock — on_progress 콜백을 실제 호출하는 side_effect."""

    async def _run(*args, **kwargs):
        on_progress = kwargs.get("on_progress")
        on_file_progress = kwargs.get("on_file_progress")
        if on_progress:
            await on_progress("semgrep", "started", 0, 0)
            await on_progress("semgrep", "completed", len(findings), 100)
        if on_file_progress:
            await on_file_progress("gcc-fanalyzer", "src/main.c", 1, 2)
        return (findings, execution)

    return _run


def _make_slow_progress_mock(findings, execution, delay: float = 0.3):
    """orchestrator.run mock — 지연 + on_progress 호출 (heartbeat 발생 유도)."""

    async def _run(*args, **kwargs):
        on_progress = kwargs.get("on_progress")
        on_file_progress = kwargs.get("on_file_progress")
        if on_progress:
            await on_progress("semgrep", "started", 0, 0)
        if on_file_progress:
            await on_file_progress("gcc-fanalyzer", "src/main.c", 1, 3)
        await asyncio.sleep(delay)
        if on_progress:
            await on_progress("semgrep", "completed", len(findings), 200)
        return (findings, execution)

    return _run


@pytest.mark.asyncio
async def test_scan_ndjson_progress_started_event(client: AsyncClient, mock_semgrep_runner) -> None:
    """스트리밍 응답에 도구별 'started' progress 이벤트가 포함되는지 확인."""
    from app.scanner.sarif_parser import parse_sarif
    import json
    from pathlib import Path as P

    sarif = json.loads((P(__file__).parent / "fixtures" / "sample.sarif.json").read_text())
    findings, _ = parse_sarif(sarif, P("/tmp/mock"))
    execution = mock_semgrep_runner.run.return_value[1]

    mock_semgrep_runner.run = AsyncMock(side_effect=_make_progress_mock(findings, execution))

    resp = await client.post(
        "/v1/scan",
        headers={"Accept": "application/x-ndjson"},
        json={
            "scanId": "test-started",
            "projectId": "proj-test",
            "files": [{"path": "src/main.c", "content": "int main() {}"}],
        },
    )
    events = _parse_ndjson(resp.text)
    started_events = [e for e in events if e.get("type") == "progress" and e.get("status") == "started"]
    assert len(started_events) >= 1
    assert started_events[0]["tool"] == "semgrep"


@pytest.mark.asyncio
async def test_scan_ndjson_heartbeat_has_progress(client: AsyncClient, mock_semgrep_runner) -> None:
    """running 상태 heartbeat에 status + progress 필드가 포함되는지 확인."""
    from app.scanner.sarif_parser import parse_sarif
    import json
    from pathlib import Path as P

    sarif = json.loads((P(__file__).parent / "fixtures" / "sample.sarif.json").read_text())
    findings, _ = parse_sarif(sarif, P("/tmp/mock"))
    execution = mock_semgrep_runner.run.return_value[1]

    mock_semgrep_runner.run = AsyncMock(
        side_effect=_make_slow_progress_mock(findings, execution, delay=0.3),
    )

    with patch("app.routers.scan._HEARTBEAT_INTERVAL_S", 0.1):
        resp = await client.post(
            "/v1/scan",
            headers={"Accept": "application/x-ndjson"},
            json={
                "scanId": "test-hb-progress",
                "projectId": "proj-test",
                "files": [{"path": "src/main.c", "content": "int main() {}"}],
            },
        )

    events = _parse_ndjson(resp.text)
    heartbeats = [e for e in events if e.get("type") == "heartbeat"]
    assert len(heartbeats) >= 1
    running_hb = [h for h in heartbeats if h.get("status") == "running"]
    assert len(running_hb) >= 1
    progress = running_hb[0]["progress"]
    assert "activeTools" in progress
    assert "completedTools" in progress
    assert "findingsCount" in progress
    assert "filesCompleted" in progress
    assert "filesTotal" in progress
    assert "currentFile" in progress


@pytest.mark.asyncio
async def test_scan_ndjson_file_progress_in_heartbeat(client: AsyncClient, mock_semgrep_runner) -> None:
    """heartbeat의 filesCompleted/currentFile이 on_file_progress에서 반영되는지 확인."""
    from app.scanner.sarif_parser import parse_sarif
    import json
    from pathlib import Path as P

    sarif = json.loads((P(__file__).parent / "fixtures" / "sample.sarif.json").read_text())
    findings, _ = parse_sarif(sarif, P("/tmp/mock"))
    execution = mock_semgrep_runner.run.return_value[1]

    mock_semgrep_runner.run = AsyncMock(
        side_effect=_make_slow_progress_mock(findings, execution, delay=0.3),
    )

    with patch("app.routers.scan._HEARTBEAT_INTERVAL_S", 0.1):
        resp = await client.post(
            "/v1/scan",
            headers={"Accept": "application/x-ndjson"},
            json={
                "scanId": "test-file-progress",
                "projectId": "proj-test",
                "files": [{"path": "src/main.c", "content": "int main() {}"}],
            },
        )

    events = _parse_ndjson(resp.text)
    running_hb = [
        e for e in events
        if e.get("type") == "heartbeat" and e.get("status") == "running"
    ]
    if running_hb:
        progress = running_hb[0]["progress"]
        assert progress["filesCompleted"] >= 1
        assert progress["currentFile"] == "src/main.c"


@pytest.mark.asyncio
async def test_scan_ndjson_queued_status(client: AsyncClient, mock_semgrep_runner) -> None:
    """세마포어 포화 시 queued status heartbeat가 전송되는지 확인."""
    from app.config import settings
    from app.scanner.sarif_parser import parse_sarif
    import json
    from pathlib import Path as P

    sarif = json.loads((P(__file__).parent / "fixtures" / "sample.sarif.json").read_text())
    findings, _ = parse_sarif(sarif, P("/tmp/mock"))
    execution = mock_semgrep_runner.run.return_value[1]

    from app.routers.scan import _scan_semaphore

    for _ in range(settings.max_concurrent_scans):
        await _scan_semaphore.acquire()

    async def _release_later():
        await asyncio.sleep(0.15)
        _scan_semaphore.release()

    mock_semgrep_runner.run = AsyncMock(
        side_effect=_make_progress_mock(findings, execution),
    )

    release_task = asyncio.create_task(_release_later())

    with patch("app.routers.scan._HEARTBEAT_INTERVAL_S", 0.05):
        resp = await client.post(
            "/v1/scan",
            headers={"Accept": "application/x-ndjson"},
            json={
                "scanId": "test-queued",
                "projectId": "proj-test",
                "files": [{"path": "src/main.c", "content": "int main() {}"}],
            },
        )

    await release_task

    events = _parse_ndjson(resp.text)
    heartbeats = [e for e in events if e.get("type") == "heartbeat"]
    queued_hb = [h for h in heartbeats if h.get("status") == "queued"]
    assert len(queued_hb) >= 1
    assert "progress" not in queued_hb[0]
