from __future__ import annotations

import json
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.runtime.request_summary import request_summary_tracker
from app.config import settings
from app.scanner.sarif_parser import parse_sarif
from app.schemas.response import (
    ExecutionReport,
    FindingsFilterInfo,
    SdkResolutionInfo,
    ToolExecutionResult,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def reset_request_summary_tracker():
    request_summary_tracker.reset()
    yield
    request_summary_tracker.reset()


@pytest.fixture(autouse=True)
def reset_scan_semaphore():
    from app.routers import scan as scan_router_module

    original = scan_router_module._scan_semaphore
    scan_router_module._scan_semaphore = asyncio.Semaphore(settings.max_concurrent_scans)
    yield
    scan_router_module._scan_semaphore = original


@pytest.fixture
def sample_sarif() -> dict:
    return json.loads((FIXTURES_DIR / "sample.sarif.json").read_text())


@pytest.fixture
def mock_semgrep_runner(sample_sarif):
    """오케스트레이터를 mock하여 sample SARIF 기반 findings + execution report를 반환."""
    findings, _ = parse_sarif(sample_sarif, Path("/tmp/mock"))

    execution = ExecutionReport(
        tools_run=["semgrep", "cppcheck", "flawfinder", "clang-tidy"],
        tool_results={
            "semgrep": ToolExecutionResult(status="ok", findings_count=3, elapsed_ms=100, version="1.45.0"),
            "cppcheck": ToolExecutionResult(status="ok", findings_count=0, elapsed_ms=50, version="2.13.0"),
            "flawfinder": ToolExecutionResult(status="ok", findings_count=0, elapsed_ms=10, version="2.0.19"),
            "clang-tidy": ToolExecutionResult(status="ok", findings_count=0, elapsed_ms=80, version="18.1.3"),
            "scan-build": ToolExecutionResult(status="skipped", findings_count=0, elapsed_ms=0, skip_reason="profile-not-applicable"),
            "gcc-fanalyzer": ToolExecutionResult(status="skipped", findings_count=0, elapsed_ms=0, skip_reason="profile-not-applicable"),
        },
        sdk=SdkResolutionInfo(resolved=False),
        filtering=FindingsFilterInfo(before_filter=3, after_filter=3, sdk_noise_removed=0),
    )

    with patch("app.routers.scan.orchestrator") as mock_orch:
        mock_orch.run = AsyncMock(return_value=(findings, execution))
        mock_orch.evaluate_policy = MagicMock(return_value=None)
        mock_orch.check_tools = AsyncMock(return_value={
            "semgrep": {"available": True, "version": "1.45.0", "probeReason": None},
            "cppcheck": {"available": True, "version": "2.13.0", "probeReason": None},
            "flawfinder": {"available": True, "version": "2.0.19", "probeReason": None},
            "clang-tidy": {"available": True, "version": "18.1.3", "probeReason": None},
            "scan-build": {"available": False, "version": None, "probeReason": "runtime-tool-missing"},
            "gcc-fanalyzer": {"available": True, "version": "13.3.0", "probeReason": None},
        })
        mock_orch.build_health_policy = MagicMock(return_value={
            "policyStatus": "degraded",
            "policyReasons": ["runtime-tool-missing"],
            "unavailableTools": ["scan-build"],
            "allowedSkipReasons": [
                "operator-requested-subset",
                "profile-not-applicable",
            ],
        })
        yield mock_orch


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
