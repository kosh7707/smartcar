from app.producers import BuildProducerDraft, ProducerDiagnostic
from app.quality import build_outcome_value_for
from app.state_machine import BuildDependencyState, BuildOrchestratorDecision
from app.types import FailureCode


def test_build_producer_draft_has_no_final_outcome_authority() -> None:
    draft = BuildProducerDraft(
        artifact={"buildScript": "make"},
        diagnostics=[ProducerDiagnostic(id="producer-note", detail="candidate script")],
    )

    assert "cleanPass" not in draft.artifact
    assert "buildOutcome" not in draft.artifact
    assert "buildDiagnostics" not in draft.artifact


def test_build_critic_and_orchestrator_boundaries_are_importable() -> None:
    assert build_outcome_value_for(FailureCode.COMPILE_FAILED) == "compile_failed"
    assert BuildDependencyState.AVAILABLE.value == "available"
    assert BuildOrchestratorDecision.RETURN_COMPLETED_OUTCOME.value == "return_completed_outcome"
