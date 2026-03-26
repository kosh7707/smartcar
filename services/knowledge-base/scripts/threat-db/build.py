#!/usr/bin/env python3
"""
AEGIS Threat Knowledge Database Builder
ETL Pipeline: CWE + ATT&CK (ICS+Enterprise) + CAPEC -> Qdrant (파일 기반)

CVE/NVD는 ETL에서 제외 — 프로젝트 분석 시 실시간 조회로 전환

Usage:
    cd services/knowledge-base
    pip install -r scripts/threat-db/requirements.txt
    python scripts/threat-db/build.py --qdrant-path data/qdrant
"""
import argparse
import datetime
import functools
import json as _json
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

# stdout 버퍼링 제거 — 백그라운드 실행 시 실시간 출력 보장
print = functools.partial(print, flush=True)

# scripts/threat-db/ 디렉토리를 sys.path에 추가 (plain import용)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_service_root = os.path.dirname(os.path.dirname(_script_dir))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

from download import download_all
from parse_cwe import parse_cwe
from parse_attack import parse_attack
from parse_capec import parse_capec
from crossref import crossref
from load_qdrant import load_qdrant
from stats import print_stats
from fmt import C, phase_header, title_box, table, colored_src


def main():
    parser = argparse.ArgumentParser(description="AEGIS Threat Knowledge DB Builder")
    parser.add_argument(
        "--qdrant-path", default="data/qdrant",
        help="Qdrant 파일 스토리지 경로 (기본: data/qdrant)",
    )
    parser.add_argument(
        "--stats-output", default=None,
        help="통계 JSON 출력 디렉토리 (미지정 시 저장 안 함)",
    )
    parser.add_argument("--no-stats", action="store_true", help="통계 출력 생략")
    parser.add_argument("--include-nvd", action="store_true", help="NVD CVE 사전 적재 (레거시)")
    args = parser.parse_args()

    # qdrant-path를 절대경로로 변환
    qdrant_path = args.qdrant_path
    if not os.path.isabs(qdrant_path):
        qdrant_path = os.path.join(_service_root, qdrant_path)

    title_box(
        "AEGIS Threat Knowledge DB -- ETL Pipeline",
        f"CWE + ATT&CK (ICS+Enterprise) + CAPEC -> Qdrant ({qdrant_path})"
    )

    t_start = time.time()

    # Phase 1: 데이터 수집
    phase_header(1, "데이터 수집")
    paths = download_all(include_nvd=args.include_nvd)

    # Phase 2: 개별 파싱
    phase_header(2, "데이터 파싱")
    cwe_records, cwe_meta, cwe_parent_map = parse_cwe(paths["cwe"])
    attack_records, attack_meta = parse_attack(paths["attack"])
    capec_records, capec_bridge, capec_meta = parse_capec(paths["capec"], cwe_parent_map=cwe_parent_map)

    # NVD (레거시 옵션)
    nvd_records = []
    if paths.get("nvd"):
        from parse_nvd import parse_nvd
        nvd_records = parse_nvd(paths["nvd"])

    atk_mit = sum(1 for r in attack_records if r.mitigations)

    print(f"\n  {C.B}파싱 결과 요약:{C.RST}")
    rows = [
        [colored_src("CWE"), len(cwe_records), sum(1 for r in cwe_records if r.automotive_relevance >= 0.2), "위협 분류 체계"],
        [colored_src("ATT&CK"), len(attack_records), len(attack_records), f"Mitigation {atk_mit}개"],
        [colored_src("CAPEC"), len(capec_records), sum(1 for r in capec_records if r.automotive_relevance >= 0.2), "풀 노드"],
    ]
    if nvd_records:
        nvd_cwe = sum(1 for r in nvd_records if r.related_cwe)
        rows.insert(1, [colored_src("CVE"), len(nvd_records), sum(1 for r in nvd_records if r.automotive_relevance >= 0.2), f"CWE 매핑 {nvd_cwe*100//max(len(nvd_records),1)}%"])

    table(["소스", "건수", "도메인 관련", "비고"], rows, [11, 8, 12, 20], "<>><")

    if not nvd_records:
        print(f"\n  {C.DIM}CVE/NVD: 프로젝트 분석 시 실시간 조회로 전환됨{C.RST}")

    # Phase 3: 교차 참조
    phase_header(3, "교차 참조 해소")
    unified = crossref(cwe_records, nvd_records, attack_records, capec_records, capec_bridge)

    # Phase 4: Qdrant 적재 (파일 기반)
    phase_header(4, "벡터 DB 적재 (파일 기반)")
    os.makedirs(qdrant_path, exist_ok=True)
    load_qdrant(unified, qdrant_path)

    # kb-meta.json 작성 (ontology 버전 추적)
    kb_meta = {
        "build_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sources": {
            "CWE": cwe_meta,
            "ATT&CK": attack_meta,
            "CAPEC": capec_meta,
        },
        "total_records": len(unified),
    }
    meta_path = os.path.join(os.path.dirname(qdrant_path), "kb-meta.json")
    with open(meta_path, "w") as f:
        _json.dump(kb_meta, f, indent=2, ensure_ascii=False)
    print(f"\n  {C.B}KB 메타데이터 저장: {C.W}{meta_path}{C.RST}")

    # Phase 5: 통계
    if not args.no_stats:
        phase_header(5, "정량적 통계")
        print_stats(unified, output_dir=args.stats_output)

    t_end = time.time()
    print()
    print(f"  {C.CY}{'─' * 58}{C.RST}")
    print(f"  {C.B}전체 파이프라인 완료: {C.Y}{t_end - t_start:.1f}초{C.RST}")
    print(f"  {C.B}Qdrant 경로: {C.W}{qdrant_path}{C.RST}")
    print(f"  {C.CY}{'─' * 58}{C.RST}")


if __name__ == "__main__":
    main()
