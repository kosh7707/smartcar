"""위협 지식 DB 벡터 검색 클라이언트."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from qdrant_client import QdrantClient

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
COLLECTION = "threat_knowledge"


@dataclass
class ThreatHit:
    """벡터 검색 결과 단건."""
    id: str
    source: str
    title: str
    threat_category: str = ""
    severity: float | None = None
    attack_surfaces: list[str] = field(default_factory=list)
    related_cwe: list[str] = field(default_factory=list)
    related_cve: list[str] = field(default_factory=list)
    related_attack: list[str] = field(default_factory=list)
    score: float = 0.0


class ThreatSearch:
    """위협 지식 DB 벡터 검색 클라이언트.

    Qdrant 파일 기반 스토리지에서 시맨틱 검색을 수행한다.
    ETL(build.py)이 사전에 실행되어 data/qdrant에 컬렉션이 존재해야 한다.
    """

    def __init__(self, qdrant_path: str) -> None:
        self._client = QdrantClient(path=qdrant_path)
        self._client.set_model(EMBEDDING_MODEL)

        # 컬렉션 존재 확인
        collections = [c.name for c in self._client.get_collections().collections]
        if COLLECTION not in collections:
            raise RuntimeError(
                f"Qdrant 컬렉션 '{COLLECTION}'이 없습니다. "
                f"ETL을 먼저 실행하세요: python scripts/threat-db/build.py"
            )
        logger.info(
            "ThreatSearch 초기화 완료: path=%s, collection=%s",
            qdrant_path, COLLECTION,
        )

    def search(
        self, query: str, top_k: int = 5, min_score: float = 0.0,
    ) -> list[ThreatHit]:
        """시맨틱 검색 -> 상위 k건 반환 (min_score 미만 제외)."""
        results = self._client.query(
            collection_name=COLLECTION,
            query_text=query,
            limit=top_k,
        )
        hits = [
            ThreatHit(
                id=r.metadata.get("id", ""),
                source=r.metadata.get("source", ""),
                title=r.metadata.get("title", ""),
                threat_category=r.metadata.get("threat_category", ""),
                severity=r.metadata.get("severity"),
                attack_surfaces=r.metadata.get("attack_surfaces", []),
                related_cwe=r.metadata.get("related_cwe", []),
                related_cve=r.metadata.get("related_cve", []),
                related_attack=r.metadata.get("related_attack", []),
                score=r.score,
            )
            for r in results
        ]
        if min_score > 0:
            hits = [h for h in hits if h.score >= min_score]
        return hits

    def scroll_all_metadata(self) -> list[dict]:
        """Qdrant 컬렉션의 전체 레코드 메타데이터를 반환한다 (그래프 구축용)."""
        all_records: list[dict] = []
        offset = None
        while True:
            records, next_offset = self._client.scroll(
                collection_name=COLLECTION,
                limit=256,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for rec in records:
                if rec.payload:
                    all_records.append(rec.payload)
            if next_offset is None:
                break
            offset = next_offset
        logger.info("전체 레코드 스크롤 완료: %d건", len(all_records))
        return all_records

    def close(self) -> None:
        """Qdrant 클라이언트 종료."""
        self._client.close()
        logger.info("ThreatSearch 종료")
