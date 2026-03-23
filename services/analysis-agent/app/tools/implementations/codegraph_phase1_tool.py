"""CodeGraphPhase1Tool — Phase 1 전용. S4 SAST Runner /v1/functions 호출."""

from __future__ import annotations

import json
import logging

import httpx

from app.context import get_request_id
from app.schemas.agent import ToolResult

logger = logging.getLogger(__name__)


class CodeGraphPhase1Tool:
    """Phase 1 전용 코드 그래프 추출 — S4 SAST Runner /v1/functions 호출."""

    def __init__(self, base_url: str = "http://localhost:9000") -> None:
        self._base_url = base_url
        self._client = httpx.AsyncClient(timeout=60.0)

    async def execute(self, arguments: dict) -> ToolResult:
        try:
            headers: dict[str, str] = {}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            resp = await self._client.post(
                f"{self._base_url}/v1/functions",
                json=arguments,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            functions = data.get("functions", [])
            new_refs = [f"eref-func-{f['name']}" for f in functions[:10]]

            return ToolResult(
                tool_call_id="",
                name="",
                success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
            )
        except Exception as e:
            logger.warning("SAST Runner /v1/functions 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content=json.dumps({"error": f"Code graph unavailable: {e}"}),
                error=str(e),
            )

    async def aclose(self) -> None:
        await self._client.aclose()
