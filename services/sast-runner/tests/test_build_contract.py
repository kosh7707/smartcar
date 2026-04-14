"""Build preparation contract tests for explicit readiness semantics."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.scanner.build_runner import BuildRunner


class _Proc:
    def __init__(
        self,
        *,
        tmp_path: Path,
        compile_commands: list[dict] | None,
        returncode: int,
        stdout: bytes = b"",
        stderr: bytes = b"",
    ) -> None:
        self._tmp_path = tmp_path
        self._compile_commands = compile_commands
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr

    async def communicate(self) -> tuple[bytes, bytes]:
        if self._compile_commands is not None:
            (self._tmp_path / "compile_commands.json").write_text(json.dumps(self._compile_commands))
        return self._stdout, self._stderr


@pytest.mark.asyncio
async def test_build_ready_requires_successful_user_entries(tmp_path: Path) -> None:
    runner = BuildRunner()
    compile_commands = [
        {"file": str(tmp_path / "src/main.c"), "command": "gcc -c src/main.c", "directory": str(tmp_path)},
    ]
    proc = _Proc(tmp_path=tmp_path, compile_commands=compile_commands, returncode=0, stdout=b"ok")

    with patch("app.scanner.build_runner.asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        result = await runner.build(tmp_path, "make")

    assert result["success"] is True
    assert result["readiness"]["status"] == "ready"
    assert result["readiness"]["compileCommandsReady"] is True
    assert result["readiness"]["quickEligible"] is True


@pytest.mark.asyncio
async def test_build_rejects_compile_commands_without_user_entries(tmp_path: Path) -> None:
    runner = BuildRunner()
    compile_commands = [
        {
            "file": str(tmp_path / "build/CMakeFiles/CMakeCCompilerId.c"),
            "command": "gcc -c CMakeCCompilerId.c",
            "directory": str(tmp_path),
        },
    ]
    proc = _Proc(tmp_path=tmp_path, compile_commands=compile_commands, returncode=0)

    with patch("app.scanner.build_runner.asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        result = await runner.build(tmp_path, "cmake -S . -B build && cmake --build build")

    assert result["success"] is False
    assert result["readiness"]["status"] == "not-ready"
    assert result["readiness"]["compileCommandsReady"] is False
    assert result["readiness"]["quickEligible"] is False
    assert result["failureDetail"]["category"] == "compile-commands-no-user-entries"


@pytest.mark.asyncio
async def test_build_partial_compile_commands_are_not_quick_eligible(tmp_path: Path) -> None:
    runner = BuildRunner()
    compile_commands = [
        {"file": str(tmp_path / "src/main.c"), "command": "gcc -c src/main.c", "directory": str(tmp_path)},
    ]
    proc = _Proc(
        tmp_path=tmp_path,
        compile_commands=compile_commands,
        returncode=2,
        stderr=b"make: *** [all] Error 2\n",
    )

    with patch("app.scanner.build_runner.asyncio.create_subprocess_exec", AsyncMock(return_value=proc)):
        result = await runner.build(tmp_path, "make")

    assert result["success"] is False
    assert result["readiness"]["status"] == "partial"
    assert result["readiness"]["compileCommandsReady"] is False
    assert result["readiness"]["quickEligible"] is False
    assert result["failureDetail"]["category"] == "build-process"
