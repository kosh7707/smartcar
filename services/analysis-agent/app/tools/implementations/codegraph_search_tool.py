"""CodeGraphSearchTool — code_graph.search 도구. S5 KB 코드 그래프 시맨틱 검색 API에 HTTP 위임."""

from __future__ import annotations

import json
import logging

import httpx

from app.clients.kb_error_utils import is_kb_not_ready_response, is_kb_timeout_response
from app.agent_runtime.context import get_request_id
from app.agent_runtime.schemas.agent import ToolResult

logger = logging.getLogger(__name__)


class CodeGraphSearchTool:
    """code_graph.search — S5 KB POST /v1/code-graph/{project_id}/search 호출.

    자연어 쿼리로 코드 함수를 시맨틱 검색한다.
    함수명 정확 매칭 + 벡터 유사도 + 호출 그래프 확장 결합.
    """

    def __init__(self, base_url: str = "http://localhost:8002", project_id: str = "") -> None:
        self._base_url = base_url
        self._project_id = project_id
        self._client = httpx.AsyncClient(timeout=10.0)

    def set_project_id(self, project_id: str) -> None:
        self._project_id = project_id

    async def execute(self, arguments: dict) -> ToolResult:
        query = arguments.get("query", "")
        top_k = arguments.get("top_k", 10)
        include_call_chain = arguments.get("include_call_chain", True)
        project_id = self._project_id

        if not query:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content='{"error": "query parameter is required"}',
                error="Missing query",
            )

        if not project_id:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content='{"error": "project_id not set (Phase 1 may have skipped code graph)"}',
                error="No project_id",
            )

        try:
            headers: dict[str, str] = {"X-Timeout-Ms": "10000"}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            body: dict = {"query": query, "top_k": top_k, "include_call_chain": include_call_chain}
            resp = await self._client.post(
                f"{self._base_url}/v1/code-graph/{project_id}/search",
                json=body,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            hits = data.get("hits", [])
            new_refs = [f"eref-codesearch-{h.get('name', '?')}" for h in hits[:10]]

            return ToolResult(
                tool_call_id="", name="", success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
            )
        except httpx.HTTPStatusError as e:
            if is_kb_timeout_response(e.response):
                logger.warning("KB code-graph search timeout under caller budget: %s", e)
                return ToolResult(
                    tool_call_id="", name="", success=False,
                    content='{"error": "TIMEOUT", "message": "Code graph search timed out under caller budget"}',
                    error="TIMEOUT",
                )
            if is_kb_not_ready_response(e.response):
                logger.warning("KB code-graph search 미초기화 (KB_NOT_READY): %s", e)
                return ToolResult(
                    tool_call_id="", name="", success=False,
                    content='{"error": "KB_NOT_READY", "message": "Code graph search not ready"}',
                    error="KB_NOT_READY",
                )
            logger.warning("KB code-graph search 실패: %s", e)
            return ToolResult(
                tool_call_id="", name="", success=False,
                content=json.dumps({"error": f"Code graph search failed: {e}"}),
                error=str(e),
            )
        except Exception as e:
            logger.warning("KB code-graph search 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="", name="", success=False,
                content=json.dumps({"error": f"Code graph search unavailable: {e}"}),
                error=str(e),
            )

    async def aclose(self) -> None:
        await self._client.aclose()
