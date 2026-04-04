#!/usr/bin/env python3
"""S5 KB 검색 정확도 벤치마크 러너.

Usage:
    cd services/knowledge-base
    .venv/bin/python scripts/benchmark/run_benchmark.py --qdrant-path data/qdrant [--neo4j] [--output results.json]

Qdrant 파일 DB를 직접 로드하여 KnowledgeAssembler로 validation set을 실행하고
Precision, Recall, F1, NDCG, MRR, Hit Rate를 측정한다.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Any

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.benchmark.metrics import (
    f1_at_k,
    hit_rate,
    mrr,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
)

_METRIC_KEYS = (
    "precision_1",
    "precision_5",
    "recall_5",
    "f1_5",
    "ndcg_5",
    "mrr",
    "hit_rate",
)
_MATCH_TYPE_KEYS = ("id_exact", "graph_neighbor", "vector_semantic")


def _load_validation_set(path: str | None = None) -> dict:
    vset_path = path or str(Path(__file__).parent / "validation_set.json")
    with open(vset_path) as f:
        return json.load(f)


def _build_assembler(qdrant_path: str | None, qdrant_url: str | None, use_neo4j: bool, rrf_k: int, min_score: float, neighbor_score: float):
    """KnowledgeAssembler를 직접 조립한다."""
    from app.graphrag.knowledge_assembler import KnowledgeAssembler
    from app.graphrag.vector_search import VectorSearch
    from app.rag.threat_search import ThreatSearch

    ts = ThreatSearch(qdrant_path=qdrant_path, qdrant_url=qdrant_url)
    vs = VectorSearch(ts)

    graph: object
    if use_neo4j:
        import neo4j
        from app.config import settings
        from app.graphrag.neo4j_graph import Neo4jGraph

        driver = neo4j.GraphDatabase.driver(
            settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password),
        )
        driver.verify_connectivity()
        graph = Neo4jGraph(driver)
    else:
        # NullGraph
        class _NullGraph:
            def get_related(self, node_id): return {}
            def get_node_info(self, node_id): return None
            def neighbors(self, node_id, depth=2): return []
        graph = _NullGraph()

    return KnowledgeAssembler(vs, graph, neighbor_score=neighbor_score, rrf_k=rrf_k), ts


def run(
    qdrant_path: str | None = None,
    qdrant_url: str | None = None,
    use_neo4j: bool = False,
    validation_set_path: str | None = None,
    min_score: float = 0.35,
    neighbor_score: float = 0.8,
    rrf_k: int = 60,
    top_k: int = 5,
) -> dict:
    """벤치마크를 실행하고 결과를 반환한다."""
    vset = _load_validation_set(validation_set_path)
    assembler, ts = _build_assembler(qdrant_path, qdrant_url, use_neo4j, rrf_k, min_score, neighbor_score)

    results = []
    start_total = time.monotonic()

    for q in vset["queries"]:
        expected = set(q["expected_ids"])
        if not expected:
            continue  # 기대 결과 없는 쿼리는 스킵

        start = time.monotonic()
        result = assembler.assemble(
            q["query"], top_k=top_k, min_score=min_score, graph_depth=2,
        )
        elapsed_ms = int((time.monotonic() - start) * 1000)

        retrieved = [h["id"] for h in result.get("hits", [])]

        entry = {
            "id": q["id"],
            "query": q["query"],
            "expected_ids": list(expected),
            "retrieved_ids": retrieved,
            "precision_1": precision_at_k(retrieved, expected, 1),
            "precision_5": precision_at_k(retrieved, expected, top_k),
            "recall_5": recall_at_k(retrieved, expected, top_k),
            "f1_5": f1_at_k(retrieved, expected, top_k),
            "ndcg_5": ndcg_at_k(retrieved, q["expected_ids"], top_k),
            "mrr": mrr(retrieved, expected),
            "hit_rate": hit_rate(retrieved, expected),
            "latency_ms": elapsed_ms,
        }
        oracle = _evaluate_oracle(q, result)
        if oracle is not None:
            entry["oracle"] = oracle

        # expected_top1 체크
        if q.get("expected_top1") and retrieved:
            entry["top1_correct"] = retrieved[0] == q["expected_top1"]

        results.append(entry)

    total_ms = int((time.monotonic() - start_total) * 1000)
    ts.close()

    # 집계
    def _agg(key):
        vals = [r[key] for r in results]
        if not vals:
            return {"mean": 0, "std": 0, "min": 0, "max": 0}
        return {
            "mean": round(statistics.mean(vals), 4),
            "std": round(statistics.stdev(vals) if len(vals) > 1 else 0, 4),
            "min": round(min(vals), 4),
            "max": round(max(vals), 4),
        }

    summary = {
        "params": {
            "min_score": min_score,
            "neighbor_score": neighbor_score,
            "rrf_k": rrf_k,
            "top_k": top_k,
            "neo4j": use_neo4j,
        },
        "query_count": len(results),
        "total_ms": total_ms,
        "metrics": {
            "precision_1": _agg("precision_1"),
            "precision_5": _agg("precision_5"),
            "recall_5": _agg("recall_5"),
            "f1_5": _agg("f1_5"),
            "ndcg_5": _agg("ndcg_5"),
            "mrr": _agg("mrr"),
            "hit_rate": _agg("hit_rate"),
        },
        "per_query": results,
    }

    oracle_entries = [row["oracle"] for row in results if "oracle" in row]
    if oracle_entries:
        total_checks = sum(item["total"] for item in oracle_entries)
        passed_checks = sum(item["passed"] for item in oracle_entries)
        full_pass_count = sum(1 for item in oracle_entries if item["all_passed"])
        summary["oracle"] = {
            "query_count": len(oracle_entries),
            "full_pass_count": full_pass_count,
            "full_pass_rate": round(full_pass_count / len(oracle_entries), 4),
            "mean_pass_rate": round(
                statistics.mean(item["pass_rate"] for item in oracle_entries), 4,
            ),
            "passed_checks": passed_checks,
            "total_checks": total_checks,
        }

    return summary


def _metric_means(summary: dict) -> dict[str, float]:
    return {
        key: round(summary["metrics"][key]["mean"], 4)
        for key in _METRIC_KEYS
    }


def _evaluate_oracle(query_spec: dict, result: dict) -> dict[str, Any] | None:
    """validation set의 graph-aware oracle을 평가한다."""
    required_match_types = query_spec.get("required_match_types", [])
    if not required_match_types:
        return None

    present_match_types = {
        hit.get("match_type")
        for hit in result.get("hits", [])
        if hit.get("match_type")
    }
    checks = {
        f"match_type:{match_type}": match_type in present_match_types
        for match_type in required_match_types
    }
    passed = sum(1 for ok in checks.values() if ok)
    total = len(checks)
    return {
        "checks": checks,
        "passed": passed,
        "total": total,
        "pass_rate": round(passed / total, 4) if total else 0.0,
        "all_passed": passed == total,
    }


def build_compare_summary(
    baseline: dict,
    candidate: dict,
    *,
    baseline_label: str = "qdrant_only",
    candidate_label: str = "neo4j_enabled",
    rank_metric: str = "ndcg_5",
    top_n: int = 10,
) -> dict[str, Any]:
    """두 벤치마크 요약을 비교해 그래프 uplift를 정리한다."""
    if rank_metric not in _METRIC_KEYS:
        raise ValueError(f"Unsupported rank metric: {rank_metric}")

    baseline_means = _metric_means(baseline)
    candidate_means = _metric_means(candidate)
    deltas = {
        key: round(candidate_means[key] - baseline_means[key], 4)
        for key in _METRIC_KEYS
    }

    baseline_queries = {row["id"]: row for row in baseline.get("per_query", [])}
    candidate_queries = {row["id"]: row for row in candidate.get("per_query", [])}
    shared_ids = sorted(set(baseline_queries) & set(candidate_queries))

    query_deltas = []
    for query_id in shared_ids:
        base_row = baseline_queries[query_id]
        cand_row = candidate_queries[query_id]
        rank_delta = round(cand_row.get(rank_metric, 0.0) - base_row.get(rank_metric, 0.0), 4)
        entry = {
            "id": query_id,
            "query": base_row["query"],
            "baseline": {
                rank_metric: round(base_row.get(rank_metric, 0.0), 4),
                "mrr": round(base_row.get("mrr", 0.0), 4),
                "hit_rate": round(base_row.get("hit_rate", 0.0), 4),
                "top1_correct": base_row.get("top1_correct"),
                "retrieved_ids": base_row.get("retrieved_ids", [])[:5],
            },
            "candidate": {
                rank_metric: round(cand_row.get(rank_metric, 0.0), 4),
                "mrr": round(cand_row.get("mrr", 0.0), 4),
                "hit_rate": round(cand_row.get("hit_rate", 0.0), 4),
                "top1_correct": cand_row.get("top1_correct"),
                "retrieved_ids": cand_row.get("retrieved_ids", [])[:5],
            },
            "delta": {
                rank_metric: rank_delta,
                "mrr": round(cand_row.get("mrr", 0.0) - base_row.get("mrr", 0.0), 4),
                "hit_rate": round(cand_row.get("hit_rate", 0.0) - base_row.get("hit_rate", 0.0), 4),
            },
        }
        query_deltas.append(entry)

    query_deltas.sort(
        key=lambda row: (
            row["delta"][rank_metric],
            row["delta"]["mrr"],
            row["delta"]["hit_rate"],
            row["id"],
        ),
        reverse=True,
    )

    improved = sum(1 for row in query_deltas if row["delta"][rank_metric] > 0)
    regressed = sum(1 for row in query_deltas if row["delta"][rank_metric] < 0)
    unchanged = len(query_deltas) - improved - regressed
    latency_baseline = baseline.get("total_ms", 0)
    latency_candidate = candidate.get("total_ms", 0)

    return {
        "labels": {
            "baseline": baseline_label,
            "candidate": candidate_label,
        },
        "query_count": {
            "baseline": baseline.get("query_count", 0),
            "candidate": candidate.get("query_count", 0),
            "shared": len(query_deltas),
        },
        "metrics": {
            "baseline": baseline_means,
            "candidate": candidate_means,
            "delta": deltas,
        },
        "latency_ms": {
            "baseline": latency_baseline,
            "candidate": latency_candidate,
            "delta": latency_candidate - latency_baseline,
            "ratio": round((latency_candidate / latency_baseline), 4) if latency_baseline else None,
        },
        "rank_metric": rank_metric,
        "query_delta_counts": {
            "improved": improved,
            "unchanged": unchanged,
            "regressed": regressed,
        },
        "top_uplift_queries": query_deltas[:top_n],
        "top_regression_queries": sorted(
            query_deltas,
            key=lambda row: (
                row["delta"][rank_metric],
                row["delta"]["mrr"],
                row["delta"]["hit_rate"],
                row["id"],
            ),
        )[:top_n],
    }


def run_compare(
    *,
    qdrant_path: str | None = None,
    qdrant_url: str | None = None,
    validation_set_path: str | None = None,
    min_score: float = 0.35,
    neighbor_score: float = 0.8,
    rrf_k: int = 60,
    top_k: int = 5,
    compare_top_n: int = 10,
    rank_metric: str = "ndcg_5",
) -> dict[str, Any]:
    """Qdrant-only vs Neo4j-enabled 벤치마크를 순차 비교한다."""
    baseline = run(
        qdrant_path=qdrant_path,
        qdrant_url=qdrant_url,
        use_neo4j=False,
        validation_set_path=validation_set_path,
        min_score=min_score,
        neighbor_score=neighbor_score,
        rrf_k=rrf_k,
        top_k=top_k,
    )
    candidate = run(
        qdrant_path=qdrant_path,
        qdrant_url=qdrant_url,
        use_neo4j=True,
        validation_set_path=validation_set_path,
        min_score=min_score,
        neighbor_score=neighbor_score,
        rrf_k=rrf_k,
        top_k=top_k,
    )
    return {
        "baseline": baseline,
        "candidate": candidate,
        "comparison": build_compare_summary(
            baseline,
            candidate,
            top_n=compare_top_n,
            rank_metric=rank_metric,
        ),
    }


def _print_table(summary: dict) -> None:
    """결과를 터미널 테이블로 출력."""
    params = summary["params"]
    metrics = summary["metrics"]

    print()
    print("=" * 62)
    print("  S5 KB Benchmark Results")
    print("=" * 62)
    print(f"  min_score={params['min_score']}, neighbor_score={params['neighbor_score']}, "
          f"rrf_k={params['rrf_k']}, top_k={params['top_k']}, neo4j={params['neo4j']}")
    print(f"  Queries: {summary['query_count']}, Total: {summary['total_ms']}ms")
    if "oracle" in summary:
        oracle = summary["oracle"]
        print(
            "  "
            f"Oracle: queries={oracle['query_count']}, "
            f"full_pass={oracle['full_pass_rate']:.4f}, "
            f"mean_pass={oracle['mean_pass_rate']:.4f}, "
            f"checks={oracle['passed_checks']}/{oracle['total_checks']}"
        )
    print("-" * 62)
    print(f"  {'Metric':<15} {'Mean':>8} {'Std':>8} {'Min':>8} {'Max':>8}")
    print("-" * 62)
    for name, vals in metrics.items():
        print(f"  {name:<15} {vals['mean']:>8.4f} {vals['std']:>8.4f} {vals['min']:>8.4f} {vals['max']:>8.4f}")
    print("=" * 62)
    print()


def _print_compare_table(compare_payload: dict) -> None:
    """비교 결과를 콘솔에 출력."""
    comparison = compare_payload["comparison"]
    baseline_label = comparison["labels"]["baseline"]
    candidate_label = comparison["labels"]["candidate"]
    rank_metric = comparison["rank_metric"]

    print()
    print("=" * 80)
    print("  S5 KB Graph Benchmark Compare")
    print("=" * 80)
    print(
        f"  Queries(shared): {comparison['query_count']['shared']} | "
        f"Latency {baseline_label}={comparison['latency_ms']['baseline']}ms, "
        f"{candidate_label}={comparison['latency_ms']['candidate']}ms, "
        f"ratio={comparison['latency_ms']['ratio']}"
    )
    print("-" * 80)
    print(f"  {'Metric':<15} {baseline_label:<14} {candidate_label:<14} {'Delta':>8}")
    print("-" * 80)
    for metric in _METRIC_KEYS:
        baseline_val = comparison["metrics"]["baseline"][metric]
        candidate_val = comparison["metrics"]["candidate"][metric]
        delta_val = comparison["metrics"]["delta"][metric]
        print(f"  {metric:<15} {baseline_val:<14.4f} {candidate_val:<14.4f} {delta_val:>8.4f}")
    print("-" * 80)
    print(
        f"  Query deltas ({rank_metric}): improved={comparison['query_delta_counts']['improved']}, "
        f"unchanged={comparison['query_delta_counts']['unchanged']}, "
        f"regressed={comparison['query_delta_counts']['regressed']}"
    )
    print("-" * 80)
    print(f"  Top uplift queries by {rank_metric}")
    print("-" * 80)
    for row in comparison["top_uplift_queries"][:5]:
        print(
            f"  {row['id']:<5} Δ{rank_metric}={row['delta'][rank_metric]:>7.4f} "
            f"ΔMRR={row['delta']['mrr']:>7.4f} "
            f"| {row['query']}"
        )
    print("=" * 80)
    print()


def main():
    parser = argparse.ArgumentParser(description="S5 KB 검색 정확도 벤치마크")
    parser.add_argument("--qdrant-path", default=None, help="Qdrant 파일 경로 (기본: data/qdrant)")
    parser.add_argument("--qdrant-url", default=None, help="Qdrant 서버 URL")
    parser.add_argument("--neo4j", action="store_true", help="Neo4j 그래프 사용 (기본: NullGraph)")
    parser.add_argument("--validation-set", default=None, help="validation set JSON 경로")
    parser.add_argument("--min-score", type=float, default=0.35)
    parser.add_argument("--neighbor-score", type=float, default=0.8)
    parser.add_argument("--rrf-k", type=int, default=60)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--compare-neo4j", action="store_true", help="Qdrant-only와 Neo4j-enabled 결과를 순차 비교")
    parser.add_argument("--compare-top-n", type=int, default=10, help="비교 결과에 포함할 상위 query delta 개수")
    parser.add_argument("--rank-metric", default="ndcg_5", choices=_METRIC_KEYS, help="비교 시 query delta 정렬 기준")
    parser.add_argument("--output", default=None, help="결과 JSON 출력 경로")
    args = parser.parse_args()

    if not args.qdrant_path and not args.qdrant_url:
        args.qdrant_path = "data/qdrant"

    if args.compare_neo4j:
        summary = run_compare(
            qdrant_path=args.qdrant_path,
            qdrant_url=args.qdrant_url,
            validation_set_path=args.validation_set,
            min_score=args.min_score,
            neighbor_score=args.neighbor_score,
            rrf_k=args.rrf_k,
            top_k=args.top_k,
            compare_top_n=args.compare_top_n,
            rank_metric=args.rank_metric,
        )
        _print_table(summary["baseline"])
        _print_table(summary["candidate"])
        _print_compare_table(summary)
    else:
        summary = run(
            qdrant_path=args.qdrant_path,
            qdrant_url=args.qdrant_url,
            use_neo4j=args.neo4j,
            validation_set_path=args.validation_set,
            min_score=args.min_score,
            neighbor_score=args.neighbor_score,
            rrf_k=args.rrf_k,
            top_k=args.top_k,
        )
        _print_table(summary)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        print(f"  결과 저장: {args.output}")


if __name__ == "__main__":
    main()
