from __future__ import annotations

from dataclasses import dataclass

from .fixtures import StabilityFixture


@dataclass(frozen=True)
class StabilityObservation:
    fixture_id: str
    task_completed: bool
    true_task_failure: bool
    dependency_failure: bool
    internal_deficiency_recovered: bool
    clean_pass: bool
    accepted_claim: bool
    poc_accepted: bool
    poc_rejected_or_inconclusive: bool
    deadline_adhered: bool
    notes: tuple[str, ...] = ()


def run_fixture_matrix(fixtures: list[StabilityFixture]) -> list[StabilityObservation]:
    """Deterministic harness scaffold for fixture-matrix accounting.

    The live service runner can replace this adapter later. The current version
    captures expected state-machine accounting without benchmark-specific logic.
    """
    observations: list[StabilityObservation] = []
    for fixture in fixtures:
        dependency_failure = not fixture.dependency_live
        true_task_failure = not fixture.expected_task_completed
        internal_recovered = fixture.expected_task_completed and any(
            tag in fixture.tags
            for tag in ("output_deficient", "evidence_role", "quality", "poc", "build")
        )
        accepted_claim = fixture.kind == "accepted_with_caveats"
        observations.append(StabilityObservation(
            fixture_id=fixture.id,
            task_completed=fixture.expected_task_completed,
            true_task_failure=true_task_failure,
            dependency_failure=dependency_failure,
            internal_deficiency_recovered=internal_recovered,
            clean_pass=fixture.expected_clean_pass,
            accepted_claim=accepted_claim,
            poc_accepted=False,
            poc_rejected_or_inconclusive=fixture.kind == "poc_rejected",
            deadline_adhered=True,
            notes=fixture.tags,
        ))
    return observations
