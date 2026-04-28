import ast
from dataclasses import fields
from pathlib import Path

from app.producers import ProducerDiagnostic, ProducerDraft
from app.quality import evaluate_deep_quality, evaluate_poc_quality
from app.state_machine import RecoveryDecision, triage_deficiency
from app.state_machine.types import DeficiencyClass, DependencyState

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


def test_analysis_producer_draft_has_no_final_verdict_authority() -> None:
    draft = ProducerDraft(
        artifact={"summary": "candidate"},
        diagnostics=[ProducerDiagnostic(id="producer-note", detail="best effort")],
    )

    assert "cleanPass" not in draft.artifact
    assert "evaluationVerdict" not in draft.artifact
    assert "qualityGate" not in draft.artifact


def test_analysis_producer_draft_model_has_no_final_authority_fields() -> None:
    field_names = {field.name for field in fields(ProducerDraft)}

    assert field_names.isdisjoint(FINAL_AUTHORITY_FIELDS)


def test_analysis_producer_modules_do_not_import_critic_or_orchestrator_authority() -> None:
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


def test_analysis_critic_and_orchestrator_boundaries_are_importable() -> None:
    assert callable(evaluate_deep_quality)
    assert callable(evaluate_poc_quality)
    assert triage_deficiency(
        DeficiencyClass.QUALITY,
        dependency_state=DependencyState.AVAILABLE,
    ) == RecoveryDecision.CLASSIFY_OUTCOME
