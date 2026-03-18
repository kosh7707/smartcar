"""Mock tool 구현체 — 프레임워크 검증용."""

from __future__ import annotations

import json

from app.schemas.agent import ToolResult


class MockKnowledgeTool:
    """knowledge.search의 mock 구현체."""

    async def execute(self, arguments: dict) -> ToolResult:
        query = arguments.get("query", "unknown")
        return ToolResult(
            tool_call_id="",  # router가 채워줌
            name="",          # router가 채워줌
            success=True,
            content=json.dumps({
                "hits": [
                    {
                        "id": "CWE-78",
                        "title": "OS Command Injection",
                        "description": f"Mock result for: {query}",
                        "related_capec": ["CAPEC-88"],
                    },
                ],
                "total": 1,
            }, ensure_ascii=False),
            new_evidence_refs=[f"eref-mock-{query[:8]}"],
        )


class MockEchoTool:
    """인자를 그대로 반환하는 디버그용 tool."""

    async def execute(self, arguments: dict) -> ToolResult:
        return ToolResult(
            tool_call_id="",
            name="",
            success=True,
            content=json.dumps({"echo": arguments}, ensure_ascii=False),
        )


class MockFailTool:
    """항상 실패하는 테스트용 tool."""

    async def execute(self, arguments: dict) -> ToolResult:
        raise RuntimeError("Intentional failure for testing")
