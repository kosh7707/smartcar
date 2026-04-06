"""벤치마크 fixture / sweep 회귀 테스트."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.benchmark import run_benchmark
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
        if query.get("required_match_types"):
            assert set(query["required_match_types"]) <= {
                "id_exact",
                "graph_neighbor",
                "vector_semantic",
            }


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


def test_validation_set_graph_oracle_floor():
    queries = _load_queries()
    oracle_queries = [q for q in queries if q.get("required_match_types")]

    assert len(oracle_queries) >= 4
    assert any("graph_neighbor" in q["required_match_types"] for q in oracle_queries)


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


def test_build_compare_summary_sorts_uplift_and_regression():
    baseline = {
        "query_count": 2,
        "total_ms": 100,
        "metrics": {
            "precision_1": {"mean": 0.2},
            "precision_5": {"mean": 0.3},
            "recall_5": {"mean": 0.4},
            "f1_5": {"mean": 0.35},
            "ndcg_5": {"mean": 0.45},
            "mrr": {"mean": 0.5},
            "hit_rate": {"mean": 0.6},
        },
        "per_query": [
            {
                "id": "q1",
                "query": "first query",
                "retrieved_ids": ["A", "B"],
                "ndcg_5": 0.1,
                "mrr": 0.0,
                "hit_rate": 0.0,
                "top1_correct": False,
            },
            {
                "id": "q2",
                "query": "second query",
                "retrieved_ids": ["X", "Y"],
                "ndcg_5": 0.9,
                "mrr": 1.0,
                "hit_rate": 1.0,
                "top1_correct": True,
            },
        ],
    }
    candidate = {
        "query_count": 2,
        "total_ms": 250,
        "metrics": {
            "precision_1": {"mean": 0.6},
            "precision_5": {"mean": 0.5},
            "recall_5": {"mean": 0.7},
            "f1_5": {"mean": 0.58},
            "ndcg_5": {"mean": 0.7},
            "mrr": {"mean": 0.75},
            "hit_rate": {"mean": 0.8},
        },
        "per_query": [
            {
                "id": "q1",
                "query": "first query",
                "retrieved_ids": ["R", "A"],
                "ndcg_5": 0.95,
                "mrr": 1.0,
                "hit_rate": 1.0,
                "top1_correct": True,
            },
            {
                "id": "q2",
                "query": "second query",
                "retrieved_ids": ["Z", "X"],
                "ndcg_5": 0.5,
                "mrr": 0.5,
                "hit_rate": 1.0,
                "top1_correct": False,
            },
        ],
    }

    summary = run_benchmark.build_compare_summary(baseline, candidate, top_n=2)

    assert summary["metrics"]["delta"]["ndcg_5"] == 0.25
    assert summary["latency_ms"]["delta"] == 150
    assert summary["latency_ms"]["ratio"] == 2.5
    assert summary["query_delta_counts"] == {
        "improved": 1,
        "unchanged": 0,
        "regressed": 1,
    }
    assert summary["top_uplift_queries"][0]["id"] == "q1"
    assert summary["top_uplift_queries"][0]["delta"]["ndcg_5"] == 0.85
    assert summary["top_regression_queries"][0]["id"] == "q2"
    assert summary["top_regression_queries"][0]["delta"]["ndcg_5"] == -0.4


def test_run_compare_executes_sequential_profiles(monkeypatch):
    calls: list[bool] = []

    def fake_run(*, use_neo4j: bool, **kwargs):
        calls.append(use_neo4j)
        value = 0.6 if use_neo4j else 0.4
        return {
            "query_count": 1,
            "total_ms": 300 if use_neo4j else 100,
            "metrics": {
                "precision_1": {"mean": value},
                "precision_5": {"mean": value},
                "recall_5": {"mean": value},
                "f1_5": {"mean": value},
                "ndcg_5": {"mean": value},
                "mrr": {"mean": value},
                "hit_rate": {"mean": value},
            },
            "per_query": [
                {
                    "id": "q1",
                    "query": "query",
                    "retrieved_ids": ["A"],
                    "ndcg_5": value,
                    "mrr": value,
                    "hit_rate": value,
                }
            ],
        }

    monkeypatch.setattr(run_benchmark, "run", fake_run)

    summary = run_benchmark.run_compare(compare_top_n=1)

    assert calls == [False, True]
    assert summary["comparison"]["metrics"]["delta"]["ndcg_5"] == 0.2
    assert summary["comparison"]["top_uplift_queries"][0]["id"] == "q1"


def test_run_aggregates_graph_oracle(monkeypatch):
    def fake_load_validation_set(_path=None):
        return {
            "queries": [
                {
                    "id": "q1",
                    "query": "CWE-78",
                    "expected_ids": ["CWE-78"],
                    "required_match_types": ["id_exact", "graph_neighbor"],
                },
                {
                    "id": "q2",
                    "query": "semantic query",
                    "expected_ids": ["CWE-20"],
                    "required_match_types": ["vector_semantic"],
                },
            ]
        }

    class FakeAssembler:
        def assemble(self, query, **kwargs):
            if query == "CWE-78":
                return {
                    "hits": [
                        {"id": "CWE-78", "match_type": "id_exact"},
                        {"id": "CAPEC-88", "match_type": "graph_neighbor"},
                    ]
                }
            return {
                "hits": [
                    {"id": "CWE-20", "match_type": "graph_neighbor"},
                ]
            }

    class FakeTs:
        def close(self):
            return None

    monkeypatch.setattr(run_benchmark, "_load_validation_set", fake_load_validation_set)
    monkeypatch.setattr(
        run_benchmark,
        "_build_assembler",
        lambda *args, **kwargs: (FakeAssembler(), FakeTs()),
    )

    summary = run_benchmark.run(qdrant_path="data/qdrant")

    assert summary["oracle"] == {
        "query_count": 2,
        "full_pass_count": 1,
        "full_pass_rate": 0.5,
        "mean_pass_rate": 0.5,
        "passed_checks": 2,
        "total_checks": 3,
    }
    assert summary["per_query"][0]["oracle"]["all_passed"] is True
    assert summary["per_query"][1]["oracle"]["all_passed"] is False
