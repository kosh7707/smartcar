"""FlawfinderRunner 파서 단위 테스트."""

from pathlib import Path

import pytest

from app.scanner.flawfinder_runner import FlawfinderRunner


@pytest.fixture
def runner():
    return FlawfinderRunner()


SAMPLE_CSV = """\
File,Line,Column,Context,Level,Category,Name,Warning,Suggestion,Note,CWEs,Other
/tmp/scan/src/main.c,8,5,"  gets(buf);",5,buffer,gets,"Does not check for buffer overflows (CWE-120, CWE-20).",Consider using fgets().,,"CWE-120, CWE-20",
/tmp/scan/src/main.c,10,5,"  printf(buf);",4,format,printf,"If format strings can be influenced by an attacker, they can be exploited (CWE-134).",Use a constant for the format specification.,,"CWE-134",
/tmp/scan/src/main.c,3,0,"",1,buffer,strcpy,"Does not check for buffer overflows when copying to destination [MS-banned] (CWE-120).",Consider using snprintf or strlcpy.,,"CWE-120",
"""


class TestParseCsv:
    def test_basic_parsing(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        assert len(findings) == 3

    def test_tool_id(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        assert all(f.tool_id == "flawfinder" for f in findings)

    def test_rule_id_format(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        assert findings[0].rule_id == "flawfinder:buffer/gets"

    def test_cwe_extraction_from_warning(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        # gets has CWE-120 in Warning text
        cwe = findings[0].metadata.get("cwe")
        assert cwe is not None
        assert "CWE-120" in (cwe if isinstance(cwe, list) else [cwe])

    def test_severity_mapping(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        # Level 5 → error, Level 4 → error (high risk)
        assert findings[0].severity == "error"
        # Level 4 is also high — actual mapping determines this
        assert findings[1].severity in ("error", "warning")

    def test_path_normalization(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        assert findings[0].location.file == "src/main.c"

    def test_location_line_column(self, runner):
        findings = runner._parse_csv(SAMPLE_CSV, Path("/tmp/scan"))
        assert findings[0].location.line == 8
        assert findings[0].location.column == 5

    def test_empty_csv(self, runner):
        empty = "File,Line,Column,Context,Level,Category,Name,Warning,Suggestion,Note,CWEs,Other\n"
        findings = runner._parse_csv(empty, Path("/tmp/scan"))
        assert findings == []
