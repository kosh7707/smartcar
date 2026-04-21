"""EvidenceRefSanitizer — evidence refId를 방어적으로 정리하는 후처리기."""

from __future__ import annotations


class EvidenceRefSanitizer:
    """LLM 응답의 evidence refId를 allowed 목록과 대조하여 제거한다."""

    def sanitize(
        self,
        parsed: dict,
        allowed_ref_ids: set[str],
    ) -> tuple[dict, list[str]]:
        """허용되지 않은 refId를 제거한다.

        Returns:
            (sanitized_parsed, corrections) — corrections는 제거 내역 로그
        """
        if not allowed_ref_ids:
            # allowed가 비어있으면 모든 refs를 제거 (검증 불가)
            corrections: list[str] = []
            used = parsed.get("usedEvidenceRefs") if "usedEvidenceRefs" in parsed else None
            if isinstance(used, list) and used:
                for ref in used:
                    corrections.append(f"usedEvidenceRefs: '{ref}' 제거 (allowed set 비어있음)")
                parsed["usedEvidenceRefs"] = []
            claims = parsed.get("claims", [])
            if isinstance(claims, list):
                for i, claim in enumerate(claims):
                    if not isinstance(claim, dict):
                        continue
                    sup = claim.get("supportingEvidenceRefs") if "supportingEvidenceRefs" in claim else None
                    if isinstance(sup, list) and sup:
                        for ref in sup:
                            corrections.append(f"claims[{i}].supportingEvidenceRefs: '{ref}' 제거 (allowed set 비어있음)")
                        claim["supportingEvidenceRefs"] = []
            return parsed, corrections

        corrections: list[str] = []
        # usedEvidenceRefs 정리
        used_refs = parsed.get("usedEvidenceRefs") if "usedEvidenceRefs" in parsed else None
        if isinstance(used_refs, list):
            parsed["usedEvidenceRefs"] = self._sanitize_ref_list(
                used_refs, allowed_ref_ids, "usedEvidenceRefs", corrections,
            )

        # claims[].supportingEvidenceRefs 정리
        claims = parsed.get("claims", [])
        if isinstance(claims, list):
            for i, claim in enumerate(claims):
                if not isinstance(claim, dict):
                    continue
                supporting = claim.get("supportingEvidenceRefs") if "supportingEvidenceRefs" in claim else None
                if isinstance(supporting, list):
                    claim["supportingEvidenceRefs"] = self._sanitize_ref_list(
                        supporting, allowed_ref_ids, f"claims[{i}].supportingEvidenceRefs", corrections,
                    )

        return parsed, corrections

    def _sanitize_ref_list(
        self,
        refs: list,
        allowed: set[str],
        location: str,
        corrections: list[str],
    ) -> list[str]:
        """refId 리스트를 정리한다. 유효 → 유지, 허용되지 않음 → 제거."""
        sanitized: list[str] = []
        seen: set[str] = set()

        for ref_id in refs:
            if not isinstance(ref_id, str):
                continue

            if ref_id in allowed:
                if ref_id not in seen:
                    sanitized.append(ref_id)
                    seen.add(ref_id)
                continue

            corrections.append(f"{location}: '{ref_id}' 제거 (허용되지 않은 refId)")

        return sanitized
