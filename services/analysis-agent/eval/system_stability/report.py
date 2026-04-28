from __future__ import annotations

from dataclasses import asdict, dataclass

from .runner import StabilityObservation


@dataclass(frozen=True)
class StabilityReport:
    total: int
    completedCount: int
    taskCompletionRate: float
    trueTaskFailureRate: float
    dependencyFailureRate: float
    internalDeficiencyRecoveredRate: float
    cleanPassRate: float
    strictCleanPassRate: float
    acceptedClaimCount: int
    acceptedClaimRate: float
    noAcceptedClaimsCount: int
    noAcceptedClaimsRate: float
    inconclusiveCount: int
    inconclusiveRate: float
    pocAcceptedCount: int
    pocAcceptedRate: float
    pocRejectedCount: int
    pocRejectedRate: float
    pocInconclusiveCount: int
    pocInconclusiveRate: float
    pocRejectedOrInconclusiveRate: float
    completedNonCleanCount: int
    silent200DiagnosticCoverageRate: float
    deadlineAdherenceRate: float

    def as_dict(self) -> dict:
        return asdict(self)


def summarize_observations(observations: list[StabilityObservation]) -> StabilityReport:
    total = len(observations)
    if total == 0:
        return StabilityReport(
            total=0,
            completedCount=0,
            taskCompletionRate=0.0,
            trueTaskFailureRate=0.0,
            dependencyFailureRate=0.0,
            internalDeficiencyRecoveredRate=0.0,
            cleanPassRate=0.0,
            strictCleanPassRate=0.0,
            acceptedClaimCount=0,
            acceptedClaimRate=0.0,
            noAcceptedClaimsCount=0,
            noAcceptedClaimsRate=0.0,
            inconclusiveCount=0,
            inconclusiveRate=0.0,
            pocAcceptedCount=0,
            pocAcceptedRate=0.0,
            pocRejectedCount=0,
            pocRejectedRate=0.0,
            pocInconclusiveCount=0,
            pocInconclusiveRate=0.0,
            pocRejectedOrInconclusiveRate=0.0,
            completedNonCleanCount=0,
            silent200DiagnosticCoverageRate=0.0,
            deadlineAdherenceRate=0.0,
        )

    def count(predicate) -> int:
        return sum(1 for obs in observations if predicate(obs))

    def rate(predicate) -> float:
        return count(predicate) / total

    completed_non_clean = [obs for obs in observations if obs.task_completed and not obs.clean_pass]
    silent_200_coverage = (
        sum(1 for obs in completed_non_clean if obs.silent_200_diagnostic_present) / len(completed_non_clean)
        if completed_non_clean
        else 1.0
    )
    poc_accepted = count(lambda obs: obs.poc_outcome == "accepted")
    poc_rejected = count(lambda obs: obs.poc_outcome == "rejected")
    poc_inconclusive = count(lambda obs: obs.poc_outcome == "inconclusive")
    accepted_claims = count(lambda obs: obs.accepted_claim)
    no_accepted_claims = count(lambda obs: obs.no_accepted_claims)
    inconclusive = count(lambda obs: obs.inconclusive)

    return StabilityReport(
        total=total,
        completedCount=count(lambda obs: obs.task_completed),
        taskCompletionRate=rate(lambda obs: obs.task_completed),
        trueTaskFailureRate=rate(lambda obs: obs.true_task_failure),
        dependencyFailureRate=rate(lambda obs: obs.dependency_failure),
        internalDeficiencyRecoveredRate=rate(lambda obs: obs.internal_deficiency_recovered),
        cleanPassRate=rate(lambda obs: obs.clean_pass),
        strictCleanPassRate=rate(
            lambda obs: obs.clean_pass and obs.fixture.fixture_source == "state_machine"
        ),
        acceptedClaimCount=accepted_claims,
        acceptedClaimRate=accepted_claims / total,
        noAcceptedClaimsCount=no_accepted_claims,
        noAcceptedClaimsRate=no_accepted_claims / total,
        inconclusiveCount=inconclusive,
        inconclusiveRate=inconclusive / total,
        pocAcceptedCount=poc_accepted,
        pocAcceptedRate=poc_accepted / total,
        pocRejectedCount=poc_rejected,
        pocRejectedRate=poc_rejected / total,
        pocInconclusiveCount=poc_inconclusive,
        pocInconclusiveRate=poc_inconclusive / total,
        pocRejectedOrInconclusiveRate=rate(lambda obs: obs.poc_rejected_or_inconclusive),
        completedNonCleanCount=len(completed_non_clean),
        silent200DiagnosticCoverageRate=silent_200_coverage,
        deadlineAdherenceRate=rate(lambda obs: obs.deadline_adhered),
    )
