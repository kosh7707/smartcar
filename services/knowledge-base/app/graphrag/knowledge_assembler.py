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
        *,
        neighbor_score: float = 0.8,
    ) -> None:
        self._vector = vector_search
        self._graph = relation_graph
        self._neighbor_score = neighbor_score

    def _enrich_with_graph(
        self, node_id: str, hit_dict: dict,
    ) -> tuple[set[str], set[str], set[str]]:
        """그래프 관계를 hit에 추가하고 관련 ID 집합을 반환한다."""
        cwe: set[str] = set()
        cve: set[str] = set()
        attack: set[str] = set()
        related = self._graph.get_related(node_id)
        if related:
            hit_dict["graph_relations"] = related
            cwe.update(related.get("cwe", []))
            cve.update(related.get("cve", []))
            attack.update(related.get("attack", []))
        return cwe, cve, attack

    def _path_id_exact(
        self,
        extracted_ids: list[str],
        seen_ids: set[str],
        graph_depth: int,
        top_k: int,
    ) -> tuple[list[dict], set[str], set[str], set[str]]:
        """경로 1: ID 직접 조회 + 그래프 이웃."""
        enriched_hits: list[dict] = []
        graph_neighbor_hits: list[dict] = []
        all_cwe: set[str] = set()
        all_cve: set[str] = set()
        all_attack: set[str] = set()

        for eid in extracted_ids:
            if eid in seen_ids:
                continue

            node_info = self._graph.get_node_info(eid)
            if node_info is None:
                continue

            hit_dict = {
                "id": node_info.get("id", eid),
                "source": node_info.get("source", ""),
                "title": node_info.get("title", ""),
                "score": 1.0,
                "threat_category": node_info.get("threat_category", ""),
                "match_type": "id_exact",
            }

            cwe, cve, att = self._enrich_with_graph(eid, hit_dict)
            all_cwe |= cwe
            all_cve |= cve
            all_attack |= att

            # 이웃 노드 수집
            neighbor_ids = self._graph.neighbors(eid, depth=min(graph_depth, 2))
            for nid in neighbor_ids[:10]:
                if nid in seen_ids:
                    continue
                ninfo = self._graph.get_node_info(nid)
                if not ninfo:
                    continue
                neighbor_dict = {
                    "id": ninfo.get("id", nid),
                    "source": ninfo.get("source", ""),
                    "title": ninfo.get("title", ""),
                    "score": self._neighbor_score,
                    "threat_category": ninfo.get("threat_category", ""),
                    "match_type": "graph_neighbor",
                }
                n_cwe, n_cve, n_att = self._enrich_with_graph(nid, neighbor_dict)
                all_cwe |= n_cwe
                all_cve |= n_cve
                all_attack |= n_att
                graph_neighbor_hits.append(neighbor_dict)
                seen_ids.add(nid)

            enriched_hits.append(hit_dict)
            seen_ids.add(eid)

        # 이웃 hits를 top_k 범위 내에서 추가
        remaining = max(0, top_k - len(enriched_hits))
        enriched_hits.extend(graph_neighbor_hits[:remaining])

        return enriched_hits, all_cwe, all_cve, all_attack

    def _path_vector_semantic(
        self,
        query: str,
        seen_ids: set[str],
        top_k: int,
        min_score: float,
    ) -> tuple[list[dict], set[str], set[str], set[str]]:
        """경로 2: 벡터 시맨틱 검색 + 그래프 보강."""
        enriched_hits: list[dict] = []
        all_cwe: set[str] = set()
        all_cve: set[str] = set()
        all_attack: set[str] = set()

        vector_hits = self._vector.search(query, top_k=top_k, min_score=min_score)

        for hit in vector_hits:
            if hit.id in seen_ids:
                continue
            if len(enriched_hits) >= top_k * 2:
                break

            hit_dict = {
                "id": hit.id,
                "source": hit.source,
                "title": hit.title,
                "score": hit.score,
                "threat_category": hit.threat_category,
                "match_type": "vector_semantic",
            }

            cwe, cve, att = self._enrich_with_graph(hit.id, hit_dict)
            all_cwe |= cwe
            all_cve |= cve
            all_attack |= att

            all_cwe.update(hit.related_cwe)
            all_cve.update(hit.related_cve)
            all_attack.update(hit.related_attack)

            enriched_hits.append(hit_dict)
            seen_ids.add(hit.id)

        return enriched_hits, all_cwe, all_cve, all_attack

    def assemble(
        self,
        query: str,
        *,
        top_k: int = 5,
        min_score: float = 0.35,
        graph_depth: int = 2,
        exclude_ids: list[str] | None = None,
    ) -> dict:
        """3경로 하이브리드 검색 → 병합 → 그래프 보강."""
        seen_ids: set[str] = set(exclude_ids) if exclude_ids else set()
        extracted_ids = _extract_ids(query)

        exact_hits, cwe1, cve1, att1 = self._path_id_exact(
            extracted_ids, seen_ids, graph_depth, top_k,
        )
        vector_hits, cwe2, cve2, att2 = self._path_vector_semantic(
            query, seen_ids, top_k, min_score,
        )

        all_hits = exact_hits + vector_hits
        all_hits.sort(key=lambda h: h.get("score", 0), reverse=True)

        return {
            "query": query,
            "hits": all_hits,
            "total": len(all_hits),
            "extracted_ids": extracted_ids,
            "related_cwe": sorted(cwe1 | cwe2),
            "related_cve": sorted(cve1 | cve2),
            "related_attack": sorted(att1 | att2),
            "match_type_counts": {
                "id_exact": sum(1 for h in all_hits if h.get("match_type") == "id_exact"),
                "graph_neighbor": sum(1 for h in all_hits if h.get("match_type") == "graph_neighbor"),
                "vector_semantic": sum(1 for h in all_hits if h.get("match_type") == "vector_semantic"),
            },
        }
