import ast
from dataclasses import fields
from pathlib import Path

from app.producers import BuildProducerDraft, ProducerDiagnostic
from app.quality import build_outcome_value_for
from app.state_machine import BuildDependencyState, BuildOrchestratorDecision
from app.types import FailureCode

SERVICE_ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_PRODUCER_IMPORT_PREFIXES = ("app.quality", "app.state_machine")
FINAL_AUTHORITY_FIELDS = {
    "buildOutcome",
    "buildDiagnostics",
    "cleanPass",
    "evaluationVerdict",
    "qualityGate",
    "claimDiagnostics",
}


def test_build_producer_draft_has_no_final_outcome_authority() -> None:
    draft = BuildProducerDraft(
        artifact={"buildScript": "make"},
        diagnostics=[ProducerDiagnostic(id="producer-note", detail="candidate script")],
    )

    assert "cleanPass" not in draft.artifact
    assert "buildOutcome" not in draft.artifact
    assert "buildDiagnostics" not in draft.artifact


def test_build_producer_draft_model_has_no_final_authority_fields() -> None:
    field_names = {field.name for field in fields(BuildProducerDraft)}

    assert field_names.isdisjoint(FINAL_AUTHORITY_FIELDS)


def test_build_producer_modules_do_not_import_critic_or_orchestrator_authority() -> None:
    for relative_path in ("app/producers/__init__.py", "app/producers/types.py"):
        source = (SERVICE_ROOT / relative_path).read_text()
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                assert not module.startswith(FORBIDDEN_PRODUCER_IMPORT_PREFIXES), (
                    f"{relative_path} must not import {module}"
                )
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    assert not alias.name.startswith(FORBIDDEN_PRODUCER_IMPORT_PREFIXES), (
                        f"{relative_path} must not import {alias.name}"
                    )


def test_build_critic_and_orchestrator_boundaries_are_importable() -> None:
    assert build_outcome_value_for(FailureCode.COMPILE_FAILED) == "compile_failed"
    assert BuildDependencyState.AVAILABLE.value == "available"
    assert BuildOrchestratorDecision.RETURN_COMPLETED_OUTCOME.value == "return_completed_outcome"
