from app.state_machine import (
    DeficiencyClass,
    DependencyState,
    RecoveryDecision,
    recovery_trace,
    triage_deficiency,
)
from app.state_machine.dependency_state import state_from_exception
from app.state_machine.outcomes import clean_pass_for
from app.types import AnalysisOutcome, PocOutcome, QualityOutcome


def test_every_deficiency_class_has_a_decision():
    for deficiency in DeficiencyClass:
        decision = triage_deficiency(deficiency)
        assert isinstance(decision, RecoveryDecision)


def test_every_dependency_state_has_a_decision_path():
    for state in DependencyState:
        decision = triage_deficiency(DeficiencyClass.SCHEMA, dependency_state=state)
        assert isinstance(decision, RecoveryDecision)


def test_output_deficient_with_possible_envelope_is_repairable():
    assert triage_deficiency(
        DeficiencyClass.MALFORMED_LLM_OUTPUT,
        dependency_state=DependencyState.OUTPUT_DEFICIENT,
        envelope_possible=True,
    ) == RecoveryDecision.REPAIR


def test_unavailable_before_envelope_is_task_failure():
    assert triage_deficiency(
        DeficiencyClass.SCHEMA,
        dependency_state=DependencyState.UNAVAILABLE,
        envelope_possible=True,
    ) == RecoveryDecision.TASK_FAIL


def test_hard_deadline_before_envelope_is_task_failure():
    assert triage_deficiency(
        DeficiencyClass.TIMEOUT,
        dependency_state=DependencyState.DEADLINE_EXCEEDED,
        envelope_possible=False,
        hard_deadline=True,
    ) == RecoveryDecision.TASK_FAIL


def test_degraded_partial_evidence_can_be_classified():
    assert triage_deficiency(
        DeficiencyClass.PARTIAL_DEPENDENCY,
        dependency_state=DependencyState.DEGRADED_PARTIAL,
        envelope_possible=True,
    ) == RecoveryDecision.CLASSIFY_OUTCOME


def test_ref_and_grounding_deficiencies_route_to_evidence_acquisition():
    assert triage_deficiency(DeficiencyClass.REF) == RecoveryDecision.ACQUIRE_EVIDENCE
    assert triage_deficiency(DeficiencyClass.GROUNDING) == RecoveryDecision.ACQUIRE_EVIDENCE


def test_recovery_trace_includes_public_v11_fields():
    trace = recovery_trace(
        deficiency="SCHEMA_DEFICIENT",
        action="structured_schema_repair",
        outcome="inconclusive",
        detail="missing required field",
        level=2,
        attempt=1,
        deficiency_class=DeficiencyClass.SCHEMA,
        dependency_state=DependencyState.OUTPUT_DEFICIENT,
    )

    assert trace.deficiency == "SCHEMA_DEFICIENT"
    assert trace.deficiencyClass == "schema"
    assert trace.recoveryAction == "structured_schema_repair"
    assert trace.result == "inconclusive"
    assert trace.dependencyState == "output_deficient"


def test_clean_pass_formula_is_strict_and_derived():
    assert clean_pass_for(
        analysis_outcome=AnalysisOutcome.ACCEPTED_CLAIMS,
        quality_outcome=QualityOutcome.ACCEPTED,
        poc_outcome=PocOutcome.POC_NOT_REQUESTED,
    ) is True
    assert clean_pass_for(
        analysis_outcome=AnalysisOutcome.NO_ACCEPTED_CLAIMS,
        quality_outcome=QualityOutcome.ACCEPTED,
        poc_outcome=PocOutcome.POC_NOT_REQUESTED,
    ) is False
    assert clean_pass_for(
        analysis_outcome=AnalysisOutcome.ACCEPTED_CLAIMS,
        quality_outcome=QualityOutcome.ACCEPTED,
        poc_outcome=PocOutcome.POC_REJECTED,
    ) is False
    assert clean_pass_for(
        analysis_outcome=AnalysisOutcome.ACCEPTED_CLAIMS,
        quality_outcome=QualityOutcome.ACCEPTED,
        poc_outcome=PocOutcome.POC_ACCEPTED,
    ) is True


def test_exception_mapping_distinguishes_timeout_and_unavailable():
    assert state_from_exception(TimeoutError("deadline")) == DependencyState.DEADLINE_EXCEEDED
    assert state_from_exception(ConnectionError("connect refused")) == DependencyState.UNAVAILABLE
    assert state_from_exception(ValueError("malformed json")) == DependencyState.OUTPUT_DEFICIENT
