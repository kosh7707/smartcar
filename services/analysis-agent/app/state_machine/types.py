from __future__ import annotations

from enum import StrEnum


class DependencyState(StrEnum):
    AVAILABLE = "available"
    DEGRADED_PARTIAL = "degraded_partial"
    OUTPUT_DEFICIENT = "output_deficient"
    UNAVAILABLE = "unavailable"
    DEADLINE_EXCEEDED = "deadline_exceeded"
    UNKNOWN = "unknown"


class DeficiencyClass(StrEnum):
    SCHEMA = "schema"
    REF = "ref"
    GROUNDING = "grounding"
    QUALITY = "quality"
    POC_QUALITY = "poc_quality"
    EMPTY_LLM_OUTPUT = "empty_llm_output"
    MALFORMED_LLM_OUTPUT = "malformed_llm_output"
    STRICT_JSON_VIOLATION = "strict_json_violation"
    REPAIR_EXHAUSTED = "repair_exhausted"
    PARTIAL_DEPENDENCY = "partial_dependency"
    DEPENDENCY_UNAVAILABLE = "dependency_unavailable"
    TIMEOUT = "timeout"
    INTERNAL_UNASSEMBLABLE = "internal_unassemblable"


class RecoveryDecision(StrEnum):
    REPAIR = "repair"
    ACQUIRE_EVIDENCE = "acquire_evidence"
    CLASSIFY_OUTCOME = "classify_outcome"
    TASK_FAIL = "task_fail"


class TaskFailureBoundary(StrEnum):
    INVALID_INPUT = "invalid_input"
    UNSAFE_REQUEST = "unsafe_request"
    DEPENDENCY_UNAVAILABLE = "dependency_unavailable"
    HARD_TIMEOUT = "hard_timeout"
    CANCELLATION = "cancellation"
    INTERNAL_UNASSEMBLABLE = "internal_unassemblable"
