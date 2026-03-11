from __future__ import annotations

import json
from dataclasses import dataclass

from app.models.severity import Severity
from app.schemas.response import VulnerabilityItem

VALID_SEVERITIES = set(Severity)

SEVERITY_ALIASES: dict[str, str] = {
    "crit": "critical",
    "med": "medium",
}


@dataclass
class ParseResult:
    vulnerabilities: list[VulnerabilityItem]
    note: str | None = None
    error: str | None = None


class ResponseParser:
    """LLM 원시 응답(JSON 텍스트)을 구조화된 VulnerabilityItem 리스트로 변환한다."""

    def parse(self, raw: str) -> ParseResult:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return ParseResult(vulnerabilities=[], error=self._make_parse_error(raw))

        raw_vulns = data.get("vulnerabilities", [])
        if not isinstance(raw_vulns, list):
            return ParseResult(vulnerabilities=[], error=self._make_parse_error(raw))

        vulns = [self._normalize(v) for v in raw_vulns if isinstance(v, dict)]
        note = data.get("note")
        return ParseResult(vulnerabilities=vulns, note=note)

    def _normalize(self, v: dict) -> VulnerabilityItem:
        severity = str(v.get("severity", "medium")).lower().strip()
        severity = SEVERITY_ALIASES.get(severity, severity)
        if severity not in VALID_SEVERITIES:
            severity = "medium"

        location = v.get("location")
        if location is not None and not str(location).strip():
            location = None

        return VulnerabilityItem(
            severity=severity,
            title=v.get("title", "Unknown Vulnerability"),
            description=v.get("description", ""),
            location=location,
            suggestion=v.get("suggestion", ""),
            fixCode=v.get("fixCode"),
        )

    @staticmethod
    def _make_parse_error(raw: str) -> str:
        """JSON 파싱 실패 시 error 메시지를 생성한다."""
        preview = raw[:200].replace("\n", " ")
        return f"LLM 응답 JSON 파싱 실패 (응답 미리보기: {preview})"
