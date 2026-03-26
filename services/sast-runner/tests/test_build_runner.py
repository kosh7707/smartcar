"""BuildRunner 단위 테스트 — detect_build_command, discover_targets, build."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.scanner.build_runner import BuildRunner


@pytest.fixture
def runner():
    return BuildRunner()


class TestDetectBuildCommand:
    def test_makefile(self, runner, tmp_path):
        (tmp_path / "Makefile").write_text("all:\n\tgcc -o main main.c\n")
        cmd = runner.detect_build_command(tmp_path)
        assert cmd == "make"

    def test_cmake(self, runner, tmp_path):
        (tmp_path / "CMakeLists.txt").write_text("project(test)\n")
        cmd = runner.detect_build_command(tmp_path)
        assert "cmake" in cmd

    def test_configure(self, runner, tmp_path):
        (tmp_path / "configure").write_text("#!/bin/sh\n")
        (tmp_path / "configure").chmod(0o755)
        cmd = runner.detect_build_command(tmp_path)
        assert "configure" in cmd

    def test_build_script_priority(self, runner, tmp_path):
        """빌드 스크립트가 Makefile보다 우선."""
        (tmp_path / "Makefile").write_text("all:\n")
        scripts = tmp_path / "scripts"
        scripts.mkdir()
        (scripts / "build.sh").write_text("#!/bin/sh\nmake\n")
        (scripts / "build.sh").chmod(0o755)
        cmd = runner.detect_build_command(tmp_path)
        assert "build.sh" in cmd

    def test_no_build_system(self, runner, tmp_path):
        cmd = runner.detect_build_command(tmp_path)
        assert cmd is None

    def test_cross_build_script_highest_priority(self, runner, tmp_path):
        """cross_build.sh가 최우선."""
        (tmp_path / "Makefile").write_text("all:\n")
        scripts = tmp_path / "scripts"
        scripts.mkdir()
        (scripts / "cross_build.sh").write_text("#!/bin/sh\n")
        (scripts / "cross_build.sh").chmod(0o755)
        (scripts / "build.sh").write_text("#!/bin/sh\n")
        (scripts / "build.sh").chmod(0o755)
        cmd = runner.detect_build_command(tmp_path)
        assert "cross_build" in cmd


class TestDiscoverTargets:
    def test_single_makefile(self, runner, tmp_path):
        (tmp_path / "Makefile").write_text("all:\n")
        targets = runner.discover_targets(tmp_path)
        assert len(targets) == 1
        assert targets[0]["buildSystem"] == "make"

    def test_nested_cmake(self, runner, tmp_path):
        (tmp_path / "CMakeLists.txt").write_text("project(root)\n")
        sub = tmp_path / "lib"
        sub.mkdir()
        (sub / "CMakeLists.txt").write_text("project(sub)\n")
        targets = runner.discover_targets(tmp_path)
        # 루트 + 하위 모두 발견될 수 있음 (nested dedup은 동일 빌드 시스템 내 부모-자식 관계)
        assert len(targets) >= 1

    def test_multiple_independent_targets(self, runner, tmp_path):
        app1 = tmp_path / "app1"
        app1.mkdir()
        (app1 / "Makefile").write_text("all:\n")
        app2 = tmp_path / "app2"
        app2.mkdir()
        (app2 / "CMakeLists.txt").write_text("project(app2)\n")
        targets = runner.discover_targets(tmp_path)
        assert len(targets) == 2

    def test_empty_project(self, runner, tmp_path):
        targets = runner.discover_targets(tmp_path)
        assert targets == []


def _make_proc_mock(returncode: int, stdout: bytes = b"", stderr: bytes = b""):
    """asyncio.create_subprocess_exec 결과를 모킹."""
    proc = AsyncMock()
    proc.returncode = returncode
    proc.communicate = AsyncMock(return_value=(stdout, stderr))
    return proc


class TestBuild:
    """BuildRunner.build() 단위 테스트 — success 판정 로직."""

    @pytest.mark.asyncio
    async def test_success_when_exit_zero(self, runner, tmp_path):
        """exitCode=0 + entries > 0 → success: true."""
        cc = [{"file": "src/main.c", "command": "gcc -c src/main.c", "directory": str(tmp_path)}]
        (tmp_path / "compile_commands.json").write_text(json.dumps(cc))

        proc = _make_proc_mock(0, b"Build OK\n")
        with patch("asyncio.create_subprocess_exec", return_value=proc):
            result = await runner.build(tmp_path, "make")

        assert result["success"] is True
        assert result["exitCode"] == 0
        assert result["entries"] == 1
        assert result["userEntries"] == 1

    @pytest.mark.asyncio
    async def test_failure_when_exit_nonzero(self, runner, tmp_path):
        """exitCode=1 + entries > 0 → success: false (핵심 버그 수정)."""
        cc = [{"file": "src/main.c", "command": "gcc -c src/main.c", "directory": str(tmp_path)}]
        (tmp_path / "compile_commands.json").write_text(json.dumps(cc))

        proc = _make_proc_mock(1, b"", b"ld returned 1 exit status\n")
        with patch("asyncio.create_subprocess_exec", return_value=proc):
            result = await runner.build(tmp_path, "make")

        assert result["success"] is False
        assert result["exitCode"] == 1
        assert result["entries"] == 1
        assert result["userEntries"] == 1
        assert "compileCommandsPath" in result

    @pytest.mark.asyncio
    async def test_failure_cmake_temp_only(self, runner, tmp_path):
        """exitCode=1 + CMakeFiles 임시 항목만 → success: false + userEntries=0."""
        cc = [
            {"file": "/tmp/build/CMakeFiles/CMakeCCompilerId.c", "command": "gcc -c CMakeCCompilerId.c", "directory": "/tmp"},
            {"file": "/tmp/build/CMakeFiles/CMakeCXXCompilerId.cpp", "command": "g++ -c CMakeCXXCompilerId.cpp", "directory": "/tmp"},
            {"file": "/tmp/build/CMakeFiles/CMakeCCompilerABI.c", "command": "gcc -c CMakeCCompilerABI.c", "directory": "/tmp"},
        ]
        (tmp_path / "compile_commands.json").write_text(json.dumps(cc))

        proc = _make_proc_mock(1, b"", b"CMake will not be able to correctly generate this project\n")
        with patch("asyncio.create_subprocess_exec", return_value=proc):
            result = await runner.build(tmp_path, "cmake -S . -B build && cmake --build build")

        assert result["success"] is False
        assert result["exitCode"] == 1
        assert result["entries"] == 3
        assert result["userEntries"] == 0
        assert "CMake temporary" in result["error"]

    @pytest.mark.asyncio
    async def test_failure_no_compile_commands(self, runner, tmp_path):
        """compile_commands.json 미생성 → success: false."""
        proc = _make_proc_mock(2, b"", b"bear: error\n")
        with patch("asyncio.create_subprocess_exec", return_value=proc):
            result = await runner.build(tmp_path, "make")

        assert result["success"] is False
        assert "bear did not generate" in result["error"]

    @pytest.mark.asyncio
    async def test_failure_empty_compile_commands(self, runner, tmp_path):
        """빈 compile_commands.json → success: false."""
        (tmp_path / "compile_commands.json").write_text("[]")

        proc = _make_proc_mock(0)
        with patch("asyncio.create_subprocess_exec", return_value=proc):
            result = await runner.build(tmp_path, "make")

        assert result["success"] is False
        assert "empty" in result["error"]

    @pytest.mark.asyncio
    async def test_timeout(self, runner, tmp_path):
        """빌드 타임아웃 → success: false."""
        import asyncio

        proc = AsyncMock()
        proc.returncode = -9
        proc.communicate = AsyncMock(side_effect=asyncio.TimeoutError())
        proc.kill = AsyncMock()

        # kill 후 communicate 재호출 모킹
        call_count = 0
        original = proc.communicate

        async def side_effect_fn():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise asyncio.TimeoutError()
            return (b"", b"")

        proc.communicate = AsyncMock(side_effect=side_effect_fn)

        with patch("asyncio.create_subprocess_exec", return_value=proc):
            result = await runner.build(tmp_path, "make", timeout=1)

        assert result["success"] is False
        assert "timed out" in result["error"]

    @pytest.mark.asyncio
    async def test_wrap_with_bear_true(self, runner, tmp_path):
        """wrapWithBear=True(기본값) → bear로 감싸서 실행."""
        cc = [{"file": "src/main.c", "command": "gcc -c src/main.c", "directory": str(tmp_path)}]
        (tmp_path / "compile_commands.json").write_text(json.dumps(cc))

        proc = _make_proc_mock(0, b"OK\n")
        with patch("asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
            await runner.build(tmp_path, "make", wrap_with_bear=True)

        cmd_args = mock_exec.call_args[0]
        assert cmd_args[0] == "bear"
        assert "--" in cmd_args

    @pytest.mark.asyncio
    async def test_wrap_with_bear_false(self, runner, tmp_path):
        """wrapWithBear=False → bear 없이 순수 실행."""
        cc = [{"file": "src/main.c", "command": "gcc -c src/main.c", "directory": str(tmp_path)}]
        (tmp_path / "compile_commands.json").write_text(json.dumps(cc))

        proc = _make_proc_mock(0, b"OK\n")
        with patch("asyncio.create_subprocess_exec", return_value=proc) as mock_exec:
            await runner.build(tmp_path, "make", wrap_with_bear=False)

        cmd_args = mock_exec.call_args[0]
        assert cmd_args[0] == "bash"
        assert "bear" not in cmd_args
