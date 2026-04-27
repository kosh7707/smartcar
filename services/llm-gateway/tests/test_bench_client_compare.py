from __future__ import annotations

import asyncio
from dataclasses import dataclass

from bench.client import extract_max_model_len, extract_served_model
from bench.compare import compare_many_summaries, compare_summaries
from bench.models import BenchTask, RunRecord
from bench.rescore import rescore_records
from bench.runner import _run_serving_diagnostics
from bench.runner import parse_args
from bench.targets import DEFAULT_TARGETS, find_target


def test_extract_served_model_from_vllm_models_response():
    data = {"object": "list", "data": [{"id": "Qwen/Qwen3.6-35B-A3B", "max_model_len": 131072}]}
    assert extract_served_model(data) == "Qwen/Qwen3.6-35B-A3B"
    assert extract_max_model_len(data) == 131072


def test_extract_served_model_from_gateway_profiles_response():
    data = {"profiles": [{"modelName": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4"}]}
    assert extract_served_model(data) == "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4"
    assert extract_max_model_len(data) is None


def test_compare_recommends_replace_when_candidate_quality_wins():
    baseline = {"metadata": {"actualModel": "old"}, "scores": {"qualityScore": 0.70}, "rates": {"transportErrorRate": 0.0, "malformedOutputRate": 0.0}}
    candidate = {"metadata": {"actualModel": "new"}, "scores": {"qualityScore": 0.80}, "rates": {"transportErrorRate": 0.0, "malformedOutputRate": 0.0}}
    result = compare_summaries(baseline, candidate, min_delta=0.03)
    assert result["recommendation"] == "replace"


def test_compare_stability_catastrophe_blocks_replacement():
    baseline = {"metadata": {"actualModel": "old"}, "scores": {"qualityScore": 0.70}, "rates": {"transportErrorRate": 0.0, "malformedOutputRate": 0.0}}
    candidate = {"metadata": {"actualModel": "new"}, "scores": {"qualityScore": 0.95}, "rates": {"transportErrorRate": 0.25, "malformedOutputRate": 0.0}}
    result = compare_summaries(baseline, candidate, min_delta=0.03)
    assert result["recommendation"] == "do-not-replace"


def test_runner_cli_defaults_and_modes():
    args = parse_args(["--mode", "quality", "--request-path", "direct", "--suite", "hard", "--thinking-mode", "off"])
    assert args.mode == "quality"
    assert args.request_path == "direct"
    assert args.suite == "hard"
    assert args.thinking_mode == "off"


def test_serving_diagnostics_record_generation_controls_with_thinking_override():
    @dataclass
    class FakeResult:
        response: dict
        latency_ms: int = 1
        error_type: str | None = None
        error: str | None = None
        status_code: int = 200

    class FakeClient:
        async def chat(self, task, model, request_id):
            assert task.enable_thinking is False
            return FakeResult({"choices": [{"message": {"content": "pong"}, "finish_reason": "stop"}], "usage": {"prompt_tokens": 1, "completion_tokens": 1}})

    task = BenchTask(
        id="serving_probe", family="serving", mode="serving-diagnostics", source_kind="serving-diagnostic",
        messages=[], scorer="exact", expected={"text": "pong"}, enable_thinking=False,
    )
    records = asyncio.run(_run_serving_diagnostics(
        client=FakeClient(), base_task=task, model="m", model_label="m", expected_model="m",
        actual_model="m", request_path="direct", concurrency=1,
    ))
    assert records[0].metadata["generationControls"]["enableThinking"] is False


def test_default_targets_include_three_model_comparison_set():
    model_ids = {target.model_id for target in DEFAULT_TARGETS}
    assert model_ids == {
        "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
        "Qwen/Qwen3.6-35B-A3B",
        "Qwen/Qwen3.6-27B",
    }
    assert find_target("qwen36-27b").model_id == "Qwen/Qwen3.6-27B"


def test_compare_many_ranks_three_models_and_flags_winner():
    summaries = {
        "qwen35-122b": {"metadata": {"actualModel": "old"}, "scores": {"qualityScore": 0.72, "allScoredMean": 0.70}, "rates": {"transportErrorRate": 0.0, "malformedOutputRate": 0.0, "passRate": 0.8}},
        "qwen36-35b-a3b": {"metadata": {"actualModel": "35b"}, "scores": {"qualityScore": 0.82, "allScoredMean": 0.80}, "rates": {"transportErrorRate": 0.0, "malformedOutputRate": 0.0, "passRate": 0.9}},
        "qwen36-27b": {
            "metadata": {"actualModel": "27b", "modelMetadata": {"response": {"data": [{"root": "27b-fp8"}]}}},
            "scores": {"qualityScore": 0.85, "allScoredMean": 0.84},
            "rates": {"transportErrorRate": 0.0, "malformedOutputRate": 0.0, "passRate": 0.95},
        },
    }
    result = compare_many_summaries(summaries, min_delta=0.03)
    assert result["winner"] == "qwen36-27b"
    assert result["recommendation"] == "prefer"
    assert [row["label"] for row in result["models"]] == ["qwen36-27b", "qwen36-35b-a3b", "qwen35-122b"]
    assert result["models"][0]["rootModel"] == "27b-fp8"


def test_rescore_records_uses_current_suite_scorer():
    records = [
        RunRecord(
            task_id="hard_code_token_bucket",
            family="coding_execution",
            mode="quality",
            source_kind="public-inspired-local",
            decisive=True,
            repeat_index=0,
            model_label="m",
            expected_model=None,
            actual_model="m",
            request_path="direct",
            latency_ms=1,
            prompt_tokens=1,
            completion_tokens=1,
            content=(
                "def count_accepted(request_times, capacity, refill_interval):\n"
                "    tokens = capacity\n"
                "    accepted = 0\n"
                "    last_time = 0\n"
                "    for t in request_times:\n"
                "        tokens = min(capacity, tokens + (t - last_time) // refill_interval)\n"
                "        last_time = t\n"
                "        if tokens:\n"
                "            tokens -= 1\n"
                "            accepted += 1\n"
                "    return accepted\n"
            ),
        )
    ]
    rescored = rescore_records(records, suite="hard")
    assert rescored[0].passed
    assert rescored[0].metadata["rescored"] is True
