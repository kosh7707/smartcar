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
import json
import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.benchmark.run_benchmark import run

# 탐색 범위
MIN_SCORE_RANGE = [0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5]
NEIGHBOR_SCORE_RANGE = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
RRF_K_RANGE = [0, 10, 30, 60, 100]


def _parse_float_range(value: str) -> list[float]:
    return [float(item.strip()) for item in value.split(",") if item.strip()]


def _parse_int_range(value: str) -> list[int]:
    return [int(item.strip()) for item in value.split(",") if item.strip()]


def run_sweep(
    *,
    qdrant_path: str | None = None,
    qdrant_url: str | None = None,
    use_neo4j: bool = False,
    validation_set: str | None = None,
    top_k: int = 5,
    min_score_range: list[float] | None = None,
    neighbor_score_range: list[float] | None = None,
    rrf_k_range: list[int] | None = None,
) -> dict:
    min_scores = min_score_range or MIN_SCORE_RANGE
    neighbor_scores = neighbor_score_range or NEIGHBOR_SCORE_RANGE
    rrf_values = rrf_k_range or RRF_K_RANGE
    combos = list(product(min_scores, neighbor_scores, rrf_values))
    total = len(combos)
    print(f"그리드 탐색 시작: {total}개 조합")
    print()

    results = []
    failures = []
    for i, (ms, ns, rk) in enumerate(combos, 1):
        print(f"  [{i}/{total}] min_score={ms}, neighbor_score={ns}, rrf_k={rk} ... ", end="", flush=True)
        try:
            summary = run(
                qdrant_path=qdrant_path,
                qdrant_url=qdrant_url,
                use_neo4j=use_neo4j,
                validation_set_path=validation_set,
                min_score=ms,
                neighbor_score=ns,
                rrf_k=rk,
                top_k=top_k,
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
            failures.append({
                "min_score": ms,
                "neighbor_score": ns,
                "rrf_k": rk,
                "error": str(e),
            })

    # NDCG@5 기준 정렬
    results.sort(key=lambda r: r["ndcg_5"], reverse=True)
    return {
        "results": results,
        "failures": failures,
        "total_combinations": total,
        "successful_combinations": len(results),
        "failed_combinations": len(failures),
    }


def build_summary(sweep_result: dict, top_n: int) -> dict:
    results = sweep_result["results"]
    if not results:
        raise RuntimeError("Sweep produced no successful benchmark results")

    top_results = results[:top_n]
    return {
        "total_combinations": sweep_result["total_combinations"],
        "successful_combinations": sweep_result["successful_combinations"],
        "failed_combinations": sweep_result["failed_combinations"],
        "best": top_results[0],
        "top_results": top_results,
        "failures": sweep_result["failures"],
    }


def write_csv(path: str, results: list[dict]) -> None:
    if not results:
        raise RuntimeError("No sweep results available for CSV export")
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)


def write_json(path: str, payload: dict) -> None:
    with open(path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description="S5 KB 파라미터 그리드 탐색")
    parser.add_argument("--qdrant-path", default=None)
    parser.add_argument("--qdrant-url", default=None)
    parser.add_argument("--neo4j", action="store_true")
    parser.add_argument("--validation-set", default=None)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--min-score-range", default=None, help="쉼표 구분 min_score 후보")
    parser.add_argument("--neighbor-score-range", default=None, help="쉼표 구분 neighbor_score 후보")
    parser.add_argument("--rrf-k-range", default=None, help="쉼표 구분 rrf_k 후보")
    parser.add_argument("--csv-output", default=None, help="전체 결과 CSV 출력 경로")
    parser.add_argument("--json-output", default=None, help="요약 결과 JSON 출력 경로")
    parser.add_argument("--top-n", type=int, default=5, help="상위 N개 결과 출력")
    args = parser.parse_args()

    if not args.qdrant_path and not args.qdrant_url:
        args.qdrant_path = "data/qdrant"

    sweep_result = run_sweep(
        qdrant_path=args.qdrant_path,
        qdrant_url=args.qdrant_url,
        use_neo4j=args.neo4j,
        validation_set=args.validation_set,
        top_k=args.top_k,
        min_score_range=_parse_float_range(args.min_score_range) if args.min_score_range else None,
        neighbor_score_range=_parse_float_range(args.neighbor_score_range) if args.neighbor_score_range else None,
        rrf_k_range=_parse_int_range(args.rrf_k_range) if args.rrf_k_range else None,
    )
    results = sweep_result["results"]
    summary = build_summary(sweep_result, args.top_n)

    print()
    print("=" * 80)
    print(f"  상위 {args.top_n}개 조합 (NDCG@5 기준)")
    print("=" * 80)
    print(f"  시도: {summary['total_combinations']} / 성공: {summary['successful_combinations']} / 실패: {summary['failed_combinations']}")
    print(f"  {'Rank':<5} {'min_score':<10} {'neighbor':<10} {'rrf_k':<7} "
          f"{'NDCG@5':<9} {'MRR':<9} {'P@5':<9} {'R@5':<9} {'F1@5':<9} {'Hit':<6}")
    print("-" * 80)
    for i, r in enumerate(summary["top_results"], 1):
        print(f"  {i:<5} {r['min_score']:<10} {r['neighbor_score']:<10} {r['rrf_k']:<7} "
              f"{r['ndcg_5']:<9.4f} {r['mrr']:<9.4f} {r['precision_5']:<9.4f} "
              f"{r['recall_5']:<9.4f} {r['f1_5']:<9.4f} {r['hit_rate']:<6.4f}")
    print("=" * 80)

    if args.csv_output:
        write_csv(args.csv_output, results)
        print(f"\n  CSV 저장: {args.csv_output}")

    if args.json_output:
        write_json(args.json_output, summary)
        print(f"  JSON 저장: {args.json_output}")


if __name__ == "__main__":
    main()
