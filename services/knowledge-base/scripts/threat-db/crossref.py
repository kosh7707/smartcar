"""
교차 참조 엔진 -- CWE<->CVE<->ATT&CK<->CAPEC 관계 해소
"""
import functools
from collections import defaultdict
from schema import UnifiedThreatRecord, CapecBridge
from fmt import C, table

print = functools.partial(print, flush=True)


def crossref(
    cwe_records: list[UnifiedThreatRecord],
    nvd_records: list[UnifiedThreatRecord],
    attack_records: list[UnifiedThreatRecord],
    capec_records: list[UnifiedThreatRecord],
    bridge: CapecBridge,
) -> list[UnifiedThreatRecord]:
    """4개 소스 간 교차 참조 해소 후 통합 리스트 반환"""

    # 역인덱스: CWE ID -> CVE IDs
    cwe_to_cves: dict[str, list[str]] = defaultdict(list)
    for cve in nvd_records:
        for cwe_id in cve.related_cwe:
            cwe_to_cves[cwe_id].append(cve.id)

    # 1. CVE -> ATT&CK (CWE 경유 간접)
    cve_to_attack_linked = 0
    for cve in nvd_records:
        for cwe_id in cve.related_cwe:
            capec_ids = bridge.cwe_to_capec.get(cwe_id, [])
            for capec_id in capec_ids:
                attack_ids = bridge.capec_to_attack.get(capec_id, [])
                for aid in attack_ids:
                    if aid not in cve.related_attack:
                        cve.related_attack.append(aid)
                    if capec_id not in cve.related_capec:
                        cve.related_capec.append(capec_id)
        if cve.related_attack:
            cve_to_attack_linked += 1

    # 2. ATT&CK -> CWE (CAPEC 경유)
    attack_to_cwe_linked = 0
    for tech in attack_records:
        for capec_id in tech.related_capec:
            cwe_ids = bridge.capec_to_cwe.get(capec_id, [])
            for cwe_id in cwe_ids:
                if cwe_id not in tech.related_cwe:
                    tech.related_cwe.append(cwe_id)

        if not tech.related_cwe:
            capec_ids = bridge.attack_to_capec.get(tech.id, [])
            for capec_id in capec_ids:
                if capec_id not in tech.related_capec:
                    tech.related_capec.append(capec_id)
                cwe_ids = bridge.capec_to_cwe.get(capec_id, [])
                for cwe_id in cwe_ids:
                    if cwe_id not in tech.related_cwe:
                        tech.related_cwe.append(cwe_id)

        for cwe_id in tech.related_cwe:
            cve_ids = cwe_to_cves.get(cwe_id, [])
            for cve_id in cve_ids:
                if cve_id not in tech.related_cve:
                    tech.related_cve.append(cve_id)

        if tech.related_cwe:
            attack_to_cwe_linked += 1

    # 3. CWE -> CVE, ATT&CK (역방향 보완)
    for cwe in cwe_records:
        cve_ids = cwe_to_cves.get(cwe.id, [])
        for cve_id in cve_ids:
            if cve_id not in cwe.related_cve:
                cwe.related_cve.append(cve_id)

        capec_ids = bridge.cwe_to_capec.get(cwe.id, [])
        for capec_id in capec_ids:
            if capec_id not in cwe.related_capec:
                cwe.related_capec.append(capec_id)
            attack_ids = bridge.capec_to_attack.get(capec_id, [])
            for aid in attack_ids:
                if aid not in cwe.related_attack:
                    cwe.related_attack.append(aid)

    # 4. CAPEC -> CVE (CWE 경유 간접)
    capec_to_cve_linked = 0
    for capec in capec_records:
        for cwe_id in capec.related_cwe:
            cve_ids = cwe_to_cves.get(cwe_id, [])
            for cve_id in cve_ids:
                if cve_id not in capec.related_cve:
                    capec.related_cve.append(cve_id)
        if capec.related_cve:
            capec_to_cve_linked += 1

    all_records = cwe_records + nvd_records + attack_records + capec_records

    total_crossrefs = sum(
        len(r.related_cwe) + len(r.related_cve) + len(r.related_attack) + len(r.related_capec)
        for r in all_records
    )
    cve_with_cwe = sum(1 for r in nvd_records if r.related_cwe)
    cwe_with_cve = sum(1 for r in cwe_records if r.related_cve)
    cwe_with_attack = sum(1 for r in cwe_records if r.related_attack)
    capec_with_cwe = sum(1 for r in capec_records if r.related_cwe)

    def _pct(a, b):
        return f"{a*100//max(b,1)}%" if b > 0 else "N/A"

    print(f"\n  {C.B}교차 참조 해소 결과:{C.RST}")
    table(
        ["관계", "연결됨", "전체", "커버리지"],
        [
            ["CVE -> CWE", cve_with_cwe, len(nvd_records), _pct(cve_with_cwe, len(nvd_records))],
            ["CVE -> ATT&CK", cve_to_attack_linked, len(nvd_records), _pct(cve_to_attack_linked, len(nvd_records))],
            ["ATT&CK -> CWE", attack_to_cwe_linked, len(attack_records), _pct(attack_to_cwe_linked, len(attack_records))],
            ["CWE -> CVE", cwe_with_cve, len(cwe_records), _pct(cwe_with_cve, len(cwe_records))],
            ["CWE -> ATT&CK", cwe_with_attack, len(cwe_records), _pct(cwe_with_attack, len(cwe_records))],
            ["CAPEC -> CWE", capec_with_cwe, len(capec_records), _pct(capec_with_cwe, len(capec_records))],
            ["CAPEC -> CVE", capec_to_cve_linked, len(capec_records), _pct(capec_to_cve_linked, len(capec_records))],
        ],
        [14, 8, 8, 10],
        "<>>>"
    )
    print(f"  {C.DIM}총 레코드: {C.W}{len(all_records)}건{C.RST}{C.DIM}, 총 교차 참조: {C.Y}{total_crossrefs:,}건{C.RST}")

    return all_records
