"""검색 정확도 메트릭 — Precision, Recall, F1, NDCG, MRR, Hit Rate."""

from __future__ import annotations

import math


def precision_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Precision@k: 상위 k건 중 관련 항목 비율."""
    if k <= 0:
        return 0.0
    top_k = retrieved_ids[:k]
    if not top_k:
        return 0.0
    return sum(1 for rid in top_k if rid in relevant_ids) / len(top_k)


def recall_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Recall@k: 전체 관련 항목 중 상위 k건에 포함된 비율."""
    if not relevant_ids or k <= 0:
        return 0.0
    top_k = retrieved_ids[:k]
    return sum(1 for rid in top_k if rid in relevant_ids) / len(relevant_ids)


def f1_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """F1@k: Precision@k와 Recall@k의 조화 평균."""
    p = precision_at_k(retrieved_ids, relevant_ids, k)
    r = recall_at_k(retrieved_ids, relevant_ids, k)
    if p + r == 0:
        return 0.0
    return 2 * p * r / (p + r)


def ndcg_at_k(retrieved_ids: list[str], relevant_ordered: list[str], k: int) -> float:
    """NDCG@k: 정규화된 할인 누적 이득.

    relevant_ordered의 순서가 이상적 순서(가장 관련 있는 것이 앞).
    관련 항목에 대해 순위 역수 기반 relevance를 부여한다.
    """
    if k <= 0 or not relevant_ordered:
        return 0.0

    # 관련 항목별 relevance 점수 (순서 기반, 가장 앞 = 가장 높은 점수)
    rel_scores = {}
    for i, rid in enumerate(relevant_ordered):
        rel_scores[rid] = len(relevant_ordered) - i

    # DCG@k
    dcg = 0.0
    for i, rid in enumerate(retrieved_ids[:k]):
        rel = rel_scores.get(rid, 0)
        if rel > 0:
            dcg += rel / math.log2(i + 2)  # i+2 because rank starts at 1

    # IDCG@k (이상적 순서)
    ideal_rels = sorted(rel_scores.values(), reverse=True)[:k]
    idcg = sum(r / math.log2(i + 2) for i, r in enumerate(ideal_rels))

    if idcg == 0:
        return 0.0
    return dcg / idcg


def mrr(retrieved_ids: list[str], relevant_ids: set[str]) -> float:
    """MRR (Mean Reciprocal Rank): 첫 번째 관련 항목의 순위 역수."""
    for i, rid in enumerate(retrieved_ids):
        if rid in relevant_ids:
            return 1.0 / (i + 1)
    return 0.0


def hit_rate(retrieved_ids: list[str], relevant_ids: set[str]) -> float:
    """Hit Rate: 관련 항목이 하나라도 포함되면 1.0, 아니면 0.0."""
    for rid in retrieved_ids:
        if rid in relevant_ids:
            return 1.0
    return 0.0
