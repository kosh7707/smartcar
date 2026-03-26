"""ScaTool — sca.libraries tool 구현체. S4 SAST Runner에 HTTP 위임."""

from __future__ import annotations

import json
import logging

import httpx

from agent_shared.context import get_request_id
from agent_shared.schemas.agent import ToolResult

logger = logging.getLogger(__name__)


class ScaTool:
    """sca.libraries tool — S4 SAST Runner /v1/libraries 호출."""

    def __init__(self, base_url: str = "http://localhost:9000") -> None:
        self._base_url = base_url
        self._client = httpx.AsyncClient(timeout=60.0)

    async def execute(self, arguments: dict) -> ToolResult:
        try:
            headers: dict[str, str] = {"X-Timeout-Ms": "30000"}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id

            resp = await self._client.post(
                f"{self._base_url}/v1/libraries",
                json=arguments,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            libraries = data.get("libraries", [])
            new_refs = [f"eref-sca-{lib['name']}" for lib in libraries if lib.get("name")]

            return ToolResult(
                tool_call_id="",
                name="",
                success=True,
                content=json.dumps(data, ensure_ascii=False),
                new_evidence_refs=new_refs,
            )
        except Exception as e:
            logger.warning("SCA /v1/libraries 호출 실패: %s", e)
            return ToolResult(
                tool_call_id="",
                name="",
                success=False,
                content=json.dumps({"error": f"SCA unavailable: {e}"}),
                error=str(e),
            )

    async def aclose(self) -> None:
        await self._client.aclose()
