"""S5 Knowledge Base 위협 검색 HTTP 클라이언트."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import httpx

from app.context import get_request_id

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0  # S5 API 계약: 10초


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
    """S5 Knowledge Base 위협 검색 HTTP 클라이언트.

    S5(KB) 서비스의 POST /v1/search 엔드포인트를 호출하여
    시맨틱 검색 결과를 반환한다.
    """

    def __init__(self, kb_endpoint: str) -> None:
        self._kb_endpoint = kb_endpoint.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._kb_endpoint,
            timeout=_TIMEOUT,
        )
        logger.info("ThreatSearch 초기화 완료: kb_endpoint=%s", self._kb_endpoint)

    async def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.0,
        graph_depth: int = 2,
    ) -> list[ThreatHit]:
        """S5 KB 시맨틱 검색 -> 상위 k건 반환."""
        headers: dict[str, str] = {}
        request_id = get_request_id()
        if request_id:
            headers["X-Request-Id"] = request_id

        start = time.monotonic()
        try:
            resp = await self._client.post(
                "/v1/search",
                json={
                    "query": query,
                    "top_k": top_k,
                    "min_score": min_score,
                    "graph_depth": graph_depth,
                },
                headers=headers,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            latency_ms = int((time.monotonic() - start) * 1000)
            logger.error(
                "S5 KB 검색 실패 requestId=%s, error=HTTP_%d, latencyMs=%d, query=%s, body=%s",
                get_request_id(), e.response.status_code, latency_ms,
                query[:80], e.response.text[:200] if e.response.text else "",
            )
            return []
        except httpx.ConnectError:
            latency_ms = int((time.monotonic() - start) * 1000)
            logger.error(
                "S5 KB 검색 실패 requestId=%s, error=CONNECT, latencyMs=%d, query=%s",
                get_request_id(), latency_ms, query[:80],
            )
            return []
        except httpx.TimeoutException:
            latency_ms = int((time.monotonic() - start) * 1000)
            logger.error(
                "S5 KB 검색 실패 requestId=%s, error=TIMEOUT, latencyMs=%d, query=%s",
                get_request_id(), latency_ms, query[:80],
            )
            return []

        data = resp.json()
        hits: list[ThreatHit] = []
        for h in data.get("hits", []):
            graph_relations = h.get("graph_relations", {})
            hits.append(ThreatHit(
                id=h.get("id", ""),
                source=h.get("source", ""),
                title=h.get("title", ""),
                threat_category=h.get("threat_category", ""),
                severity=None,
                attack_surfaces=[],
                related_cwe=graph_relations.get("cwe", []),
                related_cve=graph_relations.get("cve", []),
                related_attack=graph_relations.get("attack", []),
                score=h.get("score", 0.0),
            ))
        return hits

    async def close(self) -> None:
        """httpx 클라이언트 종료."""
        await self._client.aclose()
        logger.info("ThreatSearch 종료")
