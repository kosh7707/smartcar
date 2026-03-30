"""ScanbuildRunner 파서 단위 테스트."""

from pathlib import Path

import pytest

from app.scanner.path_utils import normalize_path
from app.scanner.scanbuild_runner import ScanbuildRunner


@pytest.fixture
def runner():
    return ScanbuildRunner()


class TestConvertDiagnostic:
    """_convert_diagnostic() 메서드 단위 테스트."""

    def test_basic_diagnostic(self, runner):
        files_list = ["src/main.c", "src/util.c"]
        diag = {
            "description": "Null pointer dereference",
            "category": "Logic error",
            "check_name": "core.NullDereference",
            "location": {"file": 0, "line": 17, "col": 5},
            "path": [],
        }
        finding = runner._convert_diagnostic(diag, files_list, Path("/tmp/scan"))
        assert finding is not None
        assert finding.tool_id == "scan-build"
        assert finding.rule_id == "scan-build:core.NullDereference"
        assert finding.location.file == "src/main.c"
        assert finding.location.line == 17

    def test_cwe_mapping(self, runner):
        files_list = ["src/main.c"]
        diag = {
            "description": "Use of memory after it is freed",
            "category": "Memory error",
            "check_name": "unix.Malloc",
            "location": {"file": 0, "line": 14, "col": 5},
            "path": [],
        }
        finding = runner._convert_diagnostic(diag, files_list, Path("/tmp/scan"))
        assert finding is not None
        cwe = finding.metadata.get("cwe")
        assert cwe is not None

    def test_data_flow_extraction(self, runner):
        files_list = ["src/main.c"]
        diag = {
            "description": "Dereference of null pointer",
            "category": "Logic error",
            "check_name": "core.NullDereference",
            "location": {"file": 0, "line": 17, "col": 5},
            "path": [
                {"kind": "event", "location": {"file": 0, "line": 15, "col": 3},
                 "message": "Variable 'q' initialized to NULL"},
                {"kind": "control", "location": {"file": 0, "line": 16, "col": 3}},
                {"kind": "event", "location": {"file": 0, "line": 17, "col": 5},
                 "message": "Dereference of null pointer"},
            ],
        }
        finding = runner._convert_diagnostic(diag, files_list, Path("/tmp/scan"))
        assert finding is not None
        assert finding.data_flow is not None
        # Only "event" kind entries become data flow steps
        assert len(finding.data_flow) == 2

    def test_invalid_file_index(self, runner):
        files_list = ["src/main.c"]
        diag = {
            "description": "Some error",
            "category": "Logic error",
            "check_name": "core.Something",
            "location": {"file": 99, "line": 1, "col": 1},
            "path": [],
        }
        finding = runner._convert_diagnostic(diag, files_list, Path("/tmp/scan"))
        assert finding is None

    def test_negative_file_index(self, runner):
        """음수 file_idx는 files_list[-1]이 아닌 None 반환."""
        files_list = ["src/main.c"]
        diag = {
            "description": "Some error",
            "category": "Logic error",
            "check_name": "core.Something",
            "location": {"file": -1, "line": 10, "col": 1},
            "path": [],
        }
        finding = runner._convert_diagnostic(diag, files_list, Path("/tmp/scan"))
        assert finding is None

    def test_missing_line(self, runner):
        files_list = ["src/main.c"]
        diag = {
            "description": "Some error",
            "category": "Logic error",
            "check_name": "core.Something",
            "location": {"file": 0},
            "path": [],
        }
        finding = runner._convert_diagnostic(diag, files_list, Path("/tmp/scan"))
        assert finding is None


class TestNormalizePath:
    def test_strips_base_dir(self):
        assert normalize_path("/tmp/scan/src/main.c", Path("/tmp/scan")) == "src/main.c"

    def test_already_relative(self):
        assert normalize_path("src/main.c", Path("/tmp/scan")) == "src/main.c"
