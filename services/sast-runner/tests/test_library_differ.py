"""library_differ 단위 테스트 — upstream diff, clone, 해시 비교."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.scanner.library_differ import LibraryDiffer


@pytest.fixture
def differ():
    return LibraryDiffer()


# ──────────────────── _count_diff_lines ────────────────────


class TestCountDiffLines:
    @pytest.mark.asyncio
    async def test_basic_diff(self, differ, tmp_path):
        a = tmp_path / "a.c"
        b = tmp_path / "b.c"
        a.write_text("line1\nline2\nline3\n")
        b.write_text("line1\nmodified\nline3\nnew_line\n")
        ins, dels = await differ._count_diff_lines(a, b)
        assert ins == 2  # modified + new_line
        assert dels == 1  # line2

    @pytest.mark.asyncio
    async def test_identical_files(self, differ, tmp_path):
        a = tmp_path / "a.c"
        b = tmp_path / "b.c"
        a.write_text("same\n")
        b.write_text("same\n")
        ins, dels = await differ._count_diff_lines(a, b)
        assert ins == 0
        assert dels == 0


# ──────────────────── _clone_and_checkout ────────────────────


class TestCloneAndCheckout:
    @pytest.mark.asyncio
    async def test_tag_found_first_try(self, differ, tmp_path):
        with patch.object(differ, "_git_clone_tag", new_callable=AsyncMock, return_value=True):
            tag = await differ._clone_and_checkout("https://repo", "1.2.0", tmp_path, 30)
        assert tag == "v1.2.0"  # 첫 번째 후보

    @pytest.mark.asyncio
    async def test_tag_not_found_fallback_head(self, differ, tmp_path):
        with patch.object(differ, "_git_clone_tag", new_callable=AsyncMock, return_value=False), \
             patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=True):
            tag = await differ._clone_and_checkout("https://repo", "9.9.9", tmp_path, 30)
        assert tag == "HEAD"

    @pytest.mark.asyncio
    async def test_all_clone_fail(self, differ, tmp_path):
        with patch.object(differ, "_git_clone_tag", new_callable=AsyncMock, return_value=False), \
             patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=False):
            tag = await differ._clone_and_checkout("https://repo", "1.0", tmp_path, 30)
        assert tag is None

    @pytest.mark.asyncio
    async def test_no_version_clone_head(self, differ, tmp_path):
        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=True):
            tag = await differ._clone_and_checkout("https://repo", None, tmp_path, 30)
        assert tag == "HEAD"


# ──────────────────── _clone_at_commit ────────────────────


class TestCloneAtCommit:
    @pytest.mark.asyncio
    async def test_success(self, differ, tmp_path):
        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=True), \
             patch.object(differ, "_git_checkout", new_callable=AsyncMock, return_value=True):
            result = await differ._clone_at_commit("https://repo", "abc123", tmp_path, 30)
        assert result == "abc123"

    @pytest.mark.asyncio
    async def test_clone_fail(self, differ, tmp_path):
        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=False):
            result = await differ._clone_at_commit("https://repo", "abc", tmp_path, 30)
        assert result is None

    @pytest.mark.asyncio
    async def test_checkout_fail(self, differ, tmp_path):
        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=True), \
             patch.object(differ, "_git_checkout", new_callable=AsyncMock, return_value=False):
            result = await differ._clone_at_commit("https://repo", "bad", tmp_path, 30)
        assert result is None


# ──────────────────── diff (integration-style, mocked) ────────────────────


class TestDiff:
    @pytest.mark.asyncio
    async def test_diff_with_commit(self, differ, tmp_path):
        # local 라이브러리 디렉토리
        lib_dir = tmp_path / "local_lib"
        lib_dir.mkdir()
        (lib_dir / "main.c").write_text("int main() { return 0; }\n")

        with patch.object(differ, "_clone_at_commit", new_callable=AsyncMock, return_value="abc123"), \
             patch("app.scanner.library_differ.hash_source_files") as mock_hash, \
             patch("app.scanner.library_differ.compare_hashes") as mock_compare:
            mock_hash.return_value = {"main.c": "aaa"}
            mock_compare.return_value = {
                "identical": ["main.c"], "modified": [], "added": [], "deleted": [],
                "identicalCount": 1, "modifiedCount": 0, "addedCount": 0, "deletedCount": 0,
                "matchRatio": 1.0,
            }
            result = await differ.diff(lib_dir, "https://repo", "1.0", commit="abc123")

        assert result["matchedVersion"] == "abc123"
        assert result["matchRatio"] == 1.0
        assert result["modifiedFiles"] == 0

    @pytest.mark.asyncio
    async def test_diff_clone_fail(self, differ, tmp_path):
        lib_dir = tmp_path / "lib"
        lib_dir.mkdir()

        with patch.object(differ, "_clone_and_checkout", new_callable=AsyncMock, return_value=None):
            result = await differ.diff(lib_dir, "https://repo", "1.0")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_diff_with_modifications(self, differ, tmp_path):
        lib_dir = tmp_path / "lib"
        lib_dir.mkdir()
        (lib_dir / "mod.c").write_text("modified content\n")

        with patch.object(differ, "_clone_and_checkout", new_callable=AsyncMock, return_value="v1.0"), \
             patch("app.scanner.library_differ.hash_source_files") as mock_hash, \
             patch("app.scanner.library_differ.compare_hashes") as mock_compare, \
             patch.object(differ, "_count_diff_lines", new_callable=AsyncMock, return_value=(5, 2)):
            mock_hash.return_value = {"mod.c": "aaa"}
            mock_compare.return_value = {
                "identical": [], "modified": ["mod.c"], "added": [], "deleted": [],
                "identicalCount": 0, "modifiedCount": 1, "addedCount": 0, "deletedCount": 0,
                "matchRatio": 0.0,
            }
            # _count_diff_lines needs both files to exist
            clone_dir_patch = tmp_path / "clone"
            clone_dir_patch.mkdir(exist_ok=True)
            (clone_dir_patch / "mod.c").write_text("original\n")

            result = await differ.diff(lib_dir, "https://repo", "1.0")

        assert result["matchedVersion"] == "v1.0"
        assert result["modifiedFiles"] == 1


# ──────────────────── find_closest_version ────────────────────


class TestFindClosestVersion:
    @pytest.mark.asyncio
    async def test_no_tags(self, differ, tmp_path):
        lib_dir = tmp_path / "lib"
        lib_dir.mkdir()

        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=True), \
             patch.object(differ, "_get_tags", new_callable=AsyncMock, return_value=[]):
            result = await differ.find_closest_version(lib_dir, "https://repo")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_clone_fail(self, differ, tmp_path):
        lib_dir = tmp_path / "lib"
        lib_dir.mkdir()

        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=False):
            result = await differ.find_closest_version(lib_dir, "https://repo")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_best_tag_found(self, differ, tmp_path):
        lib_dir = tmp_path / "lib"
        lib_dir.mkdir()

        with patch.object(differ, "_git_clone", new_callable=AsyncMock, return_value=True), \
             patch.object(differ, "_get_tags", new_callable=AsyncMock, return_value=["v1.0", "v2.0"]), \
             patch.object(differ, "_git_checkout", new_callable=AsyncMock, return_value=True), \
             patch.object(differ, "_quick_diff_size", new_callable=AsyncMock, side_effect=[10, 3]), \
             patch.object(differ, "_compute_diff", new_callable=AsyncMock, return_value={"modifiedFiles": 1}):
            result = await differ.find_closest_version(lib_dir, "https://repo")

        assert result["matchedVersion"] == "v2.0"  # smaller diff
        assert result["searchedTags"] == 2
