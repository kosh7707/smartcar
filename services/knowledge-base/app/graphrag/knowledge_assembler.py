"""KnowledgeAssembler — 하이브리드 검색 (ID 직접조회 + 벡터 + 그래프 보강)."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Protocol

from app.graphrag.vector_search import VectorSearch

if TYPE_CHECKING:
    from app.rag.threat_search import ThreatHit

logger = logging.getLogger(__name__)

# 쿼리에서 CWE/CVE/ATT&CK/CAPEC ID를 추출하는 패턴
_ID_PATTERNS = [
    re.compile(r"\b(CWE-\d+)\b", re.IGNORECASE),
    re.compile(r"\b(CVE-\d{4}-\d+)\b", re.IGNORECASE),
    re.compile(r"\b(CAPEC-\d+)\b", re.IGNORECASE),
    re.compile(r"\b(T\d{4}(?:\.\d+)?)\b"),  # ATT&CK technique IDs
]


def _extract_ids(query: str) -> list[str]:
    """쿼리에서 위협 DB ID를 추출한다."""
    ids = []
    for pattern in _ID_PATTERNS:
        for match in pattern.finditer(query):
            raw = match.group(1)
            # CWE/CVE/CAPEC는 대문자 정규화
            if raw.upper().startswith(("CWE", "CVE", "CAPEC")):
                raw = raw.upper()
            if raw not in ids:
                ids.append(raw)
    return ids


class GraphLike(Protocol):
    """Neo4jGraph 공통 인터페이스."""

    def get_related(self, node_id: str) -> dict[str, list[str]]: ...
    def get_node_info(self, node_id: str) -> dict | None: ...
    def neighbors(self, node_id: str, depth: int = 2) -> list[str]: ...


class KnowledgeAssembler:
    """하이브리드 검색: ID 직접조회 + 벡터 유사도 + 그래프 보강."""

    def __init__(
        self,
        vector_search: VectorSearch,
        relation_graph: GraphLike,
    ) -> None:
        self._vector = vector_search
        self._graph = relation_graph

    def assemble(
        self,
        query: str,
        *,
        top_k: int = 5,
        min_score: float = 0.35,
        graph_depth: int = 2,
    ) -> dict:
        """3경로 하이브리드 검색 → 병합 → 그래프 보강."""
        seen_ids: set[str] = set()
        enriched_hits: list[dict] = []
        all_related_cwe: set[str] = set()
        all_related_cve: set[str] = set()
        all_related_attack: set[str] = set()

        # ── 경로 1: ID 직접 조회 (Neo4j) ──
        extracted_ids = _extract_ids(query)
        graph_direct_hits: list[dict] = []

        for eid in extracted_ids:
            node_info = self._graph.get_node_info(eid)
            if node_info is None:
                continue

            hit_dict = {
                "id": node_info.get("id", eid),
                "source": node_info.get("source", ""),
                "title": node_info.get("title", ""),
                "score": 1.0,  # 정확 매칭 — 최고 점수
                "threat_category": node_info.get("threat_category", ""),
                "match_type": "id_exact",
            }

            # 그래프 관계 보강
            related = self._graph.get_related(eid)
            if related:
                hit_dict["graph_relations"] = related
                all_related_cwe.update(related.get("cwe", []))
                all_related_cve.update(related.get("cve", []))
                all_related_attack.update(related.get("attack", []))

            # 이웃 노드도 수집 (depth=1로 가까운 것만)
            neighbor_ids = self._graph.neighbors(eid, depth=min(graph_depth, 2))
            for nid in neighbor_ids[:10]:
                ninfo = self._graph.get_node_info(nid)
                if ninfo and nid not in seen_ids:
                    n_related = self._graph.get_related(nid)
                    neighbor_dict = {
                        "id": ninfo.get("id", nid),
                        "source": ninfo.get("source", ""),
                        "title": ninfo.get("title", ""),
                        "score": 0.8,  # 이웃 — 높은 관련성
                        "threat_category": ninfo.get("threat_category", ""),
                        "match_type": "graph_neighbor",
                    }
                    if n_related:
                        neighbor_dict["graph_relations"] = n_related
                    graph_direct_hits.append(neighbor_dict)
                    seen_ids.add(nid)

            enriched_hits.append(hit_dict)
            seen_ids.add(eid)

        # 이웃 hits를 추가 (top_k 범위 내)
        remaining_slots = max(0, top_k - len(enriched_hits))
        enriched_hits.extend(graph_direct_hits[:remaining_slots])

        # ── 경로 2: 벡터 시맨틱 검색 (Qdrant) ──
        vector_hits = self._vector.search(query, top_k=top_k, min_score=min_score)

        for hit in vector_hits:
            if hit.id in seen_ids:
                continue
            if len(enriched_hits) >= top_k * 2:  # 최대 2배까지 허용
                break

            hit_dict = {
                "id": hit.id,
                "source": hit.source,
                "title": hit.title,
                "score": hit.score,
                "threat_category": hit.threat_category,
                "match_type": "vector_semantic",
            }

            # 그래프 관계 보강
            related = self._graph.get_related(hit.id)
            if related:
                hit_dict["graph_relations"] = related
                all_related_cwe.update(related.get("cwe", []))
                all_related_cve.update(related.get("cve", []))
                all_related_attack.update(related.get("attack", []))

            all_related_cwe.update(hit.related_cwe)
            all_related_cve.update(hit.related_cve)
            all_related_attack.update(hit.related_attack)

            enriched_hits.append(hit_dict)
            seen_ids.add(hit.id)

        # 점수 내림차순 정렬
        enriched_hits.sort(key=lambda h: h.get("score", 0), reverse=True)

        return {
            "query": query,
            "hits": enriched_hits,
            "total": len(enriched_hits),
            "extracted_ids": extracted_ids,
            "related_cwe": sorted(all_related_cwe),
            "related_cve": sorted(all_related_cve),
            "related_attack": sorted(all_related_attack),
        }
