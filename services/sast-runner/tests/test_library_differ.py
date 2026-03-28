"""library_differ 단위 테스트 — upstream diff, clone, 해시 비교."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.scanner.library_differ import CloneCache, DiffResult, LibraryDiffer


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


# ──────────────────── DiffResult ────────────────────


class TestDiffResult:
    def test_success_to_dict(self):
        r = DiffResult(
            matched_version="v1.0", repo_url="https://repo",
            match_ratio=0.95, identical_files=10, modified_files=2,
            added_files=1, deleted_files=0,
            modifications=[{"file": "a.c", "insertions": 5, "deletions": 2}],
        )
        d = r.to_dict()
        assert d["matchedVersion"] == "v1.0"
        assert d["matchRatio"] == 0.95
        assert d["error"] is None
        assert d["modifiedFiles"] == 2

    def test_error_to_dict(self):
        """에러 응답도 동일한 shape (nullable 필드는 None)."""
        r = DiffResult(error="Failed to clone", repo_url="https://repo")
        d = r.to_dict()
        assert d["error"] == "Failed to clone"
        assert d["matchedVersion"] is None
        assert d["matchRatio"] is None
        assert d["modifiedFiles"] == 0
        assert d["repoUrl"] == "https://repo"

    def test_diff_clone_fail_has_unified_shape(self):
        """diff() 실패 시에도 matchedVersion, matchRatio 등 모든 키 존재."""
        r = DiffResult(error="Failed to clone upstream", repo_url="https://repo")
        d = r.to_dict()
        expected_keys = {"matchedVersion", "repoUrl", "matchRatio", "identicalFiles",
                         "modifiedFiles", "addedFiles", "deletedFiles", "modifications", "error"}
        assert expected_keys.issubset(set(d.keys()))


# ──────────────────── CloneCache ────────────────────


class TestCloneCache:
    @pytest.mark.asyncio
    async def test_miss_clones_fresh(self, tmp_path):
        """캐시 미스 → full clone."""
        cache = CloneCache(base_dir=str(tmp_path / "cache"), ttl_seconds=3600)
        with patch.object(cache, "_git_clone", new_callable=AsyncMock, return_value=True):
            result = await cache.get_or_clone("https://example.com/repo.git", timeout=30)
        assert result is not None
        assert result.is_dir()

    @pytest.mark.asyncio
    async def test_clone_failure_returns_none(self, tmp_path):
        """clone 실패 → None."""
        cache = CloneCache(base_dir=str(tmp_path / "cache"), ttl_seconds=3600)
        with patch.object(cache, "_git_clone", new_callable=AsyncMock, return_value=False):
            result = await cache.get_or_clone("https://fail.com/repo.git", timeout=30)
        assert result is None

    @pytest.mark.asyncio
    async def test_cache_key_deterministic(self, tmp_path):
        """동일 URL → 동일 캐시 키."""
        cache = CloneCache(base_dir=str(tmp_path / "cache"))
        key1 = cache._key("https://github.com/foo/bar.git")
        key2 = cache._key("https://github.com/foo/bar.git")
        assert key1 == key2
        # 다른 URL → 다른 키
        key3 = cache._key("https://github.com/baz/qux.git")
        assert key1 != key3
