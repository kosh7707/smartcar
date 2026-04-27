from __future__ import annotations

from app.core.evidence_catalog import EvidenceCatalog


class EvidenceValidator:
    """Validate final evidence refs against the allowed ledger and role policy."""

    def validate(
        self,
        parsed: dict,
        allowed_ref_ids: set[str],
        evidence_catalog: EvidenceCatalog | None = None,
        allowed_claim_ref_ids: set[str] | None = None,
    ) -> tuple[bool, list[str]]:
        errors: list[str] = []
        if evidence_catalog is not None and allowed_claim_ref_ids is None:
            allowed_claim_ref_ids = evidence_catalog.final_ref_ids()
        if allowed_claim_ref_ids is None:
            allowed_claim_ref_ids = allowed_ref_ids

        used_refs = parsed.get("usedEvidenceRefs", [])
        if isinstance(used_refs, list):
            for ref_id in used_refs:
                if ref_id not in allowed_ref_ids:
                    errors.append(
                        f"usedEvidenceRefs에 허용되지 않은 refId: '{ref_id}'"
                    )
                    continue
                if evidence_catalog is not None and ref_id not in allowed_claim_ref_ids:
                    entry = evidence_catalog.get(ref_id)
                    actual = entry.evidence_class if entry else "missing"
                    errors.append(
                        f"usedEvidenceRefs에 local/derived-local이 아닌 refId: '{ref_id}' ({actual})"
                    )
        else:
            errors.append("usedEvidenceRefs가 리스트가 아님")

        claims = parsed.get("claims", [])
        if isinstance(claims, list):
            for i, claim in enumerate(claims):
                if not isinstance(claim, dict):
                    continue
                supporting = claim.get("supportingEvidenceRefs", [])
                if isinstance(supporting, list):
                    if not supporting:
                        errors.append(
                            f"claims[{i}].supportingEvidenceRefs가 비어 있음"
                        )
                    for ref_id in supporting:
                        if ref_id not in allowed_ref_ids:
                            errors.append(
                                f"claims[{i}].supportingEvidenceRefs에 "
                                f"허용되지 않은 refId: '{ref_id}'"
                            )
                            continue
                        if ref_id not in allowed_claim_ref_ids:
                            entry = evidence_catalog.get(ref_id) if evidence_catalog is not None else None
                            actual = entry.evidence_class if entry else "not_claim_support"
                            errors.append(
                                f"claims[{i}].supportingEvidenceRefs에 "
                                f"local/derived-local이 아닌 refId: '{ref_id}' ({actual})"
                            )
                else:
                    errors.append(
                        f"claims[{i}].supportingEvidenceRefs가 리스트가 아님"
                    )
        elif claims is not None:
            errors.append("claims가 리스트가 아님")

        return len(errors) == 0, errors
