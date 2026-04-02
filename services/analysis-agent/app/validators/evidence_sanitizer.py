"""EvidenceRefSanitizer — 환각 evidence refId를 교정하거나 제거하는 후처리기."""

from __future__ import annotations

import difflib


_MATCH_THRESHOLD = 0.6


class EvidenceRefSanitizer:
    """LLM 응답의 evidence refId를 allowed 목록과 대조하여 교정/제거한다."""

    def sanitize(
        self,
        parsed: dict,
        allowed_ref_ids: set[str],
    ) -> tuple[dict, list[str]]:
        """환각 refId를 교정(fuzzy match) 또는 제거한다.

        Returns:
            (sanitized_parsed, corrections) — corrections는 교정/제거 내역 로그
        """
        if not allowed_ref_ids:
            # allowed가 비어있으면 모든 refs를 제거 (검증 불가)
            corrections: list[str] = []
            used = parsed.get("usedEvidenceRefs", [])
            if isinstance(used, list) and used:
                for ref in used:
                    corrections.append(f"usedEvidenceRefs: '{ref}' 제거 (allowed set 비어있음)")
                parsed["usedEvidenceRefs"] = []
            claims = parsed.get("claims", [])
            if isinstance(claims, list):
                for i, claim in enumerate(claims):
                    if not isinstance(claim, dict):
                        continue
                    sup = claim.get("supportingEvidenceRefs", [])
                    if isinstance(sup, list) and sup:
                        for ref in sup:
                            corrections.append(f"claims[{i}].supportingEvidenceRefs: '{ref}' 제거 (allowed set 비어있음)")
                        claim["supportingEvidenceRefs"] = []
            return parsed, corrections

        corrections: list[str] = []
        allowed_list = sorted(allowed_ref_ids)

        # usedEvidenceRefs 교정
        used_refs = parsed.get("usedEvidenceRefs", [])
        if isinstance(used_refs, list):
            parsed["usedEvidenceRefs"] = self._sanitize_ref_list(
                used_refs, allowed_ref_ids, allowed_list, "usedEvidenceRefs", corrections,
            )

        # claims[].supportingEvidenceRefs 교정
        claims = parsed.get("claims", [])
        if isinstance(claims, list):
            for i, claim in enumerate(claims):
                if not isinstance(claim, dict):
                    continue
                supporting = claim.get("supportingEvidenceRefs", [])
                if isinstance(supporting, list):
                    claim["supportingEvidenceRefs"] = self._sanitize_ref_list(
                        supporting, allowed_ref_ids, allowed_list,
                        f"claims[{i}].supportingEvidenceRefs", corrections,
                    )

        return parsed, corrections

    def _sanitize_ref_list(
        self,
        refs: list,
        allowed: set[str],
        allowed_list: list[str],
        location: str,
        corrections: list[str],
    ) -> list[str]:
        """refId 리스트를 교정한다. 유효 → 유지, 환각 → 매칭 또는 제거."""
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

            # fuzzy match
            match = self._find_best_match(ref_id, allowed_list)
            if match:
                corrections.append(f"{location}: '{ref_id}' → '{match}'")
                if match not in seen:
                    sanitized.append(match)
                    seen.add(match)
            else:
                corrections.append(f"{location}: '{ref_id}' 제거 (매칭 실패)")

        return sanitized

    @staticmethod
    def _find_best_match(ref_id: str, allowed_list: list[str]) -> str | None:
        """allowed 목록에서 가장 유사한 refId를 찾는다."""
        matches = difflib.get_close_matches(
            ref_id, allowed_list, n=1, cutoff=_MATCH_THRESHOLD,
        )
        return matches[0] if matches else None
