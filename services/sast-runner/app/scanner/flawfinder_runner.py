"""Flawfinder CLI 실행기."""

from __future__ import annotations

import asyncio
import csv
import io
import logging
from pathlib import Path
from typing import Any

from app.errors import ScanTimeoutError
from app.schemas.response import SastFinding, SastFindingLocation

logger = logging.getLogger("aegis-sast-runner")

# Flawfinder risk level → severity
_SEVERITY_MAP = {
    "5": "error",
    "4": "error",
    "3": "warning",
    "2": "warning",
    "1": "info",
    "0": "info",
}


class FlawfinderRunner:
    """Flawfinder를 asyncio subprocess로 실행한다."""

    async def check_available(self) -> tuple[bool, str | None]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "flawfinder", "--version",
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
        timeout: int = 120,
    ) -> list[SastFinding]:
        cmd = self._build_command(scan_dir)
        logger.info("Running Flawfinder: %s", " ".join(cmd))

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
            raise ScanTimeoutError(f"Flawfinder scan exceeded {timeout}s timeout")

        csv_output = stdout.decode()
        if not csv_output.strip():
            return []

        return self._parse_csv(csv_output, scan_dir)

    def _build_command(self, scan_dir: Path) -> list[str]:
        return [
            "flawfinder",
            "--csv",            # CSV 출력
            "--quiet",          # 헤더/푸터 제거
            "--minlevel=1",     # 최소 레벨 1부터
            str(scan_dir),
        ]

    def _parse_csv(
        self,
        csv_str: str,
        base_dir: Path,
    ) -> list[SastFinding]:
        """Flawfinder CSV → SastFinding[]."""
        findings: list[SastFinding] = []

        reader = csv.DictReader(io.StringIO(csv_str))
        for row in reader:
            file_path = row.get("File", "")
            line_str = row.get("Line", "0")
            level = row.get("Level", "1")
            category = row.get("Category", "")
            name = row.get("Name", "")
            warning = row.get("Warning", "")
            context = row.get("Context", "")

            if not file_path or line_str == "0":
                continue

            line = int(line_str)
            file_path = self._normalize_path(file_path, base_dir)

            severity = _SEVERITY_MAP.get(level, "info")
            column_str = row.get("Column", "0")
            column = int(column_str) if column_str and column_str != "0" else None

            metadata: dict[str, Any] = {
                "flawfinderLevel": int(level),
                "category": category,
                "name": name,
            }
            if context:
                metadata["context"] = context.strip()

            # CWE 추출 (warning 텍스트에 CWE-XXX가 포함된 경우)
            import re
            cwe_matches = re.findall(r"CWE-\d+", warning)
            if cwe_matches:
                metadata["cwe"] = cwe_matches

            findings.append(SastFinding(
                toolId="flawfinder",
                ruleId=f"flawfinder:{category}/{name}",
                severity=severity,
                message=warning,
                location=SastFindingLocation(
                    file=file_path,
                    line=line,
                    column=column,
                ),
                dataFlow=None,
                metadata=metadata,
            ))

        return findings

    def _normalize_path(self, path: str, base_dir: Path) -> str:
        base_str = str(base_dir)
        if not base_str.endswith("/"):
            base_str += "/"
        if path.startswith(base_str):
            return path[len(base_str):]
        try:
            return str(Path(path).relative_to(base_dir))
        except ValueError:
            return path
