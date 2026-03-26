from __future__ import annotations

from app.schemas.response import ValidationInfo
from app.types import TaskType

_REQUIRED_FIELDS = ("summary", "claims", "caveats", "usedEvidenceRefs")


class SchemaValidator:
    """LLM 응답의 구조적 유효성을 검증한다."""

    def validate(self, parsed: dict, task_type: TaskType) -> ValidationInfo:
        errors: list[str] = []

        for f in _REQUIRED_FIELDS:
            if f not in parsed:
                errors.append(f"필수 필드 '{f}' 누락")

        claims = parsed.get("claims")
        if isinstance(claims, list):
            for i, claim in enumerate(claims):
                if not isinstance(claim, dict):
                    errors.append(f"claims[{i}]: dict가 아님")
                    continue
                if "statement" not in claim:
                    errors.append(f"claims[{i}]: 'statement' 누락")
                if "supportingEvidenceRefs" not in claim:
                    errors.append(f"claims[{i}]: 'supportingEvidenceRefs' 누락")
        elif claims is not None:
            errors.append("'claims'가 리스트가 아님")

        confidence = parsed.get("confidence")
        if confidence is not None:
            try:
                val = float(confidence)
                if not 0.0 <= val <= 1.0:
                    errors.append(f"confidence({val})가 0~1 범위를 벗어남")
            except (TypeError, ValueError):
                errors.append(f"confidence가 숫자가 아님: {confidence}")

        if hasattr(TaskType, "TEST_PLAN_PROPOSE") and task_type == TaskType.TEST_PLAN_PROPOSE:
            plan = parsed.get("plan")
            if plan is None:
                errors.append("test-plan-propose 응답에 'plan' 필드 누락")
            elif isinstance(plan, dict):
                if "objective" not in plan:
                    errors.append("plan에 'objective' 필드 누락")
            else:
                errors.append("'plan'이 dict가 아님")

        return ValidationInfo(valid=len(errors) == 0, errors=errors)
