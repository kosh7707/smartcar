"""EvidenceValidator 단위 테스트."""

from app.validators.evidence_validator import EvidenceValidator

validator = EvidenceValidator()


def test_valid_refs():
    assessment = {
        "usedEvidenceRefs": ["eref-001", "eref-002"],
        "claims": [
            {"statement": "s", "supportingEvidenceRefs": ["eref-001"]},
        ],
    }
    valid, errors = validator.validate(assessment, {"eref-001", "eref-002", "eref-003"})
    assert valid is True
    assert errors == []


def test_hallucinated_used_ref():
    assessment = {
        "usedEvidenceRefs": ["eref-001", "eref-FAKE"],
        "claims": [],
    }
    valid, errors = validator.validate(assessment, {"eref-001"})
    assert valid is False
    assert any("eref-FAKE" in e for e in errors)


def test_hallucinated_claim_ref():
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [
            {"statement": "s", "supportingEvidenceRefs": ["eref-FAKE"]},
        ],
    }
    valid, errors = validator.validate(assessment, {"eref-001"})
    assert valid is False
    assert any("eref-FAKE" in e for e in errors)


def test_empty_refs_is_valid():
    assessment = {
        "usedEvidenceRefs": [],
        "claims": [],
    }
    valid, errors = validator.validate(assessment, set())
    assert valid is True


def test_no_allowed_refs_with_used_refs():
    assessment = {
        "usedEvidenceRefs": ["eref-001"],
        "claims": [],
    }
    valid, errors = validator.validate(assessment, set())
    assert valid is False
