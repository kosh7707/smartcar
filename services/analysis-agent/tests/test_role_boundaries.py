from app.producers import ProducerDiagnostic, ProducerDraft
from app.quality import evaluate_deep_quality, evaluate_poc_quality
from app.state_machine import RecoveryDecision, triage_deficiency
from app.state_machine.types import DeficiencyClass, DependencyState


def test_analysis_producer_draft_has_no_final_verdict_authority() -> None:
    draft = ProducerDraft(
        artifact={"summary": "candidate"},
        diagnostics=[ProducerDiagnostic(id="producer-note", detail="best effort")],
    )

    assert "cleanPass" not in draft.artifact
    assert "evaluationVerdict" not in draft.artifact
    assert "qualityGate" not in draft.artifact


def test_analysis_critic_and_orchestrator_boundaries_are_importable() -> None:
    assert callable(evaluate_deep_quality)
    assert callable(evaluate_poc_quality)
    assert triage_deficiency(
        DeficiencyClass.QUALITY,
        dependency_state=DependencyState.AVAILABLE,
    ) == RecoveryDecision.CLASSIFY_OUTCOME
