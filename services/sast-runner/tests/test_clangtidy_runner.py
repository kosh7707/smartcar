"""ClangTidyRunner 파서 단위 테스트."""

from pathlib import Path

import pytest

from app.scanner.clangtidy_runner import ClangTidyRunner


@pytest.fixture
def runner():
    return ClangTidyRunner()


SAMPLE_OUTPUT = """\
/tmp/scan/src/main.c:8:5: warning: Call to function 'gets' is insecure [cert-msc24-c]
/tmp/scan/src/main.c:10:5: warning: format string is not a string literal [clang-diagnostic-format-nonliteral]
/tmp/scan/src/main.c:17:20: warning: Dereference of null pointer (loaded from variable 'q') [clang-analyzer-core.NullDereference]
/tmp/scan/src/main.c:14:22: warning: Use of memory after it is freed [bugprone-use-after-move]
/tmp/scan/src/main.c:21:22: warning: narrowing conversion from 'int' to 'char' [bugprone-narrowing-conversions]
"""


class TestParseOutput:
    def test_basic_parsing(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        assert len(findings) == 5

    def test_tool_id(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        assert all(f.tool_id == "clang-tidy" for f in findings)

    def test_rule_id_format(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        assert findings[0].rule_id == "clang-tidy:cert-msc24-c"

    def test_cwe_mapping_cert_check(self, runner):
        # cert-env33-c → CWE-78 is in _CERT_TO_CWE
        output = "/tmp/scan/src/main.c:5:3: warning: Calling 'system' is insecure [cert-env33-c]\n"
        findings = runner._parse_output(output, Path("/tmp/scan"))
        assert len(findings) == 1
        cwe = findings[0].metadata.get("cwe")
        assert cwe is not None
        assert "CWE-78" in cwe

    def test_cwe_mapping_narrowing(self, runner):
        # bugprone-narrowing-conversions → CWE-190
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        narrowing = [f for f in findings if "narrowing" in f.rule_id]
        assert len(narrowing) == 1
        cwe = narrowing[0].metadata.get("cwe")
        assert cwe is not None
        assert "CWE-190" in cwe

    def test_path_normalization(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        assert findings[0].location.file == "src/main.c"

    def test_deduplication(self, runner):
        dup_output = (
            "/tmp/scan/src/main.c:8:5: warning: foo [cert-msc24-c]\n"
            "/tmp/scan/src/main.c:8:5: warning: foo [cert-msc24-c]\n"
        )
        findings = runner._parse_output(dup_output, Path("/tmp/scan"))
        assert len(findings) == 1

    def test_empty_output(self, runner):
        findings = runner._parse_output("", Path("/tmp/scan"))
        assert findings == []

    def test_non_matching_lines_ignored(self, runner):
        output = "Some random compiler output\nAnother line\n"
        findings = runner._parse_output(output, Path("/tmp/scan"))
        assert findings == []
