"""ConfidenceCalculator 단위 테스트."""

from __future__ import annotations

import pytest

from app.pipeline.confidence import (
    ConfidenceCalculator,
    W_DETERMINISTIC,
    W_GROUNDING,
    W_RAG_COVERAGE,
    W_SCHEMA,
)


@pytest.fixture
def calc() -> ConfidenceCalculator:
    return ConfidenceCalculator()


# ── 높은 신뢰도 ───────────────────────────────────────


def test_perfect_score(calc: ConfidenceCalculator) -> None:
    """모든 evidence 사용, rule 결과 있음, schema valid → 높은 confidence."""
    assessment = {
        "usedEvidenceRefs": ["ref-001", "ref-002"],
        "claims": [
            {"statement": "A", "supportingEvidenceRefs": ["ref-001"]},
            {"statement": "B", "supportingEvidenceRefs": ["ref-002"]},
        ],
        "caveats": ["some caveat"],
        "recommendedNextSteps": ["step1"],
    }
    score, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"ref-001", "ref-002"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=5,
    )
    # grounding: all used refs valid, all claims have refs → high
    # deterministic: has_rule_results + claims → 1.0
    # rag_coverage: 5 hits → 1.0
    # schema: valid → 1.0
    assert score > 0.8
    assert breakdown.schemaCompliance == 1.0
    assert breakdown.deterministicSupport == 1.0


# ── evidence 없음 ─────────────────────────────────────


def test_no_evidence(calc: ConfidenceCalculator) -> None:
    """input_ref_ids가 비어있으면 grounding 상한 0.3."""
    assessment = {
        "usedEvidenceRefs": [],
        "claims": [],
    }
    score, breakdown = calc.calculate(
        assessment,
        input_ref_ids=set(),
        schema_valid=True,
        has_rule_results=False,
        rag_hits=0,
    )
    assert breakdown.grounding == 0.3


# ── claims 없음 ───────────────────────────────────────


def test_no_claims(calc: ConfidenceCalculator) -> None:
    """usedRefs는 있지만 claims가 없으면 grounding 절반."""
    assessment = {
        "usedEvidenceRefs": ["ref-001"],
        "claims": [],
    }
    score, breakdown = calc.calculate(
        assessment,
        input_ref_ids={"ref-001"},
        schema_valid=True,
        has_rule_results=False,
        rag_hits=0,
    )
    # used_ratio = 1.0, but no claims → * 0.5
    assert breakdown.grounding == 0.5


# ── schema invalid ─────────────────────────────────────


def test_schema_invalid(calc: ConfidenceCalculator) -> None:
    """schema_valid=False → schemaCompliance=0.0, 전체 score 하락."""
    assessment = {
        "usedEvidenceRefs": ["ref-001"],
        "claims": [
            {"statement": "A", "supportingEvidenceRefs": ["ref-001"]},
        ],
    }
    score_valid, bd_valid = calc.calculate(
        assessment,
        input_ref_ids={"ref-001"},
        schema_valid=True,
    )
    score_invalid, bd_invalid = calc.calculate(
        assessment,
        input_ref_ids={"ref-001"},
        schema_valid=False,
    )
    assert bd_invalid.schemaCompliance == 0.0
    assert bd_valid.schemaCompliance == 1.0
    assert score_invalid < score_valid


# ── 경계값: 0.0 ~ 1.0 ─────────────────────────────────


def test_bounded(calc: ConfidenceCalculator) -> None:
    """confidence는 항상 [0.0, 1.0] 범위 내."""
    # 최소 조건
    score_min, _ = calc.calculate(
        {"usedEvidenceRefs": [], "claims": []},
        input_ref_ids=set(),
        schema_valid=False,
        has_rule_results=False,
        rag_hits=0,
    )
    assert 0.0 <= score_min <= 1.0

    # 최대 조건
    score_max, _ = calc.calculate(
        {
            "usedEvidenceRefs": ["r1"],
            "claims": [{"statement": "A", "supportingEvidenceRefs": ["r1"]}],
            "caveats": ["c"],
            "recommendedNextSteps": ["s"],
        },
        input_ref_ids={"r1"},
        schema_valid=True,
        has_rule_results=True,
        rag_hits=10,
    )
    assert 0.0 <= score_max <= 1.0
