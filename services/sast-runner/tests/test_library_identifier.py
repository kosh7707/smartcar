"""LibraryIdentifier 단위 테스트."""

from pathlib import Path

import pytest

from app.scanner.library_identifier import LibraryIdentifier


@pytest.fixture
def identifier():
    return LibraryIdentifier()


class TestParseCmake:
    def test_project_with_version(self, identifier, tmp_path):
        cmake = tmp_path / "CMakeLists.txt"
        cmake.write_text('cmake_minimum_required(VERSION 3.10)\nproject(civetweb VERSION 1.16)\n')
        result = identifier._parse_cmake(cmake)
        assert result is not None
        assert result["name"] == "civetweb"
        assert result["version"] == "1.16"

    def test_project_without_version(self, identifier, tmp_path):
        cmake = tmp_path / "CMakeLists.txt"
        cmake.write_text('project(mylib)\nadd_library(mylib src/lib.c)\n')
        result = identifier._parse_cmake(cmake)
        # version 없으면 None 가능
        assert result is None or result.get("version") is None

    def test_set_version_variables(self, identifier, tmp_path):
        cmake = tmp_path / "CMakeLists.txt"
        cmake.write_text(
            'project(rapidjson)\n'
            'set(LIB_MAJOR_VERSION "1")\n'
            'set(LIB_MINOR_VERSION "1")\n'
            'set(LIB_PATCH_VERSION "0")\n'
        )
        result = identifier._parse_cmake(cmake)
        assert result is not None
        assert result["version"] == "1.1.0"


class TestParseConfigureAc:
    def test_ac_init(self, identifier, tmp_path):
        ac = tmp_path / "configure.ac"
        ac.write_text('AC_INIT([tinydtls], [0.8.6])\nAC_CONFIG_SRCDIR([dtls.c])\n')
        result = identifier._parse_configure_ac(ac)
        assert result is not None
        assert result["name"] == "tinydtls"
        assert result["version"] == "0.8.6"

    def test_no_ac_init(self, identifier, tmp_path):
        ac = tmp_path / "configure.ac"
        ac.write_text('dnl just a comment\n')
        result = identifier._parse_configure_ac(ac)
        assert result is None


class TestParseVersionHeader:
    def test_define_version(self, identifier, tmp_path):
        header = tmp_path / "version.h"
        header.write_text('#define CIVETWEB_VERSION "1.16"\n')
        result = identifier._parse_version_header(header, "civetweb")
        assert result is not None
        assert result["version"] == "1.16"

    def test_no_version_define(self, identifier, tmp_path):
        header = tmp_path / "config.h"
        header.write_text('#define BUFFER_SIZE 1024\n')
        result = identifier._parse_version_header(header, "mylib")
        assert result is None


class TestFindLibraryDirs:
    def test_finds_libraries_dir(self, identifier, tmp_path):
        lib_dir = tmp_path / "libraries" / "civetweb"
        lib_dir.mkdir(parents=True)
        (lib_dir / "civetweb.c").write_text("// source\n")
        dirs = identifier._find_library_dirs(tmp_path)
        assert len(dirs) >= 1

    def test_skips_build_dir(self, identifier, tmp_path):
        build_dir = tmp_path / "build" / "somelib"
        build_dir.mkdir(parents=True)
        (build_dir / "lib.c").write_text("// source\n")
        dirs = identifier._find_library_dirs(tmp_path)
        assert all("build" not in str(d) for d in dirs)

    def test_skips_node_modules(self, identifier, tmp_path):
        nm = tmp_path / "node_modules" / "somelib"
        nm.mkdir(parents=True)
        dirs = identifier._find_library_dirs(tmp_path)
        assert all("node_modules" not in str(d) for d in dirs)


class TestIdentify:
    def test_cmake_library(self, identifier, tmp_path):
        lib_dir = tmp_path / "libraries" / "mylib"
        lib_dir.mkdir(parents=True)
        (lib_dir / "CMakeLists.txt").write_text('project(mylib VERSION 2.0.0)\n')
        (lib_dir / "mylib.c").write_text("// source\n")

        libs = identifier.identify(tmp_path)
        assert len(libs) >= 1
        mylib = [l for l in libs if l["name"] == "mylib"]
        assert len(mylib) == 1
        assert mylib[0]["version"] == "2.0.0"
