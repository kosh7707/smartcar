from __future__ import annotations

from app.v1.schemas.response import ConfidenceBreakdown

# 가중치 (외부 피드백 기반)
W_GROUNDING = 0.45
W_DETERMINISTIC = 0.30
W_CONSISTENCY = 0.15
W_SCHEMA = 0.10


class ConfidenceCalculator:
    """S3가 직접 계산하는 confidence 점수. LLM self-score에 맡기지 않는다."""

    def calculate(
        self,
        assessment: dict,
        input_ref_ids: set[str],
        schema_valid: bool,
        has_rule_results: bool = False,
    ) -> tuple[float, ConfidenceBreakdown]:
        grounding = self._calc_grounding(assessment, input_ref_ids)
        deterministic = self._calc_deterministic(assessment, has_rule_results)
        consistency = 1.0  # Phase 1: dual-run 미구현, 고정값
        schema_compliance = 1.0 if schema_valid else 0.0

        score = (
            W_GROUNDING * grounding
            + W_DETERMINISTIC * deterministic
            + W_CONSISTENCY * consistency
            + W_SCHEMA * schema_compliance
        )
        score = round(min(max(score, 0.0), 1.0), 4)

        breakdown = ConfidenceBreakdown(
            grounding=round(grounding, 4),
            deterministicSupport=round(deterministic, 4),
            consistency=round(consistency, 4),
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
        if not has_rule_results:
            return 0.5  # rule 결과 없으면 중립
        # rule 결과가 있으면 claims와 부합한다고 가정 (Phase 1 단순화)
        claims = assessment.get("claims", [])
        return 1.0 if claims else 0.3
