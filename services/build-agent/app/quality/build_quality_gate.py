from __future__ import annotations

from app.types import FailureCode


def build_outcome_value_for(code: FailureCode | None) -> str:
    """Map Build Agent failure codes to stable build-domain outcome labels.

    This is Critic/QualityGate classification, not task failure authority.
    Keep currently emitted additive fields stable unless a separate public
    compatibility gate promotes or changes their semantics.
    """
    if code is None:
        return "inconclusive"
    return {
        FailureCode.COMPILE_FAILED: "compile_failed",
        FailureCode.MISSING_BUILD_MATERIALS: "missing_materials",
        FailureCode.SDK_MISMATCH: "sdk_mismatch",
        FailureCode.EXPECTED_ARTIFACTS_MISMATCH: "artifact_mismatch",
        FailureCode.BUILD_SCRIPT_SYNTHESIS_FAILED: "inconclusive",
        FailureCode.INVALID_GROUNDING: "inconclusive",
    }.get(code, "inconclusive")
