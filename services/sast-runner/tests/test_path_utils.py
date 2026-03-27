"""path_utils 단위 테스트 — 경로 정규화."""

from __future__ import annotations

from pathlib import Path

from app.scanner.path_utils import normalize_path


class TestNormalizePath:
    def test_absolute_under_base(self):
        result = normalize_path("/tmp/scan/src/main.c", Path("/tmp/scan"))
        assert result == "src/main.c"

    def test_already_relative(self):
        result = normalize_path("src/main.c", Path("/tmp/scan"))
        assert result == "src/main.c"

    def test_outside_base(self):
        result = normalize_path("/usr/include/stdio.h", Path("/tmp/scan"))
        assert result == "/usr/include/stdio.h"

    def test_base_without_trailing_slash(self):
        result = normalize_path("/home/user/project/file.c", Path("/home/user/project"))
        assert result == "file.c"

    def test_base_with_trailing_slash(self):
        result = normalize_path("/home/user/project/src/a.c", Path("/home/user/project/"))
        assert result == "src/a.c"
