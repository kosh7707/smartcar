from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

BenchmarkMode = Literal["quality", "strict-format", "gateway-contract", "serving-diagnostics"]
RequestPath = Literal["direct", "gateway"]
SourceKind = Literal["official-adapter", "public-inspired-local", "custom-s7-diagnostic", "serving-diagnostic"]


@dataclass(frozen=True)
class BenchTask:
    id: str
    family: str
    mode: BenchmarkMode
    source_kind: SourceKind
    messages: list[dict[str, Any]]
    scorer: str
    expected: dict[str, Any] = field(default_factory=dict)
    max_tokens: int = 256
    temperature: float = 1.0
    top_p: float | None = 0.95
    top_k: int | None = 20
    tools: list[dict[str, Any]] | None = None
    tool_choice: str | dict[str, Any] | None = None
    response_format: dict[str, Any] | None = None
    enable_thinking: bool | None = None
    repeat: int = 1
    decisive: bool = True
    notes: str | None = None


@dataclass
class ScoreResult:
    score: float
    passed: bool
    reason: str = ""
    malformed: bool = False
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class RunRecord:
    task_id: str
    family: str
    mode: BenchmarkMode
    source_kind: SourceKind
    decisive: bool
    repeat_index: int
    model_label: str
    expected_model: str | None
    actual_model: str | None
    request_path: RequestPath
    latency_ms: int | None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    finish_reason: str | None = None
    content: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    score: float = 0.0
    passed: bool = False
    malformed: bool = False
    error_type: str | None = None
    error: str | None = None
    scorer_reason: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "taskId": self.task_id,
            "family": self.family,
            "mode": self.mode,
            "sourceKind": self.source_kind,
            "decisive": self.decisive,
            "repeatIndex": self.repeat_index,
            "modelLabel": self.model_label,
            "expectedModel": self.expected_model,
            "actualModel": self.actual_model,
            "requestPath": self.request_path,
            "latencyMs": self.latency_ms,
            "promptTokens": self.prompt_tokens,
            "completionTokens": self.completion_tokens,
            "finishReason": self.finish_reason,
            "content": self.content,
            "toolCalls": self.tool_calls,
            "score": self.score,
            "passed": self.passed,
            "malformed": self.malformed,
            "errorType": self.error_type,
            "error": self.error,
            "scorerReason": self.scorer_reason,
            "metadata": self.metadata,
        }
