from enum import StrEnum


class TaskType(StrEnum):
    STATIC_EXPLAIN = "static-explain"
    STATIC_CLUSTER = "static-cluster"
    DYNAMIC_ANNOTATE = "dynamic-annotate"
    TEST_PLAN_PROPOSE = "test-plan-propose"
    REPORT_DRAFT = "report-draft"
    DEEP_ANALYZE = "deep-analyze"


class TaskStatus(StrEnum):
    COMPLETED = "completed"
    VALIDATION_FAILED = "validation_failed"
    TIMEOUT = "timeout"
    MODEL_ERROR = "model_error"
    BUDGET_EXCEEDED = "budget_exceeded"
    UNSAFE_OUTPUT = "unsafe_output"
    EMPTY_RESULT = "empty_result"


class FailureCode(StrEnum):
    INVALID_SCHEMA = "INVALID_SCHEMA"
    INVALID_GROUNDING = "INVALID_GROUNDING"
    TIMEOUT = "TIMEOUT"
    MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
    TOKEN_BUDGET_EXCEEDED = "TOKEN_BUDGET_EXCEEDED"
    UNSAFE_CONTENT = "UNSAFE_CONTENT"
    EMPTY_RESPONSE = "EMPTY_RESPONSE"
    LLM_OVERLOADED = "LLM_OVERLOADED"
    INPUT_TOO_LARGE = "INPUT_TOO_LARGE"
    UNKNOWN_TASK_TYPE = "UNKNOWN_TASK_TYPE"
