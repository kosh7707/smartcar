"""SchemaValidator 단위 테스트."""

from app.types import TaskType
from app.validators.schema_validator import SchemaValidator

validator = SchemaValidator()


def test_valid_assessment():
    data = {
        "summary": "요약",
        "claims": [{"statement": "s", "supportingEvidenceRefs": ["eref-001"]}],
        "caveats": ["caveat"],
        "usedEvidenceRefs": ["eref-001"],
    }
    info = validator.validate(data, TaskType.STATIC_EXPLAIN)
    assert info.valid is True
    assert info.errors == []


def test_missing_summary():
    data = {
        "claims": [],
        "caveats": [],
        "usedEvidenceRefs": [],
    }
    info = validator.validate(data, TaskType.STATIC_EXPLAIN)
    assert info.valid is False
    assert any("summary" in e for e in info.errors)


def test_missing_claims():
    data = {
        "summary": "s",
        "caveats": [],
        "usedEvidenceRefs": [],
    }
    info = validator.validate(data, TaskType.STATIC_EXPLAIN)
    assert info.valid is False
    assert any("claims" in e for e in info.errors)


def test_claim_without_statement():
    data = {
        "summary": "s",
        "claims": [{"supportingEvidenceRefs": []}],
        "caveats": [],
        "usedEvidenceRefs": [],
    }
    info = validator.validate(data, TaskType.STATIC_EXPLAIN)
    assert info.valid is False
    assert any("statement" in e for e in info.errors)


def test_confidence_out_of_range():
    data = {
        "summary": "s",
        "claims": [],
        "caveats": [],
        "usedEvidenceRefs": [],
        "confidence": 1.5,
    }
    info = validator.validate(data, TaskType.STATIC_EXPLAIN)
    assert info.valid is False
    assert any("confidence" in e for e in info.errors)


def test_test_plan_missing_plan():
    data = {
        "summary": "s",
        "claims": [],
        "caveats": [],
        "usedEvidenceRefs": [],
    }
    info = validator.validate(data, TaskType.TEST_PLAN_PROPOSE)
    assert info.valid is False
    assert any("plan" in e for e in info.errors)


def test_test_plan_valid():
    data = {
        "summary": "s",
        "claims": [],
        "caveats": [],
        "usedEvidenceRefs": [],
        "plan": {"objective": "test"},
    }
    info = validator.validate(data, TaskType.TEST_PLAN_PROPOSE)
    assert info.valid is True
