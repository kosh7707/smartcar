"""SchemaValidator / EvidenceValidator 단위 테스트."""

from __future__ import annotations

import pytest

from app.types import TaskType
from app.validators.evidence_validator import EvidenceValidator
from app.validators.schema_validator import SchemaValidator


# ══════════════════════════════════════════════════════════
# SchemaValidator
# ══════════════════════════════════════════════════════════


class TestSchemaValidator:

    @pytest.fixture
    def validator(self) -> SchemaValidator:
        return SchemaValidator()

    def _valid_parsed(self) -> dict:
        return {
            "summary": "All good",
            "claims": [
                {
                    "statement": "No issues found",
                    "supportingEvidenceRefs": ["ref-001"],
                }
            ],
            "caveats": [],
            "usedEvidenceRefs": ["ref-001"],
        }

    def test_schema_valid(self, validator: SchemaValidator) -> None:
        """모든 필수 필드가 존재하면 valid=True, errors=[]."""
        result = validator.validate(self._valid_parsed(), TaskType.BUILD_RESOLVE)
        assert result.valid is True
        assert result.errors == []

    def test_schema_missing_summary(self, validator: SchemaValidator) -> None:
        """summary 누락 → 에러."""
        parsed = self._valid_parsed()
        del parsed["summary"]
        result = validator.validate(parsed, TaskType.BUILD_RESOLVE)
        assert result.valid is False
        assert any("summary" in e for e in result.errors)

    def test_schema_missing_claims(self, validator: SchemaValidator) -> None:
        """claims 누락 → 에러."""
        parsed = self._valid_parsed()
        del parsed["claims"]
        result = validator.validate(parsed, TaskType.BUILD_RESOLVE)
        assert result.valid is False
        assert any("claims" in e for e in result.errors)

    def test_schema_claims_not_list(self, validator: SchemaValidator) -> None:
        """claims가 리스트가 아닌 문자열 → 에러."""
        parsed = self._valid_parsed()
        parsed["claims"] = "not a list"
        result = validator.validate(parsed, TaskType.BUILD_RESOLVE)
        assert result.valid is False
        assert any("리스트" in e for e in result.errors)


# ══════════════════════════════════════════════════════════
# EvidenceValidator
# ══════════════════════════════════════════════════════════


class TestEvidenceValidator:

    @pytest.fixture
    def validator(self) -> EvidenceValidator:
        return EvidenceValidator()

    def test_evidence_valid(self, validator: EvidenceValidator) -> None:
        """모든 ref가 허용 목록 내에 있으면 (True, [])."""
        parsed = {
            "usedEvidenceRefs": ["ref-001", "ref-002"],
            "claims": [
                {"supportingEvidenceRefs": ["ref-001"]},
            ],
        }
        valid, errors = validator.validate(parsed, {"ref-001", "ref-002"})
        assert valid is True
        assert errors == []

    def test_evidence_hallucinated_ref(self, validator: EvidenceValidator) -> None:
        """허용되지 않은 ref → (False, [...])."""
        parsed = {
            "usedEvidenceRefs": ["ref-001", "ref-hallucinated"],
            "claims": [],
        }
        valid, errors = validator.validate(parsed, {"ref-001"})
        assert valid is False
        assert len(errors) >= 1
        assert any("ref-hallucinated" in e for e in errors)

    def test_evidence_claim_ref_invalid(self, validator: EvidenceValidator) -> None:
        """claim의 supportingEvidenceRefs에 유효하지 않은 ref → (False, [...])."""
        parsed = {
            "usedEvidenceRefs": ["ref-001"],
            "claims": [
                {"supportingEvidenceRefs": ["ref-001", "ref-bad"]},
            ],
        }
        valid, errors = validator.validate(parsed, {"ref-001"})
        assert valid is False
        assert any("ref-bad" in e for e in errors)

    def test_evidence_empty_refs(self, validator: EvidenceValidator) -> None:
        """ref도 claims도 없으면 (True, [])."""
        parsed = {
            "usedEvidenceRefs": [],
            "claims": [],
        }
        valid, errors = validator.validate(parsed, set())
        assert valid is True
        assert errors == []
