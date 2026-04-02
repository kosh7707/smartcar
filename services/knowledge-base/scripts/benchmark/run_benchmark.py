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

    return summary


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
    print("-" * 62)
    print(f"  {'Metric':<15} {'Mean':>8} {'Std':>8} {'Min':>8} {'Max':>8}")
    print("-" * 62)
    for name, vals in metrics.items():
        print(f"  {name:<15} {vals['mean']:>8.4f} {vals['std']:>8.4f} {vals['min']:>8.4f} {vals['max']:>8.4f}")
    print("=" * 62)
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
    parser.add_argument("--output", default=None, help="결과 JSON 출력 경로")
    args = parser.parse_args()

    if not args.qdrant_path and not args.qdrant_url:
        args.qdrant_path = "data/qdrant"

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
