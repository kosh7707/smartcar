"""ReadFileTool 단위 테스트."""

import os
import tempfile

import pytest

from app.tools.implementations.read_file_tool import ReadFileTool


@pytest.fixture
def project_dir(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.c").write_text("int main() { return 0; }\n")
    (tmp_path / "src" / "big.c").write_text("x" * 10_000)
    return str(tmp_path)


@pytest.fixture
def tool(project_dir):
    return ReadFileTool(project_dir)


@pytest.mark.asyncio
async def test_read_existing_file(tool):
    result = await tool.execute({"path": "src/main.c"})
    assert result.success is True
    assert "int main()" in result.content
    assert result.new_evidence_refs == ["eref-file-src-main.c"]


@pytest.mark.asyncio
async def test_file_not_found(tool):
    result = await tool.execute({"path": "src/nonexistent.c"})
    assert result.success is False
    assert "not found" in result.error


@pytest.mark.asyncio
async def test_path_traversal_blocked(tool):
    result = await tool.execute({"path": "../../etc/passwd"})
    assert result.success is False
    assert "traversal" in result.error


@pytest.mark.asyncio
async def test_missing_path_parameter(tool):
    result = await tool.execute({})
    assert result.success is False
    assert "path" in result.content


@pytest.mark.asyncio
async def test_large_file_truncated(tool):
    result = await tool.execute({"path": "src/big.c"})
    assert result.success is True
    assert "잘림" in result.content
    assert len(result.content) < 10_000


@pytest.mark.asyncio
async def test_evidence_ref_generated(tool):
    result = await tool.execute({"path": "src/main.c"})
    assert result.success is True
    assert len(result.new_evidence_refs) == 1
    assert result.new_evidence_refs[0].startswith("eref-file-")
