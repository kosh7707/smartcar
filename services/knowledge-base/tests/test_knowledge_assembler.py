"""KnowledgeAssembler 단위 테스트 — ThreatSearch와 Graph를 mock하여 검증."""

from dataclasses import dataclass
from unittest.mock import MagicMock

from app.graphrag.knowledge_assembler import KnowledgeAssembler
from app.graphrag.vector_search import VectorSearch


@dataclass
class FakeHit:
    id: str = "CWE-78"
    source: str = "CWE"
    title: str = "OS Command Injection"
    threat_category: str = "Injection"
    severity: float | None = None
    attack_surfaces: list = None
    related_cwe: list = None
    related_cve: list = None
    related_attack: list = None
    score: float = 0.85

    def __post_init__(self):
        self.attack_surfaces = self.attack_surfaces or []
        self.related_cwe = self.related_cwe or []
        self.related_cve = self.related_cve or ["CVE-2021-28372"]
        self.related_attack = self.related_attack or []


class FakeGraph:
    """Neo4jGraph 인터페이스의 경량 mock."""

    def __init__(self, records: list[dict]):
        self._nodes = {r["id"]: r for r in records}
        self._edges: dict[str, dict[str, list[str]]] = {}
        for rec in records:
            related: dict[str, list[str]] = {}
            for field, key in [("related_capec", "capec"), ("related_cwe", "cwe"),
                               ("related_cve", "cve"), ("related_attack", "attack")]:
                ids = rec.get(field, [])
                if ids:
                    related[key] = ids
            if related:
                self._edges[rec["id"]] = related

    def get_related(self, node_id: str) -> dict[str, list[str]]:
        return self._edges.get(node_id, {})

    def get_node_info(self, node_id: str) -> dict | None:
        return self._nodes.get(node_id)

    def neighbors(self, node_id: str, depth: int = 2) -> list[str]:
        related = self._edges.get(node_id, {})
        result = []
        for ids in related.values():
            result.extend(ids)
        return result


def _make_assembler(hits: list | None = None) -> KnowledgeAssembler:
    mock_search = MagicMock()
    mock_search.search.return_value = hits if hits is not None else [FakeHit()]
    vs = VectorSearch.__new__(VectorSearch)
    vs._search = mock_search

    graph = FakeGraph([
        {"id": "CWE-78", "source": "CWE", "title": "OS CI", "related_capec": ["CAPEC-88"], "related_cve": [], "related_cwe": [], "related_attack": []},
        {"id": "CAPEC-88", "source": "CAPEC", "title": "OS CI Attack", "related_cwe": ["CWE-78"], "related_cve": [], "related_attack": [], "related_capec": []},
    ])

    return KnowledgeAssembler(vs, graph)


def test_assemble_combines_vector_and_graph():
    assembler = _make_assembler()
    result = assembler.assemble("command injection")
    assert result["total"] >= 1
    # graph enrichment should add CAPEC-88
    assert "CAPEC-88" in str(result)


def test_assemble_no_hits():
    assembler = _make_assembler(hits=[])
    result = assembler.assemble("unknown query")
    assert result["total"] == 0
    assert result["hits"] == []


def test_assemble_collects_cross_references():
    assembler = _make_assembler()
    result = assembler.assemble("CWE-78")
    # ID 직접 조회로 CWE-78이 잡히고, 그래프 이웃(CAPEC-88)이 related_capec에 포함
    assert "CAPEC-88" in str(result)


def test_assemble_returns_sorted_references():
    hit1 = FakeHit(id="CWE-78", related_cve=["CVE-2023-001", "CVE-2021-002"])
    assembler = _make_assembler(hits=[hit1])
    result = assembler.assemble("injection")
    assert result["related_cve"] == sorted(result["related_cve"])


def test_hybrid_id_exact_match():
    """쿼리에 CWE-78이 명시되면 ID 직접 조회로 score=1.0 hit이 나와야 한다."""
    assembler = _make_assembler(hits=[])  # 벡터 검색 0건
    result = assembler.assemble("CWE-78 command injection")

    assert result["total"] >= 1
    assert result["extracted_ids"] == ["CWE-78"]

    # 첫 번째 hit이 CWE-78 (ID 정확 매칭, score=1.0)
    top = result["hits"][0]
    assert top["id"] == "CWE-78"
    assert top["score"] == 1.0
    assert top["match_type"] == "id_exact"

    # 그래프 이웃(CAPEC-88)도 포함
    all_ids = {h["id"] for h in result["hits"]}
    assert "CAPEC-88" in all_ids


def test_hybrid_deduplication():
    """벡터 검색과 ID 조회가 같은 노드를 반환하면 중복 제거."""
    hit = FakeHit(id="CWE-78")
    assembler = _make_assembler(hits=[hit])
    result = assembler.assemble("CWE-78 injection")

    cwe78_hits = [h for h in result["hits"] if h["id"] == "CWE-78"]
    assert len(cwe78_hits) == 1  # 중복 없음
