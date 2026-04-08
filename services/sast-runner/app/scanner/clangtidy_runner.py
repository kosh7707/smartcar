"""clang-tidy CLI 실행기."""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Any

from app.errors import ScanTimeoutError
from app.scanner.path_utils import normalize_path
from app.scanner.tool_probe import probe_command, service_toolchain_executable
from app.schemas.request import BuildProfile
from app.schemas.response import SastFinding, SastFindingLocation

logger = logging.getLogger("aegis-sast-runner")

# clang-tidy 경고 패턴: file:line:col: severity: message [check-name]
_WARNING_RE = re.compile(
    r"^(?P<file>.+?):(?P<line>\d+):(?P<col>\d+): (?P<severity>warning|error): (?P<message>.+?) \[(?P<check>[^\]]+)\]$"
)

# 기본 체크 목록 (보안 + 버그 + 성능 관련)
DEFAULT_CHECKS = ",".join([
    "bugprone-*",
    "cert-*",
    "clang-analyzer-*",
    "performance-*",
    "portability-*",
])


class ClangTidyRunner:
    """clang-tidy를 asyncio subprocess로 실행한다."""

    async def check_available(self) -> tuple[bool, str | None]:
        def _parse(output: str) -> str:
            match = re.search(r"version (\S+)", output)
            return match.group(1) if match else output.strip().split("\n")[0]

        probe = await probe_command(
            ["clang-tidy", "--version"],
            version_parser=_parse,
            expected_executable_path=service_toolchain_executable("clang-tidy"),
        )
        self._last_probe = probe
        return bool(probe["available"]), probe["version"] if isinstance(probe["version"], str) else None

    async def run(
        self,
        scan_dir: Path,
        source_files: list[str],
        profile: BuildProfile | None,
        checks: str | None = None,
        timeout: int = 120,
        compile_commands: str | None = None,
    ) -> list[SastFinding]:
        """clang-tidy를 실행하고 SastFinding[]을 반환한다."""
        targets = [
            str(scan_dir / f) for f in source_files
            if f.endswith((".c", ".cpp", ".cc", ".cxx"))
        ]
        if not targets:
            return []

        cmd = self._build_command(targets, profile, checks, scan_dir, compile_commands)
        logger.info("Running clang-tidy on %d files", len(targets))

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
            raise ScanTimeoutError(f"clang-tidy scan exceeded {timeout}s timeout")

        output = stdout.decode()
        if not output.strip():
            return []

        return self._parse_output(output, scan_dir)

    def _build_command(
        self,
        targets: list[str],
        profile: BuildProfile | None,
        checks: str | None,
        scan_dir: Path | None = None,
        compile_commands: str | None = None,
    ) -> list[str]:
        cmd = [
            "clang-tidy",
            f"--checks={checks or DEFAULT_CHECKS}",
        ]

        # compile_commands.json이 있으면 -p로 지정 (BuildProfile보다 우선)
        if compile_commands:
            cc_path = Path(compile_commands)
            if not cc_path.is_absolute() and scan_dir:
                cc_path = scan_dir / compile_commands
            if cc_path.exists():
                cmd.extend(["-p", str(cc_path.parent)])
                cmd.extend(targets)
                return cmd

        cmd.extend(targets)

        # -- 뒤에 컴파일러 옵션
        cmd.append("--")

        if profile:
            if profile.language_standard:
                cmd.append(f"-std={profile.language_standard.lower()}")

            if profile.include_paths:
                for inc in profile.include_paths:
                    # 상대 경로는 scan_dir 기준으로 변환
                    inc_path = Path(inc)
                    if not inc_path.is_absolute() and scan_dir:
                        inc_path = scan_dir / inc
                    cmd.extend(["-I", str(inc_path)])

            if profile.defines:
                for key, val in profile.defines.items():
                    if val:
                        cmd.append(f"-D{key}={val}")
                    else:
                        cmd.append(f"-D{key}")
        else:
            from app.config import settings
            cmd.append(f"-std={settings.default_language_standard}")

        return cmd

    def _parse_output(
        self,
        output: str,
        base_dir: Path,
    ) -> list[SastFinding]:
        """clang-tidy 텍스트 출력 → SastFinding[]."""
        findings: list[SastFinding] = []
        seen: set[tuple[str, int, str]] = set()  # (file, line, check) 중복 제거

        for line in output.splitlines():
            match = _WARNING_RE.match(line)
            if not match:
                continue

            file_path = normalize_path(match.group("file"), base_dir)
            line_num = int(match.group("line"))
            col = int(match.group("col"))
            severity = match.group("severity")
            message = match.group("message")
            check = match.group("check")

            # 중복 제거 (같은 위치, 같은 체크)
            key = (file_path, line_num, check)
            if key in seen:
                continue
            seen.add(key)

            metadata: dict[str, Any] = {"clangTidyCheck": check}

            # CERT 체크에서 CWE 매핑 (주요 매핑만)
            cwe = _CERT_TO_CWE.get(check)
            if cwe:
                metadata["cwe"] = [cwe]
                metadata["cweId"] = cwe

            findings.append(SastFinding(
                toolId="clang-tidy",
                ruleId=f"clang-tidy:{check}",
                severity=severity,
                message=message,
                location=SastFindingLocation(
                    file=file_path,
                    line=line_num,
                    column=col,
                ),
                dataFlow=None,
                metadata=metadata,
            ))

        return findings


# CERT C/C++ 체크 → CWE 매핑 (주요 보안 관련만)
_CERT_TO_CWE: dict[str, str] = {
    # CERT C/C++
    "cert-env33-c": "CWE-78",
    "cert-err33-c": "CWE-252",
    "cert-err34-c": "CWE-704",
    "cert-err52-cpp": "CWE-404",
    "cert-exp34-c": "CWE-476",
    "cert-flp30-c": "CWE-835",
    "cert-int30-c": "CWE-190",
    "cert-int32-c": "CWE-190",
    "cert-mem30-c": "CWE-416",
    "cert-mem50-cpp": "CWE-416",
    "cert-msc30-c": "CWE-338",
    "cert-msc32-c": "CWE-338",
    "cert-msc51-cpp": "CWE-338",
    "cert-str30-c": "CWE-787",
    # bugprone
    "bugprone-use-after-move": "CWE-416",
    "bugprone-dangling-handle": "CWE-416",
    "bugprone-sizeof-expression": "CWE-131",
    "bugprone-integer-division": "CWE-190",
    "bugprone-narrowing-conversions": "CWE-190",
    "bugprone-string-constructor": "CWE-665",
    # clang-analyzer (clang-tidy 경유)
    "clang-analyzer-core.NullDereference": "CWE-476",
    "clang-analyzer-core.UndefinedBinaryOperatorResult": "CWE-190",
    "clang-analyzer-unix.Malloc": "CWE-416",
    "clang-analyzer-alpha.security.ArrayBoundV2": "CWE-787",
}
