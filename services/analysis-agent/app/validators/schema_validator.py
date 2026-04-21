from __future__ import annotations

from app.schemas.response import ValidationInfo
from app.types import TaskType

_REQUIRED_FIELDS = (
    "summary",
    "claims",
    "caveats",
    "usedEvidenceRefs",
    "suggestedSeverity",
    "needsHumanReview",
    "recommendedNextSteps",
    "policyFlags",
)
_SEVERITIES = {"critical", "high", "medium", "low", "info"}


class SchemaValidator:
    """LLM 응답의 구조적 유효성을 검증한다."""

    def validate(self, parsed: dict, task_type: TaskType) -> ValidationInfo:
        errors: list[str] = []

        for f in _REQUIRED_FIELDS:
            if f not in parsed:
                errors.append(f"필수 필드 '{f}' 누락")

        summary = parsed.get("summary")
        if not isinstance(summary, str):
            errors.append("'summary'가 문자열이 아님")
        elif not summary.strip():
            errors.append("'summary'가 비어 있음")

        claims = parsed.get("claims")
        if isinstance(claims, list):
            for i, claim in enumerate(claims):
                if not isinstance(claim, dict):
                    errors.append(f"claims[{i}]: dict가 아님")
                    continue
                if "statement" not in claim:
                    errors.append(f"claims[{i}]: 'statement' 누락")
                elif not isinstance(claim.get("statement"), str):
                    errors.append(f"claims[{i}]: 'statement'가 문자열이 아님")
                elif not claim.get("statement", "").strip():
                    errors.append(f"claims[{i}]: 'statement'가 비어 있음")
                if "detail" not in claim:
                    errors.append(f"claims[{i}]: 'detail' 누락")
                elif not isinstance(claim.get("detail"), str):
                    errors.append(f"claims[{i}]: 'detail'이 문자열이 아님")
                elif not claim.get("detail", "").strip():
                    errors.append(f"claims[{i}]: 'detail'이 비어 있음")
                if "supportingEvidenceRefs" not in claim:
                    errors.append(f"claims[{i}]: 'supportingEvidenceRefs' 누락")
                elif not isinstance(claim.get("supportingEvidenceRefs"), list):
                    errors.append(f"claims[{i}]: 'supportingEvidenceRefs'가 리스트가 아님")
                else:
                    for j, ref in enumerate(claim.get("supportingEvidenceRefs", [])):
                        if not isinstance(ref, str):
                            errors.append(f"claims[{i}].supportingEvidenceRefs[{j}]가 문자열이 아님")
                if "location" not in claim:
                    errors.append(f"claims[{i}]: 'location' 누락")
                elif not isinstance(claim.get("location"), str):
                    errors.append(f"claims[{i}]: 'location'이 문자열이 아님")
                elif not claim.get("location", "").strip():
                    errors.append(f"claims[{i}]: 'location'이 비어 있음")
        else:
            errors.append("'claims'가 리스트가 아님")

        caveats = parsed.get("caveats")
        if not isinstance(caveats, list):
            errors.append("'caveats'가 리스트가 아님")
        elif isinstance(caveats, list):
            for i, caveat in enumerate(caveats):
                if not isinstance(caveat, str):
                    errors.append(f"caveats[{i}]가 문자열이 아님")

        used_refs = parsed.get("usedEvidenceRefs")
        if not isinstance(used_refs, list):
            errors.append("'usedEvidenceRefs'가 리스트가 아님")
        elif isinstance(used_refs, list):
            for i, ref in enumerate(used_refs):
                if not isinstance(ref, str):
                    errors.append(f"usedEvidenceRefs[{i}]가 문자열이 아님")

        suggested_severity = parsed.get("suggestedSeverity")
        if not isinstance(suggested_severity, str):
            errors.append("'suggestedSeverity'가 문자열이 아님")
        elif suggested_severity not in _SEVERITIES:
            errors.append(f"suggestedSeverity({suggested_severity})가 허용 범위를 벗어남")

        needs_human_review = parsed.get("needsHumanReview")
        if not isinstance(needs_human_review, bool):
            errors.append("'needsHumanReview'가 bool이 아님")

        recommended_next_steps = parsed.get("recommendedNextSteps")
        if not isinstance(recommended_next_steps, list):
            errors.append("'recommendedNextSteps'가 리스트가 아님")
        elif isinstance(recommended_next_steps, list):
            for i, step in enumerate(recommended_next_steps):
                if not isinstance(step, str):
                    errors.append(f"recommendedNextSteps[{i}]가 문자열이 아님")

        policy_flags = parsed.get("policyFlags")
        if not isinstance(policy_flags, list):
            errors.append("'policyFlags'가 리스트가 아님")
        elif isinstance(policy_flags, list):
            for i, flag in enumerate(policy_flags):
                if not isinstance(flag, str):
                    errors.append(f"policyFlags[{i}]가 문자열이 아님")

        confidence = parsed.get("confidence")
        if confidence is not None:
            try:
                val = float(confidence)
                if not 0.0 <= val <= 1.0:
                    errors.append(f"confidence({val})가 0~1 범위를 벗어남")
            except (TypeError, ValueError):
                errors.append(f"confidence가 숫자가 아님: {confidence}")

        if task_type == TaskType.TEST_PLAN_PROPOSE:
            plan = parsed.get("plan")
            if plan is None:
                errors.append("test-plan-propose 응답에 'plan' 필드 누락")
            elif isinstance(plan, dict):
                if "objective" not in plan:
                    errors.append("plan에 'objective' 필드 누락")
            else:
                errors.append("'plan'이 dict가 아님")

        return ValidationInfo(valid=len(errors) == 0, errors=errors)
