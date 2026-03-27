"""GccAnalyzerRunner 파서 단위 테스트."""

from pathlib import Path

import pytest

from app.scanner.gcc_analyzer_runner import GccAnalyzerRunner


@pytest.fixture
def runner():
    return GccAnalyzerRunner()


SAMPLE_OUTPUT = """\
/tmp/scan/src/main.c:17:20: warning: dereference of NULL 'q' [CWE-476] [-Wanalyzer-null-dereference]
   17 |     printf("%d\\n", *q);
      |                    ^~
/tmp/scan/src/main.c:14:22: warning: use after 'free' of 'p' [CWE-416] [-Wanalyzer-use-after-free]
   14 |     printf("%s\\n", p);
      |                      ^
/tmp/scan/src/main.c:12:5: warning: leak of 'p' [CWE-401] [-Wanalyzer-malloc-leak]
   12 |     free(p);
      |     ^~~~~~~
/tmp/scan/src/main.c:8:5: note: some note about gets
    8 |     gets(buf);
      |     ^~~~~~~~~
"""


class TestParseOutput:
    def test_basic_parsing(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        # note lines are skipped
        assert len(findings) == 3

    def test_tool_id(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        assert all(f.tool_id == "gcc-fanalyzer" for f in findings)

    def test_cwe_from_inline_tag(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        all_cwes = []
        for f in findings:
            cwe = f.metadata.get("cwe")
            if cwe:
                all_cwes.extend(cwe if isinstance(cwe, list) else [cwe])
        assert "CWE-476" in all_cwes
        assert "CWE-416" in all_cwes
        assert "CWE-401" in all_cwes

    def test_rule_id_from_flag(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        rule_ids = {f.rule_id for f in findings}
        # rule_id strips -W prefix
        assert any("null-dereference" in rid for rid in rule_ids)

    def test_path_normalization(self, runner):
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        assert findings[0].location.file == "src/main.c"

    def test_note_becomes_dataflow(self, runner):
        """-Wanalyzer note 라인은 이전 warning의 dataFlow가 된다."""
        # note에 -Wanalyzer flag가 있는 샘플
        output = """\
/tmp/scan/src/main.c:12:5: warning: leak of 'p' [CWE-401] [-Wanalyzer-malloc-leak]
   12 |     free(p);
      |     ^~~~~~~
/tmp/scan/src/main.c:8:5: note: allocated here [-Wanalyzer-malloc-leak]
    8 |     p = malloc(100);
      |     ^~~~~~~~~~~~~~~
"""
        findings = runner._parse_output(output, Path("/tmp/scan"))
        assert len(findings) == 1
        assert findings[0].data_flow is not None
        assert len(findings[0].data_flow) == 1

    def test_non_analyzer_note_ignored(self, runner):
        """flag 없는 일반 note는 무시된다."""
        findings = runner._parse_output(SAMPLE_OUTPUT, Path("/tmp/scan"))
        # SAMPLE_OUTPUT의 마지막 note는 flag 없음 → 무시 → dataFlow 없음
        last = findings[-1]  # malloc-leak
        assert last.data_flow is None or len(last.data_flow) == 0

    def test_empty_output(self, runner):
        findings = runner._parse_output("", Path("/tmp/scan"))
        assert findings == []

    def test_non_analyzer_warnings_skipped(self, runner):
        output = "/tmp/scan/src/main.c:5:3: warning: unused variable 'x' [-Wunused-variable]\n"
        findings = runner._parse_output(output, Path("/tmp/scan"))
        assert findings == []

    def test_cross_boundary_dataflow(self, runner):
        """사용자 코드 → SDK 경계를 넘는 dataFlow가 파싱되는지 확인."""
        output = (
            "/home/kosh/sdks/ti-am335x/include/sdk_api.h:42:5: warning: "
            "buffer overflow [-Wanalyzer-buffer-overflow]\n"
            "/tmp/scan/src/main.c:10:3: note: 'buf' allocated here [-Wanalyzer-buffer-overflow]\n"
            "/home/kosh/sdks/ti-am335x/include/sdk_api.h:42:5: note: overflow occurs here [-Wanalyzer-buffer-overflow]\n"
        )
        findings = runner._parse_output(output, Path("/tmp/scan"))
        assert len(findings) == 1
        assert findings[0].data_flow is not None
        assert len(findings[0].data_flow) == 2
        # 첫 번째 step은 사용자 코드 (상대 경로로 정규화)
        assert findings[0].data_flow[0].file == "src/main.c"
        # 두 번째 step은 SDK (절대 경로 유지)
        assert findings[0].data_flow[1].file.startswith("/")

    def test_warning_without_notes_has_no_dataflow(self, runner):
        output = "/tmp/scan/src/main.c:5:3: warning: null deref [-Wanalyzer-null-dereference]\n"
        findings = runner._parse_output(output, Path("/tmp/scan"))
        assert len(findings) == 1
        assert findings[0].data_flow is None
