"""
CWE XML 파서 -> UnifiedThreatRecord 변환
"""
import xml.etree.ElementTree as ET
from schema import UnifiedThreatRecord
from taxonomy import classify_attack_surfaces, compute_automotive_relevance, classify_threat_category

# CWE XML 네임스페이스
NS = {"cwe": "http://cwe.mitre.org/cwe-7"}


def _get_text_recursive(el) -> str:
    """요소 내 모든 텍스트를 재귀적으로 추출"""
    texts = []
    if el.text:
        texts.append(el.text.strip())
    for child in el:
        texts.append(_get_text_recursive(child))
        if child.tail:
            texts.append(child.tail.strip())
    return " ".join(t for t in texts if t)


def parse_cwe(xml_path: str) -> list[UnifiedThreatRecord]:
    """CWE XML 파일을 파싱하여 UnifiedThreatRecord 리스트 반환"""
    print(f"  [CWE] 파싱 중...")

    tree = ET.parse(xml_path)
    root = tree.getroot()

    weaknesses_el = root.find("cwe:Weaknesses", NS)
    if weaknesses_el is None:
        print("  [CWE] Weaknesses 요소를 찾을 수 없음")
        return []

    records = []
    for weakness in weaknesses_el.findall("cwe:Weakness", NS):
        cwe_id_num = weakness.get("ID", "")
        cwe_id = f"CWE-{cwe_id_num}"
        name = weakness.get("Name", "")
        status = weakness.get("Status", "")

        if status == "Deprecated":
            continue

        desc_el = weakness.find("cwe:Description", NS)
        description = _get_text_recursive(desc_el) if desc_el is not None else ""

        ext_desc_el = weakness.find("cwe:Extended_Description", NS)
        if ext_desc_el is not None:
            ext_text = _get_text_recursive(ext_desc_el)
            if ext_text:
                description = f"{description} {ext_text}"

        mitigations = []
        mit_container = weakness.find("cwe:Potential_Mitigations", NS)
        if mit_container is not None:
            for mit in mit_container.findall("cwe:Mitigation", NS):
                mit_desc = mit.find("cwe:Description", NS)
                if mit_desc is not None:
                    mit_text = _get_text_recursive(mit_desc)
                    if mit_text:
                        mitigations.append(mit_text)

        related_cwe = []
        rel_container = weakness.find("cwe:Related_Weaknesses", NS)
        if rel_container is not None:
            for rel in rel_container.findall("cwe:Related_Weakness", NS):
                rel_id = rel.get("CWE_ID", "")
                if rel_id:
                    related_cwe.append(f"CWE-{rel_id}")

        full_text = f"{name} {description}"
        attack_surfaces = classify_attack_surfaces(full_text)
        relevance = compute_automotive_relevance(name, description)
        category = classify_threat_category(cwe_id)

        record = UnifiedThreatRecord(
            id=cwe_id,
            source="CWE",
            title=name,
            description=description,
            attack_surfaces=attack_surfaces,
            threat_category=category,
            mitigations=mitigations,
            related_cwe=related_cwe,
            automotive_relevance=relevance,
        )
        records.append(record)

    auto_count = sum(1 for r in records if r.automotive_relevance >= 0.2)
    print(f"  [CWE] 완료: {len(records)}개 약점, 자동차 관련 {auto_count}개")
    return records
