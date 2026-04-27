"""CodeGraphCalleesTool — code_graph.callees tool 구현체. S5 KB 코드 그래프 API에 HTTP 위임."""

from __future__ import annotations

import json
import logging

import httpx

from app.agent_runtime.context import get_request_id
from app.agent_runtime.schemas.agent import ToolResult

logger = logging.getLogger(__name__)


class CodeGraphCalleesTool:
    """code_graph.callees tool — S5 KB /v1/code-graph/{project_id}/callees/{function} 호출."""

    def __init__(self, base_url: str = "http://localhost:8002", project_id: str = "") -> None:
        self._base_url = base_url
        self._project_id = project_id
        self._client = httpx.AsyncClient(timeout=10.0)

    def set_project_id(self, project_id: str) -> None:
        self._project_id = project_id

    async def execute(self, arguments: dict) -> ToolResult:
        function_name = arguments.get("function_name", "")
        project_id = self._project_id

        if not function_name:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content='{"error": "function_name parameter is required"}',
                error="Missing function_name",
            )

        if not project_id:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content='{"error": "project_id not set (Phase 1 may have skipped code graph)"}',
                error="No project_id",
            )

        try:
            headers: dict[str, str] = {}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            resp = await self._client.get(
                f"{self._base_url}/v1/code-graph/{project_id}/callees/{function_name}",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            callees = data.get("callees", [])
            new_refs = [f"eref-callee-{c.get('name', '?')}" for c in callees[:10]]

            return ToolResult(
                tool_call_id="", name="", success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
            )
        except Exception as e:
            logger.warning("KB /v1/code-graph callees 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="", name="", success=False,
                content=json.dumps({"error": f"Code graph unavailable: {e}"}),
                error=str(e),
            )

    async def aclose(self) -> None:
        await self._client.aclose()
