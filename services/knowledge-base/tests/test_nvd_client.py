"""NvdClient 단위 테스트 — NVD API를 mock하여 검증."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.cve.nvd_client import (
    NvdClient,
    _check_version_in_range,
    _extract_vendor_from_url,
    _parse_version,
)


# ── 버전 파싱 ──


def test_parse_version_simple():
    assert _parse_version("7.68.0") == (7, 68, 0)


def test_parse_version_strip_suffix():
    assert _parse_version("7.68.0-rc1") == (7, 68, 0)


def test_parse_version_two_parts():
    assert _parse_version("2.28") == (2, 28)


# ── vendor 추론 ──


def test_extract_vendor_github():
    assert _extract_vendor_from_url("https://github.com/eclipse/mosquitto.git") == "eclipse"


def test_extract_vendor_gitlab():
    assert _extract_vendor_from_url("https://gitlab.com/libvirt/libvirt.git") == "libvirt"


def test_extract_vendor_none():
    assert _extract_vendor_from_url(None) is None


def test_extract_vendor_unknown_host():
    assert _extract_vendor_from_url("https://example.com/foo/bar") is None


# ── 버전 범위 매칭 ──


def test_version_in_range_inclusive():
    cpe_match = {
        "vulnerable": True,
        "versionStartIncluding": "7.41",
        "versionEndIncluding": "7.77.0",
    }
    assert _check_version_in_range("7.68.0", cpe_match) is True


def test_version_below_range():
    cpe_match = {
        "vulnerable": True,
        "versionStartIncluding": "7.41",
        "versionEndIncluding": "7.77.0",
    }
    assert _check_version_in_range("7.40.0", cpe_match) is False


def test_version_above_range():
    cpe_match = {
        "vulnerable": True,
        "versionStartIncluding": "7.41",
        "versionEndIncluding": "7.77.0",
    }
    assert _check_version_in_range("8.0.0", cpe_match) is False


def test_version_exclusive_end():
    cpe_match = {
        "vulnerable": True,
        "versionStartIncluding": "1.0",
        "versionEndExcluding": "2.0.0",
    }
    assert _check_version_in_range("1.5.0", cpe_match) is True
    assert _check_version_in_range("2.0.0", cpe_match) is False


def test_version_no_range_data():
    cpe_match = {"vulnerable": True}
    assert _check_version_in_range("1.0.0", cpe_match) is None


def test_version_not_vulnerable():
    cpe_match = {
        "vulnerable": False,
        "versionStartIncluding": "1.0",
        "versionEndIncluding": "2.0",
    }
    assert _check_version_in_range("1.5", cpe_match) is None


# ── NvdClient 캐시 ──


@pytest.mark.asyncio
async def test_lookup_cache_hit():
    client = NvdClient(api_key="test", cache_ttl=3600)

    # 캐시에 직접 삽입
    cached_result = {
        "library": "testlib",
        "version": "1.0.0",
        "cves": [{"id": "CVE-2024-0001"}],
        "total": 1,
        "cached": False,
    }
    client._cache["testlib:1.0.0"] = (time.monotonic(), cached_result)

    result = await client.lookup("testlib", "1.0.0")
    assert result["cached"] is True
    assert result["total"] == 1

    await client.close()


@pytest.mark.asyncio
async def test_lookup_cache_expired():
    client = NvdClient(api_key="test", cache_ttl=0)  # TTL 0 = 즉시 만료

    cached_result = {
        "library": "testlib",
        "version": "1.0.0",
        "cves": [],
        "total": 0,
        "cached": False,
    }
    client._cache["testlib:1.0.0"] = (time.monotonic() - 1, cached_result)

    # _nvd_request를 mock (내부 HTTP 호출 대신)
    client._nvd_request = AsyncMock(return_value={
        "vulnerabilities": [],
        "totalResults": 0,
    })

    result = await client.lookup("testlib", "1.0.0")
    assert result["cached"] is False
    assert client._nvd_request.called

    await client.close()


# ── 배치 조회 ──


@pytest.mark.asyncio
async def test_batch_lookup_aggregates():
    client = NvdClient(api_key="test", cache_ttl=3600)

    # 두 라이브러리를 캐시에 삽입
    for name in ["libA", "libB"]:
        client._cache[f"{name}:1.0"] = (
            time.monotonic(),
            {"library": name, "version": "1.0", "cves": [], "total": 0, "cached": False},
        )

    results = await client.batch_lookup([
        {"name": "libA", "version": "1.0"},
        {"name": "libB", "version": "1.0"},
    ])
    assert len(results) == 2
    assert results[0]["library"] == "libA"
    assert results[1]["library"] == "libB"

    await client.close()


@pytest.mark.asyncio
async def test_batch_lookup_passes_repo_url():
    client = NvdClient(api_key="test", cache_ttl=3600)

    # 캐시에 삽입
    client._cache["testlib:1.0"] = (
        time.monotonic(),
        {"library": "testlib", "version": "1.0", "cves": [], "total": 0, "cached": False},
    )

    results = await client.batch_lookup([
        {"name": "testlib", "version": "1.0", "repo_url": "https://github.com/org/testlib.git"},
    ])
    assert len(results) == 1

    await client.close()
