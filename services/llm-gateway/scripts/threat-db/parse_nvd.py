"""
NVD CVE JSON 2.0 파서 -> UnifiedThreatRecord 변환
"""
import json
from schema import UnifiedThreatRecord
from taxonomy import classify_attack_surfaces, compute_automotive_relevance, classify_threat_category


def _extract_cvss(metrics: dict) -> tuple[float | None, str | None]:
    """CVSS 점수 + 공격 벡터 추출 (v4 > v3.1 > v3.0 > v2 우선순위)"""
    for key in ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30"]:
        if key in metrics and metrics[key]:
            data = metrics[key][0].get("cvssData", {})
            score = data.get("baseScore")
            vector = data.get("attackVector")
            return score, vector

    if "cvssMetricV2" in metrics and metrics["cvssMetricV2"]:
        data = metrics["cvssMetricV2"][0].get("cvssData", {})
        score = data.get("baseScore")
        vector = data.get("accessVector")
        return score, vector

    return None, None


def _extract_cwe_ids(weaknesses: list) -> list[str]:
    """NVD weaknesses 필드에서 CWE ID 추출"""
    cwe_ids = []
    for w in weaknesses:
        for desc in w.get("description", []):
            val = desc.get("value", "")
            if val.startswith("CWE-") and val != "NVD-CWE-noinfo" and val != "NVD-CWE-Other":
                cwe_ids.append(val)
    return cwe_ids


def parse_nvd(json_path: str) -> list[UnifiedThreatRecord]:
    """NVD JSON 파일을 파싱하여 UnifiedThreatRecord 리스트 반환"""
    print(f"  [NVD] 파싱 중...")

    with open(json_path) as f:
        data = json.load(f)

    vulns = data.get("vulnerabilities", [])
    records = []

    for entry in vulns:
        cve = entry.get("cve", {})
        cve_id = cve.get("id", "")

        descriptions = cve.get("descriptions", [])
        en_desc = ""
        for d in descriptions:
            if d.get("lang") == "en":
                en_desc = d.get("value", "")
                break
        if not en_desc and descriptions:
            en_desc = descriptions[0].get("value", "")

        metrics = cve.get("metrics", {})
        severity, attack_vector = _extract_cvss(metrics)

        weaknesses = cve.get("weaknesses", [])
        related_cwe = _extract_cwe_ids(weaknesses)

        category = ""
        if related_cwe:
            category = classify_threat_category(related_cwe[0])

        attack_surfaces = classify_attack_surfaces(en_desc)
        relevance = compute_automotive_relevance(cve_id, en_desc)

        last_modified = cve.get("lastModified", "")

        record = UnifiedThreatRecord(
            id=cve_id,
            source="CVE",
            title=cve_id,
            description=en_desc,
            severity=severity,
            attack_vector=attack_vector,
            attack_surfaces=attack_surfaces,
            threat_category=category,
            related_cwe=related_cwe,
            automotive_relevance=relevance,
            last_updated=last_modified,
        )
        records.append(record)

    auto_count = sum(1 for r in records if r.automotive_relevance >= 0.2)
    with_cwe = sum(1 for r in records if r.related_cwe)
    print(f"  [NVD] 완료: {len(records)}개 CVE, 자동차 관련 {auto_count}개, CWE 매핑 {with_cwe*100//max(len(records),1)}%")
    return records
