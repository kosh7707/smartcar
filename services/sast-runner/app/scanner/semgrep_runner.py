"""Semgrep CLI 실행기."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from app.errors import ScanTimeoutError, SemgrepNotAvailableError

logger = logging.getLogger("s4-sast-runner")


class SemgrepRunner:
    """Semgrep CLI를 asyncio subprocess로 실행한다."""

    async def check_available(self) -> tuple[bool, str | None]:
        """Semgrep 바이너리 가용 여부와 버전을 반환."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "semgrep", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            if proc.returncode == 0:
                version = stdout.decode().strip()
                return True, version
            return False, None
        except (FileNotFoundError, asyncio.TimeoutError):
            return False, None

    async def run(
        self,
        scan_dir: Path,
        rulesets: list[str],
        timeout: int = 120,
    ) -> dict[str, Any]:
        """Semgrep을 실행하고 SARIF JSON을 반환한다.

        Raises:
            SemgrepNotAvailableError: semgrep이 없을 때.
            ScanTimeoutError: 타임아웃 초과 시.
        """
        available, _ = await self.check_available()
        if not available:
            raise SemgrepNotAvailableError("Semgrep binary not found in PATH")

        cmd = self._build_command(scan_dir, rulesets)
        logger.info("Running Semgrep: %s", " ".join(cmd))

        proc = await asyncio.create_subprocess_exec(
            *cmd,
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
            raise ScanTimeoutError(
                f"Semgrep scan exceeded {timeout}s timeout"
            )

        # Semgrep은 findings가 있으면 exit code 1을 반환할 수 있다.
        # SARIF 출력이 있으면 성공으로 간주.
        raw = stdout.decode()
        if not raw.strip():
            # stderr에 에러가 있을 수 있음
            err_msg = stderr.decode().strip()
            if err_msg:
                logger.warning("Semgrep stderr: %s", err_msg)
            # 빈 결과를 SARIF 형태로 반환
            return {"runs": [{"tool": {"driver": {"rules": []}}, "results": []}]}

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # JSON이 아닌 출력 (에러 메시지 등)
            err_msg = stderr.decode().strip()
            logger.error("Semgrep non-JSON output: %s, stderr: %s", raw[:500], err_msg)
            return {"runs": [{"tool": {"driver": {"rules": []}}, "results": []}]}

    def _build_command(
        self,
        scan_dir: Path,
        rulesets: list[str],
    ) -> list[str]:
        """Semgrep CLI 명령 조립."""
        cmd = ["semgrep", "scan"]

        for ruleset in rulesets:
            cmd.extend(["--config", ruleset])

        cmd.extend([
            "--sarif",              # SARIF JSON 출력
            "--timeout", "5",       # per-rule 타임아웃 (초)
            "--max-target-bytes", "1000000",  # 1MB 초과 파일 스킵
            "--no-git-ignore",      # temp dir에는 .gitignore 없음
            "--metrics", "off",     # 텔레메트리 비활성화
            str(scan_dir),
        ])

        return cmd
