"""EvidenceRefSanitizer 단위 테스트."""

import pytest

from app.validators.evidence_sanitizer import EvidenceRefSanitizer


@pytest.fixture
def sanitizer():
    return EvidenceRefSanitizer()


ALLOWED = {"eref-sast-cmd-injection", "eref-caller-main", "eref-knowledge-CWE-78", "eref-001"}


class TestNoChange:
    def test_all_valid_refs_unchanged(self, sanitizer):
        parsed = {
            "usedEvidenceRefs": ["eref-001", "eref-caller-main"],
            "claims": [{"supportingEvidenceRefs": ["eref-001"]}],
        }
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == ["eref-001", "eref-caller-main"]
        assert result["claims"][0]["supportingEvidenceRefs"] == ["eref-001"]
        assert corrections == []

    def test_empty_refs(self, sanitizer):
        parsed = {"usedEvidenceRefs": [], "claims": []}
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == []
        assert corrections == []

    def test_empty_allowed_strips_all(self, sanitizer):
        """allowed가 비어있으면 모든 refs를 제거한다."""
        parsed = {"usedEvidenceRefs": ["eref-001"], "claims": [{"supportingEvidenceRefs": ["eref-002"]}]}
        result, corrections = sanitizer.sanitize(parsed, set())
        assert result["usedEvidenceRefs"] == []
        assert result["claims"][0]["supportingEvidenceRefs"] == []
        assert len(corrections) == 2


class TestFuzzyMatch:
    def test_close_match_removed_without_rewrite(self, sanitizer):
        """유사 ref도 자동 재작성하지 않고 제거한다."""
        parsed = {"usedEvidenceRefs": ["eref-knowledge-CWE78"], "claims": []}
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == []
        assert len(corrections) == 1
        assert "eref-knowledge-CWE78" in corrections[0]
        assert "제거" in corrections[0]

    def test_claim_ref_typo_removed(self, sanitizer):
        parsed = {
            "usedEvidenceRefs": [],
            "claims": [{"supportingEvidenceRefs": ["eref-caller-mian"]}],  # typo: mian
        }
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["claims"][0]["supportingEvidenceRefs"] == []
        assert len(corrections) == 1


class TestRemoval:
    def test_no_match_removed(self, sanitizer):
        parsed = {"usedEvidenceRefs": ["eref-totally-fake-xyz"], "claims": []}
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == []
        assert len(corrections) == 1
        assert "제거" in corrections[0]

    def test_mixed_valid_and_invalid(self, sanitizer):
        parsed = {
            "usedEvidenceRefs": ["eref-001", "eref-totally-fake", "eref-caller-main"],
            "claims": [],
        }
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == ["eref-001", "eref-caller-main"]
        assert len(corrections) == 1

    def test_non_string_ref_skipped(self, sanitizer):
        parsed = {"usedEvidenceRefs": [123, "eref-001", None], "claims": []}
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == ["eref-001"]
        assert corrections == []


class TestDeduplication:
    def test_invalid_near_duplicate_removed(self, sanitizer):
        """유효 ref는 유지하고 유사한 invalid ref는 제거한다."""
        parsed = {
            "usedEvidenceRefs": ["eref-caller-main", "eref-caller-mian"],
            "claims": [],
        }
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["usedEvidenceRefs"] == ["eref-caller-main"]
        assert len(corrections) == 1


class TestMultipleClaims:
    def test_sanitize_across_multiple_claims(self, sanitizer):
        parsed = {
            "usedEvidenceRefs": ["eref-001"],
            "claims": [
                {"supportingEvidenceRefs": ["eref-completely-unrelated-xyz"]},
                {"supportingEvidenceRefs": ["eref-001"]},
                {"supportingEvidenceRefs": ["eref-knowledge-CWE78"]},
            ],
        }
        result, corrections = sanitizer.sanitize(parsed, ALLOWED)
        assert result["claims"][0]["supportingEvidenceRefs"] == []  # no match → removed
        assert result["claims"][1]["supportingEvidenceRefs"] == ["eref-001"]
        assert result["claims"][2]["supportingEvidenceRefs"] == []
        assert len(corrections) == 2
