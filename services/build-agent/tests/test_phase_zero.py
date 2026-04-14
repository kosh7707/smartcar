"""Phase0Executor 단위 테스트 — 결정론적 빌드 시스템 탐지."""

from __future__ import annotations

import os

import pytest

from app.core.phase_zero import Phase0Executor, Phase0Result


def _make_file(base, rel: str, content: str = "") -> None:
    full = os.path.join(base, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# 빌드 시스템 탐지
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_detect_cmake_project(tmp_path):
    _make_file(tmp_path, "CMakeLists.txt", "cmake_minimum_required()")
    _make_file(tmp_path, "src/main.c")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.build_system == "cmake"


@pytest.mark.asyncio
async def test_detect_makefile_project(tmp_path):
    _make_file(tmp_path, "Makefile", "all:\n\tgcc main.c")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.build_system == "make"


@pytest.mark.asyncio
async def test_detect_autotools_project(tmp_path):
    _make_file(tmp_path, "configure.ac")
    _make_file(tmp_path, "configure", "#!/bin/sh")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.build_system == "autotools"


@pytest.mark.asyncio
async def test_detect_shell_project(tmp_path):
    _make_file(tmp_path, "scripts/cross_build.sh", "#!/bin/bash")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.build_system == "shell"


@pytest.mark.asyncio
async def test_detect_unknown_project(tmp_path):
    _make_file(tmp_path, "README.md")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.build_system == "unknown"


@pytest.mark.asyncio
async def test_detect_cmake_in_subdir(tmp_path):
    _make_file(tmp_path, "src/CMakeLists.txt")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.build_system == "cmake"


# ---------------------------------------------------------------------------
# 빌드 파일 탐색
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_build_files_discovered(tmp_path):
    _make_file(tmp_path, "CMakeLists.txt")
    _make_file(tmp_path, "src/CMakeLists.txt")
    _make_file(tmp_path, "scripts/build.sh")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert "CMakeLists.txt" in result.build_files
    assert any("build.sh" in f for f in result.build_files)


@pytest.mark.asyncio
async def test_build_files_exclude_noise(tmp_path):
    _make_file(tmp_path, "CMakeLists.txt")
    _make_file(tmp_path, "third_party/lib/CMakeLists.txt")
    _make_file(tmp_path, "vendor/foo/Makefile")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert all("third_party" not in f for f in result.build_files)
    assert all("vendor" not in f for f in result.build_files)


# ---------------------------------------------------------------------------
# 기존 빌드 스크립트 탐지
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_existing_build_script_detected(tmp_path):
    _make_file(tmp_path, "scripts/cross_build.sh", "#!/bin/bash")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.has_existing_build_script is True
    assert result.existing_script_path == "scripts/cross_build.sh"


@pytest.mark.asyncio
async def test_no_existing_build_script(tmp_path):
    _make_file(tmp_path, "src/main.c")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.has_existing_build_script is False
    assert result.existing_script_path == ""


# ---------------------------------------------------------------------------
# 언어 탐지
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_language_detection(tmp_path):
    _make_file(tmp_path, "src/main.c")
    _make_file(tmp_path, "src/util.cpp")
    _make_file(tmp_path, "include/config.h")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert "c" in result.detected_languages
    assert "cpp" in result.detected_languages


# ---------------------------------------------------------------------------
# 프로젝트 트리 / 스코핑
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_project_tree_generated(tmp_path):
    _make_file(tmp_path, "src/main.c")
    _make_file(tmp_path, "include/config.h")
    _make_file(tmp_path, "CMakeLists.txt")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert "src/" in result.project_tree
    assert "CMakeLists.txt" in result.project_tree


@pytest.mark.asyncio
async def test_duration_recorded(tmp_path):
    _make_file(tmp_path, "main.c")
    ex = Phase0Executor(str(tmp_path))
    result = await ex.execute()
    assert result.duration_ms >= 0


@pytest.mark.asyncio
async def test_target_path_scoping(tmp_path):
    """target_path가 지정되면 해당 서브디렉토리 기준으로 분석."""
    _make_file(tmp_path, "sub/CMakeLists.txt")
    _make_file(tmp_path, "sub/src/main.c")
    _make_file(tmp_path, "other/Makefile")
    ex = Phase0Executor(str(tmp_path), target_path="sub")
    result = await ex.execute()
    assert result.build_system == "cmake"
