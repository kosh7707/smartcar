"""Shared generation-control observability helpers."""

from __future__ import annotations

from typing import Any


def effective_enable_thinking(
    body: dict[str, Any],
) -> bool | None:
    """Return the caller-supplied Qwen thinking flag for a forwarded request body."""

    chat_template_kwargs = body.get("chat_template_kwargs")
    if not isinstance(chat_template_kwargs, dict):
        return None
    value = chat_template_kwargs.get("enable_thinking")
    return value if isinstance(value, bool) else None


def generation_log_fields(
    body: dict[str, Any],
    *,
    task_type: str | None = None,
) -> dict[str, Any]:
    """Build the low-cardinality generation tuple used by logs and metrics."""

    return {
        "maxTokens": body.get("max_tokens"),
        "temperature": body.get("temperature"),
        "topP": body.get("top_p"),
        "topK": body.get("top_k"),
        "minP": body.get("min_p"),
        "presencePenalty": body.get("presence_penalty"),
        "repetitionPenalty": body.get("repetition_penalty"),
        "enableThinking": effective_enable_thinking(body),
        "taskType": task_type,
    }


def normalize_tool_choice(value: Any) -> str:
    """Bucket OpenAI-compatible tool_choice into bounded Prometheus labels."""

    if value is None:
        return "none"
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"auto", "required", "none"}:
            return normalized
        return "named" if normalized else "none"
    if isinstance(value, dict):
        return "named"
    return "none"
