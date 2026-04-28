from enum import StrEnum


class TaskType(StrEnum):
    STATIC_EXPLAIN = "static-explain"
    STATIC_CLUSTER = "static-cluster"
    DYNAMIC_ANNOTATE = "dynamic-annotate"
    TEST_PLAN_PROPOSE = "test-plan-propose"
    REPORT_DRAFT = "report-draft"
    DEEP_ANALYZE = "deep-analyze"
    GENERATE_POC = "generate-poc"


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
    MAX_STEPS_EXCEEDED = "MAX_STEPS_EXCEEDED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    ALL_TOOLS_EXHAUSTED = "ALL_TOOLS_EXHAUSTED"
    UNSAFE_CONTENT = "UNSAFE_CONTENT"
    EMPTY_RESPONSE = "EMPTY_RESPONSE"
    LLM_OVERLOADED = "LLM_OVERLOADED"
    INPUT_TOO_LARGE = "INPUT_TOO_LARGE"
    UNKNOWN_TASK_TYPE = "UNKNOWN_TASK_TYPE"


class AnalysisOutcome(StrEnum):
    ACCEPTED_CLAIMS = "accepted_claims"
    NO_ACCEPTED_CLAIMS = "no_accepted_claims"
    INCONCLUSIVE = "inconclusive"


class QualityOutcome(StrEnum):
    ACCEPTED = "accepted"
    ACCEPTED_WITH_CAVEATS = "accepted_with_caveats"
    REJECTED = "rejected"
    INCONCLUSIVE = "inconclusive"
    REPAIR_EXHAUSTED = "repair_exhausted"


class PocOutcome(StrEnum):
    POC_ACCEPTED = "poc_accepted"
    POC_REJECTED = "poc_rejected"
    POC_INCONCLUSIVE = "poc_inconclusive"
    POC_NOT_REQUESTED = "poc_not_requested"


class ClaimStatus(StrEnum):
    CANDIDATE = "candidate"
    UNDER_EVIDENCED = "under_evidenced"
    GROUNDED = "grounded"
    REJECTED = "rejected"
    NEEDS_HUMAN_REVIEW = "needs_human_review"
