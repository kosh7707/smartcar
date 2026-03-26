"""SastScanTool — sast.scan tool 구현체. S4 SAST Runner에 HTTP 위임."""

from __future__ import annotations

import json
import logging

import httpx

from agent_shared.context import get_request_id
from agent_shared.schemas.agent import ToolResult

logger = logging.getLogger(__name__)


class SastScanTool:
    """sast.scan tool — S4 SAST Runner /v1/scan 호출."""

    def __init__(self, base_url: str = "http://localhost:9000", timeout_s: float = 450.0) -> None:
        self._base_url = base_url
        self._timeout_s = timeout_s
        self._client = httpx.AsyncClient(timeout=timeout_s)

    async def execute(self, arguments: dict) -> ToolResult:
        try:
            headers: dict[str, str] = {"X-Timeout-Ms": str(int(self._timeout_s * 1000))}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            resp = await self._client.post(
                f"{self._base_url}/v1/scan",
                json=arguments,
                headers=headers,
                timeout=self._timeout_s,
            )
            resp.raise_for_status()
            data = resp.json()

            findings = data.get("findings", [])
            new_refs = [f"eref-sast-{f['ruleId']}" for f in findings[:10]]

            return ToolResult(
                tool_call_id="",
                name="",
                success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
            )
        except Exception as e:
            logger.warning("SAST Runner 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content=json.dumps({"error": f"SAST Runner unavailable: {e}"}),
                error=str(e),
            )

    async def aclose(self) -> None:
        await self._client.aclose()
