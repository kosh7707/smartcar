"""
통계 생성 -- 보고서용 정량적 데이터
CVE는 ETL 범위에서 제외됨 — 런타임 조회로 전환
"""
import json
import os
from collections import Counter
from schema import UnifiedThreatRecord
from fmt import C, table, bar, colored_src


def print_stats(records: list[UnifiedThreatRecord], output_dir: str | None = None):
    """파이프라인 결과 통계 출력"""
    source_counts = Counter(r.source for r in records)

    # 1. 소스별 레코드 수
    print(f"\n  {C.B}[1] 소스별 레코드 수:{C.RST}")
    table(
        ["소스", "레코드"],
        [
            [colored_src("CWE"), source_counts.get("CWE", 0)],
            [colored_src("ATT&CK"), source_counts.get("ATT&CK", 0)],
            [colored_src("CAPEC"), source_counts.get("CAPEC", 0)],
            [f"{C.B}합계{C.RST}", f"{C.B}{len(records)}{C.RST}"],
        ],
        [12, 8],
        "<>",
    )

    # 2. 도메인 관련 레코드
    auto_records = [r for r in records if r.automotive_relevance >= 0.2]
    auto_by_source = Counter(r.source for r in auto_records)
    print(f"\n  {C.B}[2] 도메인 관련 레코드 (relevance >= 0.2):{C.RST}")
    rows_2 = []
    for src in ["CWE", "ATT&CK", "CAPEC"]:
        total = source_counts.get(src, 0)
        auto = auto_by_source.get(src, 0)
        pct = f"{auto*100//max(total,1)}%" if total > 0 else "N/A"
        rows_2.append([colored_src(src), auto, total, pct])
    table(
        ["소스", "관련", "전체", "비율"],
        rows_2,
        [12, 6, 6, 8],
        "<>>>"
    )

    # 3. 공격 표면 분포
    surface_counts: Counter = Counter()
    for r in records:
        for s in r.attack_surfaces:
            surface_counts[s] += 1

    print(f"\n  {C.B}[3] 공격 표면 분포:{C.RST}")
    rows_3 = []
    for surface, count in surface_counts.most_common():
        b = bar(count, scale=10, max_width=16)
        rows_3.append([surface, count, b])
    table(
        ["공격 표면", "건수", ""],
        rows_3,
        [28, 5, 16],
        "<><",
    )

    # 4. 위협 카테고리 Top 10
    cat_counts = Counter(r.threat_category for r in records if r.threat_category)
    print(f"\n  {C.B}[4] 위협 카테고리 Top 10:{C.RST}")
    rows_4 = [[cat, count] for cat, count in cat_counts.most_common(10)]
    table(
        ["카테고리", "건수"],
        rows_4,
        [32, 5],
        "<>",
    )

    # JSON 저장
    if output_dir:
        attack_records_list = [r for r in records if r.source == "ATT&CK"]
        attack_with_cwe = sum(1 for r in attack_records_list if r.related_cwe)
        cwe_records_list = [r for r in records if r.source == "CWE"]
        cwe_with_attack = sum(1 for r in cwe_records_list if r.related_attack)

        stats_data = {
            "total_records": len(records),
            "by_source": dict(source_counts),
            "automotive_relevant": len(auto_records),
            "attack_surfaces": dict(surface_counts.most_common()),
            "crossref_coverage": {
                "attack_to_cwe": f"{attack_with_cwe}/{len(attack_records_list)}",
                "cwe_to_attack": f"{cwe_with_attack}/{len(cwe_records_list)}",
            },
            "threat_categories": dict(cat_counts.most_common()),
        }

        os.makedirs(output_dir, exist_ok=True)
        stats_path = os.path.join(output_dir, "stats.json")
        with open(stats_path, "w") as f:
            json.dump(stats_data, f, ensure_ascii=False, indent=2)
        print(f"\n  {C.DIM}통계 JSON 저장: {stats_path}{C.RST}")
