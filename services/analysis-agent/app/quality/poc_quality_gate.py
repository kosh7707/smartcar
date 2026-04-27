from __future__ import annotations

from app.schemas.response import Claim, QualityGateItem, QualityGateResult
from app.types import QualityOutcome

_UNSAFE_MARKERS = (
    "rm -rf",
    "format disk",
    "delete all",
    "exfiltrate",
    "무차별 삭제",
)


def evaluate_poc_quality(
    *,
    claims: list[Claim],
    caveats: list[str] | None = None,
) -> QualityGateResult:
    """Classify PoC consumability/safety without fabricating exploit success."""
    caveats = caveats or []
    if not claims:
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=[QualityGateItem(
                id="poc-claim-bound",
                repairable=True,
                requiredEvidenceSlots=["claim-bound PoC detail"],
                detail="PoC output did not include a structured claim.",
            )],
            caveats=caveats,
        )

    detail_blob = " ".join([claim.detail or "" for claim in claims] + caveats).lower()
    if any(marker in detail_blob for marker in _UNSAFE_MARKERS):
        return QualityGateResult(
            outcome=QualityOutcome.REJECTED,
            failedItems=[QualityGateItem(
                id="poc-safety",
                repairable=True,
                requiredEvidenceSlots=["non-destructive reproduction steps"],
                detail="PoC contains potentially destructive instructions.",
            )],
            caveats=caveats,
        )

    if caveats:
        return QualityGateResult(
            outcome=QualityOutcome.ACCEPTED_WITH_CAVEATS,
            caveats=caveats,
        )

    return QualityGateResult(outcome=QualityOutcome.ACCEPTED, caveats=caveats)
