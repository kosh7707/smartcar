"""S7-owned LLM generation and timeout policy constants.

Validated against Qwen3.6-27B (HF model card retrieved 2026-04-28).
Re-validate on model family change or model card revision.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SamplingPreset:
    """Qwen/vLLM sampling tuple that callers may copy into public contracts."""

    temperature: float
    top_p: float
    top_k: int
    min_p: float
    presence_penalty: float
    repetition_penalty: float
    enable_thinking: bool


class SamplingDefaults:
    """Named Qwen3.6 generation presets.

    S7 does not silently apply these to `/v1/tasks`; that surface is
    caller-owned and all values are required. These constants are the S7-owned
    source of truth for warmup, tests, documentation examples, and downstream
    callers that need a canonical starting tuple.
    """

    THINKING_GENERAL = SamplingPreset(
        temperature=1.0,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
        presence_penalty=0.0,
        repetition_penalty=1.0,
        enable_thinking=True,
    )
    THINKING_CODING = SamplingPreset(
        temperature=0.6,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
        presence_penalty=0.0,
        repetition_penalty=1.0,
        enable_thinking=True,
    )
    INSTRUCT = SamplingPreset(
        temperature=0.7,
        top_p=0.80,
        top_k=20,
        min_p=0.0,
        presence_penalty=1.5,
        repetition_penalty=1.0,
        enable_thinking=False,
    )
    HEALTH_PROBE = SamplingPreset(
        temperature=0.0,
        top_p=0.95,
        top_k=20,
        min_p=0.0,
        presence_penalty=0.0,
        repetition_penalty=1.0,
        enable_thinking=True,
    )


class TimeoutDefaults:
    """S7 timeout policy constants in seconds."""

    CHAT_DEFAULT_SECONDS = 1800.0
    CHAT_MAX_SECONDS = 1800.0
    TASK_CLIENT_READ_SECONDS = 600.0
    REPAIR_OR_STRICT_JSON_SECONDS = 600.0
    TOOL_EXECUTION_SECONDS = 120.0
