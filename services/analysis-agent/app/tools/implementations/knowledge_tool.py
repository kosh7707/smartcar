"""KnowledgeTool — knowledge.search tool 구현체. knowledge-base 서비스에 HTTP 위임."""

from __future__ import annotations

import json
import logging

import httpx

from agent_shared.context import get_request_id
from agent_shared.schemas.agent import ToolResult
from agent_shared.schemas.upstream import KbSearchHit

logger = logging.getLogger(__name__)


def _is_kb_not_ready(response: httpx.Response | None) -> bool:
    if response is None or response.status_code != 503:
        return False
    try:
        data = response.json()
    except Exception:
        return False
    return data.get("errorDetail", {}).get("code") == "KB_NOT_READY"


class KnowledgeTool:
    """knowledge.search tool — knowledge-base 서비스에 HTTP 요청."""

    def __init__(self, base_url: str = "http://localhost:8002") -> None:
        self._base_url = base_url
        self._client = httpx.AsyncClient(timeout=10.0)

    async def execute(self, arguments: dict) -> ToolResult:
        query = arguments.get("query", "")
        top_k = arguments.get("top_k", 5)
        source_filter = arguments.get("source_filter")
        exclude_ids = arguments.get("exclude_ids")

        if not query:
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content='{"error": "query parameter is required"}',
                error="Missing query parameter",
            )

        try:
            headers: dict[str, str] = {"X-Timeout-Ms": "10000"}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            body: dict = {"query": query}
            if source_filter:
                body["source_filter"] = source_filter
            if exclude_ids:
                body["exclude_ids"] = exclude_ids

            resp = await self._client.post(
                f"{self._base_url}/v1/search",
                json=body,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            hits = [KbSearchHit.model_validate(h) for h in data.get("hits", [])]
            new_refs = [f"eref-knowledge-{h.id}" for h in hits if h.id]

            # Backward compatibility: legacy degraded field from older S5 versions
            if data.get("degraded", False):
                data["_kb_warning"] = (
                    "KB degraded 모드: 그래프 관계(graph_relations, related_cwe/cve/attack)가 "
                    "누락되었을 수 있음. 분석 시 이 한계를 caveats에 반영하라."
                )
                logger.warning("knowledge.search: KB degraded 모드 (그래프 보강 불가)")

            return ToolResult(
                tool_call_id="",
                name="",
                success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
            )
        except httpx.HTTPStatusError as e:
            if _is_kb_not_ready(e.response):
                logger.warning("knowledge.search: KB not ready")
                return ToolResult(
                    tool_call_id="",
                    name="",
                    success=False,
                    content=json.dumps({"error": "KB_NOT_READY", "message": "Knowledge base not ready"}),
                    error="KB_NOT_READY",
                )
            logger.warning("knowledge-base 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content=json.dumps({"error": f"Knowledge base unavailable: {e}"}),
                error=str(e),
            )
        except Exception as e:
            logger.warning("knowledge-base 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content=json.dumps({"error": f"Knowledge base unavailable: {e}"}),
                error=str(e),
            )

    async def aclose(self) -> None:
        await self._client.aclose()
