"""정적 분석 Mock — 룰 기반 심층 분석 + 키워드 스캔."""

from __future__ import annotations

import re

from app.data.static_templates import (
    COMPOUND_PATTERNS,
    DEEP_ANALYSIS_TEMPLATES,
    KEYWORD_SEARCH,
)
from app.models.analysis import AnalysisResult
from app.models.vulnerability import VulnerabilityData


def analyze_static(content: str) -> AnalysisResult:
    """정적 분석 Mock. ruleResults 기반 심층 분석 + 복합 취약점."""
    rule_items = _parse_rule_context(content)
    source = _extract_source_section(content)

    if rule_items:
        vulns = _analyze_from_rules(rule_items)
        detected_kws = {kw for _, _, _, kw in rule_items if kw}
        vulns.extend(_detect_compound_vulns(detected_kws, rule_items))
        return AnalysisResult(vulnerabilities=vulns)

    return _keyword_scan(source)


def _parse_rule_context(
    content: str,
) -> list[tuple[str, str, str, str | None]]:
    """[컨텍스트] 섹션에서 룰 결과를 파싱한다.
    Returns: [(title, severity, location, matched_keyword), ...]
    """
    end = content.find("[분석 대상]")
    context = content[:end] if end != -1 else ""

    results: list[tuple[str, str, str, str | None]] = []
    for m in re.finditer(r"- \S+:\s+(.+?)\s+\[(\w+)\]\s+\((.+)\)", context):
        title = m.group(1)
        severity = m.group(2).lower()
        location = m.group(3)
        keyword = _match_template_keyword(title)
        results.append((title, severity, location, keyword))

    return results


def _match_template_keyword(title: str) -> str | None:
    """룰 title에서 DEEP_ANALYSIS_TEMPLATES 키워드를 매칭한다."""
    title_lower = title.lower()
    for keyword in DEEP_ANALYSIS_TEMPLATES:
        if keyword in title_lower:
            return keyword
    return None


def _analyze_from_rules(
    rule_items: list[tuple[str, str, str, str | None]],
) -> list[VulnerabilityData]:
    """각 룰 결과에 대해 심층 분석 템플릿을 적용한다."""
    vulns: list[VulnerabilityData] = []
    for title, severity, location, keyword in rule_items:
        if keyword and keyword in DEEP_ANALYSIS_TEMPLATES:
            tmpl = DEEP_ANALYSIS_TEMPLATES[keyword]
            vulns.append(VulnerabilityData(
                severity=tmpl["severity"],
                title=tmpl["title"],
                description=tmpl["description"].format(location=location),
                location=location,
                suggestion=tmpl["suggestion"],
                fix_code=tmpl.get("fixCode"),
            ))
        else:
            vulns.append(VulnerabilityData(
                severity=severity,
                title=f"{title} - 심층 분석",
                description=(
                    f"{location}에서 탐지된 '{title}' 항목에 대한 심층 분석입니다. "
                    "해당 패턴은 보안 취약점으로 이어질 수 있으므로 코드 수정을 권장합니다."
                ),
                location=location,
                suggestion="해당 코드를 안전한 대안으로 교체하고, 입력 검증을 추가하세요.",
                fix_code=None,
            ))
    return vulns


def _detect_compound_vulns(
    detected_keywords: set[str],
    rule_items: list[tuple[str, str, str, str | None]],
) -> list[VulnerabilityData]:
    """복합 취약점(연쇄 공격 패턴)을 탐지한다."""
    vulns: list[VulnerabilityData] = []
    for pattern in COMPOUND_PATTERNS:
        required = pattern["requires"]
        if all(kw in detected_keywords for kw in required):
            locations = sorted({
                loc for _, _, loc, kw in rule_items if kw in required
            })
            vulns.append(VulnerabilityData(
                severity=pattern["severity"],
                title=pattern["title"],
                description=pattern["description"],
                location=", ".join(locations) if locations else None,
                suggestion=pattern["suggestion"],
                fix_code=None,
            ))
    return vulns


def _keyword_scan(source: str) -> AnalysisResult:
    """소스코드 키워드 검색 (ruleResults 없을 때 fallback)."""
    vulns: list[VulnerabilityData] = []
    for keyword, search_keys in KEYWORD_SEARCH.items():
        for sk in search_keys:
            if sk in source:
                tmpl = DEEP_ANALYSIS_TEMPLATES[keyword]
                location = _find_line_in_source(source, sk) or "소스코드"
                vulns.append(VulnerabilityData(
                    severity=tmpl["severity"],
                    title=tmpl["title"],
                    description=tmpl["description"].format(location=location),
                    location=location,
                    suggestion=tmpl["suggestion"],
                    fix_code=tmpl.get("fixCode"),
                ))
                break

    if not vulns:
        return AnalysisResult(
            note="소스코드에서 알려진 취약 패턴이 발견되지 않았습니다. "
                 "MISRA C, CERT C 등 코딩 표준 기반 수동 코드 리뷰를 권장합니다.",
        )

    return AnalysisResult(vulnerabilities=vulns)


def _extract_source_section(content: str) -> str:
    """프롬프트에서 [분석 대상] 이후의 소스코드 영역만 추출한다."""
    marker = "[분석 대상]"
    idx = content.find(marker)
    if idx == -1:
        return content
    after = content[idx + len(marker):]
    end = after.find("[출력 형식]")
    if end != -1:
        after = after[:end]
    return after


def _find_line_in_source(source: str, keyword: str) -> str | None:
    """소스코드에서 키워드 위치를 filename:line 형식으로 반환한다."""
    lines = source.split("\n")
    current_file = ""
    file_line = 0
    for line in lines:
        m = re.match(r"//\s*===\s*(.+?)\s*===", line)
        if m:
            current_file = m.group(1).strip()
            file_line = 0
            continue
        file_line += 1
        if keyword in line:
            if current_file:
                return f"{current_file}:{file_line}"
            return f"line:{file_line}"
    return None
