"""NvdClient — NVD API 2.0 실시간 CVE 조회 + 버전 매칭 + 그래프 보강 + EPSS/KEV."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from app.graphrag.neo4j_graph import Neo4jGraph

logger = logging.getLogger(__name__)

_VERSION_STRIP_RE = re.compile(r"[-+].*$")
_REPO_URL_RE = re.compile(
    r"(?:github\.com|gitlab\.com|bitbucket\.org)[/:]([^/]+)/([^/.]+)",
)


def _extract_vendor_from_url(repo_url: str | None) -> str | None:
    """git repo URL에서 vendor(organization)를 추론한다.

    예: https://github.com/eclipse/mosquitto.git → "eclipse"
    """
    if not repo_url:
        return None
    m = _REPO_URL_RE.search(repo_url)
    if m:
        return m.group(1).lower()
    return None


def _parse_version(v: str) -> tuple[int, ...]:
    """버전 문자열을 비교 가능한 정수 튜플로 변환한다."""
    v = _VERSION_STRIP_RE.sub("", v.strip())
    parts = []
    for p in v.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            break
    return tuple(parts) if parts else (0,)


def _check_version_in_range(
    version: str,
    cpe_match: dict,
) -> bool | None:
    """CPE 매치 엔트리에서 버전 범위를 확인한다.

    Returns: True(범위 안), False(범위 밖), None(판정 불가)
    """
    if not cpe_match.get("vulnerable", False):
        return None

    ver = _parse_version(version)

    has_range = False

    start_inc = cpe_match.get("versionStartIncluding")
    if start_inc:
        has_range = True
        if ver < _parse_version(start_inc):
            return False

    start_exc = cpe_match.get("versionStartExcluding")
    if start_exc:
        has_range = True
        if ver <= _parse_version(start_exc):
            return False

    end_inc = cpe_match.get("versionEndIncluding")
    if end_inc:
        has_range = True
        if ver > _parse_version(end_inc):
            return False

    end_exc = cpe_match.get("versionEndExcluding")
    if end_exc:
        has_range = True
        if ver >= _parse_version(end_exc):
            return False

    if has_range:
        return True

    return None


def _build_affected_versions(cpe_match: dict) -> str:
    """CPE 매치에서 사람이 읽을 수 있는 영향 버전 문자열을 만든다."""
    parts = []
    si = cpe_match.get("versionStartIncluding")
    se = cpe_match.get("versionStartExcluding")
    ei = cpe_match.get("versionEndIncluding")
    ee = cpe_match.get("versionEndExcluding")

    if si:
        parts.append(f">= {si}")
    elif se:
        parts.append(f"> {se}")

    if ei:
        parts.append(f"<= {ei}")
    elif ee:
        parts.append(f"< {ee}")

    return ", ".join(parts) if parts else ""


def _extract_cvss(metrics: dict) -> tuple[float | None, str | None]:
    """CVSS 점수와 공격 벡터를 추출한다 (v4 > v3.1 > v3 > v2)."""
    for key in ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30"]:
        entries = metrics.get(key, [])
        if entries:
            data = entries[0].get("cvssData", {})
            return data.get("baseScore"), data.get("attackVector")

    entries = metrics.get("cvssMetricV2", [])
    if entries:
        data = entries[0].get("cvssData", {})
        return data.get("baseScore"), data.get("accessVector")

    return None, None


def _extract_cwe_ids(weaknesses: list[dict]) -> list[str]:
    """NVD weaknesses에서 CWE ID를 추출한다."""
    cwe_ids = []
    for w in weaknesses:
        for desc in w.get("description", []):
            val = desc.get("value", "")
            if val.startswith("CWE-") and val not in ("NVD-CWE-noinfo", "NVD-CWE-Other"):
                if val not in cwe_ids:
                    cwe_ids.append(val)
    return cwe_ids


class NvdClient:
    """NVD API 2.0 실시간 CVE 조회 클라이언트.

    - 라이브러리명+버전으로 CVE 검색
    - CPE 버전 범위와 대조하여 version_match 판정
    - Neo4j 그래프로 CWE → ATT&CK 관계 보강
    - EPSS 악용 확률 + CISA KEV 활성 공격 플래그
    - 인메모리 캐시 (TTL 기반)
    - asyncio.gather 기반 병렬 배치 조회
    """

    def __init__(
        self,
        api_key: str = "",
        api_base: str = "https://services.nvd.nist.gov/rest/json/cves/2.0",
        rate_delay: float = 1.0,
        cache_ttl: int = 86400,
        neo4j_graph: Neo4jGraph | None = None,
        nvd_concurrency: int = 5,
        epss_enabled: bool = True,
        kev_ttl: int = 3600,
    ) -> None:
        self._api_key = api_key
        self._api_base = api_base
        self._rate_delay = rate_delay
        self._cache_ttl = cache_ttl
        self._graph = neo4j_graph

        self._client = httpx.AsyncClient(timeout=30.0)
        self._cache: dict[str, tuple[float, dict]] = {}
        self._cache_max_size: int = 1000
        self._last_request_time: float = 0.0

        # 동시성 제어
        self._nvd_semaphore = asyncio.Semaphore(nvd_concurrency)
        self._nvd_lock = asyncio.Lock()

        # EPSS
        self._epss_enabled = epss_enabled

        # KEV
        self._kev_set: set[str] | None = None
        self._kev_last_fetch: float = 0.0
        self._kev_ttl = kev_ttl

    async def close(self) -> None:
        await self._client.aclose()

    # ── OSV.dev ──

    async def _osv_query(self, repo_url: str, commit: str) -> list[dict]:
        """OSV.dev commit 기반 조회. CVE 리스트를 반환한다."""
        try:
            resp = await self._client.post(
                "https://api.osv.dev/v1/query",
                json={
                    "commit": commit,
                    "package": {"name": repo_url, "ecosystem": "GIT"},
                },
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception as e:
            logger.warning("OSV 조회 실패: %s", e)
            return []

        cves = []
        for vuln in data.get("vulns", []):
            # CVE ID 추출 (aliases에서 CVE-XXXX 찾기)
            cve_id = vuln.get("id", "")
            aliases = vuln.get("aliases", [])
            for alias in aliases:
                if alias.startswith("CVE-"):
                    cve_id = alias
                    break

            # severity
            severity = None
            for sev in vuln.get("severity", []):
                if sev.get("type") in ("CVSS_V3", "CVSS_V4"):
                    try:
                        severity = float(sev["score"].split("/")[0])
                    except (ValueError, IndexError):
                        pass
                    break

            # CWE
            related_cwe = []
            for affected in vuln.get("affected", []):
                db_specific = affected.get("database_specific", {})
                for cwe_id in db_specific.get("cwe_ids", []):
                    if cwe_id not in related_cwe:
                        related_cwe.append(cwe_id)

            # affected_versions
            affected_versions = ""
            for affected in vuln.get("affected", []):
                versions = affected.get("versions", [])
                if versions:
                    affected_versions = f"{versions[0]} ~ {versions[-1]}" if len(versions) > 1 else versions[0]
                    break

            # Neo4j 보강
            related_attack = self._enrich_cwe_to_attack(related_cwe)

            cves.append({
                "id": cve_id,
                "title": vuln.get("summary", "")[:200],
                "description": vuln.get("details", vuln.get("summary", "")),
                "severity": severity,
                "attack_vector": None,
                "affected_versions": affected_versions,
                "version_match": True,  # commit 기반이므로 항상 정확 매칭
                "related_cwe": related_cwe,
                "related_attack": related_attack,
                "source": "osv",
            })

        return cves

    # ── Neo4j 보강 ──

    def _enrich_cwe_to_attack(self, related_cwe: list[str]) -> list[str]:
        """CWE → ATT&CK 관계를 Neo4j에서 보강한다."""
        related_attack = []
        if self._graph and related_cwe:
            for cwe_id in related_cwe[:3]:
                try:
                    related = self._graph.get_related(cwe_id)
                    if related:
                        for aid in related.get("attack", []):
                            if aid not in related_attack:
                                related_attack.append(aid)
                except Exception:
                    pass
        return related_attack

    # ── EPSS ──

    async def _enrich_epss(self, cve_ids: list[str]) -> dict[str, dict]:
        """FIRST.org EPSS API로 CVE별 악용 확률을 배치 조회한다."""
        if not cve_ids or not self._epss_enabled:
            return {}

        result: dict[str, dict] = {}
        for batch_start in range(0, len(cve_ids), 100):
            batch = cve_ids[batch_start:batch_start + 100]
            try:
                resp = await self._client.get(
                    "https://api.first.org/data/v1/epss",
                    params={"cve": ",".join(batch)},
                )
                if resp.status_code != 200:
                    logger.warning("EPSS API returned %d", resp.status_code)
                    continue
                data = resp.json()
                for entry in data.get("data", []):
                    cve_id = entry.get("cve", "")
                    if cve_id:
                        result[cve_id] = {
                            "epss": float(entry.get("epss", 0)),
                            "percentile": float(entry.get("percentile", 0)),
                        }
            except Exception as e:
                logger.warning("EPSS 조회 실패: %s", e)

        return result

    # ── KEV ──

    async def _load_kev_catalog(self) -> set[str]:
        """CISA KEV 카탈로그를 lazy-load. 메모리 캐시 + TTL."""
        now = time.monotonic()
        if self._kev_set is not None and (now - self._kev_last_fetch) < self._kev_ttl:
            return self._kev_set

        try:
            resp = await self._client.get(
                "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
            )
            resp.raise_for_status()
            data = resp.json()
            kev_set = {
                v.get("cveID", "")
                for v in data.get("vulnerabilities", [])
                if v.get("cveID")
            }
            self._kev_set = kev_set
            self._kev_last_fetch = now
            logger.info("KEV 카탈로그 로드 완료: %d건", len(kev_set))
            return kev_set
        except Exception as e:
            logger.warning("KEV 카탈로그 다운로드 실패: %s", e)
            return self._kev_set or set()

    # ── NVD ──

    async def _nvd_request(self, params: dict) -> dict | None:
        """NVD API 단일 요청 (세마포어 + rate limit + 에러 처리)."""
        async with self._nvd_semaphore:
            # rate-limit 타이밍 직렬화
            async with self._nvd_lock:
                elapsed = time.monotonic() - self._last_request_time
                if elapsed < self._rate_delay:
                    await asyncio.sleep(self._rate_delay - elapsed)
                self._last_request_time = time.monotonic()

            # HTTP 요청 (lock 해제, 세마포어 내)
            headers = {}
            if self._api_key:
                headers["apiKey"] = self._api_key

            resp = await self._client.get(
                self._api_base, params=params, headers=headers,
            )

            if resp.status_code == 429:
                logger.warning("NVD API 429 — rate limit 초과")
                return None
            resp.raise_for_status()
            return resp.json()

    async def lookup(
        self, name: str, version: str,
        repo_url: str | None = None, commit: str | None = None,
    ) -> dict:
        """단일 라이브러리의 CVE를 실시간 조회한다.

        3단계 전략:
          1. OSV.dev commit 기반 (commit + repo_url 필요) — 가장 정밀
          2. NVD CPE 기반 (repo_url에서 vendor 추론) — 정밀
          3. NVD keywordSearch 폴백 — 넓음
        + EPSS 악용 확률 + CISA KEV 플래그 보강
        """
        cache_key = f"{name.lower()}:{version}"
        now = time.monotonic()

        # 캐시 확인
        if cache_key in self._cache:
            cached_time, cached_result = self._cache[cache_key]
            if now - cached_time < self._cache_ttl:
                return {**cached_result, "cached": True}

        cves = []
        try:
            # 전략 1: OSV.dev commit 기반 (가장 정밀)
            if commit and repo_url:
                osv_cves = await self._osv_query(repo_url, commit)
                if osv_cves:
                    logger.info("OSV 조회 성공: %s@%s (%d건)", name, commit[:8], len(osv_cves))
                    cves.extend(osv_cves)

            # 전략 2+3: NVD (OSV에서 못 찾은 경우에도 보완적으로 조회)
            vendor = _extract_vendor_from_url(repo_url)
            data = None

            if vendor:
                cpe_match = f"cpe:2.3:a:{vendor}:{name.lower()}:*:*:*:*:*:*:*:*"
                data = await self._nvd_request({
                    "virtualMatchString": cpe_match,
                    "resultsPerPage": 100,
                })
                if data and data.get("totalResults", 0) > 0:
                    logger.info("NVD CPE 조회 성공: %s:%s (%d건)", vendor, name, data["totalResults"])
                else:
                    data = None  # 폴백

            # 전략 2: keywordSearch 폴백
            if data is None:
                data = await self._nvd_request({
                    "keywordSearch": name,
                    "resultsPerPage": 100,
                })

            if data is None:
                return {"library": name, "version": version, "cves": [], "total": 0, "error": "rate_limited"}

            for vuln in data.get("vulnerabilities", []):
                cve_data = vuln.get("cve", {})
                cve_id = cve_data.get("id", "")

                # description
                desc = ""
                for d in cve_data.get("descriptions", []):
                    if d.get("lang") == "en":
                        desc = d.get("value", "")
                        break

                # 라이브러리명이 설명에 없으면 무관한 CVE
                if name.lower() not in desc.lower() and name.lower() not in cve_id.lower():
                    continue

                # OSV에서 이미 찾은 CVE는 스킵 (중복 방지)
                osv_ids = {c["id"] for c in cves}
                if cve_id in osv_ids:
                    continue

                # CVSS
                metrics = cve_data.get("metrics", {})
                severity, attack_vector = _extract_cvss(metrics)

                # CWE
                related_cwe = _extract_cwe_ids(cve_data.get("weaknesses", []))

                # 버전 매칭
                version_match = None
                affected_versions = ""
                configs = cve_data.get("configurations", [])
                for config in configs:
                    for node in config.get("nodes", []):
                        for cpe_match in node.get("cpeMatch", []):
                            criteria = cpe_match.get("criteria", "")
                            # CPE에 라이브러리명 포함 여부 확인
                            if name.lower() not in criteria.lower():
                                continue

                            match_result = _check_version_in_range(version, cpe_match)
                            av = _build_affected_versions(cpe_match)

                            if match_result is True:
                                version_match = True
                                if av:
                                    affected_versions = av
                            elif match_result is False and version_match is not True:
                                version_match = False
                                if av:
                                    affected_versions = av

                # Neo4j 보강: CWE → ATT&CK 관계
                related_attack = self._enrich_cwe_to_attack(related_cwe)

                cves.append({
                    "id": cve_id,
                    "title": desc[:200] if desc else "",
                    "description": desc,
                    "severity": severity,
                    "attack_vector": attack_vector,
                    "affected_versions": affected_versions,
                    "version_match": version_match,
                    "related_cwe": related_cwe,
                    "related_attack": related_attack,
                    "source": "nvd",
                })

        except httpx.HTTPStatusError as e:
            logger.error("NVD API 오류: %s", e)
            return {"library": name, "version": version, "cves": [], "total": 0, "error": str(e)}
        except Exception as e:
            logger.error("NVD 조회 실패: %s", e)
            return {"library": name, "version": version, "cves": [], "total": 0, "error": str(e)}

        # EPSS 보강
        cve_ids = [c["id"] for c in cves if c["id"].startswith("CVE-")]
        if cve_ids:
            epss_map = await self._enrich_epss(cve_ids)
            for cve_entry in cves:
                epss_data = epss_map.get(cve_entry["id"])
                if epss_data:
                    cve_entry["epss_score"] = epss_data["epss"]
                    cve_entry["epss_percentile"] = epss_data["percentile"]
                else:
                    cve_entry["epss_score"] = None
                    cve_entry["epss_percentile"] = None
        else:
            for cve_entry in cves:
                cve_entry["epss_score"] = None
                cve_entry["epss_percentile"] = None

        # KEV 플래그
        kev_set = await self._load_kev_catalog()
        for cve_entry in cves:
            cve_entry["kev"] = cve_entry["id"] in kev_set

        # 점수순 정렬
        cves.sort(key=lambda c: c.get("severity") or 0, reverse=True)

        result = {
            "library": name,
            "version": version,
            "cves": cves,
            "total": len(cves),
            "cached": False,
        }

        # 캐시 크기 제한: 초과 시 가장 오래된 엔트리 제거
        if len(self._cache) >= self._cache_max_size:
            oldest_key = min(self._cache, key=lambda k: self._cache[k][0])
            del self._cache[oldest_key]

        self._cache[cache_key] = (time.monotonic(), result)
        return result

    async def batch_lookup(self, libraries: list[dict]) -> list[dict]:
        """여러 라이브러리의 CVE를 병렬 조회한다.

        asyncio.gather로 동시 실행, NVD 세마포어가 rate limit 자동 조절.
        """
        tasks = [
            self.lookup(
                lib["name"], lib["version"],
                repo_url=lib.get("repo_url"),
                commit=lib.get("commit"),
            )
            for lib in libraries
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        final = []
        for lib, result in zip(libraries, results):
            if isinstance(result, Exception):
                logger.error("batch_lookup 실패: %s — %s", lib["name"], result)
                final.append({
                    "library": lib["name"],
                    "version": lib["version"],
                    "cves": [],
                    "total": 0,
                    "error": str(result),
                })
            else:
                final.append(result)
        return final
