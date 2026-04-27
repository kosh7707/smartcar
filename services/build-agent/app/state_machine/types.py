from __future__ import annotations

from enum import StrEnum


class BuildDependencyState(StrEnum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    OUTPUT_DEFICIENT = "output_deficient"
    DEADLINE_EXCEEDED = "deadline_exceeded"


class BuildOrchestratorDecision(StrEnum):
    RETURN_COMPLETED_OUTCOME = "return_completed_outcome"
    TASK_FAIL = "task_fail"
    RETRY_OR_REPAIR = "retry_or_repair"
