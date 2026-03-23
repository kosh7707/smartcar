"""빌드 자동 실행 — bear로 compile_commands.json 자동 생성."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from app.schemas.request import BuildProfile

logger = logging.getLogger("aegis-sast-runner")


class BuildRunner:
    """사용자 빌드 명령을 bear로 감싸서 compile_commands.json을 자동 생성한다."""

    # 빌드 파일 → 빌드 시스템 매핑
    _BUILD_FILES: list[tuple[str, str]] = [
        ("CMakeLists.txt", "cmake"),
        ("Makefile", "make"),
        ("meson.build", "meson"),
        ("configure", "autotools"),
    ]

    def discover_targets(self, project_path: Path) -> list[dict[str, str]]:
        """프로젝트 내 빌드 타겟(독립 빌드 단위)을 자동 탐색.

        빌드 파일(CMakeLists.txt, Makefile 등)을 재귀 탐색하여
        각 빌드 파일 디렉토리를 하나의 타겟으로 반환한다.
        중첩된 빌드 파일은 상위 타겟의 하위로 간주하여 제외한다.
        """
        # 제외할 디렉토리
        skip_dirs = {".git", "build", "node_modules", ".venv", "__pycache__", "test", "tests", "examples"}

        # 1. 모든 빌드 파일 수집
        raw_targets: list[dict[str, str]] = []
        for build_file, build_system in self._BUILD_FILES:
            for found in project_path.rglob(build_file):
                rel = found.relative_to(project_path)
                # 제외 디렉토리 필터
                if any(part in skip_dirs for part in rel.parts[:-1]):
                    continue
                target_dir = found.parent
                rel_dir = str(target_dir.relative_to(project_path))
                if rel_dir == ".":
                    rel_dir = ""
                raw_targets.append({
                    "name": target_dir.name if rel_dir else project_path.name,
                    "relativePath": rel_dir + "/" if rel_dir else "",
                    "buildSystem": build_system,
                    "buildFile": str(rel),
                })

        # 2. 중첩 제거: 상위 타겟이 있으면 하위 제거
        # relativePath 기준 정렬 (짧은 것 먼저)
        raw_targets.sort(key=lambda t: t["relativePath"])
        accepted: list[dict[str, str]] = []
        accepted_paths: list[str] = []

        for target in raw_targets:
            path = target["relativePath"]
            # 이미 수용된 상위 경로의 하위인지 확인
            is_nested = any(
                path.startswith(parent) and path != parent
                for parent in accepted_paths
                if parent  # 루트("")는 제외
            )
            if not is_nested:
                accepted.append(target)
                accepted_paths.append(path)

        logger.info(
            "Discovered %d build targets in %s (scanned %d candidates)",
            len(accepted), project_path, len(raw_targets),
        )
        return accepted

    def detect_build_command(self, project_path: Path) -> str | None:
        """프로젝트 빌드 시스템을 자동 감지하여 빌드 명령어를 반환.

        우선순위: CMakeLists.txt > Makefile > configure
        """
        if (project_path / "CMakeLists.txt").exists():
            return "mkdir -p build && cd build && cmake .. && make"
        if (project_path / "Makefile").exists():
            return "make"
        if (project_path / "configure").exists():
            return "./configure && make"
        return None

    async def build(
        self,
        project_path: Path,
        build_command: str,
        timeout: int = 300,
        profile: BuildProfile | None = None,
    ) -> dict[str, Any]:
        """빌드 실행 + compile_commands.json 생성.

        Args:
            project_path: 프로젝트 루트 디렉토리.
            build_command: 빌드 명령어 (예: "./scripts/cross_build.sh")
            timeout: 빌드 타임아웃 (초, 기본 5분)
            profile: BuildProfile — sdkId가 있으면 environment-setup 자동 적용

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

        # SDK environment-setup 적용
        actual_cmd = build_command
        if profile:
            from app.scanner.sdk_resolver import get_sdk_environment_setup
            env_setup = get_sdk_environment_setup(profile)
            if env_setup:
                actual_cmd = f"source {env_setup} && {build_command}"
                logger.info("SDK environment-setup applied: %s", env_setup)

        cmd = ["bear", "--", "sh", "-c", actual_cmd]

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
