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
from .outcomes import OutcomeDecision, TriageContext, clean_pass_for, outcome_for_deficiency
from .claim import (
    ClaimEvidenceDiagnosis,
    derive_required_evidence,
    diagnose_claim_evidence,
    transition_claim_status,
)
from .acquisition_planner import PlannedAction, plan_next_action

__all__ = [
    "DeficiencyClass",
    "DependencyState",
    "RecoveryDecision",
    "TaskFailureBoundary",
    "triage_deficiency",
    "recovery_trace",
    "clean_pass_for",
    "OutcomeDecision",
    "TriageContext",
    "outcome_for_deficiency",
    "ClaimEvidenceDiagnosis",
    "derive_required_evidence",
    "diagnose_claim_evidence",
    "transition_claim_status",
    "PlannedAction",
    "plan_next_action",
]
