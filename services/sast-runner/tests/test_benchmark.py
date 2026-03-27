"""벤치마크 인프라 단위 테스트 — metrics, compare."""

from __future__ import annotations

import pytest

from benchmark.metrics import BenchmarkResult, CWEMetrics, RuleMetrics, ToolMetrics
from benchmark.compare import compare


# ──────────────────── ToolMetrics ────────────────────


class TestToolMetrics:
    def test_recall(self):
        tm = ToolMetrics(tool_name="cppcheck", tp=8, fn=2)
        assert tm.recall == pytest.approx(0.8)

    def test_noise_tracking(self):
        tm = ToolMetrics(tool_name="cppcheck", tp=8, fn=2, noise_findings=15)
        assert tm.noise_findings == 15

    def test_zero_division(self):
        tm = ToolMetrics(tool_name="x")
        assert tm.recall == 0.0

    def test_to_dict(self):
        d = ToolMetrics(tool_name="t", tp=5, fn=5, noise_findings=10).to_dict()
        assert d["recall"] == 0.5
        assert d["noise"] == 10
        assert "tp" in d


# ──────────────────── CWEMetrics ────────────────────


class TestCWEMetrics:
    def test_combined_recall(self):
        m = CWEMetrics(cwe="CWE-78", cwe_name="Cmd", total_files=10,
                       combined_tp=8, combined_fn=2, combined_noise=30)
        assert m.combined_recall == pytest.approx(0.8)

    def test_noise_per_file(self):
        m = CWEMetrics(cwe="CWE-78", cwe_name="test", total_files=10, combined_noise=50)
        assert m.noise_per_file == pytest.approx(5.0)

    def test_noise_per_file_zero_files(self):
        m = CWEMetrics(cwe="CWE-78", cwe_name="test", total_files=0, combined_noise=5)
        assert m.noise_per_file == 0.0

    def test_to_dict_includes_noise(self):
        m = CWEMetrics(cwe="CWE-78", cwe_name="test", total_files=10, combined_noise=50)
        d = m.to_dict()
        assert d["combined"]["noise"] == 50
        assert d["combined"]["noisePerFile"] == 5.0

    def test_by_rule_in_dict(self):
        m = CWEMetrics(cwe="CWE-78", cwe_name="test")
        m.by_rule["flawfinder:gets"] = RuleMetrics(rule_id="flawfinder:gets", tool="flawfinder", tp=3, noise=0)
        d = m.to_dict()
        assert "byRule" in d
        assert d["byRule"]["flawfinder:gets"]["tp"] == 3


# ──────────────────── BenchmarkResult ────────────────────


class TestBenchmarkResult:
    def _make_result(self) -> BenchmarkResult:
        r = BenchmarkResult()
        r.cwe_results["CWE-78"] = CWEMetrics(
            cwe="CWE-78", cwe_name="Cmd", total_files=10,
            combined_tp=8, combined_fn=2, combined_noise=30,
        )
        r.cwe_results["CWE-476"] = CWEMetrics(
            cwe="CWE-476", cwe_name="Null", total_files=5,
            combined_tp=5, combined_fn=0, combined_noise=10,
        )
        return r

    def test_overall_recall(self):
        r = self._make_result()
        assert r.overall_recall == pytest.approx(13 / 15)

    def test_overall_noise_per_file(self):
        r = self._make_result()
        assert r.overall_noise_per_file == pytest.approx(40 / 15)

    def test_to_dict_summary(self):
        d = self._make_result().to_dict()
        s = d["summary"]
        assert s["totalTP"] == 13
        assert s["totalFN"] == 2
        assert s["totalNoise"] == 40
        assert "overallNoisePerFile" in s

    def test_to_markdown(self):
        md = self._make_result().to_markdown()
        assert "Recall:" in md
        assert "Noise/File:" in md

    def test_to_markdown_with_rules(self):
        r = self._make_result()
        r.cwe_results["CWE-78"].by_rule["semgrep:cmd"] = RuleMetrics(
            rule_id="semgrep:cmd", tool="semgrep", tp=3, noise=1,
        )
        md = r.to_markdown(show_rules=True)
        assert "Per-Rule" in md
        assert "semgrep:cmd" in md


# ──────────────────── compare ────────────────────


class TestCompare:
    def _make_data(self, recall_78: float, recall_476: float) -> dict:
        return {
            "results": {
                "CWE-78": {"combined": {"recall": recall_78, "noisePerFile": 3.0}},
                "CWE-476": {"combined": {"recall": recall_476, "noisePerFile": 1.0}},
            },
            "summary": {
                "overallRecall": (recall_78 + recall_476) / 2,
            },
        }

    def test_no_change(self):
        data = self._make_data(0.8, 1.0)
        report = compare(data, data, "a", "b")
        assert len(report.regressions) == 0
        assert len(report.improvements) == 0

    def test_regression_detected(self):
        baseline = self._make_data(0.8, 1.0)
        current = self._make_data(0.5, 1.0)
        report = compare(baseline, current, "a", "b")
        assert len(report.regressions) == 1
        assert report.regressions[0].cwe == "CWE-78"
        assert report.has_regression(threshold=0.05)

    def test_improvement_detected(self):
        baseline = self._make_data(0.5, 0.8)
        current = self._make_data(0.8, 0.9)
        report = compare(baseline, current, "a", "b")
        assert len(report.improvements) == 2

    def test_to_markdown(self):
        baseline = self._make_data(0.8, 1.0)
        current = self._make_data(0.6, 1.0)
        report = compare(baseline, current, "base.json", "curr.json")
        md = report.to_markdown()
        assert "Regressions" in md

    def test_new_cwe_in_current(self):
        baseline = {"results": {}, "summary": {"overallRecall": 0}}
        current = self._make_data(0.8, 1.0)
        report = compare(baseline, current, "a", "b")
        assert len(report.improvements) == 2

    def test_threshold(self):
        baseline = self._make_data(0.8, 1.0)
        current = self._make_data(0.78, 1.0)
        report = compare(baseline, current, "a", "b")
        assert not report.has_regression(threshold=0.05)
        assert report.has_regression(threshold=0.01)
