"""WriteFileTool — build-aegis/ 폴더 안에만 파일 생성."""
from __future__ import annotations
import os
from app.schemas.agent import ToolResult

class WriteFileTool:
    def __init__(self, project_path: str, build_dir: str = "build-aegis") -> None:
        self._target_dir = os.path.join(project_path, build_dir)
        self._build_dir = build_dir

    async def execute(self, arguments: dict) -> ToolResult:
        rel_path = arguments.get("path", "")
        content = arguments.get("content", "")
        full_path = os.path.normpath(os.path.join(self._target_dir, rel_path))
        if not full_path.startswith(self._target_dir):
            return ToolResult(tool_call_id="", name="", success=False,
                              content=f'{{"error": "write only allowed in {self._build_dir}/"}}', error="write blocked")
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            return ToolResult(tool_call_id="", name="", success=True,
                              content=f'{{"written": "{self._build_dir}/{rel_path}", "bytes": {len(content)}}}')
        except Exception as e:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=f'{{"error": "{e}"}}', error=str(e))
