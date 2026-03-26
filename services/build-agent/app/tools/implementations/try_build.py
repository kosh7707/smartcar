"""TryBuildTool — S4 POST /v1/build 호출 + 금지 명령어 검사 + 결과 검증.

v2: 정규식 금지 명령어, sdk_id/buildProfile 전송, bear 자동 제거, exitCode 기반 성공 판정.
"""
from __future__ import annotations

import json
import logging
import re

import httpx
from agent_shared.schemas.agent import ToolResult

logger = logging.getLogger(__name__)

# 워드 바운더리 기반 금지 명령어 (arm-linux-... 등의 오탐 방지)
_FORBIDDEN_PATTERNS = [
    re.compile(r"\brm\b"),
    re.compile(r"\bdd\b"),
    re.compile(r"\bcurl\b"),
    re.compile(r"\bwget\b"),
    re.compile(r"\bgit\b"),
    re.compile(r"\bdocker\b"),
    re.compile(r"\bchmod\b"),
    re.compile(r"\bchown\b"),
    re.compile(r"\bpatch\b"),
    re.compile(r"\bsed\s+-i\b"),
]

# S4가 자동으로 bear를 감싸므로, LLM이 넣은 bear를 제거
_BEAR_PREFIX_RE = re.compile(r"\bbear\s+--\s*")


def _validate_build_result(data: dict) -> tuple[bool, str | None]:
    """S4 빌드 응답의 exitCode 기반 성공 판정."""
    exit_code = data.get("exitCode", -1)
    s4_success = data.get("success", False)

    if exit_code != 0:
        return False, f"빌드 exit code={exit_code} (실패). S4 success={s4_success}."

    return True, None


class TryBuildTool:
    def __init__(self, sast_endpoint: str, project_path: str, request_id: str = "") -> None:
        self._sast_endpoint = sast_endpoint
        self._project_path = project_path
        self._request_id = request_id

    async def execute(self, arguments: dict) -> ToolResult:
        build_cmd = arguments.get("build_command", "")
        sdk_id = arguments.get("sdk_id", "")

        if not build_cmd:
            return ToolResult(tool_call_id="", name="", success=False,
                              content='{"error": "build_command is required"}', error="missing command")

        # 금지 명령어 검사 (정규식 워드 바운더리)
        cmd_lower = build_cmd.lower()
        for pattern in _FORBIDDEN_PATTERNS:
            match = pattern.search(cmd_lower)
            if match:
                forbidden = match.group()
                return ToolResult(tool_call_id="", name="", success=False,
                                  content=f'{{"error": "forbidden command: {forbidden}"}}',
                                  error=f"forbidden: {forbidden}")

        # LLM이 넣은 bear 제거 (S4가 자동으로 감싸므로 이중 방지)
        build_cmd = _BEAR_PREFIX_RE.sub("", build_cmd).strip()

        try:
            headers = {"X-Request-Id": self._request_id} if self._request_id else {}
            payload: dict = {
                "projectPath": self._project_path,
                "buildCommand": build_cmd,
                "timeout": 120,
            }
            if sdk_id:
                payload["buildProfile"] = {"sdkId": sdk_id}

            async with httpx.AsyncClient(timeout=180.0) as client:
                resp = await client.post(
                    f"{self._sast_endpoint}/v1/build",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()

                actual_success, warning = _validate_build_result(data)
                if warning:
                    data["_s3_warning"] = warning
                    logger.warning("[try_build] S4 응답 검증: %s", warning)

                new_refs = ["eref-build-success"] if actual_success else []
                return ToolResult(
                    tool_call_id="", name="", success=actual_success,
                    content=json.dumps(data, ensure_ascii=False),
                    new_evidence_refs=new_refs,
                )
        except Exception as e:
            return ToolResult(tool_call_id="", name="", success=False,
                              content=f'{{"error": "build API call failed: {e}"}}', error=str(e))
