"""
MITRE ATT&CK STIX 2.1 파서 -> UnifiedThreatRecord 변환
ICS + Enterprise 듀얼 번들 지원
"""
import functools
import json
from schema import UnifiedThreatRecord
from taxonomy import classify_attack_surfaces, compute_automotive_relevance

print = functools.partial(print, flush=True)

# Enterprise에서 임베디드/시스템 관련 전술만 선별
ENTERPRISE_RELEVANT_TACTICS = {
    "initial-access", "execution", "persistence",
    "privilege-escalation", "defense-evasion",
    "credential-access", "lateral-movement",
}

# Enterprise에서 제외할 SaaS/클라우드 전용 플랫폼
ENTERPRISE_EXCLUDE_PLATFORMS = {
    "SaaS", "Office 365", "Google Workspace", "Azure AD",
}


def _parse_stix_bundle(
    stix_path: str,
    domain: str,
) -> list[UnifiedThreatRecord]:
    """단일 STIX 2.1 번들 파싱. domain: 'ics' | 'enterprise'"""

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
        platforms = obj.get("x_mitre_platforms", [])

        # Enterprise 필터링
        if domain == "enterprise":
            # 관련 전술만 선별
            if phase and phase not in ENTERPRISE_RELEVANT_TACTICS:
                continue
            # SaaS/클라우드 전용 기법 제외
            platform_set = set(platforms)
            if platform_set and platform_set.issubset(ENTERPRISE_EXCLUDE_PLATFORMS):
                continue

        desc = obj.get("description", "")
        desc = desc.replace("(Citation:", "").replace(")", "")

        full_text = f"{obj.get('name', '')} {desc} {' '.join(platforms)}"
        attack_surfaces = classify_attack_surfaces(full_text)
        relevance = compute_automotive_relevance(obj.get("name", ""), desc)

        if domain == "ics":
            # ICS는 기본적으로 산업/자동차 관련 → 최소 relevance 보장
            relevance = max(relevance, 0.3)
            threat_category = "ICS/OT Attack"
        else:
            threat_category = "Enterprise Attack"

        record = UnifiedThreatRecord(
            id=attack_id,
            source="ATT&CK",
            title=obj.get("name", ""),
            description=desc,
            attack_surfaces=attack_surfaces,
            threat_category=threat_category,
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

    return list(techniques.values())


def parse_attack(stix_paths: dict[str, str]) -> list[UnifiedThreatRecord]:
    """ATT&CK ICS + Enterprise 듀얼 번들 파싱.

    stix_paths: {"ics": "path/ics-attack.json", "enterprise": "path/enterprise-attack.json"}
    ICS/Enterprise 중복 기법은 ICS 우선.
    """
    print(f"  [ATT&CK] 파싱 중...")

    # ICS 먼저 (우선)
    ics_records = _parse_stix_bundle(stix_paths["ics"], domain="ics")
    ics_ids = {r.id for r in ics_records}
    print(f"  [ATT&CK] ICS: {len(ics_records)}개 기법")

    # Enterprise (ICS와 중복 제거)
    ent_records = _parse_stix_bundle(stix_paths["enterprise"], domain="enterprise")
    ent_unique = [r for r in ent_records if r.id not in ics_ids]
    print(f"  [ATT&CK] Enterprise: {len(ent_records)}개 중 {len(ent_unique)}개 신규")

    records = ics_records + ent_unique

    with_mit = sum(1 for r in records if r.mitigations)
    with_capec = sum(1 for r in records if r.related_capec)
    print(f"  [ATT&CK] 완료: {len(records)}개 기법 (ICS {len(ics_records)} + Enterprise {len(ent_unique)}), Mitigation {with_mit}개, CAPEC {with_capec}개")
    return records
