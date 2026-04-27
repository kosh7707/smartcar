"""Safety tests for ReadFileTool — path traversal, size limits, encoding."""

from __future__ import annotations

import os

import pytest

from app.tools.implementations.read_file import ReadFileTool
from app.agent_runtime.schemas.agent import ToolResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_file(base: os.PathLike, rel: str, content: str | bytes = "") -> str:
    """Create a file under *base* at relative *rel* and return its path."""
    full = os.path.join(base, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    mode = "wb" if isinstance(content, bytes) else "w"
    kwargs = {} if isinstance(content, bytes) else {"encoding": "utf-8"}
    with open(full, mode, **kwargs) as f:
        f.write(content)
    return full


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_read_existing_file(tmp_path):
    _make_file(tmp_path, "hello.txt", "hello world")
    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "hello.txt"})

    assert isinstance(result, ToolResult)
    assert result.success is True
    assert result.content == "hello world"


@pytest.mark.asyncio
async def test_read_nonexistent_file(tmp_path):
    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "no_such_file.txt"})

    assert result.success is False
    assert "not found" in (result.error or "")


@pytest.mark.asyncio
async def test_path_traversal_dotdot(tmp_path):
    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "../../etc/passwd"})

    assert result.success is False
    assert "path traversal" in (result.error or "").lower()


@pytest.mark.asyncio
async def test_path_traversal_absolute(tmp_path):
    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "/etc/passwd"})

    assert result.success is False
    # normpath("/etc/passwd") = "/etc/passwd" which won't startswith(tmp_path)
    assert "path traversal" in (result.error or "").lower()


@pytest.mark.asyncio
async def test_read_8kb_limit_with_truncation_notice(tmp_path):
    """8,000자 초과 파일은 잘리고 절삭 공지가 붙는다."""
    big_content = "A" * 100_000
    _make_file(tmp_path, "big.txt", big_content)

    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "big.txt"})

    assert result.success is True
    assert result.content.startswith("A" * 100)
    assert "8,000자에서 잘림" in result.content
    assert "100,000바이트" in result.content
    # 잘린 본문(8000) + 절삭 공지
    assert len(result.content) < 8_200


@pytest.mark.asyncio
async def test_read_binary_file(tmp_path):
    # 0x80-0xFF are non-UTF-8 single bytes; errors="replace" must not crash
    binary_blob = bytes(range(256))
    _make_file(tmp_path, "blob.bin", binary_blob)

    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "blob.bin"})

    assert result.success is True
    # The replacement character should appear for invalid bytes
    assert "\ufffd" in result.content


@pytest.mark.asyncio
async def test_read_empty_file(tmp_path):
    _make_file(tmp_path, "empty.txt", "")

    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "empty.txt"})

    assert result.success is True
    assert result.content == ""


@pytest.mark.asyncio
async def test_read_unicode_file(tmp_path):
    korean = "AEGIS 정적 분석 보고서"
    _make_file(tmp_path, "report.txt", korean)

    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "report.txt"})

    assert result.success is True
    assert result.content == korean


@pytest.mark.asyncio
async def test_read_nested_subdir(tmp_path):
    _make_file(tmp_path, "a/b/c.txt", "nested content")

    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "a/b/c.txt"})

    assert result.success is True
    assert result.content == "nested content"


@pytest.mark.asyncio
async def test_path_traversal_prefix_attack(tmp_path):
    """'/home/project' 접두사로 '/home/projectEVIL/' 접근 차단 확인."""
    tool = ReadFileTool(project_path=str(tmp_path))
    # tmp_path가 '/tmp/pytest-xxx/test_xxx0' 라면
    # 'EVIL/secret.txt' → '/tmp/pytest-xxx/test_xxx0EVIL/secret.txt' 로 정규화
    # 이는 프로젝트 경로 밖이므로 차단되어야 함
    evil_path = f"../{tmp_path.name}EVIL/secret.txt"
    result = await tool.execute({"path": evil_path})
    assert result.success is False
    assert "path traversal" in (result.error or "").lower()


@pytest.mark.asyncio
async def test_evidence_ref_generated(tmp_path):
    _make_file(tmp_path, "src/main.c", "int main(){}")

    tool = ReadFileTool(project_path=str(tmp_path))
    result = await tool.execute({"path": "src/main.c"})

    assert result.success is True
    assert len(result.new_evidence_refs) == 1
    assert result.new_evidence_refs[0].startswith("eref-file-")
