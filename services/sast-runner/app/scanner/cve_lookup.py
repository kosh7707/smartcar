"""CVE 조회 — NVD/OSV API 기반 라이브러리 취약점 검색."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger("s4-sast-runner")

# OSV.dev API (Google, 무료, 빠름)
OSV_API = "https://api.osv.dev/v1/query"

# NVD API (NIST, 무료, 느릴 수 있음)
NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"


class CveLookup:
    """라이브러리 이름+버전으로 알려진 CVE를 조회한다."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=15.0)

    async def lookup(
        self,
        name: str,
        version: str | None = None,
        commit: str | None = None,
    ) -> list[dict[str, Any]]:
        """라이브러리의 알려진 CVE를 조회.

        OSV → NVD 순으로 시도. 둘 다 실패하면 빈 리스트.

        Returns:
            [{ "id": "CVE-2024-...", "severity": "HIGH",
               "summary": "...", "fixedIn": "2.0.19", "source": "osv" }, ...]
        """
        cves: list[dict[str, Any]] = []

        # 1. OSV.dev (빠르고 정확)
        osv_results = await self._query_osv(name, version, commit)
        cves.extend(osv_results)

        # 2. OSV에서 못 찾으면 NVD
        if not cves:
            nvd_results = await self._query_nvd(name, version)
            cves.extend(nvd_results)

        # 중복 제거
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for cve in cves:
            if cve["id"] not in seen:
                seen.add(cve["id"])
                unique.append(cve)

        logger.info("CVE lookup: %s %s → %d CVEs", name, version or commit or "?", len(unique))
        return unique

    async def _query_osv(
        self,
        name: str,
        version: str | None,
        commit: str | None,
    ) -> list[dict[str, Any]]:
        """OSV.dev API 조회."""
        # OSV는 ecosystem 기반 — C/C++은 "OSS-Fuzz" 또는 패키지명 직접
        payload: dict[str, Any] = {}

        if commit:
            payload["commit"] = commit
        elif version:
            payload["version"] = version
            payload["package"] = {"name": name, "ecosystem": "OSS-Fuzz"}
        else:
            # 이름만으로 검색
            payload["package"] = {"name": name, "ecosystem": "OSS-Fuzz"}

        try:
            resp = await self._client.post(OSV_API, json=payload)
            if resp.status_code != 200:
                # ecosystem이 안 맞으면 이름만으로 재시도
                payload2 = {"package": {"name": name}}
                if version:
                    payload2["version"] = version
                resp = await self._client.post(OSV_API, json=payload2)

            if resp.status_code != 200:
                return []

            data = resp.json()
            vulns = data.get("vulns", [])
            return [self._parse_osv_vuln(v) for v in vulns]

        except Exception as e:
            logger.warning("OSV lookup failed for %s: %s", name, e)
            return []

    async def _query_nvd(
        self,
        name: str,
        version: str | None,
    ) -> list[dict[str, Any]]:
        """NVD API 조회."""
        params: dict[str, str] = {
            "keywordSearch": name,
            "resultsPerPage": "20",
        }

        try:
            resp = await self._client.get(NVD_API, params=params)
            if resp.status_code != 200:
                return []

            data = resp.json()
            vulns = data.get("vulnerabilities", [])
            results: list[dict[str, Any]] = []

            for vuln_wrapper in vulns:
                cve_data = vuln_wrapper.get("cve", {})
                parsed = self._parse_nvd_cve(cve_data, name, version)
                if parsed:
                    results.append(parsed)

            return results

        except Exception as e:
            logger.warning("NVD lookup failed for %s: %s", name, e)
            return []

    def _parse_osv_vuln(self, vuln: dict) -> dict[str, Any]:
        """OSV 취약점 → 표준 형식."""
        aliases = vuln.get("aliases", [])
        cve_id = next((a for a in aliases if a.startswith("CVE-")), vuln.get("id", ""))

        severity = "UNKNOWN"
        for s in vuln.get("severity", []):
            if s.get("type") == "CVSS_V3":
                score = s.get("score", "")
                # CVSS 점수에서 severity 추론
                if ":" in score:
                    try:
                        base = float(score.split("/")[0].split(":")[-1])
                        if base >= 9.0:
                            severity = "CRITICAL"
                        elif base >= 7.0:
                            severity = "HIGH"
                        elif base >= 4.0:
                            severity = "MEDIUM"
                        else:
                            severity = "LOW"
                    except (ValueError, IndexError):
                        pass

        # fixed 버전 추출
        fixed_in = None
        for affected in vuln.get("affected", []):
            for r in affected.get("ranges", []):
                for event in r.get("events", []):
                    if "fixed" in event:
                        fixed_in = event["fixed"]

        return {
            "id": cve_id or vuln.get("id", ""),
            "severity": severity,
            "summary": vuln.get("summary", "")[:200],
            "fixedIn": fixed_in,
            "source": "osv",
            "url": f"https://osv.dev/vulnerability/{vuln.get('id', '')}",
        }

    def _parse_nvd_cve(
        self,
        cve: dict,
        lib_name: str,
        lib_version: str | None,
    ) -> dict[str, Any] | None:
        """NVD CVE → 표준 형식. 라이브러리명이 description에 포함된 것만."""
        cve_id = cve.get("id", "")
        descriptions = cve.get("descriptions", [])
        desc_en = next(
            (d["value"] for d in descriptions if d.get("lang") == "en"),
            "",
        )

        # 라이브러리명이 description에 포함되는지 확인
        if lib_name.lower() not in desc_en.lower():
            return None

        # severity 추출
        severity = "UNKNOWN"
        metrics = cve.get("metrics", {})
        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            metric_list = metrics.get(key, [])
            if metric_list:
                severity = metric_list[0].get("cvssData", {}).get("baseSeverity", "UNKNOWN")
                break

        return {
            "id": cve_id,
            "severity": severity,
            "summary": desc_en[:200],
            "fixedIn": None,
            "source": "nvd",
            "url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
        }
