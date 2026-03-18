"""빌드 자동 실행 — bear로 compile_commands.json 자동 생성."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("s4-sast-runner")


class BuildRunner:
    """사용자 빌드 명령을 bear로 감싸서 compile_commands.json을 자동 생성한다."""

    async def build(
        self,
        project_path: Path,
        build_command: str,
        timeout: int = 300,
    ) -> dict[str, Any]:
        """빌드 실행 + compile_commands.json 생성.

        Args:
            project_path: 프로젝트 루트 디렉토리.
            build_command: 빌드 명령어 (예: "./scripts/cross_build.sh")
            timeout: 빌드 타임아웃 (초, 기본 5분)

        Returns:
            {
                "success": true/false,
                "compileCommandsPath": "/path/to/compile_commands.json",
                "entries": 7,
                "buildOutput": "...",
                "elapsedMs": 12345
            }
        """
        import time
        t0 = time.perf_counter()

        cc_path = project_path / "compile_commands.json"

        # 기존 compile_commands.json 백업
        cc_backup = None
        if cc_path.exists():
            cc_backup = cc_path.read_text()

        cmd = ["bear", "--", "sh", "-c", build_command]

        logger.info(
            "Build started: %s in %s",
            build_command, project_path,
        )

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(project_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            elapsed = int((time.perf_counter() - t0) * 1000)
            return {
                "success": False,
                "error": f"Build timed out after {timeout}s",
                "elapsedMs": elapsed,
            }

        elapsed = int((time.perf_counter() - t0) * 1000)
        build_output = stdout.decode() + stderr.decode()

        # compile_commands.json 확인
        if not cc_path.exists():
            return {
                "success": False,
                "error": "bear did not generate compile_commands.json",
                "buildOutput": build_output[-1000:],
                "exitCode": proc.returncode,
                "elapsedMs": elapsed,
            }

        try:
            entries = json.loads(cc_path.read_text())
            entry_count = len(entries)
        except json.JSONDecodeError:
            entry_count = 0

        if entry_count == 0:
            return {
                "success": False,
                "error": "compile_commands.json is empty — build may have failed",
                "buildOutput": build_output[-1000:],
                "exitCode": proc.returncode,
                "elapsedMs": elapsed,
            }

        logger.info(
            "Build completed: %d entries, exit=%d, %dms",
            entry_count, proc.returncode, elapsed,
        )

        return {
            "success": True,
            "compileCommandsPath": str(cc_path),
            "entries": entry_count,
            "exitCode": proc.returncode,
            "buildOutput": build_output[-500:],
            "elapsedMs": elapsed,
        }
