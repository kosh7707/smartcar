"""
CWE XML 파서 -> UnifiedThreatRecord 변환
CWE 계층 구조(ChildOf) 추출 + 임베딩 유사도 기반 분류
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


def _build_parent_map(weaknesses_el) -> dict[str, str]:
    """CWE XML에서 ChildOf 관계를 추출하여 parent_map을 구축한다.

    반환: {CWE-787: "CWE-119", CWE-119: "CWE-118", ...}
    같은 CWE에 여러 View의 ChildOf가 있으면 첫 번째(가장 작은 ID)를 사용.
    """
    parent_map: dict[str, str] = {}

    for weakness in weaknesses_el.findall("cwe:Weakness", NS):
        cwe_id = f"CWE-{weakness.get('ID', '')}"
        if weakness.get("Status") == "Deprecated":
            continue

        rel_container = weakness.find("cwe:Related_Weaknesses", NS)
        if rel_container is None:
            continue

        parents: set[str] = set()
        for rel in rel_container.findall("cwe:Related_Weakness", NS):
            if rel.get("Nature") == "ChildOf":
                rel_id = rel.get("CWE_ID", "")
                if rel_id:
                    parents.add(f"CWE-{rel_id}")

        if parents:
            parent_map[cwe_id] = sorted(parents)[0]

    return parent_map


def parse_cwe(xml_path: str) -> tuple[list[UnifiedThreatRecord], dict, dict[str, str]]:
    """CWE XML 파일을 파싱하여 (records, version_meta, parent_map) 반환."""
    print(f"  [CWE] 파싱 중...")

    tree = ET.parse(xml_path)
    root = tree.getroot()

    version_meta = {
        "version": root.get("Version", "unknown"),
        "date": root.get("Date", "unknown"),
    }

    weaknesses_el = root.find("cwe:Weaknesses", NS)
    if weaknesses_el is None:
        print("  [CWE] Weaknesses 요소를 찾을 수 없음")
        return [], version_meta, {}

    # 1차 패스: ChildOf 부모 맵 구축
    parent_map = _build_parent_map(weaknesses_el)

    # 2차 패스: 레코드 생성
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

        # related_cwe: 중복 제거 (View_ID 무관하게 unique ID만)
        related_cwe: list[str] = []
        seen_ids: set[str] = set()
        rel_container = weakness.find("cwe:Related_Weaknesses", NS)
        if rel_container is not None:
            for rel in rel_container.findall("cwe:Related_Weakness", NS):
                rel_id = rel.get("CWE_ID", "")
                if rel_id:
                    full_id = f"CWE-{rel_id}"
                    if full_id not in seen_ids:
                        seen_ids.add(full_id)
                        related_cwe.append(full_id)

        full_text = f"{name} {description}"
        attack_surfaces = classify_attack_surfaces(full_text)
        relevance = compute_automotive_relevance(name, description)
        category = classify_threat_category(cwe_id, parent_map)

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
    other_count = sum(1 for r in records if r.threat_category == "Other")
    print(f"  [CWE] 완료: {len(records)}개 약점, 자동차 관련 {auto_count}개, "
          f"카테고리 분류 {len(records) - other_count}/{len(records)} "
          f"(v{version_meta['version']})")

    version_meta["count"] = len(records)
    return records, version_meta, parent_map
