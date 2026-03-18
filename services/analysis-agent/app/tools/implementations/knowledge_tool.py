"""KnowledgeTool — knowledge.search tool 구현체. knowledge-base 서비스에 HTTP 위임."""

from __future__ import annotations

import json
import logging

import httpx

from app.context import get_request_id
from app.schemas.agent import ToolResult

logger = logging.getLogger(__name__)


class KnowledgeTool:
    """knowledge.search tool — knowledge-base 서비스에 HTTP 요청."""

    def __init__(self, base_url: str = "http://localhost:8002") -> None:
        self._base_url = base_url
        self._client = httpx.AsyncClient(timeout=10.0)

    async def execute(self, arguments: dict) -> ToolResult:
        query = arguments.get("query", "")
        top_k = arguments.get("top_k", 5)

        if not query:
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content='{"error": "query parameter is required"}',
                error="Missing query parameter",
            )

        try:
            headers: dict[str, str] = {}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            resp = await self._client.post(
                f"{self._base_url}/v1/search",
                json={"query": query, "top_k": top_k},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            new_refs = [f"eref-knowledge-{h['id']}" for h in data.get("hits", [])]
            return ToolResult(
                tool_call_id="",
                name="",
                success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
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
