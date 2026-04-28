from __future__ import annotations

from dataclasses import dataclass

from app.types import AnalysisOutcome, PocOutcome, QualityOutcome
from .types import DeficiencyClass


@dataclass(frozen=True)
class OutcomeDecision:
    analysis_outcome: AnalysisOutcome = AnalysisOutcome.INCONCLUSIVE
    quality_outcome: QualityOutcome = QualityOutcome.INCONCLUSIVE
    poc_outcome: PocOutcome = PocOutcome.POC_NOT_REQUESTED


@dataclass(frozen=True)
class TriageContext:
    has_accepted_claims: bool = False
    poc_requested: bool = False
    no_accepted_claims: bool = False


def outcome_for_deficiency(
    deficiency: DeficiencyClass,
    context: TriageContext | None = None,
) -> OutcomeDecision:
    """Single source for recoverable deficiency -> result-level outcomes."""
    context = context or TriageContext()
    if deficiency in {
        DeficiencyClass.SCHEMA,
        DeficiencyClass.EMPTY_LLM_OUTPUT,
        DeficiencyClass.MALFORMED_LLM_OUTPUT,
        DeficiencyClass.STRICT_JSON_VIOLATION,
        DeficiencyClass.REPAIR_EXHAUSTED,
    }:
        return OutcomeDecision(
            analysis_outcome=(
                AnalysisOutcome.NO_ACCEPTED_CLAIMS
                if context.no_accepted_claims
                else AnalysisOutcome.INCONCLUSIVE
            ),
            quality_outcome=QualityOutcome.REPAIR_EXHAUSTED,
            poc_outcome=(
                PocOutcome.POC_INCONCLUSIVE
                if context.poc_requested
                else PocOutcome.POC_NOT_REQUESTED
            ),
        )
    if deficiency in {DeficiencyClass.REF, DeficiencyClass.GROUNDING}:
        return OutcomeDecision(
            analysis_outcome=AnalysisOutcome.NO_ACCEPTED_CLAIMS,
            quality_outcome=QualityOutcome.REJECTED,
        )
    if deficiency == DeficiencyClass.QUALITY:
        return OutcomeDecision(
            analysis_outcome=(
                AnalysisOutcome.ACCEPTED_CLAIMS
                if context.has_accepted_claims
                else AnalysisOutcome.NO_ACCEPTED_CLAIMS
            ),
            quality_outcome=QualityOutcome.REJECTED,
        )
    if deficiency == DeficiencyClass.POC_QUALITY:
        return OutcomeDecision(
            analysis_outcome=AnalysisOutcome.ACCEPTED_CLAIMS,
            quality_outcome=QualityOutcome.REJECTED,
            poc_outcome=PocOutcome.POC_REJECTED,
        )
    if deficiency in {
        DeficiencyClass.PARTIAL_DEPENDENCY,
        DeficiencyClass.DEPENDENCY_UNAVAILABLE,
        DeficiencyClass.TIMEOUT,
        DeficiencyClass.INTERNAL_UNASSEMBLABLE,
    }:
        return OutcomeDecision(
            analysis_outcome=AnalysisOutcome.INCONCLUSIVE,
            quality_outcome=QualityOutcome.INCONCLUSIVE,
            poc_outcome=(
                PocOutcome.POC_INCONCLUSIVE
                if context.poc_requested
                else PocOutcome.POC_NOT_REQUESTED
            ),
        )
    return OutcomeDecision()


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
