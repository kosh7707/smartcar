from __future__ import annotations


class EvidenceValidator:
    """LLM 응답의 evidence ref가 입력 whitelist 내에 있는지 검증한다."""

    def validate(
        self,
        parsed: dict,
        allowed_ref_ids: set[str],
    ) -> tuple[bool, list[str]]:
        errors: list[str] = []

        used_refs = parsed.get("usedEvidenceRefs", [])
        if isinstance(used_refs, list):
            for ref_id in used_refs:
                if ref_id not in allowed_ref_ids:
                    errors.append(
                        f"usedEvidenceRefs에 허용되지 않은 refId: '{ref_id}'"
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
                else:
                    errors.append(
                        f"claims[{i}].supportingEvidenceRefs가 리스트가 아님"
                    )
        elif claims is not None:
            errors.append("claims가 리스트가 아님")

        return len(errors) == 0, errors
