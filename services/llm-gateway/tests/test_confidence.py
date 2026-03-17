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
        rag_hits=5,
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


# --- RAG coverage 분화 테스트 ---


def test_rag_hits_zero():
    """RAG 히트 0 → ragCoverage=0.4, confidence 하락."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["eref-001"]}],
    }
    conf, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=0,
    )
    assert breakdown.ragCoverage == 0.4
    # 기존 consistency=1.0 대비 하락
    assert conf < 0.955


def test_rag_hits_max():
    """RAG 히트 5(max_k) → ragCoverage=1.0."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["eref-001"]}],
    }
    _, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=5,
    )
    assert breakdown.ragCoverage == 1.0


def test_rag_hits_partial():
    """RAG 히트 3 → ragCoverage=0.76."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["eref-001"]}],
    }
    _, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=3,
    )
    assert breakdown.ragCoverage == 0.76


def test_confidence_differentiation():
    """0 hits vs 5 hits → confidence 점수 차이 존재."""
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["eref-001"]}],
    }
    conf_zero, _ = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=0,
    )
    conf_max, _ = calc.calculate(
        assessment,
        input_ref_ids={"eref-001"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=5,
    )
    # 분별력 0.09
    assert conf_max - conf_zero >= 0.08


def test_rag_hits_exceeds_max_k():
    """RAG 히트가 max_k 초과해도 ragCoverage는 1.0으로 캡."""
    _, breakdown = calc.calculate(
        {"usedEvidenceRefs": [], "claims": []},
        input_ref_ids=set(),
        schema_valid=True,
        rag_hits=10,
    )
    assert breakdown.ragCoverage == 1.0
