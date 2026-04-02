"""벤치마크 메트릭 함수 단위 테스트."""

import sys
from pathlib import Path

# scripts/benchmark를 import 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "benchmark"))

from metrics import f1_at_k, hit_rate, mrr, ndcg_at_k, precision_at_k, recall_at_k


# ── Precision@k ──


def test_precision_perfect():
    """모든 결과가 관련 → P@3 = 1.0."""
    assert precision_at_k(["A", "B", "C"], {"A", "B", "C"}, 3) == 1.0


def test_precision_none():
    """관련 결과 없음 → P@3 = 0.0."""
    assert precision_at_k(["X", "Y", "Z"], {"A", "B"}, 3) == 0.0


def test_precision_partial():
    """일부만 관련 → P@4 = 0.5."""
    assert precision_at_k(["A", "X", "B", "Y"], {"A", "B"}, 4) == 0.5


# ── Recall@k ──


def test_recall_all_found():
    """모든 관련 항목이 상위 k에 포함 → R@3 = 1.0."""
    assert recall_at_k(["A", "B", "C"], {"A", "B"}, 3) == 1.0


def test_recall_partial():
    """일부만 상위 k에 포함 → R@2 = 0.5."""
    assert recall_at_k(["A", "X"], {"A", "B"}, 2) == 0.5


# ── F1@k ──


def test_f1_perfect():
    """P=1.0, R=1.0 → F1 = 1.0."""
    assert f1_at_k(["A", "B"], {"A", "B"}, 2) == 1.0


def test_f1_zero():
    """P=0, R=0 → F1 = 0."""
    assert f1_at_k(["X"], {"A"}, 1) == 0.0


# ── NDCG@k ──


def test_ndcg_perfect_order():
    """이상적 순서 → NDCG = 1.0."""
    assert ndcg_at_k(["A", "B", "C"], ["A", "B", "C"], 3) == 1.0


def test_ndcg_reversed_order():
    """역순 → NDCG < 1.0."""
    score = ndcg_at_k(["C", "B", "A"], ["A", "B", "C"], 3)
    assert 0.0 < score < 1.0


def test_ndcg_no_relevant():
    """관련 항목 없음 → NDCG = 0.0."""
    assert ndcg_at_k(["X", "Y"], ["A", "B"], 2) == 0.0


# ── MRR ──


def test_mrr_first():
    """첫 결과가 관련 → MRR = 1.0."""
    assert mrr(["A", "X", "Y"], {"A"}) == 1.0


def test_mrr_third():
    """세 번째에 첫 관련 → MRR = 1/3."""
    assert abs(mrr(["X", "Y", "A"], {"A"}) - 1 / 3) < 1e-9


def test_mrr_not_found():
    """관련 항목 없음 → MRR = 0.0."""
    assert mrr(["X", "Y", "Z"], {"A"}) == 0.0


# ── Hit Rate ──


def test_hit_rate_found():
    """관련 항목 하나라도 있으면 1.0."""
    assert hit_rate(["X", "A", "Y"], {"A"}) == 1.0


def test_hit_rate_not_found():
    """관련 항목 없으면 0.0."""
    assert hit_rate(["X", "Y"], {"A"}) == 0.0
