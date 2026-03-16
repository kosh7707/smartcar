"""
MITRE ATT&CK ICS STIX 2.1 파서 -> UnifiedThreatRecord 변환
"""
import json
from schema import UnifiedThreatRecord
from taxonomy import classify_attack_surfaces, compute_automotive_relevance


def parse_attack(stix_path: str) -> list[UnifiedThreatRecord]:
    """ATT&CK STIX 2.1 JSON 번들을 파싱하여 UnifiedThreatRecord 리스트 반환"""
    print(f"  [ATT&CK] 파싱 중...")

    with open(stix_path) as f:
        bundle = json.load(f)

    objects = bundle.get("objects", [])

    # 1단계: attack-pattern (기법) 추출
    techniques = {}
    for obj in objects:
        if obj.get("type") != "attack-pattern":
            continue
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue

        attack_id = ""
        capec_ids = []
        for ref in obj.get("external_references", []):
            if ref.get("source_name") == "mitre-attack":
                attack_id = ref.get("external_id", "")
            elif ref.get("source_name") == "capec":
                capec_ids.append(f"CAPEC-{ref.get('external_id', '')}")

        if not attack_id:
            continue

        kill_chain_phases = obj.get("kill_chain_phases", [])
        phase = kill_chain_phases[0]["phase_name"] if kill_chain_phases else None
        tactic = phase

        desc = obj.get("description", "")
        desc = desc.replace("(Citation:", "").replace(")", "")

        platforms = obj.get("x_mitre_platforms", [])

        full_text = f"{obj.get('name', '')} {desc} {' '.join(platforms)}"
        attack_surfaces = classify_attack_surfaces(full_text)
        relevance = compute_automotive_relevance(obj.get("name", ""), desc)

        # ICS 매트릭스는 기본적으로 자동차/산업 관련 -> 최소 relevance 보장
        relevance = max(relevance, 0.3)

        record = UnifiedThreatRecord(
            id=attack_id,
            source="ATT&CK",
            title=obj.get("name", ""),
            description=desc,
            attack_surfaces=attack_surfaces,
            threat_category="ICS/OT Attack",
            attack_vector=tactic,
            kill_chain_phase=phase,
            related_capec=capec_ids,
            automotive_relevance=relevance,
        )
        techniques[attack_id] = record

    # 2단계: course-of-action 수집
    mitigations_map: dict[str, str] = {}
    for obj in objects:
        if obj.get("type") == "course-of-action":
            if obj.get("revoked") or obj.get("x_mitre_deprecated"):
                continue
            mid = obj.get("id", "")
            name = obj.get("name", "")
            desc = obj.get("description", "")
            mitigations_map[mid] = f"{name}: {desc[:200]}"

    # 3단계: mitigation 직접 연결
    stix_id_to_attack_id: dict[str, str] = {}
    for obj in objects:
        if obj.get("type") == "attack-pattern":
            stix_id = obj.get("id", "")
            for ref in obj.get("external_references", []):
                if ref.get("source_name") == "mitre-attack":
                    stix_id_to_attack_id[stix_id] = ref.get("external_id", "")

    for obj in objects:
        if obj.get("type") != "relationship" or obj.get("relationship_type") != "mitigates":
            continue
        source_ref = obj.get("source_ref", "")
        target_ref = obj.get("target_ref", "")
        mit_text = mitigations_map.get(source_ref, "")
        attack_id = stix_id_to_attack_id.get(target_ref, "")
        if mit_text and attack_id and attack_id in techniques:
            techniques[attack_id].mitigations.append(mit_text)

    records = list(techniques.values())
    with_mit = sum(1 for r in records if r.mitigations)
    with_capec = sum(1 for r in records if r.related_capec)
    print(f"  [ATT&CK] 완료: {len(records)}개 기법, Mitigation {with_mit}개, CAPEC {with_capec}개")
    return records
