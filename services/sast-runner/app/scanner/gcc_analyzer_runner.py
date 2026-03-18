"""gcc -fanalyzer 실행기."""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Any

from app.errors import ScanTimeoutError
from app.scanner.sdk_resolver import get_sdk_compiler
from app.schemas.request import BuildProfile
from app.schemas.response import SastFinding, SastFindingLocation

logger = logging.getLogger("s4-sast-runner")

# gcc 경고 패턴: file:line:col: warning: message [-Wanalyzer-*]
_WARNING_RE = re.compile(
    r"^(?P<file>.+?):(?P<line>\d+):(?P<col>\d+): (?P<severity>warning|error|note): (?P<message>.+?)(?:\s+\[(?P<flag>-W[^\]]+)\])?$"
)


class GccAnalyzerRunner:
    """gcc -fanalyzer를 asyncio subprocess로 실행한다."""

    async def check_available(self) -> tuple[bool, str | None]:
        """gcc -fanalyzer가 사용 가능한지 확인."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "gcc", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            if proc.returncode == 0:
                output = stdout.decode()
                match = re.search(r"(\d+\.\d+\.\d+)", output)
                version = match.group(1) if match else "unknown"
                # gcc 10+ 에서 -fanalyzer 지원
                major = int(version.split(".")[0]) if version != "unknown" else 0
                if major >= 10:
                    return True, version
            return False, None
        except (FileNotFoundError, asyncio.TimeoutError):
            return False, None

    async def run(
        self,
        scan_dir: Path,
        source_files: list[str],
        profile: BuildProfile | None,
        timeout: int = 120,
    ) -> list[SastFinding]:
        c_cpp_files = [
            str(scan_dir / f) for f in source_files
            if f.endswith((".c", ".cpp", ".cc", ".cxx"))
        ]
        if not c_cpp_files:
            return []

        gcc_bin = self._resolve_gcc(profile)
        cmd = self._build_command(gcc_bin, c_cpp_files, profile, scan_dir)
        logger.info("Running gcc -fanalyzer (%s) on %d files", gcc_bin, len(c_cpp_files))

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            _, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=timeout,
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise ScanTimeoutError(f"gcc -fanalyzer exceeded {timeout}s timeout")

        output = stderr.decode()
        if not output.strip():
            return []

        return self._parse_output(output, scan_dir)

    def _resolve_gcc(self, profile: BuildProfile | None) -> str:
        """BuildProfile에서 SDK 크로스 컴파일러를 찾거나, 호스트 gcc를 반환."""
        if profile:
            sdk_gcc = get_sdk_compiler(profile)
            if sdk_gcc:
                return sdk_gcc
        return "gcc"

    def _build_command(
        self,
        gcc_bin: str,
        targets: list[str],
        profile: BuildProfile | None,
        scan_dir: Path,
    ) -> list[str]:
        cmd = [gcc_bin, "-fanalyzer", "-fsyntax-only"]

        if profile:
            cmd.append(f"-std={profile.language_standard.lower()}")
            if profile.include_paths:
                for inc in profile.include_paths:
                    inc_path = Path(inc)
                    if not inc_path.is_absolute():
                        inc_path = scan_dir / inc
                    cmd.extend(["-I", str(inc_path)])
            if profile.defines:
                for key, val in profile.defines.items():
                    cmd.append(f"-D{key}={val}" if val else f"-D{key}")
        else:
            cmd.append("-std=c++17")

        cmd.extend(targets)
        return cmd

    def _parse_output(
        self, output: str, scan_dir: Path,
    ) -> list[SastFinding]:
        """gcc stderr 출력 → SastFinding[]."""
        findings: list[SastFinding] = []
        seen: set[tuple[str, int, str]] = set()

        for line in output.splitlines():
            match = _WARNING_RE.match(line)
            if not match:
                continue

            file_path = self._normalize_path(match.group("file"), scan_dir)
            line_num = int(match.group("line"))
            col = int(match.group("col"))
            severity = match.group("severity")
            message = match.group("message")
            flag = match.group("flag") or ""

            # -fanalyzer 경고만 수집 (일반 -W 경고는 제외)
            if flag and not flag.startswith("-Wanalyzer"):
                continue

            # note는 스킵 (이전 warning의 부가 설명)
            if severity == "note":
                continue

            key = (file_path, line_num, message[:50])
            if key in seen:
                continue
            seen.add(key)

            rule_id = flag.replace("-W", "") if flag else "analyzer"
            metadata: dict[str, Any] = {}
            if flag:
                metadata["gccFlag"] = flag

            findings.append(SastFinding(
                toolId="gcc-fanalyzer",
                ruleId=f"gcc-fanalyzer:{rule_id}",
                severity=severity,
                message=message,
                location=SastFindingLocation(
                    file=file_path, line=line_num, column=col,
                ),
                dataFlow=None,
                metadata=metadata if metadata else None,
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
