"""Fixture 기반 통합 테스트 — 실제 SAST 도구로 C 프로젝트를 분석.

pytest -m integration  으로 실행.
도구 미설치 시 자동 skip.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

FIXTURES_DIR = Path(__file__).parent / "fixtures"
C_PROJECT = FIXTURES_DIR / "c_project"


def _tool_available(name: str) -> bool:
    return shutil.which(name) is not None


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not _tool_available("flawfinder"),
        reason="SAST tools not installed",
    ),
]


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestScanFixtureProject:
    """실제 도구로 fixture C 프로젝트를 스캔하여 findings 검증."""

    @pytest.mark.asyncio
    async def test_scan_detects_vulnerabilities(self, client):
        """flawfinder 단독으로 fixture 스캔 — 최소 1개 finding."""
        resp = await client.post("/v1/scan", json={
            "scanId": "integ-scan-1",
            "projectId": "integ-proj",
            "projectPath": str(C_PROJECT),
            "options": {"tools": ["flawfinder"]},
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["findings"]) > 0

    @pytest.mark.asyncio
    async def test_scan_finds_gets_cwe120(self, client):
        """gets() 사용 → CWE-120 감지 확인."""
        resp = await client.post("/v1/scan", json={
            "scanId": "integ-scan-cwe120",
            "projectId": "integ-proj",
            "projectPath": str(C_PROJECT),
            "options": {"tools": ["flawfinder"]},
        })
        data = resp.json()
        cwes_found = set()
        for f in data.get("findings", []):
            for cwe in (f.get("metadata") or {}).get("cwe", []):
                cwes_found.add(cwe)
        # flawfinder는 gets()를 CWE-120 또는 CWE-242로 잡음
        assert "CWE-120" in cwes_found or "CWE-242" in cwes_found

    @pytest.mark.asyncio
    @pytest.mark.skipif(not _tool_available("cppcheck"), reason="cppcheck not installed")
    async def test_scan_cppcheck_finds_null_deref(self, client):
        """cppcheck 단독 — CWE-476 NULL deref 감지."""
        resp = await client.post("/v1/scan", json={
            "scanId": "integ-cppcheck",
            "projectId": "integ-proj",
            "projectPath": str(C_PROJECT),
            "options": {"tools": ["cppcheck"]},
        })
        data = resp.json()
        assert data["success"] is True
        # cppcheck은 null pointer deref를 잡는다
        has_null = any(
            "null" in (f.get("message", "") + f.get("ruleId", "")).lower()
            for f in data.get("findings", [])
        )
        assert has_null


class TestFunctionsFixtureProject:
    """실제 clang으로 함수 추출."""

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not (_tool_available("clang") or _tool_available("clang-18") or _tool_available("clang-17")),
        reason="clang not installed",
    )
    async def test_extracts_main_function(self, client):
        resp = await client.post("/v1/functions", json={
            "scanId": "integ-func",
            "projectId": "integ-proj",
            "projectPath": str(C_PROJECT),
        })
        assert resp.status_code == 200
        data = resp.json()
        func_names = [f["name"] for f in data.get("functions", [])]
        assert "main" in func_names

    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not (_tool_available("clang") or _tool_available("clang-18") or _tool_available("clang-17")),
        reason="clang not installed",
    )
    async def test_main_has_calls(self, client):
        """main() 함수가 호출하는 함수 목록 확인."""
        resp = await client.post("/v1/functions", json={
            "scanId": "integ-func-calls",
            "projectId": "integ-proj",
            "projectPath": str(C_PROJECT),
        })
        data = resp.json()
        main_func = next(
            (f for f in data.get("functions", []) if f["name"] == "main"), None
        )
        assert main_func is not None
        # main()이 호출하는 함수 중 일부 확인
        calls = set(main_func.get("calls", []))
        assert len(calls) > 0  # 최소 1개 호출


class TestHealthEndpoint:
    """health 엔드포인트가 실제 도구 상태를 반환."""

    @pytest.mark.asyncio
    async def test_health_shows_tools(self, client):
        resp = await client.get("/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        # 최소 flawfinder는 있어야 함 (pytestmark에서 확인됨)
        assert data["tools"]["flawfinder"]["available"] is True
