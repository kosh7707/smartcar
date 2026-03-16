#!/usr/bin/env python3
"""
Automotive Threat Knowledge Database Builder
ETL Pipeline: CWE + CVE/NVD + ATT&CK + CAPEC -> Qdrant (파일 기반)

Usage:
    cd services/llm-gateway
    pip install -r scripts/threat-db/requirements.txt
    python scripts/threat-db/build.py --qdrant-path data/qdrant
"""
import argparse
import os
import sys
import time
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

# scripts/threat-db/ 디렉토리를 sys.path에 추가 (plain import용)
_script_dir = os.path.dirname(os.path.abspath(__file__))
_gateway_root = os.path.dirname(os.path.dirname(_script_dir))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

from download import download_all
from parse_cwe import parse_cwe
from parse_nvd import parse_nvd
from parse_attack import parse_attack
from parse_capec import parse_capec
from crossref import crossref
from load_qdrant import load_qdrant
from stats import print_stats
from fmt import C, phase_header, title_box, table, colored_src


def main():
    parser = argparse.ArgumentParser(description="Automotive Threat Knowledge DB Builder")
    parser.add_argument(
        "--qdrant-path", default="data/qdrant",
        help="Qdrant 파일 스토리지 경로 (기본: data/qdrant)",
    )
    parser.add_argument(
        "--stats-output", default=None,
        help="통계 JSON 출력 디렉토리 (미지정 시 저장 안 함)",
    )
    parser.add_argument("--no-stats", action="store_true", help="통계 출력 생략")
    args = parser.parse_args()

    # qdrant-path를 절대경로로 변환 (services/llm-gateway 기준)
    qdrant_path = args.qdrant_path
    if not os.path.isabs(qdrant_path):
        qdrant_path = os.path.join(_gateway_root, qdrant_path)

    title_box(
        "Automotive Threat Knowledge DB -- ETL Pipeline",
        f"CWE + CVE/NVD + ATT&CK ICS + CAPEC -> Qdrant ({qdrant_path})"
    )

    t_start = time.time()

    # Phase 1: 데이터 수집
    phase_header(1, "데이터 수집")
    paths = download_all()

    # Phase 2: 개별 파싱
    phase_header(2, "데이터 파싱")
    cwe_records = parse_cwe(paths["cwe"])
    nvd_records = parse_nvd(paths["nvd"])
    attack_records = parse_attack(paths["attack"])
    capec_bridge = parse_capec(paths["capec"])

    cwe_auto = sum(1 for r in cwe_records if r.automotive_relevance >= 0.2)
    nvd_auto = sum(1 for r in nvd_records if r.automotive_relevance >= 0.2)
    nvd_cwe = sum(1 for r in nvd_records if r.related_cwe)
    atk_mit = sum(1 for r in attack_records if r.mitigations)
    capec_cnt = len(capec_bridge.capec_to_cwe)

    print(f"\n  {C.B}파싱 결과 요약:{C.RST}")
    table(
        ["소스", "건수", "자동차 관련", "비고"],
        [
            [colored_src("CWE"), len(cwe_records), cwe_auto, ""],
            [colored_src("CVE"), len(nvd_records), nvd_auto, f"CWE 매핑 {nvd_cwe*100//max(len(nvd_records),1)}%"],
            [colored_src("ATT&CK"), len(attack_records), len(attack_records), f"Mitigation {atk_mit}개"],
            [colored_src("CAPEC"), f"{capec_cnt}패턴", "-", "Bridge 전용"],
        ],
        [11, 8, 12, 20],
        "<>><",
    )

    # Phase 3: 교차 참조
    phase_header(3, "교차 참조 해소")
    unified = crossref(cwe_records, nvd_records, attack_records, capec_bridge)

    # Phase 4: Qdrant 적재 (파일 기반)
    phase_header(4, "벡터 DB 적재 (파일 기반)")
    os.makedirs(qdrant_path, exist_ok=True)
    load_qdrant(unified, qdrant_path)

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
