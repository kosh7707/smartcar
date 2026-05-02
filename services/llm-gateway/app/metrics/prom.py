"""Prometheus 메트릭 정의.

모든 메트릭은 aegis_llm_ 접두사를 사용한다.
"""
from __future__ import annotations

from typing import Any

from prometheus_client import Counter, Gauge, Histogram

from app.generation_observability import normalize_tool_choice

REQUEST_COUNT = Counter(
    "aegis_llm_requests_total",
    "Total LLM requests",
    ["endpoint", "status"],
)

REQUEST_DURATION = Histogram(
    "aegis_llm_request_duration_seconds",
    "LLM request duration",
    ["endpoint"],
    buckets=(0.5, 1, 2, 5, 10, 20, 30, 60, 120),
)

TOKEN_COUNT = Counter(
    "aegis_llm_tokens_total",
    "Total tokens consumed",
    ["type"],
)

ERROR_COUNT = Counter(
    "aegis_llm_errors_total",
    "Total LLM errors",
    ["endpoint", "error_type"],
)

FINISH_REASON_COUNT = Counter(
    "aegis_llm_finish_reason_total",
    "Total LLM responses by finish reason",
    ["endpoint", "task_type", "reason"],
)

CIRCUIT_BREAKER_STATE = Gauge(
    "aegis_llm_circuit_breaker_state",
    "Circuit breaker state (0=closed, 0.5=half_open, 1=open)",
)

CONCURRENT_REQUESTS = Gauge(
    "aegis_llm_concurrent_requests",
    "Current in-flight LLM requests",
)

GENERATION_TEMPERATURE = Histogram(
    "aegis_llm_temperature",
    "Observed LLM request temperature",
    ["endpoint", "task_type"],
    buckets=(0, 0.2, 0.3, 0.6, 0.7, 1.0, 1.5, 2.0),
)

GENERATION_TOP_P = Histogram(
    "aegis_llm_top_p",
    "Observed LLM request top_p",
    ["endpoint", "task_type"],
    buckets=(0, 0.5, 0.8, 0.9, 0.95, 0.99, 1.0),
)

GENERATION_TOP_K = Histogram(
    "aegis_llm_top_k",
    "Observed LLM request top_k; -1 is observed as 0 for histogram compatibility",
    ["endpoint", "task_type"],
    buckets=(0, 1, 10, 20, 40, 100, 1000),
)

GENERATION_MIN_P = Histogram(
    "aegis_llm_min_p",
    "Observed LLM request min_p",
    ["endpoint", "task_type"],
    buckets=(0, 0.01, 0.05, 0.1, 0.5, 1.0),
)

GENERATION_PRESENCE_PENALTY = Histogram(
    "aegis_llm_presence_penalty",
    "Observed LLM request presence_penalty",
    ["endpoint", "task_type"],
    buckets=(-2, -1, 0, 0.5, 1.0, 1.5, 2.0),
)

GENERATION_REPETITION_PENALTY = Histogram(
    "aegis_llm_repetition_penalty",
    "Observed LLM request repetition_penalty",
    ["endpoint", "task_type"],
    buckets=(0, 0.5, 1.0, 1.1, 1.5, 2.0),
)

THINKING_REQUEST_COUNT = Counter(
    "aegis_llm_thinking_requests_total",
    "Total LLM requests by effective thinking mode",
    ["endpoint", "task_type", "enabled"],
)

THINKING_TOKEN_COUNT = Histogram(
    "aegis_llm_thinking_token_count",
    "Observed backend-reported reasoning/thinking token count when available",
    ["endpoint", "task_type"],
    buckets=(0, 16, 64, 256, 1024, 4096, 8192, 32768),
)

TOOL_CHOICE_COUNT = Counter(
    "aegis_llm_tool_choice_total",
    "Total LLM requests by bounded tool_choice bucket",
    ["endpoint", "choice"],
)


def record_generation_observability(
    *,
    endpoint: str,
    generation: dict[str, Any],
    response_data: Any | None = None,
    tool_choice: Any | None = None,
) -> None:
    """Record generation controls as low-cardinality Prometheus observations.

    S7 exchange logs keep the authoritative per-request payload. These metrics
    intentionally expose only numeric values and boolean thinking mode so that
    sampling/tool policy changes can be detected without creating
    high-cardinality labels.
    """

    task_type = (
        generation.get("taskType")
        if isinstance(generation.get("taskType"), str)
        else "none"
    )
    _observe_numeric(
        GENERATION_TEMPERATURE,
        endpoint,
        task_type,
        generation.get("temperature"),
    )
    _observe_numeric(GENERATION_TOP_P, endpoint, task_type, generation.get("topP"))
    top_k = generation.get("topK")
    if top_k == -1:
        top_k = 0
    _observe_numeric(GENERATION_TOP_K, endpoint, task_type, top_k)
    _observe_numeric(GENERATION_MIN_P, endpoint, task_type, generation.get("minP"))
    _observe_numeric(
        GENERATION_PRESENCE_PENALTY,
        endpoint,
        task_type,
        generation.get("presencePenalty"),
    )
    _observe_numeric(
        GENERATION_REPETITION_PENALTY,
        endpoint,
        task_type,
        generation.get("repetitionPenalty"),
    )

    enabled = generation.get("enableThinking")
    if isinstance(enabled, bool):
        THINKING_REQUEST_COUNT.labels(
            endpoint=endpoint,
            task_type=task_type,
            enabled=str(enabled).lower(),
        ).inc()

    thinking_tokens = _extract_thinking_tokens(response_data)
    if thinking_tokens is not None:
        THINKING_TOKEN_COUNT.labels(endpoint=endpoint, task_type=task_type).observe(thinking_tokens)

    finish_reason = _extract_finish_reason(response_data)
    if finish_reason:
        FINISH_REASON_COUNT.labels(
            endpoint=endpoint,
            task_type=task_type,
            reason=finish_reason,
        ).inc()

    if tool_choice is not None:
        TOOL_CHOICE_COUNT.labels(
            endpoint=endpoint,
            choice=normalize_tool_choice(tool_choice),
        ).inc()


def _observe_numeric(metric: Histogram, endpoint: str, task_type: str, value: Any) -> None:
    if isinstance(value, bool) or value is None:
        return
    if isinstance(value, (int, float)):
        metric.labels(endpoint=endpoint, task_type=task_type).observe(float(value))


def _extract_thinking_tokens(response_data: Any | None) -> int | None:
    if not isinstance(response_data, dict):
        return None
    usage = response_data.get("usage")
    if not isinstance(usage, dict):
        return None
    details = usage.get("completion_tokens_details")
    if isinstance(details, dict):
        for key in ("reasoning_tokens", "thinking_tokens"):
            value = details.get(key)
            if isinstance(value, int):
                return value
    value = usage.get("reasoning_tokens", usage.get("thinking_tokens"))
    return value if isinstance(value, int) else None


def _extract_finish_reason(response_data: Any | None) -> str | None:
    if not isinstance(response_data, dict):
        return None
    choices = response_data.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if not isinstance(first, dict):
        return None
    reason = first.get("finish_reason")
    return reason if isinstance(reason, str) and reason else None
