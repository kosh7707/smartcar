"""빌드 자동 실행 — caller가 제공한 명령을 그대로 실행하고 compile_commands.json을 생성한다."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Any

logger = logging.getLogger("aegis-sast-runner")

_SHARED_LIBRARY_ERROR_RE = re.compile(
    r"error while loading shared libraries?: (?P<lib>[^\s:]+): cannot open shared object file",
    re.IGNORECASE,
)


class BuildRunner:
    """caller가 완전히 materialize한 build command를 실행한다."""

    _BUILD_FILES: list[tuple[str, str]] = [
        ("CMakeLists.txt", "cmake"),
        ("Makefile", "make"),
        ("meson.build", "meson"),
        ("configure", "autotools"),
    ]

    def discover_targets(self, project_path: Path) -> list[dict[str, str]]:
        """프로젝트 내 빌드 타겟(독립 빌드 단위)을 자동 탐색.

        이 endpoint는 identity-hint surface만 유지한다. build command는 더 이상 추론/제안하지 않는다.
        """
        skip_dirs = {".git", "build", "node_modules", ".venv", "__pycache__", "test", "tests", "examples"}

        raw_targets: list[dict[str, str]] = []
        for build_file, build_system in self._BUILD_FILES:
            for found in project_path.rglob(build_file):
                rel = found.relative_to(project_path)
                if any(part in skip_dirs for part in rel.parts[:-1]):
                    continue
                target_dir = found.parent
                rel_dir = str(target_dir.relative_to(project_path))
                if rel_dir == ".":
                    rel_dir = ""
                raw_targets.append(
                    {
                        "name": target_dir.name if rel_dir else project_path.name,
                        "relativePath": rel_dir + "/" if rel_dir else "",
                        "buildSystem": build_system,
                        "buildFile": str(rel),
                    },
                )

        raw_targets.sort(key=lambda t: t["relativePath"])
        accepted: list[dict[str, str]] = []
        accepted_paths: list[str] = []

        for target in raw_targets:
            path = target["relativePath"]
            is_nested = any(
                path.startswith(parent) and path != parent
                for parent in accepted_paths
                if parent
            )
            if not is_nested:
                accepted.append(target)
                accepted_paths.append(path)

        logger.info(
            "Discovered %d build targets in %s (scanned %d candidates)",
            len(accepted), project_path, len(raw_targets),
        )
        return accepted

    async def build(
        self,
        project_path: Path,
        build_command: str,
        timeout: int = 300,
        environment: dict[str, str] | None = None,
        wrap_with_bear: bool = True,
    ) -> dict[str, Any]:
        """caller가 제공한 build command를 그대로 실행하고 compile_commands.json을 생성한다."""
        import time

        t0 = time.perf_counter()
        cc_path = project_path / "compile_commands.json"
        effective_command = build_command
        exec_env = os.environ.copy()
        if environment:
            exec_env.update(environment)

        if wrap_with_bear:
            cmd = ["bear", "--", "bash", "-c", effective_command]
        else:
            cmd = ["bash", "-c", effective_command]
            logger.info("Bear wrapping disabled — raw build execution")

        logger.info(
            "Build started: %s in %s",
            build_command, project_path,
        )

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(project_path),
            env=exec_env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            kill_result = proc.kill()
            if asyncio.iscoroutine(kill_result):
                await kill_result
            await proc.communicate()
            elapsed = int((time.perf_counter() - t0) * 1000)
            return {
                "success": False,
                "buildEvidence": self._build_evidence(
                    project_path=project_path,
                    requested_command=build_command,
                    effective_command=effective_command,
                    compile_commands_path=None,
                    entries=None,
                    user_entries=None,
                    exit_code=None,
                    build_output=None,
                    wrap_with_bear=wrap_with_bear,
                    timeout=timeout,
                    environment=environment,
                    elapsed_ms=elapsed,
                ),
                "failureDetail": self._failure_detail(
                    category="timeout",
                    summary=f"Build timed out after {timeout}s.",
                    matched_excerpt=None,
                    hint="Provide a valid build command and increase timeout only when the caller intentionally expects a long-running build.",
                    retryable=True,
                ),
            }

        elapsed = int((time.perf_counter() - t0) * 1000)
        build_output = stdout.decode() + stderr.decode()
        base_evidence = self._build_evidence(
            project_path=project_path,
            requested_command=build_command,
            effective_command=effective_command,
            compile_commands_path=str(cc_path) if cc_path.exists() else None,
            entries=None,
            user_entries=None,
            exit_code=proc.returncode,
            build_output=build_output[-1000:],
            wrap_with_bear=wrap_with_bear,
            timeout=timeout,
            environment=environment,
            elapsed_ms=elapsed,
        )

        if not cc_path.exists():
            return {
                "success": False,
                "buildEvidence": base_evidence,
                "failureDetail": self._diagnose_failure(
                    build_output=build_output,
                    exit_code=proc.returncode,
                    default_category="compile-commands-missing",
                    default_summary="bear did not generate compile_commands.json.",
                    default_hint="Caller must provide a build command that actually invokes the compiler under bear.",
                ),
            }

        try:
            entries = json.loads(cc_path.read_text())
            entry_count = len(entries)
        except json.JSONDecodeError:
            entry_count = 0

        if entry_count == 0:
            return {
                "success": False,
                "buildEvidence": self._build_evidence(
                    project_path=project_path,
                    requested_command=build_command,
                    effective_command=effective_command,
                    compile_commands_path=str(cc_path),
                    entries=entry_count,
                    user_entries=0,
                    exit_code=proc.returncode,
                    build_output=build_output[-1000:],
                    wrap_with_bear=wrap_with_bear,
                    timeout=timeout,
                    environment=environment,
                    elapsed_ms=elapsed,
                ),
                "failureDetail": self._diagnose_failure(
                    build_output=build_output,
                    exit_code=proc.returncode,
                    default_category="compile-commands-empty",
                    default_summary="compile_commands.json is empty — build may have failed.",
                    default_hint="Caller must provide a build command that produces real compiler invocations under bear.",
                ),
            }

        user_entries = [e for e in entries if "CMakeFiles" not in e.get("file", "")]
        user_entry_count = len(user_entries)
        build_failed = proc.returncode != 0

        if build_failed and user_entry_count == 0:
            reason = f"build exited with code {proc.returncode}"
            if entry_count > 0:
                reason += " — compile_commands.json contains only CMake temporary entries"
            logger.warning(
                "Build failed: %s (%d total entries, %d user entries, %dms)",
                reason, entry_count, user_entry_count, elapsed,
            )
            return {
                "success": False,
                "buildEvidence": self._build_evidence(
                    project_path=project_path,
                    requested_command=build_command,
                    effective_command=effective_command,
                    compile_commands_path=str(cc_path),
                    entries=entry_count,
                    user_entries=user_entry_count,
                    exit_code=proc.returncode,
                    build_output=build_output[-1000:],
                    wrap_with_bear=wrap_with_bear,
                    timeout=timeout,
                    environment=environment,
                    elapsed_ms=elapsed,
                ),
                "failureDetail": self._diagnose_failure(
                    build_output=build_output,
                    exit_code=proc.returncode,
                    default_category="build-process",
                    default_summary=reason,
                    default_hint="S4 will not infer or repair build intent; the caller must provide correct build materials.",
                ),
            }

        if build_failed and user_entry_count > 0:
            reason = f"build exited with code {proc.returncode}"
            logger.warning(
                "Build failed (partial compile_commands available): %s (%d total entries, %d user entries, %dms)",
                reason, entry_count, user_entry_count, elapsed,
            )
            return {
                "success": False,
                "buildEvidence": self._build_evidence(
                    project_path=project_path,
                    requested_command=build_command,
                    effective_command=effective_command,
                    compile_commands_path=str(cc_path),
                    entries=entry_count,
                    user_entries=user_entry_count,
                    exit_code=proc.returncode,
                    build_output=build_output[-1000:],
                    wrap_with_bear=wrap_with_bear,
                    timeout=timeout,
                    environment=environment,
                    elapsed_ms=elapsed,
                ),
                "failureDetail": self._diagnose_failure(
                    build_output=build_output,
                    exit_code=proc.returncode,
                    default_category="build-process",
                    default_summary=reason,
                    default_hint=f"Partial compile_commands are available ({user_entry_count} user entries), but S4 will not compensate for caller-side build mistakes.",
                ),
            }

        logger.info(
            "Build completed: %d entries (%d user), exit=%d, %dms",
            entry_count, user_entry_count, proc.returncode, elapsed,
        )
        return {
            "success": True,
            "buildEvidence": self._build_evidence(
                project_path=project_path,
                requested_command=build_command,
                effective_command=effective_command,
                compile_commands_path=str(cc_path),
                entries=entry_count,
                user_entries=user_entry_count,
                exit_code=proc.returncode,
                build_output=build_output[-500:],
                wrap_with_bear=wrap_with_bear,
                timeout=timeout,
                environment=environment,
                elapsed_ms=elapsed,
            ),
            "failureDetail": None,
        }

    def _build_evidence(
        self,
        *,
        project_path: Path,
        requested_command: str,
        effective_command: str,
        compile_commands_path: str | None,
        entries: int | None,
        user_entries: int | None,
        exit_code: int | None,
        build_output: str | None,
        wrap_with_bear: bool,
        timeout: int,
        environment: dict[str, str] | None,
        elapsed_ms: int,
    ) -> dict[str, Any]:
        return {
            "requestedBuildCommand": requested_command,
            "effectiveBuildCommand": effective_command,
            "buildDir": str(project_path),
            "compileCommandsPath": compile_commands_path,
            "entries": entries,
            "userEntries": user_entries,
            "exitCode": exit_code,
            "buildOutput": build_output,
            "wrapWithBear": wrap_with_bear,
            "timeoutSeconds": timeout,
            "environmentKeys": sorted(environment.keys()) if environment else None,
            "elapsedMs": elapsed_ms,
        }

    def _diagnose_failure(
        self,
        *,
        build_output: str,
        exit_code: int | None,
        default_category: str,
        default_summary: str,
        default_hint: str,
    ) -> dict[str, Any]:
        lines = [line.strip() for line in build_output.splitlines() if line.strip()]
        excerpt = lines[-1] if lines else None

        lib_match = _SHARED_LIBRARY_ERROR_RE.search(build_output)
        if lib_match:
            return self._failure_detail(
                category="shared-library-load",
                summary="The supplied build environment could not load a required shared library.",
                matched_excerpt=lib_match.group(0),
                hint="Caller must provide a valid runtime/library environment for the build command.",
                retryable=False,
            )

        if exit_code == 127:
            return self._failure_detail(
                category="command-not-found",
                summary="The supplied build command referenced an unavailable executable or script (exit code 127).",
                matched_excerpt=excerpt,
                hint="Caller must provide a valid build command and executable paths.",
                retryable=False,
            )

        return self._failure_detail(
            category=default_category,
            summary=default_summary,
            matched_excerpt=excerpt,
            hint=default_hint,
            retryable=default_category == "timeout",
        )

    def _failure_detail(
        self,
        *,
        category: str,
        summary: str,
        matched_excerpt: str | None,
        hint: str,
        retryable: bool,
    ) -> dict[str, Any]:
        return {
            "category": category,
            "summary": summary,
            "matchedExcerpt": matched_excerpt,
            "hint": hint,
            "retryable": retryable,
        }
