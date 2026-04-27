"""Thin S3 state-machine decision surface.

This package intentionally owns only dependency/deficiency/recovery/outcome
classification. Domain-specific evidence slots, vulnerability-family policy,
PoC quality policy, and build/workspace logic stay in their owning modules.
"""

from .types import (
    DeficiencyClass,
    DependencyState,
    RecoveryDecision,
    TaskFailureBoundary,
)
from .recovery_triage import triage_deficiency, recovery_trace
from .outcomes import clean_pass_for

__all__ = [
    "DeficiencyClass",
    "DependencyState",
    "RecoveryDecision",
    "TaskFailureBoundary",
    "triage_deficiency",
    "recovery_trace",
    "clean_pass_for",
]
