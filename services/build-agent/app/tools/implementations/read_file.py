"""ReadFileTool — 프로젝트 내 파일 읽기 (읽기 전용)."""
from __future__ import annotations

import json
import os

from agent_shared.path_util import resolve_scoped_path
from agent_shared.schemas.agent import ToolResult

# 컨텍스트 폭발 방지: 파일 읽기 최대 8,000자 (~2K 토큰)
_MAX_READ_CHARS = 8_000


class ReadFileTool:
    def __init__(self, project_path: str) -> None:
        self._project_path = os.path.normpath(project_path)

    async def execute(self, arguments: dict) -> ToolResult:
        rel_path = arguments.get("path", "")
        full_path = resolve_scoped_path(self._project_path, rel_path)
        if full_path is None:
            return ToolResult(tool_call_id="", name="", success=False,
                              content='{"error": "path traversal blocked"}', error="path traversal")
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(_MAX_READ_CHARS + 1)
            if len(content) > _MAX_READ_CHARS:
                total_size = os.path.getsize(full_path)
                content = (
                    content[:_MAX_READ_CHARS]
                    + f"\n\n--- [파일이 {_MAX_READ_CHARS:,}자에서 잘림. "
                    + f"전체 크기: {total_size:,}바이트] ---"
                )
            return ToolResult(tool_call_id="", name="", success=True, content=content,
                              new_evidence_refs=[f"eref-file-{rel_path.replace('/', '-')}"])
        except FileNotFoundError:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=json.dumps({"error": f"file not found: {rel_path}"}),
                              error="not found")
        except Exception as e:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=json.dumps({"error": str(e)}), error=str(e))
