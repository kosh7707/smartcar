"""동적 테스트 Mock — 침투 테스트 결과 분석."""

from __future__ import annotations

import re

from app.data.testing_templates import TESTING_ANALYSIS_TEMPLATES
from app.models.analysis import AnalysisResult
from app.models.vulnerability import VulnerabilityData


def analyze_testing(content: str) -> AnalysisResult:
    """동적 테스트 결과에 대한 Mock 분석 응답. ruleResults 기반."""
    rule_items = _parse_testing_context(content)

    if not rule_items:
        return AnalysisResult(
            note="제출된 테스트 결과에서 추가 분석이 필요한 항목이 발견되지 않았습니다. "
                 "경계값, 시나리오 기반 전략으로 추가 테스트를 수행하세요.",
        )

    vulns: list[VulnerabilityData] = []
    for title, severity, location, finding_type in rule_items:
        tmpl = TESTING_ANALYSIS_TEMPLATES.get(finding_type)
        if tmpl:
            vulns.append(VulnerabilityData(
                severity=tmpl["severity"],
                title=tmpl["title"],
                description=tmpl["description"],
                location=location,
                suggestion=tmpl["suggestion"],
                fix_code=None,
            ))
        else:
            vulns.append(VulnerabilityData(
                severity=severity,
                title=f"{title} - 심층 분석",
                description=(
                    f"{location}에서 발견된 사항에 대한 심층 분석입니다. "
                    "ECU 펌웨어의 입력 검증과 예외 처리를 점검하세요."
                ),
                location=location,
                suggestion="ECU 펌웨어의 입력 검증과 예외 처리를 강화하세요.",
                fix_code=None,
            ))

    return AnalysisResult(vulnerabilities=vulns)


def _parse_testing_context(
    content: str,
) -> list[tuple[str, str, str, str]]:
    """동적 테스트 [컨텍스트]에서 finding 유형을 파싱한다."""
    end = content.find("[분석 대상")
    context = content[:end] if end != -1 else ""

    results: list[tuple[str, str, str, str]] = []
    for m in re.finditer(r"- \S+:\s+(.+?)\s+\[(\w+)\]\s+\((.+)\)", context):
        title = m.group(1)
        severity = m.group(2).lower()
        location = m.group(3)

        title_lower = title.lower()
        if "크래시" in title_lower or "crash" in title_lower:
            ftype = "crash"
        elif any(k in title_lower for k in ("프로토콜", "anomaly", "비정상")):
            ftype = "anomaly"
        elif any(k in title_lower for k in ("타임아웃", "timeout", "지연")):
            ftype = "timeout"
        else:
            ftype = "unknown"

        results.append((title, severity, location, ftype))

    return results
