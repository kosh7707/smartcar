from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .fixtures import StabilityFixture

PocOutcomeBucket = Literal["accepted", "rejected", "inconclusive", "not_requested"]


@dataclass(frozen=True)
class StabilityObservation:
    fixture_id: str
    fixture: StabilityFixture
    task_completed: bool
    true_task_failure: bool
    dependency_failure: bool
    internal_deficiency_recovered: bool
    clean_pass: bool
    accepted_claim: bool
    no_accepted_claims: bool
    inconclusive: bool
    poc_accepted: bool
    poc_rejected_or_inconclusive: bool
    poc_outcome: PocOutcomeBucket
    deadline_adhered: bool
    silent_200_diagnostic_present: bool
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
            for tag in ("output_deficient", "evidence_role", "quality", "poc", "build", "paper_fixture")
        )
        accepted_claim = fixture.kind == "accepted_with_caveats"
        no_accepted_claims = fixture.kind == "no_accepted_claims"
        inconclusive = fixture.kind in {
            "s7_empty",
            "s7_malformed",
            "s7_strict_json",
            "knowledge_only_refs",
            "operational_only_refs",
            "poc_inconclusive",
        }
        poc_outcome = _poc_outcome_for(fixture)
        completed_non_clean = fixture.expected_task_completed and not fixture.expected_clean_pass
        observations.append(StabilityObservation(
            fixture_id=fixture.id,
            fixture=fixture,
            task_completed=fixture.expected_task_completed,
            true_task_failure=true_task_failure,
            dependency_failure=dependency_failure,
            internal_deficiency_recovered=internal_recovered,
            clean_pass=fixture.expected_clean_pass,
            accepted_claim=accepted_claim,
            no_accepted_claims=no_accepted_claims,
            inconclusive=inconclusive,
            poc_accepted=poc_outcome == "accepted",
            poc_rejected_or_inconclusive=poc_outcome in {"rejected", "inconclusive"},
            poc_outcome=poc_outcome,
            deadline_adhered=True,
            silent_200_diagnostic_present=(not completed_non_clean) or bool(fixture.diagnostic_channels),
            notes=fixture.tags + fixture.diagnostic_channels,
        ))
    return observations


def _poc_outcome_for(fixture: StabilityFixture) -> PocOutcomeBucket:
    if fixture.kind == "poc_accepted":
        return "accepted"
    if fixture.kind == "poc_rejected":
        return "rejected"
    if fixture.kind == "poc_inconclusive":
        return "inconclusive"
    return "not_requested"
