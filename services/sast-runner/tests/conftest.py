from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.scanner.sarif_parser import parse_sarif

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_sarif() -> dict:
    return json.loads((FIXTURES_DIR / "sample.sarif.json").read_text())


@pytest.fixture
def mock_semgrep_runner(sample_sarif):
    """오케스트레이터를 mock하여 sample SARIF 기반 findings + execution report를 반환."""
    findings, _ = parse_sarif(sample_sarif, Path("/tmp/mock"))

    execution = {
        "toolsRun": ["semgrep", "cppcheck", "flawfinder", "clang-tidy"],
        "toolResults": {
            "semgrep": {"findingsCount": 3, "elapsedMs": 100, "status": "ok"},
            "cppcheck": {"findingsCount": 0, "elapsedMs": 50, "status": "ok"},
            "flawfinder": {"findingsCount": 0, "elapsedMs": 10, "status": "ok"},
            "clang-tidy": {"findingsCount": 0, "elapsedMs": 80, "status": "ok"},
            "scan-build": {"findingsCount": 0, "elapsedMs": 0, "status": "skipped", "skipReason": "Not installed"},
            "gcc-fanalyzer": {"findingsCount": 0, "elapsedMs": 0, "status": "skipped", "skipReason": "Not installed"},
        },
        "sdk": {"resolved": False},
        "filtering": {"beforeFilter": 3, "afterFilter": 3, "sdkNoiseRemoved": 0},
    }

    with patch("app.routers.scan.orchestrator") as mock_orch:
        mock_orch.run = AsyncMock(return_value=(findings, execution))
        mock_orch.check_tools = AsyncMock(return_value={
            "semgrep": {"available": True, "version": "1.45.0"},
            "cppcheck": {"available": True, "version": "2.13.0"},
            "flawfinder": {"available": True, "version": "2.0.19"},
            "clang-tidy": {"available": True, "version": "18.1.3"},
            "scan-build": {"available": False, "version": None},
            "gcc-fanalyzer": {"available": True, "version": "13.3.0"},
        })
        yield mock_orch


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
