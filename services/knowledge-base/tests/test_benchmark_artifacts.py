"""벤치마크 fixture / sweep 회귀 테스트."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.benchmark import sweep


_VALIDATION_SET = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "benchmark"
    / "validation_set.json"
)


def _load_queries() -> list[dict]:
    return json.loads(_VALIDATION_SET.read_text())["queries"]


def test_validation_set_shape_and_uniqueness():
    queries = _load_queries()

    assert len(queries) >= 40
    ids = [q["id"] for q in queries]
    assert len(ids) == len(set(ids))

    for query in queries:
        assert query["query"].strip()
        assert query["tags"]
        if query.get("expected_top1") is not None:
            assert query["expected_top1"] in query["expected_ids"]


def test_validation_set_coverage_floors():
    queries = _load_queries()

    mode_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    for query in queries:
        for tag in query.get("tags", []):
            target = mode_counts if tag in {
                "id_exact", "vector_semantic", "attack", "capec", "automotive",
            } else category_counts
            target[tag] = target.get(tag, 0) + 1

    assert mode_counts["id_exact"] >= 18
    assert mode_counts["vector_semantic"] >= 20
    assert mode_counts["automotive"] >= 5
    assert mode_counts["attack"] >= 3
    assert mode_counts["capec"] >= 2
    for required in [
        "memory",
        "injection",
        "authentication",
        "input_validation",
        "cryptography",
        "resource",
        "authorization",
        "configuration",
        "concurrency",
    ]:
        minimum = 2 if required in {"authorization", "configuration", "concurrency"} else 1
        assert category_counts.get(required, 0) >= minimum


def test_sweep_run_and_summary(monkeypatch):
    def fake_run(**kwargs):
        score = kwargs["min_score"] + kwargs["neighbor_score"] + (kwargs["rrf_k"] / 1000)
        return {
            "metrics": {
                "ndcg_5": {"mean": score},
                "mrr": {"mean": score / 2},
                "precision_5": {"mean": 0.5},
                "recall_5": {"mean": 0.6},
                "f1_5": {"mean": 0.55},
                "hit_rate": {"mean": 1.0},
            }
        }

    monkeypatch.setattr(sweep, "run", fake_run)

    result = sweep.run_sweep(
        qdrant_path="data/qdrant",
        top_k=5,
        min_score_range=[0.1, 0.2],
        neighbor_score_range=[0.6],
        rrf_k_range=[0, 60],
    )
    summary = sweep.build_summary(result, top_n=2)

    assert result["total_combinations"] == 4
    assert result["failed_combinations"] == 0
    assert summary["best"]["ndcg_5"] >= summary["top_results"][1]["ndcg_5"]
    assert len(summary["top_results"]) == 2
