#!/usr/bin/env python3
"""S5 KB 파라미터 그리드 탐색.

Usage:
    cd services/knowledge-base
    .venv/bin/python scripts/benchmark/sweep.py --qdrant-path data/qdrant [--neo4j]

min_score, neighbor_score, rrf_k 조합을 탐색하여 NDCG@5 기준 최적 파라미터를 찾는다.
"""

from __future__ import annotations

import argparse
import csv
import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.benchmark.run_benchmark import run

# 탐색 범위
MIN_SCORE_RANGE = [0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5]
NEIGHBOR_SCORE_RANGE = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
RRF_K_RANGE = [0, 10, 30, 60, 100]


def main():
    parser = argparse.ArgumentParser(description="S5 KB 파라미터 그리드 탐색")
    parser.add_argument("--qdrant-path", default=None)
    parser.add_argument("--qdrant-url", default=None)
    parser.add_argument("--neo4j", action="store_true")
    parser.add_argument("--validation-set", default=None)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--csv-output", default=None, help="전체 결과 CSV 출력 경로")
    parser.add_argument("--top-n", type=int, default=5, help="상위 N개 결과 출력")
    args = parser.parse_args()

    if not args.qdrant_path and not args.qdrant_url:
        args.qdrant_path = "data/qdrant"

    combos = list(product(MIN_SCORE_RANGE, NEIGHBOR_SCORE_RANGE, RRF_K_RANGE))
    total = len(combos)
    print(f"그리드 탐색 시작: {total}개 조합")
    print()

    results = []
    for i, (ms, ns, rk) in enumerate(combos, 1):
        print(f"  [{i}/{total}] min_score={ms}, neighbor_score={ns}, rrf_k={rk} ... ", end="", flush=True)
        try:
            summary = run(
                qdrant_path=args.qdrant_path,
                qdrant_url=args.qdrant_url,
                use_neo4j=args.neo4j,
                validation_set_path=args.validation_set,
                min_score=ms,
                neighbor_score=ns,
                rrf_k=rk,
                top_k=args.top_k,
            )
            m = summary["metrics"]
            entry = {
                "min_score": ms,
                "neighbor_score": ns,
                "rrf_k": rk,
                "ndcg_5": m["ndcg_5"]["mean"],
                "mrr": m["mrr"]["mean"],
                "precision_5": m["precision_5"]["mean"],
                "recall_5": m["recall_5"]["mean"],
                "f1_5": m["f1_5"]["mean"],
                "hit_rate": m["hit_rate"]["mean"],
            }
            results.append(entry)
            print(f"NDCG@5={entry['ndcg_5']:.4f}, MRR={entry['mrr']:.4f}")
        except Exception as e:
            print(f"ERROR: {e}")

    # NDCG@5 기준 정렬
    results.sort(key=lambda r: r["ndcg_5"], reverse=True)

    print()
    print("=" * 80)
    print(f"  상위 {args.top_n}개 조합 (NDCG@5 기준)")
    print("=" * 80)
    print(f"  {'Rank':<5} {'min_score':<10} {'neighbor':<10} {'rrf_k':<7} "
          f"{'NDCG@5':<9} {'MRR':<9} {'P@5':<9} {'R@5':<9} {'F1@5':<9} {'Hit':<6}")
    print("-" * 80)
    for i, r in enumerate(results[:args.top_n], 1):
        print(f"  {i:<5} {r['min_score']:<10} {r['neighbor_score']:<10} {r['rrf_k']:<7} "
              f"{r['ndcg_5']:<9.4f} {r['mrr']:<9.4f} {r['precision_5']:<9.4f} "
              f"{r['recall_5']:<9.4f} {r['f1_5']:<9.4f} {r['hit_rate']:<6.4f}")
    print("=" * 80)

    if args.csv_output:
        with open(args.csv_output, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n  CSV 저장: {args.csv_output}")


if __name__ == "__main__":
    main()
