from __future__ import annotations

from app.config import settings
from app.schemas.response import ConfidenceBreakdown


class ConfidenceCalculator:
    """S7이 직접 계산하는 confidence 점수. LLM self-score에 맡기지 않는다."""

    def calculate(
        self,
        assessment: dict,
        input_ref_ids: set[str],
        schema_valid: bool,
        has_rule_results: bool = False,
        rag_hits: int = 0,
    ) -> tuple[float, ConfidenceBreakdown]:
        grounding = self._calc_grounding(assessment, input_ref_ids)
        deterministic = self._calc_deterministic(assessment, has_rule_results)
        rag_coverage = self._calc_rag_coverage(rag_hits)
        schema_compliance = 1.0 if schema_valid else 0.0

        score = (
            settings.confidence_w_grounding * grounding
            + settings.confidence_w_deterministic * deterministic
            + settings.confidence_w_rag_coverage * rag_coverage
            + settings.confidence_w_schema * schema_compliance
        )
        score = round(min(max(score, 0.0), 1.0), 4)

        breakdown = ConfidenceBreakdown(
            grounding=round(grounding, 4),
            deterministicSupport=round(deterministic, 4),
            ragCoverage=round(rag_coverage, 4),
            schemaCompliance=round(schema_compliance, 4),
        )
        return score, breakdown

    def _calc_grounding(
        self,
        assessment: dict,
        input_ref_ids: set[str],
    ) -> float:
        if not input_ref_ids:
            # evidence가 없으면 grounding 상한 제한
            return 0.3

        # 1) usedEvidenceRefs 중 유효한 비율
        used_refs = assessment.get("usedEvidenceRefs", [])
        if not used_refs:
            return 0.0
        valid_used = sum(1 for r in used_refs if r in input_ref_ids)
        used_ratio = valid_used / len(used_refs) if used_refs else 0.0

        # 2) claims 중 evidence가 있는 비율
        claims = assessment.get("claims", [])
        if not claims:
            return used_ratio * 0.5  # claim 없으면 절반

        claims_with_refs = sum(
            1
            for c in claims
            if isinstance(c, dict)
            and c.get("supportingEvidenceRefs")
        )
        claim_ratio = claims_with_refs / len(claims)

        return (used_ratio + claim_ratio) / 2.0

    def _calc_deterministic(
        self,
        assessment: dict,
        has_rule_results: bool,
    ) -> float:
        claims = assessment.get("claims", [])
        if has_rule_results:
            # rule 결과가 있으면 claims와 부합한다고 가정 (Phase 1 단순화)
            return 1.0 if claims else 0.3

        # rule 결과 없이 LLM만으로 분석한 경우:
        # claims 수와 caveats 존재 여부로 세분화
        if not claims:
            return 0.3
        has_caveats = bool(assessment.get("caveats"))
        has_steps = bool(assessment.get("recommendedNextSteps"))
        # claims가 있고 한계점을 인지하면 더 신뢰
        score = 0.5
        if has_caveats:
            score += 0.15
        if has_steps:
            score += 0.1
        if len(claims) >= 2:
            score += 0.1
        return min(score, 1.0)

    def _calc_rag_coverage(self, rag_hits: int, max_k: int = 5) -> float:
        if rag_hits <= 0:
            return 0.4
        return 0.4 + 0.6 * min(rag_hits / max_k, 1.0)
