"""scan-build (Clang Static Analyzer) 실행기."""

from __future__ import annotations

import asyncio
import logging
import plistlib
import shutil
import tempfile
from pathlib import Path
from typing import Any

from app.errors import ScanTimeoutError
from app.schemas.request import BuildProfile
from app.schemas.response import SastDataFlowStep, SastFinding, SastFindingLocation

logger = logging.getLogger("aegis-sast-runner")

_SEVERITY_MAP = {
    "warning": "warning",
    "error": "error",
    "note": "info",
}

# scan-build checkName → CWE 매핑
_SCANBUILD_CWE_MAP: dict[str, list[str]] = {
    "core.NullDereference": ["CWE-476"],
    "core.StackAddressEscape": ["CWE-562"],
    "core.UndefinedBinaryOperatorResult": ["CWE-190"],
    "core.uninitialized.Assign": ["CWE-457"],
    "core.uninitialized.Branch": ["CWE-457"],
    "core.uninitialized.ArraySubscript": ["CWE-457"],
    "unix.Malloc": ["CWE-416", "CWE-415"],
    "unix.MallocSizeof": ["CWE-131"],
    "unix.MismatchedDeallocator": ["CWE-762"],
    "alpha.security.ArrayBound": ["CWE-119", "CWE-787"],
    "alpha.security.ArrayBoundV2": ["CWE-119", "CWE-787"],
    "alpha.security.ReturnPtrRange": ["CWE-466"],
    "alpha.security.taint.TaintPropagation": ["CWE-78"],
    "deadcode.DeadStores": ["CWE-563"],
    "optin.cplusplus.UninitializedObject": ["CWE-908"],
}


class ScanbuildRunner:
    """scan-build를 asyncio subprocess로 실행한다."""

    async def check_available(self) -> tuple[bool, str | None]:
        for name in ("scan-build", "scan-build-18", "scan-build-17"):
            try:
                proc = await asyncio.create_subprocess_exec(
                    name, "--help",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
                if proc.returncode == 0:
                    return True, name
                return False, None
            except (FileNotFoundError, asyncio.TimeoutError):
                continue
        return False, None

    async def run(
        self,
        scan_dir: Path,
        source_files: list[str],
        profile: BuildProfile | None,
        timeout: int = 120,
    ) -> list[SastFinding]:
        available, scan_build_bin = await self.check_available()
        if not available:
            return []

        c_cpp_files = [
            f for f in source_files
            if f.endswith((".c", ".cpp", ".cc", ".cxx"))
        ]
        if not c_cpp_files:
            return []

        logger.info("Running scan-build on %d files", len(c_cpp_files))
        bin_name = scan_build_bin or "scan-build"

        # 파일별 개별 실행 (동일 심볼 충돌 방지) + 병렬
        per_file_timeout = max(timeout // max(len(c_cpp_files), 1), 15)
        tasks = [
            self._run_single(bin_name, scan_dir, f, profile, per_file_timeout)
            for f in c_cpp_files
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_findings: list[SastFinding] = []
        for f, result in zip(c_cpp_files, results):
            if isinstance(result, Exception):
                logger.warning("scan-build failed for %s: %s", f, result)
            else:
                all_findings.extend(result)

        return all_findings

    async def _run_single(
        self,
        scan_build_bin: str,
        scan_dir: Path,
        source_file: str,
        profile: BuildProfile | None,
        timeout: int,
    ) -> list[SastFinding]:
        """단일 파일에 대해 scan-build를 실행."""
        target = str(scan_dir / source_file)
        output_dir = Path(tempfile.mkdtemp(prefix="scan-build-"))
        try:
            cmd = self._build_command(
                scan_build_bin, [target], output_dir, profile, scan_dir,
            )

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                _, _ = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout,
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return []  # 개별 파일 타임아웃은 무시하고 진행

            return self._parse_plist_results(output_dir, scan_dir)
        finally:
            shutil.rmtree(output_dir, ignore_errors=True)

    def _build_command(
        self,
        scan_build_bin: str,
        targets: list[str],
        output_dir: Path,
        profile: BuildProfile | None,
        scan_dir: Path,
    ) -> list[str]:
        clang_bin = self._find_clang()
        cmd = [
            scan_build_bin,
            "-o", str(output_dir),
            "-plist",
            "--status-bugs",
            clang_bin, "-c",
        ]

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

    def _parse_plist_results(
        self, output_dir: Path, scan_dir: Path,
    ) -> list[SastFinding]:
        """scan-build의 plist 출력을 SastFinding[]로 변환."""
        findings: list[SastFinding] = []

        for plist_file in output_dir.rglob("*.plist"):
            try:
                with open(plist_file, "rb") as f:
                    data = plistlib.load(f)
            except Exception:
                continue

            files_list = data.get("files", [])
            for diag in data.get("diagnostics", []):
                finding = self._convert_diagnostic(diag, files_list, scan_dir)
                if finding:
                    findings.append(finding)

        return findings

    def _convert_diagnostic(
        self,
        diag: dict,
        files_list: list[str],
        scan_dir: Path,
    ) -> SastFinding | None:
        desc = diag.get("description", "")
        category = diag.get("category", "")
        check_name = diag.get("check_name", "")

        loc = diag.get("location", {})
        file_idx = loc.get("file", 0)
        line = loc.get("line", 0)
        col = loc.get("col", 0)

        if file_idx >= len(files_list) or line == 0:
            return None

        file_path = self._normalize_path(files_list[file_idx], scan_dir)

        # data flow 추출
        data_flow: list[SastDataFlowStep] | None = None
        path_entries = diag.get("path", [])
        if path_entries:
            steps = []
            for entry in path_entries:
                if entry.get("kind") == "event":
                    e_loc = entry.get("location", {})
                    e_idx = e_loc.get("file", 0)
                    e_line = e_loc.get("line", 0)
                    e_msg = entry.get("message", "")
                    if e_idx < len(files_list) and e_line > 0:
                        steps.append(SastDataFlowStep(
                            file=self._normalize_path(files_list[e_idx], scan_dir),
                            line=e_line,
                            content=e_msg if e_msg else None,
                        ))
            if steps:
                data_flow = steps

        metadata: dict[str, Any] = {"category": category}
        if check_name:
            metadata["checkName"] = check_name
            cwe = _SCANBUILD_CWE_MAP.get(check_name)
            if cwe:
                metadata["cwe"] = cwe

        return SastFinding(
            toolId="scan-build",
            ruleId=f"scan-build:{check_name}" if check_name else f"scan-build:{category}",
            severity="warning",
            message=desc,
            location=SastFindingLocation(
                file=file_path, line=line, column=col if col else None,
            ),
            dataFlow=data_flow,
            metadata=metadata,
        )

    def _find_clang(self) -> str:
        import shutil as _sh
        for name in ("clang", "clang-18", "clang-17"):
            if _sh.which(name):
                return name
        return "clang"

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
