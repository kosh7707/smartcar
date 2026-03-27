"""NvdClient 단위 테스트 — NVD API를 mock하여 검증."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.cve.nvd_client import (
    NvdClient,
    _check_version_in_range,
    _compute_risk_score,
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


def test_extract_vendor_codeberg():
    assert _extract_vendor_from_url("https://codeberg.org/dnkl/foot") == "dnkl"


def test_extract_vendor_self_hosted_gitlab():
    assert _extract_vendor_from_url("https://gitlab.internal.com/infra/libfoo.git") == "infra"


def test_extract_vendor_git_ssh():
    assert _extract_vendor_from_url("git@github.com:curl/curl.git") == "curl"


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


# ── 병렬 배치 조회 ──


@pytest.mark.asyncio
async def test_batch_lookup_parallel():
    """asyncio.gather 기반 병렬 실행 확인 (타이밍)."""
    client = NvdClient(api_key="test", cache_ttl=3600, nvd_concurrency=5)

    call_count = 0

    async def _mock_lookup(name, version, repo_url=None, commit=None):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)  # 50ms 시뮬레이션
        return {"library": name, "version": version, "cves": [], "total": 0, "cached": False}

    client.lookup = _mock_lookup

    libs = [{"name": f"lib{i}", "version": "1.0"} for i in range(5)]
    start = time.monotonic()
    results = await client.batch_lookup(libs)
    elapsed = time.monotonic() - start

    assert len(results) == 5
    assert call_count == 5
    # 병렬이므로 5 × 50ms = 250ms 보다 훨씬 빨라야 함
    assert elapsed < 0.2

    await client.close()


@pytest.mark.asyncio
async def test_batch_lookup_partial_failure():
    """1건 실패해도 나머지는 정상 반환."""
    client = NvdClient(api_key="test", cache_ttl=3600)

    async def _mock_lookup(name, version, repo_url=None, commit=None):
        if name == "badlib":
            raise RuntimeError("network error")
        return {"library": name, "version": version, "cves": [], "total": 0, "cached": False}

    client.lookup = _mock_lookup

    results = await client.batch_lookup([
        {"name": "goodlib", "version": "1.0"},
        {"name": "badlib", "version": "2.0"},
        {"name": "oklib", "version": "3.0"},
    ])
    assert len(results) == 3
    assert results[0]["library"] == "goodlib"
    assert "error" in results[1]
    assert results[2]["library"] == "oklib"

    await client.close()


@pytest.mark.asyncio
async def test_nvd_semaphore_limits_concurrency():
    """세마포어가 동시 NVD 요청 수를 제한하는지 확인."""
    client = NvdClient(api_key="test", rate_delay=0.0, nvd_concurrency=2)

    max_concurrent = 0
    current_concurrent = 0
    lock = asyncio.Lock()

    original_get = client._client.get

    async def _tracking_get(*args, **kwargs):
        nonlocal max_concurrent, current_concurrent
        async with lock:
            current_concurrent += 1
            if current_concurrent > max_concurrent:
                max_concurrent = current_concurrent
        await asyncio.sleep(0.05)
        async with lock:
            current_concurrent -= 1
        # mock 응답
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"vulnerabilities": [], "totalResults": 0}
        resp.raise_for_status = MagicMock()
        return resp

    client._client.get = _tracking_get

    # 5개 요청을 동시에 실행
    tasks = [client._nvd_request({"keywordSearch": f"lib{i}"}) for i in range(5)]
    await asyncio.gather(*tasks)

    # 세마포어=2이므로 최대 동시 실행은 2 이하
    assert max_concurrent <= 2

    await client.close()


# ── EPSS ──


@pytest.mark.asyncio
async def test_enrich_epss_success():
    """EPSS API mock → 점수 매핑 확인."""
    client = NvdClient(api_key="test", epss_enabled=True)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "data": [
            {"cve": "CVE-2024-0001", "epss": "0.87", "percentile": "0.95"},
            {"cve": "CVE-2024-0002", "epss": "0.12", "percentile": "0.45"},
        ],
    }
    client._client.get = AsyncMock(return_value=mock_resp)

    result = await client._enrich_epss(["CVE-2024-0001", "CVE-2024-0002"])
    assert result["CVE-2024-0001"]["epss"] == 0.87
    assert result["CVE-2024-0002"]["percentile"] == 0.45

    await client.close()


@pytest.mark.asyncio
async def test_enrich_epss_failure():
    """EPSS API 실패 → 빈 dict 반환."""
    client = NvdClient(api_key="test", epss_enabled=True)

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    client._client.get = AsyncMock(return_value=mock_resp)

    result = await client._enrich_epss(["CVE-2024-0001"])
    assert result == {}

    await client.close()


@pytest.mark.asyncio
async def test_lookup_includes_epss_kev():
    """lookup() 결과에 epss_score, epss_percentile, kev 필드가 포함되는지 확인."""
    client = NvdClient(api_key="test", cache_ttl=3600, epss_enabled=True)

    # NVD mock
    client._nvd_request = AsyncMock(return_value={
        "vulnerabilities": [{
            "cve": {
                "id": "CVE-2024-1111",
                "descriptions": [{"lang": "en", "value": "testlib buffer overflow"}],
                "metrics": {},
                "weaknesses": [],
                "configurations": [],
            },
        }],
        "totalResults": 1,
    })

    # EPSS mock
    client._enrich_epss = AsyncMock(return_value={
        "CVE-2024-1111": {"epss": 0.55, "percentile": 0.80},
    })

    # KEV mock
    client._load_kev_catalog = AsyncMock(return_value={"CVE-2024-1111"})

    result = await client.lookup("testlib", "1.0.0")
    assert result["total"] == 1
    cve = result["cves"][0]
    assert cve["epss_score"] == 0.55
    assert cve["epss_percentile"] == 0.80
    assert cve["kev"] is True

    await client.close()


# ── KEV ──


@pytest.mark.asyncio
async def test_load_kev_caches():
    """TTL 내 재호출 시 캐시 사용 확인."""
    client = NvdClient(api_key="test", kev_ttl=3600)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "vulnerabilities": [{"cveID": "CVE-2021-44228"}],
    }
    client._client.get = AsyncMock(return_value=mock_resp)

    kev1 = await client._load_kev_catalog()
    kev2 = await client._load_kev_catalog()

    assert "CVE-2021-44228" in kev1
    assert kev1 is kev2  # 동일 객체 (캐시)
    assert client._client.get.call_count == 1  # 한 번만 호출

    await client.close()


@pytest.mark.asyncio
async def test_load_kev_refreshes_after_ttl():
    """TTL 만료 후 재다운로드 확인."""
    client = NvdClient(api_key="test", kev_ttl=0)  # TTL 0 = 즉시 만료

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "vulnerabilities": [{"cveID": "CVE-2021-44228"}],
    }
    client._client.get = AsyncMock(return_value=mock_resp)

    await client._load_kev_catalog()
    await client._load_kev_catalog()

    # TTL=0이므로 매번 다운로드
    assert client._client.get.call_count == 2

    await client.close()


@pytest.mark.asyncio
async def test_kev_flag_set_on_cve():
    """KEV 목록에 있는 CVE → kev=True, 없는 CVE → kev=False."""
    client = NvdClient(api_key="test", kev_ttl=3600)

    # KEV에 CVE-2021-44228만 있음
    client._kev_set = {"CVE-2021-44228"}
    client._kev_last_fetch = time.monotonic()

    kev_set = await client._load_kev_catalog()
    assert "CVE-2021-44228" in kev_set
    assert "CVE-2024-9999" not in kev_set

    await client.close()


# ── 복합 위험 점수 ──


def test_risk_score_full():
    """모든 신호가 최대일 때 → 1.0."""
    score = _compute_risk_score(severity=10.0, epss_score=1.0, kev=True, automotive_relevance=1.0)
    assert score == 1.0


def test_risk_score_severity_only():
    """CVSS만 있을 때 → 40% 가중치."""
    score = _compute_risk_score(severity=10.0, epss_score=None, kev=False, automotive_relevance=0.0)
    assert score == 0.4


def test_risk_score_kev_boost():
    """KEV 활성 공격 → 20% 부스트."""
    without_kev = _compute_risk_score(severity=5.0, epss_score=None, kev=False, automotive_relevance=0.0)
    with_kev = _compute_risk_score(severity=5.0, epss_score=None, kev=True, automotive_relevance=0.0)
    assert with_kev - without_kev == pytest.approx(0.2, abs=0.001)


def test_risk_score_none_inputs():
    """severity/epss가 None이면 해당 가중치 0."""
    score = _compute_risk_score(severity=None, epss_score=None, kev=False, automotive_relevance=0.5)
    assert score == pytest.approx(0.05, abs=0.001)


# ── KB 지식 보강 ──


def test_enrich_from_kb_with_lookup():
    """kb_lookup이 주입되면 threat_categories/attack_surfaces 반환."""
    def mock_kb_lookup(cwe_id: str) -> dict | None:
        if cwe_id == "CWE-787":
            return {
                "threat_category": "Memory Corruption",
                "attack_surfaces": ["ECU/게이트웨이", "임베디드/RTOS"],
                "automotive_relevance": 0.85,
            }
        return None

    client = NvdClient(api_key="test", kb_lookup=mock_kb_lookup)
    context = client._enrich_from_kb(["CWE-787", "CWE-999"])

    assert "Memory Corruption" in context["threat_categories"]
    assert "ECU/게이트웨이" in context["attack_surfaces"]
    assert context["max_automotive_relevance"] == 0.85


def test_enrich_from_kb_without_lookup():
    """kb_lookup이 None이면 빈 context 반환."""
    client = NvdClient(api_key="test", kb_lookup=None)
    context = client._enrich_from_kb(["CWE-787"])

    assert context["threat_categories"] == []
    assert context["attack_surfaces"] == []
    assert context["max_automotive_relevance"] == 0.0


# ── 캐시 영속화 ──


def test_cache_persistence(tmp_path):
    """캐시 저장 → 복원 라운드트립."""
    cache_file = str(tmp_path / "cache.json")

    client1 = NvdClient(api_key="test", cache_file=cache_file, cache_ttl=3600)
    client1._cache["testlib:1.0"] = (
        time.monotonic(),
        {"library": "testlib", "version": "1.0", "cves": [{"id": "CVE-2024-0001"}], "total": 1, "cached": False},
    )
    client1._save_cache_file()

    client2 = NvdClient(api_key="test", cache_file=cache_file, cache_ttl=3600)
    assert "testlib:1.0" in client2._cache
    _, data = client2._cache["testlib:1.0"]
    assert data["total"] == 1
    assert data["cves"][0]["id"] == "CVE-2024-0001"


def test_cache_persistence_expired(tmp_path):
    """TTL 초과 캐시는 복원하지 않는다."""
    import json as _json

    cache_file = str(tmp_path / "cache.json")
    with open(cache_file, "w") as f:
        _json.dump({
            "old:1.0": {"wall_ts": time.time() - 999999, "data": {"cves": [], "total": 0}},
        }, f)

    client = NvdClient(api_key="test", cache_file=cache_file, cache_ttl=3600)
    assert "old:1.0" not in client._cache
