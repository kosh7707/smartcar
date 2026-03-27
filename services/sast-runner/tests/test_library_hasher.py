"""library_hasher 단위 테스트 — hash_source_files, compare_hashes."""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from app.scanner.library_hasher import compare_hashes, hash_source_files


# ---------------------------------------------------------------------------
# hash_source_files
# ---------------------------------------------------------------------------

class TestHashSourceFiles:
    def test_hashes_c_and_h_files(self, tmp_path: Path):
        """tmp 디렉토리에 .c/.h 파일을 만들고 해시 맵 생성을 검증."""
        (tmp_path / "main.c").write_text("int main() { return 0; }\n")
        (tmp_path / "util.h").write_text("#pragma once\nvoid util();\n")

        result = hash_source_files(tmp_path)

        assert "main.c" in result
        assert "util.h" in result
        assert len(result) == 2
        # 해시는 SHA256 앞 16자
        for h in result.values():
            assert len(h) == 16

    def test_skips_test_and_doc_directories(self, tmp_path: Path):
        """_SKIP_PATHS에 포함된 디렉토리는 무시."""
        src = tmp_path / "src"
        src.mkdir()
        (src / "main.c").write_text("// source\n")

        for skip_dir in ("test", "tests", "doc", "docs", "example", "examples",
                         "benchmark", ".git"):
            d = tmp_path / skip_dir
            d.mkdir(exist_ok=True)
            (d / "skip_me.c").write_text("// should be skipped\n")

        result = hash_source_files(tmp_path)

        assert "src/main.c" in result
        assert len(result) == 1

    def test_ignores_non_source_extensions(self, tmp_path: Path):
        """.txt, .o, .py 등 소스가 아닌 확장자는 무시."""
        (tmp_path / "readme.txt").write_text("readme\n")
        (tmp_path / "main.o").write_text("\x00\x01\x02")
        (tmp_path / "script.py").write_text("print('hello')\n")
        (tmp_path / "real.c").write_text("int x;\n")

        result = hash_source_files(tmp_path)

        assert len(result) == 1
        assert "real.c" in result

    def test_crlf_normalization_produces_same_hash(self, tmp_path: Path):
        """CRLF와 LF 줄 끝이 같은 내용이면 동일한 해시를 생성."""
        lf_dir = tmp_path / "lf"
        lf_dir.mkdir()
        crlf_dir = tmp_path / "crlf"
        crlf_dir.mkdir()

        content_lf = b"int main() {\n    return 0;\n}\n"
        content_crlf = b"int main() {\r\n    return 0;\r\n}\r\n"

        (lf_dir / "main.c").write_bytes(content_lf)
        (crlf_dir / "main.c").write_bytes(content_crlf)

        lf_hashes = hash_source_files(lf_dir)
        crlf_hashes = hash_source_files(crlf_dir)

        assert lf_hashes["main.c"] == crlf_hashes["main.c"]

    def test_correct_sha256_value(self, tmp_path: Path):
        """생성된 해시가 실제 SHA256 앞 16자와 일치하는지 검증."""
        content = b"hello world\n"
        (tmp_path / "test.c").write_bytes(content)

        result = hash_source_files(tmp_path)
        expected = hashlib.sha256(content).hexdigest()[:16]
        assert result["test.c"] == expected

    def test_nested_directories(self, tmp_path: Path):
        """하위 디렉토리에 있는 소스 파일도 상대 경로로 반환."""
        sub = tmp_path / "src" / "lib"
        sub.mkdir(parents=True)
        (sub / "lib.cpp").write_text("void f() {}\n")

        result = hash_source_files(tmp_path)

        assert "src/lib/lib.cpp" in result

    def test_empty_directory(self, tmp_path: Path):
        """빈 디렉토리 → 빈 딕셔너리."""
        result = hash_source_files(tmp_path)
        assert result == {}

    def test_all_source_extensions(self, tmp_path: Path):
        """지원하는 모든 소스 확장자가 포함되는지 검증."""
        exts = [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"]
        for ext in exts:
            (tmp_path / f"file{ext}").write_text(f"// {ext}\n")

        result = hash_source_files(tmp_path)
        assert len(result) == len(exts)


# ---------------------------------------------------------------------------
# compare_hashes
# ---------------------------------------------------------------------------

class TestCompareHashes:
    def test_all_identical(self):
        """모든 파일이 동일한 경우."""
        local = {"a.c": "aaa", "b.h": "bbb"}
        upstream = {"a.c": "aaa", "b.h": "bbb"}

        result = compare_hashes(local, upstream)

        assert result["identical"] == ["a.c", "b.h"]
        assert result["modified"] == []
        assert result["added"] == []
        assert result["deleted"] == []
        assert result["identicalCount"] == 2
        assert result["matchRatio"] == 1.0

    def test_some_modified(self):
        """일부 파일이 수정된 경우."""
        local = {"a.c": "aaa", "b.c": "xxx"}
        upstream = {"a.c": "aaa", "b.c": "bbb"}

        result = compare_hashes(local, upstream)

        assert result["identical"] == ["a.c"]
        assert result["modified"] == ["b.c"]
        assert result["identicalCount"] == 1
        assert result["modifiedCount"] == 1
        assert result["matchRatio"] == 0.5

    def test_added_files(self):
        """로컬에만 있는 파일 → added."""
        local = {"a.c": "aaa", "new.c": "nnn"}
        upstream = {"a.c": "aaa"}

        result = compare_hashes(local, upstream)

        assert result["added"] == ["new.c"]
        assert result["addedCount"] == 1

    def test_deleted_files(self):
        """upstream에만 있는 파일 → deleted."""
        local = {"a.c": "aaa"}
        upstream = {"a.c": "aaa", "old.c": "ooo"}

        result = compare_hashes(local, upstream)

        assert result["deleted"] == ["old.c"]
        assert result["deletedCount"] == 1

    def test_empty_inputs(self):
        """양쪽 모두 빈 딕셔너리."""
        result = compare_hashes({}, {})

        assert result["identical"] == []
        assert result["modified"] == []
        assert result["added"] == []
        assert result["deleted"] == []
        assert result["matchRatio"] == 0.0

    def test_match_ratio_calculation(self):
        """matchRatio = identical / (identical + modified)."""
        local = {"a.c": "aaa", "b.c": "xxx", "c.c": "ccc", "new.c": "nnn"}
        upstream = {"a.c": "aaa", "b.c": "bbb", "c.c": "ccc", "old.c": "ooo"}

        result = compare_hashes(local, upstream)

        # identical=2 (a.c, c.c), modified=1 (b.c), added=1, deleted=1
        assert result["identicalCount"] == 2
        assert result["modifiedCount"] == 1
        # matchRatio = 2 / (2+1) = 0.6667
        assert result["matchRatio"] == round(2 / 3, 4)

    def test_match_ratio_with_only_added_deleted(self):
        """identical+modified가 0이면 matchRatio=0.0 (added/deleted만 있는 경우)."""
        local = {"new.c": "nnn"}
        upstream = {"old.c": "ooo"}

        result = compare_hashes(local, upstream)

        assert result["addedCount"] == 1
        assert result["deletedCount"] == 1
        assert result["matchRatio"] == 0.0

    def test_results_sorted(self):
        """결과 리스트가 정렬되어 있는지 검증."""
        local = {"z.c": "zzz", "a.c": "aaa", "m.c": "mmm"}
        upstream = {"z.c": "zzz", "a.c": "aaa", "m.c": "mmm"}

        result = compare_hashes(local, upstream)

        assert result["identical"] == ["a.c", "m.c", "z.c"]
