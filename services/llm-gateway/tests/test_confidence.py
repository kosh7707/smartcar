"""ConfidenceCalculator 단위 테스트."""

from app.pipeline.confidence import ConfidenceCalculator

calc = ConfidenceCalculator()


def test_perfect_score():
    """모든 조건이 이상적일 때 confidence ≈ 1.0."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [
            {"statement": "s", "supportingEvidenceRefs": ["eref-001"]},
        ],
    }
    conf, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=True,
    )
    assert conf >= 0.9
    assert breakdown.grounding >= 0.9
    assert breakdown.schemaCompliance == 1.0


def test_no_evidence_caps_grounding():
    """evidence가 없으면 grounding이 0.3으로 제한된다."""
    assessment = {
        "usedEvidenceRefs": [],
        "claims": [{"statement": "s", "supportingEvidenceRefs": []}],
    }
    conf, breakdown = calc.calculate(
        assessment,
        input_ref_ids=set(),
        schema_valid=True,
        has_rule_results=False,
    )
    assert breakdown.grounding <= 0.3


def test_schema_invalid():
    """schema 검증 실패 시 schemaCompliance = 0."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [],
    }
    conf, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=False,
        has_rule_results=True,
    )
    assert breakdown.schemaCompliance == 0.0


def test_confidence_range():
    """confidence는 항상 0~1 범위."""
    assessment = {
        "usedEvidenceRefs": [],
        "claims": [],
    }
    conf, _ = calc.calculate(
        assessment,
        input_ref_ids=set(),
        schema_valid=False,
        has_rule_results=False,
    )
    assert 0.0 <= conf <= 1.0


def test_no_rule_results_lowers_deterministic():
    """rule results 없으면 deterministicSupport = 0.5."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["eref-001"]}],
    }
    _, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=False,
    )
    assert breakdown.deterministicSupport == 0.5
