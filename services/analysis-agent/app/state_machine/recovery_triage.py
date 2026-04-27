from __future__ import annotations

from app.schemas.response import RecoveryTraceEntry

from .types import DeficiencyClass, DependencyState, RecoveryDecision


_TASK_FAIL_DEFICIENCIES = {
    DeficiencyClass.DEPENDENCY_UNAVAILABLE,
    DeficiencyClass.INTERNAL_UNASSEMBLABLE,
}


def triage_deficiency(
    deficiency: DeficiencyClass,
    *,
    dependency_state: DependencyState = DependencyState.AVAILABLE,
    envelope_possible: bool = True,
    hard_deadline: bool = False,
) -> RecoveryDecision:
    """Return the next state-machine decision for a deficiency.

    This is deliberately thin: it does not know vulnerability families, build
    artifacts, or prompt content. Those modules decide whether a repair is
    available; this function only protects task-failure boundaries.
    """
    if not envelope_possible:
        return RecoveryDecision.TASK_FAIL
    if hard_deadline:
        return RecoveryDecision.TASK_FAIL
    if dependency_state == DependencyState.UNAVAILABLE:
        return RecoveryDecision.TASK_FAIL
    if deficiency in _TASK_FAIL_DEFICIENCIES:
        return RecoveryDecision.TASK_FAIL
    if deficiency == DeficiencyClass.TIMEOUT and dependency_state == DependencyState.DEADLINE_EXCEEDED:
        return RecoveryDecision.TASK_FAIL
    if deficiency in {DeficiencyClass.REF, DeficiencyClass.GROUNDING}:
        return RecoveryDecision.ACQUIRE_EVIDENCE
    if deficiency in {DeficiencyClass.SCHEMA, DeficiencyClass.MALFORMED_LLM_OUTPUT, DeficiencyClass.EMPTY_LLM_OUTPUT}:
        return RecoveryDecision.REPAIR
    return RecoveryDecision.CLASSIFY_OUTCOME


def recovery_trace(
    *,
    deficiency: str,
    action: str,
    outcome: str,
    detail: str | None = None,
    level: int | None = None,
    attempt: int | None = None,
    deficiency_class: DeficiencyClass | str | None = None,
    dependency_state: DependencyState | str | None = None,
) -> RecoveryTraceEntry:
    """Build a backward-compatible public recovery trace entry."""
    deficiency_value = deficiency_class.value if hasattr(deficiency_class, "value") else deficiency_class
    dependency_value = dependency_state.value if hasattr(dependency_state, "value") else dependency_state
    return RecoveryTraceEntry(
        deficiency=deficiency,
        action=action,
        outcome=outcome,
        detail=detail,
        level=level,
        attempt=attempt,
        deficiencyClass=deficiency_value,
        recoveryAction=action,
        result=outcome,
        dependencyState=dependency_value,
    )
