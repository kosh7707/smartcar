"""include_resolver 단위 테스트 — gcc -E -M 의존성 파싱."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.scanner.include_resolver import IncludeResolver


@pytest.fixture
def resolver():
    return IncludeResolver()


class TestParseDeps:
    def test_single_line(self, resolver):
        raw = "main.o: src/main.c include/header.h /usr/include/stdio.h"
        result = resolver._parse_deps(raw, Path("src/main.c"))
        assert "include/header.h" in result
        assert "/usr/include/stdio.h" in result

    def test_multiline_backslash(self, resolver):
        raw = "main.o: src/main.c \\\n include/a.h \\\n include/b.h"
        result = resolver._parse_deps(raw, Path("src/main.c"))
        assert "include/a.h" in result
        assert "include/b.h" in result

    def test_source_file_excluded(self, resolver):
        raw = "main.o: src/main.c include/header.h"
        result = resolver._parse_deps(raw, Path("src/main.c"))
        assert not any(d.endswith("main.c") for d in result)

    def test_no_colon(self, resolver):
        raw = "no deps here"
        result = resolver._parse_deps(raw, Path("src/main.c"))
        assert result == []

    def test_empty_deps(self, resolver):
        raw = "main.o:"
        result = resolver._parse_deps(raw, Path("src/main.c"))
        assert result == []


class TestResolveGcc:
    def test_no_profile_returns_gcc(self, resolver):
        assert resolver._resolve_gcc(None) == "gcc"
