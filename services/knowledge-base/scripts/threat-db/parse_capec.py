"""
CAPEC XML 파서 -> UnifiedThreatRecord 리스트 + CapecBridge 룩업 테이블 구축
ATT&CK <-> CWE 연결의 유일한 경로 (브릿지) + 풀 노드 적재
"""
import functools
import xml.etree.ElementTree as ET
from collections import defaultdict
from schema import UnifiedThreatRecord, CapecBridge
from taxonomy import classify_attack_surfaces, compute_automotive_relevance, classify_threat_category

print = functools.partial(print, flush=True)

# CAPEC XML 네임스페이스
NS = {"capec": "http://capec.mitre.org/capec-3"}

# Typical_Severity → 수치 매핑
_SEVERITY_MAP = {
    "very high": 9.0,
    "high": 8.0,
    "medium": 5.0,
    "low": 2.0,
    "very low": 1.0,
}


def _get_text_recursive(el) -> str:
    """XML 요소에서 모든 텍스트를 재귀 추출."""
    if el is None:
        return ""
    parts = []
    if el.text:
        parts.append(el.text.strip())
    for child in el:
        parts.append(_get_text_recursive(child))
        if child.tail:
            parts.append(child.tail.strip())
    return " ".join(p for p in parts if p)


_cwe_parent_map: dict[str, str] = {}


def parse_capec(
    xml_path: str,
    cwe_parent_map: dict[str, str] | None = None,
) -> tuple[list[UnifiedThreatRecord], CapecBridge, dict]:
    """CAPEC XML을 파싱하여 (UnifiedThreatRecord 리스트, CapecBridge, 버전 메타) 반환."""
    global _cwe_parent_map
    if cwe_parent_map:
        _cwe_parent_map = cwe_parent_map
    print(f"  [CAPEC] 파싱 중...")

    tree = ET.parse(xml_path)
    root = tree.getroot()

    # 버전 메타데이터 추출
    version_meta = {
        "version": root.get("Version", "unknown"),
        "date": root.get("Date", "unknown"),
    }

    capec_to_cwe: dict[str, list[str]] = defaultdict(list)
    capec_to_attack: dict[str, list[str]] = defaultdict(list)
    attack_to_capec: dict[str, list[str]] = defaultdict(list)
    cwe_to_capec: dict[str, list[str]] = defaultdict(list)

    records: list[UnifiedThreatRecord] = []

    patterns_el = root.find("capec:Attack_Patterns", NS)
    if patterns_el is None:
        print("  [CAPEC] Attack_Patterns 요소를 찾을 수 없음")
        return [], CapecBridge()

    total = 0
    with_cwe = 0
    with_attack = 0

    for pattern in patterns_el.findall("capec:Attack_Pattern", NS):
        capec_id_num = pattern.get("ID", "")
        capec_id = f"CAPEC-{capec_id_num}"
        status = pattern.get("Status", "")
        name = pattern.get("Name", "")

        if status == "Deprecated" or status == "Obsolete":
            continue

        total += 1

        # ── 브릿지 구축 (기존 로직) ──
        rel_weaknesses = pattern.find("capec:Related_Weaknesses", NS)
        if rel_weaknesses is not None:
            for rw in rel_weaknesses.findall("capec:Related_Weakness", NS):
                cwe_id_num = rw.get("CWE_ID", "")
                if cwe_id_num:
                    cwe_id = f"CWE-{cwe_id_num}"
                    capec_to_cwe[capec_id].append(cwe_id)
                    cwe_to_capec[cwe_id].append(capec_id)
            if capec_to_cwe[capec_id]:
                with_cwe += 1

        tax_mappings = pattern.find("capec:Taxonomy_Mappings", NS)
        if tax_mappings is not None:
            for tm in tax_mappings.findall("capec:Taxonomy_Mapping", NS):
                tax_name = tm.get("Taxonomy_Name", "")
                if "ATT&CK" in tax_name or "ATTACK" in tax_name.upper():
                    entry_id_el = tm.find("capec:Entry_ID", NS)
                    if entry_id_el is not None and entry_id_el.text:
                        raw_id = entry_id_el.text.strip()
                        attack_id = raw_id if raw_id.startswith("T") else f"T{raw_id}"
                        capec_to_attack[capec_id].append(attack_id)
                        attack_to_capec[attack_id].append(capec_id)
            if capec_to_attack[capec_id]:
                with_attack += 1

        # ── UnifiedThreatRecord 생성 (신규) ──
        desc_el = pattern.find("capec:Description", NS)
        description = _get_text_recursive(desc_el)

        # severity
        severity_el = pattern.find("capec:Typical_Severity", NS)
        severity = None
        if severity_el is not None and severity_el.text:
            severity = _SEVERITY_MAP.get(severity_el.text.strip().lower())

        # attack_surfaces, relevance
        full_text = f"{name} {description}"
        attack_surfaces = classify_attack_surfaces(full_text)
        relevance = compute_automotive_relevance(name, description)

        # threat_category: 첫 번째 관련 CWE 기반 (parent_map으로 계층 탐색)
        related_cwe_ids = capec_to_cwe.get(capec_id, [])
        threat_category = "Attack Pattern"
        for cid in related_cwe_ids:
            cat = classify_threat_category(cid, _cwe_parent_map)
            if cat != "Other":
                threat_category = cat
                break

        # mitigations
        mitigations = []
        mit_el = pattern.find("capec:Mitigations", NS)
        if mit_el is not None:
            for m in mit_el.findall("capec:Mitigation", NS):
                mit_text = _get_text_recursive(m)
                if mit_text:
                    mitigations.append(mit_text[:300])

        record = UnifiedThreatRecord(
            id=capec_id,
            source="CAPEC",
            title=name,
            description=description,
            severity=severity,
            attack_surfaces=attack_surfaces,
            threat_category=threat_category,
            related_cwe=list(related_cwe_ids),
            related_attack=list(capec_to_attack.get(capec_id, [])),
            mitigations=mitigations[:5],
            automotive_relevance=relevance,
        )
        records.append(record)

    bridge = CapecBridge(
        capec_to_cwe=dict(capec_to_cwe),
        capec_to_attack=dict(capec_to_attack),
        attack_to_capec=dict(attack_to_capec),
        cwe_to_capec=dict(cwe_to_capec),
    )

    print(f"  [CAPEC] 완료: {total}개 패턴, CWE 매핑 {with_cwe}개({with_cwe*100//max(total,1)}%), ATT&CK 매핑 {with_attack}개({with_attack*100//max(total,1)}%)")

    bridgeable = 0
    for attack_id, capec_ids in attack_to_capec.items():
        for cid in capec_ids:
            if cid in capec_to_cwe:
                bridgeable += 1
                break
    print(f"  [CAPEC] ATT&CK->CWE 브릿지 가능: {bridgeable}개 기법")
    print(f"  [CAPEC] 노드 생성: {len(records)}개 레코드 (v{version_meta['version']})")

    version_meta["count"] = len(records)
    return records, bridge, version_meta
