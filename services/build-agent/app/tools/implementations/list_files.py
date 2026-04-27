"""ListFilesTool — 프로젝트 디렉토리 구조를 트리 형태로 반환한다."""
from __future__ import annotations

import os

from app.agent_runtime.path_util import resolve_scoped_path
from app.agent_runtime.schemas.agent import ToolResult

# read_file, tasks.py와 동일한 노이즈 디렉토리 목록
_EXCLUDE_DIRS = frozenset({
    "build", "build-wsl", "build-aegis", "CMakeFiles", ".git", "__pycache__",
    "node_modules", ".cache", ".venv", "venv",
    "test", "tests", "doc", "docs", "example", "examples", "unittest",
    "third_party", "vendor", "external", "deps",
})

_MAX_DEPTH = 3
_MAX_ENTRIES = 200


class ListFilesTool:
    def __init__(self, project_path: str) -> None:
        self._project_path = os.path.normpath(project_path)

    async def execute(self, arguments: dict) -> ToolResult:
        rel_path = arguments.get("path", "")
        max_depth = min(arguments.get("max_depth", _MAX_DEPTH), 5)
        max_entries = min(arguments.get("max_entries", _MAX_ENTRIES), 500)

        if rel_path:
            full_path = resolve_scoped_path(self._project_path, rel_path)
            if full_path is None:
                return ToolResult(
                    tool_call_id="", name="", success=False,
                    content='{"error": "path traversal blocked"}',
                    error="path traversal",
                )
        else:
            full_path = self._project_path

        if not os.path.isdir(full_path):
            return ToolResult(
                tool_call_id="", name="", success=False,
                content=f'{{"error": "directory not found: {rel_path}"}}',
                error="not found",
            )

        lines: list[str] = []
        truncated = False

        for root, dirs, files in os.walk(full_path):
            depth = root[len(full_path):].count(os.sep)
            if depth >= max_depth:
                dirs.clear()
                continue

            # 노이즈 디렉토리 제외 (in-place prune)
            dirs[:] = sorted(d for d in dirs if d not in _EXCLUDE_DIRS and not d.startswith("."))

            indent = "  " * depth

            # 하위 디렉토리를 부모 레벨에서 바로 표시
            for d in dirs:
                lines.append(f"{indent}{d}/")
                if len(lines) >= max_entries:
                    truncated = True
                    break

            if truncated:
                break

            # 파일 엔트리
            for fname in sorted(files):
                if fname.startswith("."):
                    continue
                lines.append(f"{indent}{fname}")
                if len(lines) >= max_entries:
                    truncated = True
                    break
            if truncated:
                break

        if not lines:
            content = "(empty directory)"
        else:
            content = "\n".join(lines)
            if truncated:
                content += f"\n\n--- [{max_entries}개 항목에서 잘림. 더 보려면 특정 하위 디렉토리를 지정하라] ---"

        eref_suffix = rel_path.replace("/", "-") if rel_path else "root"
        return ToolResult(
            tool_call_id="", name="", success=True,
            content=content,
            new_evidence_refs=[f"eref-tree-{eref_suffix}"],
        )
