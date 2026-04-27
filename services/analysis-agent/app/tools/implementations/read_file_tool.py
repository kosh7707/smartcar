"""ReadFileTool — 프로젝트 소스 파일 읽기 (읽기 전용, Phase 2 LLM 도구)."""
from __future__ import annotations

import json
import os

from app.agent_runtime.path_util import resolve_scoped_path
from app.agent_runtime.schemas.agent import ToolResult

_MAX_READ_CHARS = 8_000


class ReadFileTool:
    """프로젝트 디렉토리 내 파일을 읽는다. 경로 탈출 차단."""

    def __init__(self, project_path: str) -> None:
        self._project_path = os.path.normpath(project_path)

    async def execute(self, arguments: dict) -> ToolResult:
        rel_path = arguments.get("path", "")
        if not rel_path:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content='{"error": "path parameter is required"}',
                error="missing path",
            )

        full_path = resolve_scoped_path(self._project_path, rel_path)
        if full_path is None:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content='{"error": "path traversal blocked"}',
                error="path traversal",
            )

        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(_MAX_READ_CHARS + 1)
            truncated = len(content) > _MAX_READ_CHARS
            if truncated:
                total_size = os.path.getsize(full_path)
                content = (
                    content[:_MAX_READ_CHARS]
                    + f"\n\n--- [파일이 {_MAX_READ_CHARS:,}자에서 잘림. "
                    + f"전체 크기: {total_size:,}바이트] ---"
                )
            return ToolResult(
                tool_call_id="", name="", success=True,
                content=content,
                new_evidence_refs=[f"eref-file-{rel_path.replace('/', '-')}"],
            )
        except FileNotFoundError:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content=json.dumps({"error": f"file not found: {rel_path}"}),
                error="not found",
            )
        except Exception as e:
            return ToolResult(
                tool_call_id="", name="", success=False,
                content=json.dumps({"error": str(e)}),
                error=str(e),
            )
