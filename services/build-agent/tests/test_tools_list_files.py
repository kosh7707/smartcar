"""ListFilesTool 단위 테스트 — 디렉토리 트리, 깊이 제한, 노이즈 필터, 경로 순회 차단."""

from __future__ import annotations

import os

import pytest

from app.tools.implementations.list_files import ListFilesTool


def _make_file(base, rel: str, content: str = "") -> None:
    full = os.path.join(base, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w") as f:
        f.write(content)


@pytest.mark.asyncio
async def test_list_basic_project(tmp_path):
    _make_file(tmp_path, "CMakeLists.txt")
    _make_file(tmp_path, "src/main.c")
    _make_file(tmp_path, "include/config.h")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({})

    assert result.success is True
    assert "CMakeLists.txt" in result.content
    assert "src/" in result.content
    assert "main.c" in result.content
    assert "include/" in result.content


@pytest.mark.asyncio
async def test_list_respects_depth_limit(tmp_path):
    _make_file(tmp_path, "a/b/c/d/e/deep.txt")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({"max_depth": 2})

    assert result.success is True
    assert "a/" in result.content
    assert "b/" in result.content
    # depth 2 이상은 나타나지 않아야 함
    assert "deep.txt" not in result.content


@pytest.mark.asyncio
async def test_list_excludes_noise_dirs(tmp_path):
    _make_file(tmp_path, "src/main.c")
    _make_file(tmp_path, ".git/config")
    _make_file(tmp_path, "node_modules/pkg/index.js")
    _make_file(tmp_path, "build/output.o")
    _make_file(tmp_path, "third_party/lib/foo.c")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({})

    assert result.success is True
    assert "main.c" in result.content
    assert "node_modules" not in result.content
    assert ".git" not in result.content
    assert "build/" not in result.content
    assert "third_party" not in result.content


@pytest.mark.asyncio
async def test_list_max_entries_truncation(tmp_path):
    for i in range(50):
        _make_file(tmp_path, f"file_{i:03d}.txt")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({"max_entries": 10})

    assert result.success is True
    assert "잘림" in result.content


@pytest.mark.asyncio
async def test_list_path_traversal_blocked(tmp_path):
    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "../../etc"})

    assert result.success is False
    assert "path traversal" in (result.error or "").lower()


@pytest.mark.asyncio
async def test_list_subdir(tmp_path):
    _make_file(tmp_path, "src/main.c")
    _make_file(tmp_path, "src/util.c")
    _make_file(tmp_path, "include/header.h")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "src"})

    assert result.success is True
    assert "main.c" in result.content
    assert "util.c" in result.content
    assert "header.h" not in result.content


@pytest.mark.asyncio
async def test_list_empty_dir(tmp_path):
    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({})

    assert result.success is True
    assert "empty" in result.content.lower()


@pytest.mark.asyncio
async def test_list_nonexistent_path(tmp_path):
    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "no_such_dir"})

    assert result.success is False
    assert "not found" in (result.error or "").lower()


@pytest.mark.asyncio
async def test_list_evidence_ref(tmp_path):
    _make_file(tmp_path, "main.c")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({})

    assert result.success is True
    assert len(result.new_evidence_refs) == 1
    assert result.new_evidence_refs[0] == "eref-tree-root"


@pytest.mark.asyncio
async def test_list_evidence_ref_subdir(tmp_path):
    _make_file(tmp_path, "src/main.c")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "src"})

    assert result.success is True
    assert result.new_evidence_refs[0] == "eref-tree-src"


@pytest.mark.asyncio
async def test_list_hidden_files_excluded(tmp_path):
    _make_file(tmp_path, ".hidden_file")
    _make_file(tmp_path, "visible.txt")

    tool = ListFilesTool(project_path=str(tmp_path))
    result = await tool.execute({})

    assert result.success is True
    assert "visible.txt" in result.content
    assert ".hidden_file" not in result.content
