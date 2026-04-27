from __future__ import annotations

from .types import DependencyState


def state_from_exception(exc: Exception) -> DependencyState:
    name = type(exc).__name__.lower()
    text = str(exc).lower()
    if "timeout" in name or "timeout" in text:
        return DependencyState.DEADLINE_EXCEEDED
    if "unavailable" in name or "connect" in name or "connect" in text:
        return DependencyState.UNAVAILABLE
    if "strictjson" in name or "strict_json" in text or "malformed" in text:
        return DependencyState.OUTPUT_DEFICIENT
    return DependencyState.UNKNOWN
