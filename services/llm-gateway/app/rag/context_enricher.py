"""TaskRequest에서 검색 쿼리를 추출하고 RAG 컨텍스트를 조립한다."""
from __future__ import annotations

import logging
import re

from app.rag.threat_search import ThreatHit, ThreatSearch
from app.schemas.request import TaskRequest
from app.types import TaskType

logger = logging.getLogger(__name__)

# 소스코드에서 보안 관련 키워드를 추출하기 위한 패턴
_SECURITY_KW_RE = re.compile(
    r"\b(?:"
    # 메모리 취약점
    r"buffer\s*overflow|stack\s*overflow|heap\s*overflow|"
    r"use.after.free|double.free|null.pointer|dangling\s*pointer|"
    r"format\s*string|integer\s*overflow|integer\s*underflow|"
    r"out.of.bounds|uninitialized|memory\s*leak|"
    # 위험 함수
    r"memcpy|strcpy|strncpy|strcat|sprintf|snprintf|gets|scanf|sscanf|"
    r"malloc|calloc|free|realloc|alloca|"
    r"system|popen|exec[lv]p?|"
    # 웹/인젝션
    r"injection|XSS|CSRF|SSRF|SQL|command\s*injection|"
    # 차량 프로토콜/하드웨어
    r"CAN|CAN\s*bus|UDS|OBD|OBD-?II|DoIP|ISO\s*14229|ISO\s*11898|"
    r"ECU|TCU|BCM|GW|gateway|telematics|infotainment|"
    r"JTAG|SWD|SPI|UART|I2C|LIN|FlexRay|Ethernet|"
    # 보안 기능
    r"authentication|authorization|access\s*control|privilege|"
    r"crypto|encrypt|decrypt|AES|RSA|SHA|HMAC|hash|"
    r"certificate|TLS|SSL|key\s*exchange|random|seed|nonce|"
    # 펌웨어/부트
    r"firmware|bootloader|flash|EEPROM|OTA|secure\s*boot|"
    r"AUTOSAR|MISRA|RTOS|watchdog|"
    # 공격 기법
    r"fuzzing|replay|spoofing|dos|denial.of.service|"
    r"race\s*condition|TOCTOU|deadlock"
    r")\b",
    re.IGNORECASE,
)


class ContextEnricher:
    """TaskRequest에서 검색 쿼리를 추출하고 RAG 컨텍스트를 조립한다."""

    def __init__(self, threat_search: ThreatSearch) -> None:
        self._search = threat_search

    def enrich(self, request: TaskRequest, top_k: int = 5) -> tuple[str, int]:
        """요청에서 쿼리 추출 -> 검색 -> (포맷된 컨텍스트, hit 수) 반환."""
        query = self._extract_query(request)
        if not query:
            return "", 0
        hits = self._search.search(query, top_k=top_k)
        if not hits:
            return "", 0
        logger.info(
            "[%s] RAG 검색: query='%s', hits=%d",
            request.taskType, query[:80], len(hits),
        )
        return self._format_hits(hits), len(hits)

    def _extract_query(self, request: TaskRequest) -> str:
        """task type별 검색 쿼리 추출 전략."""
        trusted = request.context.trusted

        if request.taskType == TaskType.STATIC_EXPLAIN:
            query = self._extract_static_explain(trusted)
            if not query:
                # 최종 fallback: untrusted 소스코드에서 보안 키워드 추출
                query = self._extract_from_source(request)
            return query

        if request.taskType == TaskType.DYNAMIC_ANNOTATE:
            rule_matches = trusted.get("ruleMatches", [])
            titles = []
            for rm in rule_matches[:5]:
                if isinstance(rm, dict) and rm.get("title"):
                    titles.append(rm["title"])
            return " ".join(titles) if titles else ""

        if request.taskType == TaskType.TEST_PLAN_PROPOSE:
            objective = trusted.get("objective", "")
            protocol = trusted.get("targetProtocol", "")
            return f"{objective} {protocol}".strip()

        if request.taskType == TaskType.STATIC_CLUSTER:
            findings = trusted.get("findings", [])
            titles = []
            for f in findings[:10]:
                if isinstance(f, dict) and f.get("title"):
                    titles.append(f["title"])
            return " ".join(titles) if titles else ""

        if request.taskType == TaskType.REPORT_DRAFT:
            findings = trusted.get("confirmedFindings", trusted.get("findings", []))
            titles = []
            for f in findings[:10]:
                if isinstance(f, dict) and f.get("title"):
                    titles.append(f["title"])
            return " ".join(titles) if titles else ""

        return ""

    def _extract_static_explain(self, trusted: dict) -> str:
        """static-explain: finding 또는 ruleMatches에서 쿼리 추출."""
        # 1순위: finding 단일 객체
        finding = trusted.get("finding", {})
        if finding:
            parts = []
            if finding.get("title"):
                parts.append(finding["title"])
            if finding.get("ruleId"):
                parts.append(finding["ruleId"])
            if finding.get("description"):
                parts.append(finding["description"][:200])
            if parts:
                return " ".join(parts)

        # 2순위: ruleMatches 배열 (S2 어댑터 포맷)
        rule_matches = trusted.get("ruleMatches", [])
        if rule_matches:
            parts = []
            for rm in rule_matches[:5]:
                if isinstance(rm, dict):
                    if rm.get("title"):
                        parts.append(rm["title"])
                    if rm.get("ruleId"):
                        parts.append(rm["ruleId"])
            if parts:
                return " ".join(parts)

        return ""

    def _extract_from_source(self, request: TaskRequest) -> str:
        """untrusted 소스코드에서 보안 관련 키워드를 추출 (최종 fallback)."""
        untrusted = request.context.untrusted or {}
        source = untrusted.get("sourceCode", untrusted.get("sourceSnippet", ""))
        if not source:
            return ""
        # 보안 키워드 매칭
        matches = _SECURITY_KW_RE.findall(source)
        if not matches:
            return ""
        # 중복 제거 + 상위 10개
        seen: set[str] = set()
        unique: list[str] = []
        for m in matches:
            low = m.lower()
            if low not in seen:
                seen.add(low)
                unique.append(m)
            if len(unique) >= 10:
                break
        query = " ".join(unique)
        logger.info("[RAG] source fallback: extracted %d keywords -> '%s'", len(unique), query[:80])
        return query

    def _format_hits(self, hits: list[ThreatHit]) -> str:
        """검색 결과를 프롬프트 삽입용 텍스트로 포맷."""
        lines = []
        for hit in hits:
            # 헤더: [소스/ID] 제목 | 카테고리
            header = f"[{hit.source}/{hit.id}] {hit.title}"
            if hit.threat_category:
                header += f" | {hit.threat_category}"
            if hit.severity is not None:
                header += f" | CVSS {hit.severity}"

            lines.append(header)

            # 교차참조
            xrefs = []
            if hit.related_cwe:
                xrefs.extend(hit.related_cwe[:3])
            if hit.related_cve:
                xrefs.extend(hit.related_cve[:3])
            if hit.related_attack:
                xrefs.extend(hit.related_attack[:3])
            if xrefs:
                lines.append(f"  교차참조: {', '.join(xrefs)}")

            # 공격 표면
            if hit.attack_surfaces:
                lines.append(f"  공격 표면: {', '.join(hit.attack_surfaces[:3])}")

            lines.append("")  # 빈 줄 구분

        return "\n".join(lines).strip()
