"""TryBuildTool — S4 POST /v1/build 호출 + 금지 명령어 검사."""
from __future__ import annotations
import json
import httpx
from app.schemas.agent import ToolResult

_FORBIDDEN_COMMANDS = {"rm", "dd", "curl", "wget", "git", "docker", "chmod", "chown", "patch", "sed -i"}

class TryBuildTool:
    def __init__(self, sast_endpoint: str, project_path: str, request_id: str = "") -> None:
        self._sast_endpoint = sast_endpoint
        self._project_path = project_path
        self._request_id = request_id

    async def execute(self, arguments: dict) -> ToolResult:
        build_cmd = arguments.get("build_command", "")
        if not build_cmd:
            return ToolResult(tool_call_id="", name="", success=False,
                              content='{"error": "build_command is required"}', error="missing command")
        cmd_lower = build_cmd.lower()
        for forbidden in _FORBIDDEN_COMMANDS:
            if forbidden in cmd_lower:
                return ToolResult(tool_call_id="", name="", success=False,
                                  content=f'{{"error": "forbidden command: {forbidden}"}}',
                                  error=f"forbidden: {forbidden}")
        try:
            headers = {"X-Request-Id": self._request_id} if self._request_id else {}
            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(
                    f"{self._sast_endpoint}/v1/build",
                    json={"projectPath": self._project_path, "buildCommand": build_cmd, "timeout": 120},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                success = data.get("success", False)
                new_refs = ["eref-compile-commands"] if success else []
                return ToolResult(
                    tool_call_id="", name="", success=success,
                    content=json.dumps(data, ensure_ascii=False),
                    new_evidence_refs=new_refs,
                )
        except Exception as e:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=f'{{"error": "build API call failed: {e}"}}', error=str(e))
