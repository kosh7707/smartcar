from __future__ import annotations

from app.schemas.response import Claim, QualityGateItem, QualityGateResult
from app.types import QualityOutcome

_CAVEAT_MARKERS = (
    "low-confidence",
    "low confidence",
    "plausible",
    "not fully confirmed",
    "추가 검증",
    "불확실",
)


def evaluate_deep_quality(
    *,
    claims: list[Claim],
    caveats: list[str] | None = None,
    evidence_errors: list[str] | None = None,
) -> QualityGateResult:
    """Classify deep-analysis output quality without deciding vulnerability truth.

    This gate is intentionally generic: it checks whether the result is cleanly
    consumable and locally grounded, not whether a particular CWE family is true.
    """
    caveats = caveats or []
    evidence_errors = evidence_errors or []
    failed: list[QualityGateItem] = []
    repairable: list[QualityGateItem] = []

    if evidence_errors:
        failed.append(QualityGateItem(
            id="evidence-grounding",
            repairable=True,
            requiredEvidenceSlots=["project-local-or-derived evidence"],
            detail="; ".join(evidence_errors),
        ))
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=failed,
            repairableItems=repairable,
            caveats=caveats,
        )

    if not claims:
        repairable.append(QualityGateItem(
            id="accepted-claim-coverage",
            repairable=True,
            requiredEvidenceSlots=["grounded accepted claim or explicit negative rationale"],
            detail="No accepted claims were emitted.",
        ))
        return QualityGateResult(
            outcome=QualityOutcome.INCONCLUSIVE,
            failedItems=failed,
            repairableItems=repairable,
            caveats=caveats,
        )

    for i, claim in enumerate(claims):
        if not claim.location or not claim.detail or not claim.supportingEvidenceRefs:
            failed.append(QualityGateItem(
                id=f"claim-{i}-shape",
                repairable=True,
                requiredEvidenceSlots=["statement", "detail", "location", "supportingEvidenceRefs"],
                detail="Claim is missing required consumability fields.",
            ))
        missing_slots = _missing_required_slots(claim)
        if missing_slots:
            failed.append(QualityGateItem(
                id=f"claim-{i}-evidence-slots",
                repairable=True,
                requiredEvidenceSlots=missing_slots,
                detail="Claim has not filled all deterministic evidence slots required for its family.",
            ))

    if failed:
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=failed,
            repairableItems=repairable,
            caveats=caveats,
        )

    caveat_blob = " ".join(caveats + [claim.detail or "" for claim in claims]).lower()
    if any(marker in caveat_blob for marker in _CAVEAT_MARKERS):
        return QualityGateResult(
            outcome=QualityOutcome.ACCEPTED_WITH_CAVEATS,
            failedItems=[],
            repairableItems=[],
            caveats=caveats,
        )

    return QualityGateResult(
        outcome=QualityOutcome.ACCEPTED,
        failedItems=[],
        repairableItems=[],
        caveats=caveats,
    )


def _missing_required_slots(claim: Claim) -> list[str]:
    """Return missing-evidence slots for a claim.

    PRECONDITION: production callers must run ``transition_claim_status``
    first so ``claim.missingEvidence`` reflects the S3 claim lifecycle state.
    Direct test/helper callers may still use required/present evidence fields,
    but new runtime paths should not bypass the lifecycle transition.
    """
    declared = [slot for slot in claim.requiredEvidence if isinstance(slot, str) and slot]
    if claim.missingEvidence:
        return list(dict.fromkeys(slot for slot in claim.missingEvidence if isinstance(slot, str) and slot))
    if not declared:
        return []
    present = {slot for slot in claim.presentEvidence if isinstance(slot, str) and slot}
    return [slot for slot in declared if slot not in present]
