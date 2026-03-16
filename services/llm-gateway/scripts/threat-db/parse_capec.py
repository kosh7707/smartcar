"""
CAPEC XML 파서 -> CapecBridge 룩업 테이블 구축
ATT&CK <-> CWE 연결의 유일한 경로
"""
import xml.etree.ElementTree as ET
from collections import defaultdict
from schema import CapecBridge

# CAPEC XML 네임스페이스
NS = {"capec": "http://capec.mitre.org/capec-3"}


def parse_capec(xml_path: str) -> CapecBridge:
    """CAPEC XML을 파싱하여 ATT&CK<->CWE 브릿지 테이블 구축"""
    print(f"  [CAPEC] 브릿지 구축 중...")

    tree = ET.parse(xml_path)
    root = tree.getroot()

    capec_to_cwe: dict[str, list[str]] = defaultdict(list)
    capec_to_attack: dict[str, list[str]] = defaultdict(list)
    attack_to_capec: dict[str, list[str]] = defaultdict(list)
    cwe_to_capec: dict[str, list[str]] = defaultdict(list)

    patterns_el = root.find("capec:Attack_Patterns", NS)
    if patterns_el is None:
        print("  [CAPEC] Attack_Patterns 요소를 찾을 수 없음")
        return CapecBridge()

    total = 0
    with_cwe = 0
    with_attack = 0

    for pattern in patterns_el.findall("capec:Attack_Pattern", NS):
        capec_id_num = pattern.get("ID", "")
        capec_id = f"CAPEC-{capec_id_num}"
        status = pattern.get("Status", "")

        if status == "Deprecated" or status == "Obsolete":
            continue

        total += 1

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
                        attack_id = entry_id_el.text.strip()
                        capec_to_attack[capec_id].append(attack_id)
                        attack_to_capec[attack_id].append(capec_id)
            if capec_to_attack[capec_id]:
                with_attack += 1

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

    return bridge
