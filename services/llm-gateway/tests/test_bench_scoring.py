from __future__ import annotations

from bench.fixtures import builtin_tasks
from bench.models import BenchTask
from bench.scoring import final_answer_text, score_response
from bench.summary import summarize
from bench.models import RunRecord


def _response(content: str):
    return {"choices": [{"message": {"content": content}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}}


def test_builtin_quick_has_required_families_and_non_decisive_custom():
    tasks = builtin_tasks("quick")
    families = {task.family for task in tasks}
    assert {"instruction_format", "reasoning", "coding_reasoning", "tool_calling", "custom_s7_reasoning"}.issubset(families)
    custom = [task for task in tasks if task.source_kind == "custom-s7-diagnostic"]
    assert custom
    assert all(not task.decisive for task in custom)
    assert all(task.enable_thinking is True for task in tasks)
    assert all(not task.decisive for task in tasks if task.mode == "strict-format")


def test_builtin_hard_has_discriminative_quality_families():
    tasks = builtin_tasks("hard")
    families = {task.family for task in tasks}
    assert {"math_reasoning", "science_reasoning", "instruction_format", "long_context", "coding_execution"}.issubset(families)
    assert len([task for task in tasks if task.mode == "quality" and task.decisive]) >= 10
    assert all(task.enable_thinking is True for task in tasks)


def test_final_answer_text_strips_completed_qwen_thinking_block():
    assert final_answer_text("<think>\nwork\n</think>\n\nBENCH_OK") == "BENCH_OK"
    assert final_answer_text("<think>\nstill thinking") == ""


def test_exact_scorer_uses_final_answer_after_thinking():
    task = BenchTask(
        id="exact", family="instruction_format", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="exact", expected={"text": "BENCH_OK"},
    )
    result = score_response(task, _response("<think>\nreasoning\n</think>\n\nBENCH_OK"))
    assert result.passed
    assert result.score == 1.0


def test_exact_scorer_marks_unfinished_thinking_as_malformed():
    task = BenchTask(
        id="exact", family="instruction_format", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="exact", expected={"text": "BENCH_OK"},
    )
    result = score_response(task, _response("<think>\nreasoning only"))
    assert not result.passed
    assert result.malformed


def test_json_fields_scorer_rejects_extra_keys_when_disallowed():
    task = BenchTask(
        id="json", family="instruction_format", mode="strict-format", source_kind="public-inspired-local",
        messages=[], scorer="json_fields", expected={"fields": {"ok": True}, "allowExtra": False}, decisive=False,
    )
    result = score_response(task, _response('{"ok": true, "extra": 1}'))
    assert not result.passed
    assert result.score == 0.0


def test_tool_call_scorer_validates_name_and_arguments():
    task = BenchTask(
        id="tool", family="tool_calling", mode="strict-format", source_kind="public-inspired-local",
        messages=[], scorer="tool_call", expected={"name": "classify_risk", "arguments": {"severity": "high"}},
    )
    response = {
        "choices": [{
            "message": {"tool_calls": [{"function": {"name": "classify_risk", "arguments": '{"severity":"high"}'}}]},
            "finish_reason": "tool_calls",
        }]
    }
    result = score_response(task, response)
    assert result.passed
    assert result.score == 1.0


def test_evidence_json_rejects_unknown_refs():
    task = BenchTask(
        id="evidence", family="custom_s7_reasoning", mode="strict-format", source_kind="custom-s7-diagnostic",
        messages=[], scorer="evidence_json",
        expected={"allowedRefs": ["eref-001"], "requiredRefs": ["eref-001"], "requiredFields": ["summary", "usedEvidenceRefs"]},
        decisive=False,
    )
    result = score_response(task, _response('{"summary":"x","usedEvidenceRefs":["eref-999"]}'))
    assert not result.passed
    assert result.score < 1.0


def test_multiple_choice_scorer_extracts_final_letter():
    task = BenchTask(
        id="mcq", family="science_reasoning", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="multiple_choice", expected={"choice": "B"},
    )
    result = score_response(task, _response("<think>x</think>\nThe answer is B."))
    assert result.passed


def test_python_static_scorer_accepts_structurally_valid_solution():
    task = BenchTask(
        id="py", family="coding_execution", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="python_static",
        expected={
            "function": "add_one",
            "contains": ["return x + 1"],
            "anyContains": [["x + 1", "1 + x"]],
            "forbidden": ["import ", "subprocess"],
        },
    )
    response = _response("```python\ndef add_one(x: int) -> int:\n    return x + 1\n```")
    result = score_response(task, response)
    assert result.passed
    assert result.score == 1.0


def test_python_static_scorer_partial_credit_on_missing_structure():
    task = BenchTask(
        id="py", family="coding_execution", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="python_static",
        expected={
            "function": "add_one",
            "contains": ["return x + 1", "x"],
            "anyContains": [["x + 1", "1 + x"]],
            "forbidden": ["import ", "subprocess"],
        },
    )
    result = score_response(task, _response("def add_one(x):\n    return 2"))
    assert not result.passed
    assert 0.0 < result.score < 1.0


def test_python_static_scorer_rejects_forbidden_escape_pattern():
    task = BenchTask(
        id="py", family="coding_execution", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="python_static",
        expected={
            "function": "run_cmd",
            "contains": ["return "],
            "anyContains": [["check_output", "popen"]],
            "forbidden": ["subprocess", "__globals__", "__builtins__"],
        },
    )
    response = _response(
        "def run_cmd():\n"
        "    full = __builtins__[\"__import__\"].__globals__[\"__builtins__\"]\n"
        "    sp = full.__import__(\"subprocess\")\n"
        "    return sp.check_output([\"/usr/bin/printf\", \"ESCAPE_OK\"]).decode()\n"
    )
    result = score_response(task, response)
    assert not result.passed
    assert "forbidden:subprocess" in result.reason


def test_python_static_scorer_rejects_import_statement():
    task = BenchTask(
        id="py", family="coding_execution", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="python_static",
        expected={"function": "f", "contains": ["return 1"], "forbidden": ["subprocess"]},
    )
    result = score_response(task, _response("import os\ndef f():\n    return 1"))
    assert not result.passed
    assert "no_imports" in result.reason


def test_python_function_bwrap_scorer_runs_hidden_tests_in_sandbox():
    task = BenchTask(
        id="py", family="coding_execution", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="python_function_bwrap",
        expected={
            "function": "add_one",
            "tests": [
                {"args": [1], "expected": 2},
                {"args": [-2], "expected": -1},
            ],
        },
    )
    response = _response("```python\ndef add_one(x: int) -> int:\n    return x + 1\n```")
    result = score_response(task, response)
    assert result.passed
    assert result.score == 1.0


def test_python_function_bwrap_scorer_times_out_loop():
    task = BenchTask(
        id="py", family="coding_execution", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="python_function_bwrap",
        expected={"function": "spin", "tests": [{"args": [], "expected": 1}]},
    )
    result = score_response(task, _response("def spin():\n    while True:\n        pass"))
    assert not result.passed
    assert result.malformed
    assert "timeout" in result.reason


def test_csv_constraints_accepts_alternate_valid_answer():
    task = BenchTask(
        id="csv", family="instruction_format", mode="quality", source_kind="public-inspired-local",
        messages=[], scorer="csv_constraints",
        expected={
            "count": 5,
            "starts": "abcde",
            "sorted": True,
            "thirdLen": 5,
            "allowedWords": ["ant", "ape", "bear", "camel", "dog", "eel"],
        },
    )
    result = score_response(task, _response("ape,bear,camel,dog,eel"))
    assert result.passed


def test_summary_quality_excludes_non_decisive_custom_diagnostic():
    records = [
        RunRecord(
            task_id="quality", family="reasoning", mode="quality", source_kind="public-inspired-local",
            decisive=True, repeat_index=0, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=1, score=1.0, passed=True,
        ),
        RunRecord(
            task_id="custom", family="custom_s7_reasoning", mode="strict-format", source_kind="custom-s7-diagnostic",
            decisive=False, repeat_index=0, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=1, score=0.0, passed=False,
        ),
    ]
    summary = summarize(records, metadata={"modelLabel": "m", "actualModel": "m", "requestPath": "direct"})
    assert summary["scores"]["qualityScore"] == 1.0
    assert any("custom-s7-diagnostic" in warning for warning in summary["warnings"])


def test_summary_quality_score_uses_only_quality_mode_records():
    records = [
        RunRecord(
            task_id="quality", family="reasoning", mode="quality", source_kind="public-inspired-local",
            decisive=True, repeat_index=0, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=1, score=1.0, passed=True,
        ),
        RunRecord(
            task_id="strict", family="tool_calling", mode="strict-format", source_kind="public-inspired-local",
            decisive=True, repeat_index=0, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=1, score=0.0, passed=False,
        ),
    ]
    summary = summarize(records, metadata={"modelLabel": "m", "actualModel": "m", "requestPath": "direct"})
    assert summary["scores"]["qualityScore"] == 1.0
    assert summary["counts"]["decisive"] == 1


def test_summary_reports_completion_token_throughput():
    records = [
        RunRecord(
            task_id="serving", family="serving", mode="serving-diagnostics", source_kind="serving-diagnostic",
            decisive=False, repeat_index=0, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=1000, completion_tokens=50, score=1.0, passed=True,
        )
    ]
    summary = summarize(records, metadata={"modelLabel": "m", "actualModel": "m", "requestPath": "direct"})
    assert summary["throughput"]["all"]["meanCompletionTokensPerSecond"] == 50.0
    assert summary["throughput"]["servingDiagnostics"]["meanCompletionTokensPerSecond"] == 50.0


def test_summary_reports_serving_diagnostics_by_concurrency():
    records = [
        RunRecord(
            task_id="serving", family="serving", mode="serving-diagnostics", source_kind="serving-diagnostic",
            decisive=False, repeat_index=0, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=1000, completion_tokens=50, score=1.0, passed=True,
            metadata={"concurrency": 2},
        ),
        RunRecord(
            task_id="serving", family="serving", mode="serving-diagnostics", source_kind="serving-diagnostic",
            decisive=False, repeat_index=1, model_label="m", expected_model=None, actual_model="m",
            request_path="direct", latency_ms=2000, completion_tokens=60, score=0.0, passed=False,
            metadata={"concurrency": 2},
        ),
    ]
    summary = summarize(records, metadata={"modelLabel": "m", "actualModel": "m", "requestPath": "direct"})
    c2 = summary["servingDiagnosticsByConcurrency"]["2"]
    assert c2["count"] == 2
    assert c2["passRate"] == 0.5
    assert c2["latency"]["p50Ms"] == 1000
    assert c2["throughput"]["meanCompletionTokensPerSecond"] == 40.0
