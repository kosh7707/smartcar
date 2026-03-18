"""인클루드 트리 추출 — gcc -E -M 기반."""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Any

from app.scanner.sdk_resolver import get_sdk_compiler
from app.schemas.request import BuildProfile

logger = logging.getLogger("s4-sast-runner")


class IncludeResolver:
    """gcc -E -M으로 파일별 인클루드 의존성 트리를 추출한다."""

    async def resolve(
        self,
        scan_dir: Path,
        source_files: list[str],
        profile: BuildProfile | None,
        timeout: int = 30,
    ) -> dict[str, list[str]]:
        """파일별 인클루드 목록을 반환.

        Returns:
            { "src/main.c": ["include/header.h", "/usr/include/stdio.h", ...] }
        """
        gcc_bin = self._resolve_gcc(profile)
        result: dict[str, list[str]] = {}

        c_cpp_files = [
            f for f in source_files
            if f.endswith((".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"))
        ]

        for src in c_cpp_files:
            full_path = scan_dir / src
            if not full_path.exists():
                continue

            includes = await self._get_includes(
                gcc_bin, full_path, scan_dir, profile, timeout,
            )
            if includes is not None:
                result[src] = includes

        return result

    async def _get_includes(
        self,
        gcc_bin: str,
        file_path: Path,
        scan_dir: Path,
        profile: BuildProfile | None,
        timeout: int,
    ) -> list[str] | None:
        cmd = [gcc_bin, "-E", "-M", "-MG"]

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

        cmd.append(str(file_path))

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(
                proc.communicate(), timeout=timeout,
            )
        except (asyncio.TimeoutError, FileNotFoundError):
            return None

        raw = stdout.decode()
        if not raw.strip():
            return None

        return self._parse_deps(raw, file_path)

    def _parse_deps(self, raw: str, source_file: Path) -> list[str]:
        """Makefile 형식 dependency 출력을 파싱.

        형식: target.o: source.c header1.h \
               header2.h header3.h
        """
        # 줄 이음(\) 처리
        text = raw.replace("\\\n", " ")

        # target: deps 분리
        colon_idx = text.find(":")
        if colon_idx < 0:
            return []

        deps_str = text[colon_idx + 1:]
        deps = deps_str.split()

        # 첫 번째는 소스 파일 자신 → 제외
        source_name = source_file.name
        return [d for d in deps if not d.endswith(source_name)]

    def _resolve_gcc(self, profile: BuildProfile | None) -> str:
        if profile:
            sdk_gcc = get_sdk_compiler(profile)
            if sdk_gcc:
                return sdk_gcc
        return "gcc"
