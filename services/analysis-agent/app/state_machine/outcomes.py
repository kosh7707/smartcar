from __future__ import annotations

from app.types import AnalysisOutcome, PocOutcome, QualityOutcome


def clean_pass_for(
    *,
    analysis_outcome: AnalysisOutcome = AnalysisOutcome.INCONCLUSIVE,
    quality_outcome: QualityOutcome = QualityOutcome.INCONCLUSIVE,
    poc_outcome: PocOutcome = PocOutcome.POC_NOT_REQUESTED,
) -> bool:
    if quality_outcome != QualityOutcome.ACCEPTED:
        return False
    if poc_outcome != PocOutcome.POC_NOT_REQUESTED:
        return poc_outcome == PocOutcome.POC_ACCEPTED
    return analysis_outcome == AnalysisOutcome.ACCEPTED_CLAIMS
