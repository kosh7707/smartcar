"""ReadFileTool — 프로젝트 내 파일 읽기 (읽기 전용)."""
from __future__ import annotations

import json
import os

from agent_shared.schemas.agent import ToolResult


class ReadFileTool:
    def __init__(self, project_path: str) -> None:
        self._project_path = os.path.normpath(project_path)

    async def execute(self, arguments: dict) -> ToolResult:
        rel_path = arguments.get("path", "")
        full_path = os.path.normpath(os.path.join(self._project_path, rel_path))
        if not (full_path.startswith(self._project_path + os.sep) or full_path == self._project_path):
            return ToolResult(tool_call_id="", name="", success=False,
                              content='{"error": "path traversal blocked"}', error="path traversal")
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(50_000)
            return ToolResult(tool_call_id="", name="", success=True, content=content,
                              new_evidence_refs=[f"eref-file-{rel_path.replace('/', '-')}"])
        except FileNotFoundError:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=json.dumps({"error": f"file not found: {rel_path}"}),
                              error="not found")
        except Exception as e:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=json.dumps({"error": str(e)}), error=str(e))
