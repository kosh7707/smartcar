"""EvidenceValidator 단위 테스트."""

import pytest

from app.validators.evidence_validator import EvidenceValidator


@pytest.fixture
def validator():
    return EvidenceValidator()


ALLOWED = {"eref-001", "eref-sast-cmd-injection", "eref-caller-main", "eref-knowledge-CWE-78"}


class TestUsedEvidenceRefs:
    def test_all_valid(self, validator):
        parsed = {"usedEvidenceRefs": ["eref-001", "eref-caller-main"], "claims": []}
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is True
        assert errors == []

    def test_hallucinated_ref(self, validator):
        parsed = {"usedEvidenceRefs": ["eref-001", "eref-fake-999"], "claims": []}
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is False
        assert len(errors) == 1
        assert "eref-fake-999" in errors[0]

    def test_empty_refs(self, validator):
        parsed = {"usedEvidenceRefs": [], "claims": []}
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is True
        assert errors == []

    def test_missing_key(self, validator):
        parsed = {"claims": []}
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is True

    def test_non_list_is_invalid(self, validator):
        parsed = {"usedEvidenceRefs": "not-a-list", "claims": []}
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is False
        assert "usedEvidenceRefs가 리스트가 아님" in errors


class TestClaimsSupportingRefs:
    def test_valid_claim_refs(self, validator):
        parsed = {
            "usedEvidenceRefs": [],
            "claims": [{"supportingEvidenceRefs": ["eref-001", "eref-caller-main"]}],
        }
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is True

    def test_hallucinated_claim_ref(self, validator):
        parsed = {
            "usedEvidenceRefs": [],
            "claims": [{"supportingEvidenceRefs": ["eref-001", "eref-code-graph-00"]}],
        }
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is False
        assert len(errors) == 1
        assert "claims[0]" in errors[0]
        assert "eref-code-graph-00" in errors[0]

    def test_multiple_claims_multiple_errors(self, validator):
        parsed = {
            "usedEvidenceRefs": ["eref-bad-top"],
            "claims": [
                {"supportingEvidenceRefs": ["eref-bad-0"]},
                {"supportingEvidenceRefs": ["eref-001"]},
                {"supportingEvidenceRefs": ["eref-bad-2"]},
            ],
        }
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is False
        assert len(errors) == 3  # 1 from usedEvidenceRefs + 2 from claims

    def test_non_dict_claim_skipped(self, validator):
        parsed = {"usedEvidenceRefs": [], "claims": ["not-a-dict"]}
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is True

    def test_empty_claim_refs_invalid(self, validator):
        parsed = {
            "usedEvidenceRefs": [],
            "claims": [{"supportingEvidenceRefs": []}],
        }
        valid, errors = validator.validate(parsed, ALLOWED)
        assert valid is False
        assert "claims[0].supportingEvidenceRefs가 비어 있음" in errors

    def test_empty_allowed_set(self, validator):
        parsed = {"usedEvidenceRefs": ["eref-001"], "claims": []}
        valid, errors = validator.validate(parsed, set())
        assert valid is False
        assert len(errors) == 1
