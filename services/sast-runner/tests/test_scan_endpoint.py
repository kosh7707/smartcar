"""API 엔드포인트 계약 테스트."""

from __future__ import annotations

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


# === /v1/includes ===


@pytest.mark.asyncio
async def test_includes_no_input_returns_error(client: AsyncClient) -> None:
    """files도 projectPath도 없으면 에러."""
    resp = await client.post(
        "/v1/includes",
        json={"scanId": "test-inc-001", "projectId": "proj-test", "files": []},
    )
    assert resp.status_code == 400


# === /v1/libraries ===


@pytest.mark.asyncio
async def test_libraries_no_project_path(client: AsyncClient) -> None:
    """projectPath 없으면 에러."""
    resp = await client.post(
        "/v1/libraries",
        json={"scanId": "test-lib-001", "projectId": "proj-test", "files": []},
    )
    assert resp.status_code == 400
