from __future__ import annotations

from dataclasses import asdict, dataclass

from .runner import StabilityObservation


@dataclass(frozen=True)
class StabilityReport:
    total: int
    taskCompletionRate: float
    trueTaskFailureRate: float
    dependencyFailureRate: float
    internalDeficiencyRecoveredRate: float
    cleanPassRate: float
    acceptedClaimRate: float
    pocRejectedOrInconclusiveRate: float
    deadlineAdherenceRate: float

    def as_dict(self) -> dict:
        return asdict(self)


def summarize_observations(observations: list[StabilityObservation]) -> StabilityReport:
    total = len(observations)
    if total == 0:
        return StabilityReport(0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)

    def rate(predicate) -> float:
        return sum(1 for obs in observations if predicate(obs)) / total

    return StabilityReport(
        total=total,
        taskCompletionRate=rate(lambda obs: obs.task_completed),
        trueTaskFailureRate=rate(lambda obs: obs.true_task_failure),
        dependencyFailureRate=rate(lambda obs: obs.dependency_failure),
        internalDeficiencyRecoveredRate=rate(lambda obs: obs.internal_deficiency_recovered),
        cleanPassRate=rate(lambda obs: obs.clean_pass),
        acceptedClaimRate=rate(lambda obs: obs.accepted_claim),
        pocRejectedOrInconclusiveRate=rate(lambda obs: obs.poc_rejected_or_inconclusive),
        deadlineAdherenceRate=rate(lambda obs: obs.deadline_adhered),
    )
