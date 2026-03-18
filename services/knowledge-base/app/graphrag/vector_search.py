"""VectorSearch — 기존 ThreatSearch의 얇은 래퍼."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.rag.threat_search import ThreatHit, ThreatSearch


class VectorSearch:
    """Qdrant 벡터 유사도 검색을 위임한다."""

    def __init__(self, threat_search: ThreatSearch) -> None:
        self._search = threat_search

    def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.35,
    ) -> list[ThreatHit]:
        return self._search.search(query, top_k=top_k, min_score=min_score)
