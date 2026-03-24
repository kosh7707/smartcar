from enum import StrEnum

class TaskType(StrEnum):
    BUILD_RESOLVE = "build-resolve"

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
