"""scorer.py — Analysis Agent 출력 자동 채점 엔진.

골든 케이스(정답지)와 에이전트 응답을 비교하여
recall, precision, severity 등 7개 지표를 산출한다.
LLM 불필요 — 순수 Python 문자열/숫자 비교.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

# severity 서열 (숫자가 클수록 심각)
_SEVERITY_ORDINAL: dict[str, int] = {
    "info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4,
}


@dataclass
class EvalResult:
    """단일 골든 케이스 채점 결과."""

    golden_id: str
    timestamp: str = ""
    status: str = "completed"  # completed | failed | error
    metrics: dict[str, Any] = field(default_factory=dict)
    composite_score: float = 0.0
    details: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


def score_response(golden: dict, response: dict) -> EvalResult:
    """골든 케이스 vs 에이전트 응답 → 채점 결과."""
    golden_id = golden.get("id", "unknown")
    expected = golden.get("expected", {})

    # 응답에서 result 추출
    result = response.get("result", {})
    if not result:
        return EvalResult(
            golden_id=golden_id, status="error",
            details={"error": "응답에 result 필드 없음"},
        )

    claims = result.get("claims", [])
    must_find = expected.get("must_find", [])
    must_reject = expected.get("must_reject", [])

    # 1. Recall
    recall, recall_details = _score_recall(claims, must_find)

    # 2. Precision
    precision, precision_details = _score_precision(claims, must_reject)

    # 3. FP Rejection
    fp_rejection, fp_details = _score_fp_rejection(claims, must_reject)

    # 4. Severity Accuracy
    severity_acc = _score_severity(
        result.get("suggestedSeverity"),
        expected.get("severity_range", []),
    )

    # 5. Evidence Validity
    evidence_valid = _score_evidence(result, golden.get("input", {}))

    # 6. CWE Coverage
    cwe_coverage = _score_cwe_coverage(
        claims, expected.get("required_cwe_mentions", []),
    )

    # 7. Detail Heuristics
    detail_heuristics = _score_detail_heuristics(claims)

    # 8. Claim Count
    claim_count_ok = _score_claim_count(
        len(claims),
        expected.get("min_total_claims", 0),
        expected.get("max_total_claims", 99),
    )

    metrics = {
        "recall": recall,
        "precision": precision,
        "fp_rejection": fp_rejection,
        "severity_accuracy": severity_acc,
        "evidence_validity": evidence_valid,
        "cwe_coverage": cwe_coverage,
        "detail_heuristics": detail_heuristics,
        "claim_count_ok": claim_count_ok,
    }

    # Composite score (가중 평균)
    weights = {
        "recall": 0.25,
        "precision": 0.20,
        "fp_rejection": 0.15,
        "severity_accuracy": 0.10,
        "evidence_validity": 0.10,
        "cwe_coverage": 0.10,
        "detail_heuristics_avg": 0.10,
    }
    detail_avg = _avg(list(detail_heuristics.values())) if detail_heuristics else 0.0
    composite = (
        weights["recall"] * recall
        + weights["precision"] * precision
        + weights["fp_rejection"] * fp_rejection
        + weights["severity_accuracy"] * severity_acc
        + weights["evidence_validity"] * evidence_valid
        + weights["cwe_coverage"] * cwe_coverage
        + weights["detail_heuristics_avg"] * detail_avg
    )

    details = {
        "recall_details": recall_details,
        "precision_details": precision_details,
        "fp_details": fp_details,
        "claim_count": len(claims),
    }

    return EvalResult(
        golden_id=golden_id,
        status="completed",
        metrics=metrics,
        composite_score=round(composite, 4),
        details=details,
    )


# ── Claim 매칭 ──────────────────────────────────────────────


def _claim_text(claim: dict) -> str:
    """claim의 statement + detail을 합친 검색 대상 텍스트."""
    parts = []
    if claim.get("statement"):
        parts.append(claim["statement"])
    if claim.get("detail"):
        parts.append(claim["detail"])
    return " ".join(parts).lower()


def _claim_matches_expected(claim: dict, expected_entry: dict) -> bool:
    """claim이 expected_entry의 모든 조건과 매칭되는지 확인."""
    text = _claim_text(claim)
    location = (claim.get("location") or "").lower()

    # CWE 매칭
    cwe = expected_entry.get("cwe", "")
    if cwe and cwe.lower() not in text:
        return False

    # 파일 매칭
    file = expected_entry.get("file", "")
    if file and file.lower() not in location and file.lower() not in text:
        return False

    # 키워드 매칭 (모두 포함)
    keywords = expected_entry.get("keywords", [])
    for kw in keywords:
        if kw.lower() not in text:
            return False

    # 라인 범위 매칭
    line_range = expected_entry.get("line_range")
    if line_range and location:
        line_match = re.search(r":(\d+)", location)
        if line_match:
            line_num = int(line_match.group(1))
            if not (line_range[0] <= line_num <= line_range[1]):
                return False

    return True


# ── 지표별 채점 함수 ─────────────────────────────────────────


def _score_recall(
    claims: list[dict], must_find: list[dict],
) -> tuple[float, list[dict]]:
    """must_find 항목 중 claim에서 발견된 비율."""
    if not must_find:
        return 1.0, []

    details = []
    found = 0
    for mf in must_find:
        matched = any(_claim_matches_expected(c, mf) for c in claims)
        details.append({"expected": mf, "found": matched})
        if matched:
            found += 1

    return found / len(must_find), details


def _score_precision(
    claims: list[dict], must_reject: list[dict],
) -> tuple[float, list[dict]]:
    """claim 중 must_reject에 해당하지 않는 비율."""
    if not claims:
        return 1.0, []

    details = []
    spurious = 0
    for claim in claims:
        is_spurious = any(_claim_matches_expected(claim, mr) for mr in must_reject)
        details.append({
            "claim": claim.get("statement", "")[:80],
            "spurious": is_spurious,
        })
        if is_spurious:
            spurious += 1

    return (len(claims) - spurious) / len(claims), details


def _score_fp_rejection(
    claims: list[dict], must_reject: list[dict],
) -> tuple[float, list[dict]]:
    """must_reject 항목이 claim에 포함되지 않은 비율."""
    if not must_reject:
        return 1.0, []

    details = []
    rejected = 0
    for mr in must_reject:
        matched = any(_claim_matches_expected(c, mr) for c in claims)
        details.append({"reject_item": mr, "correctly_rejected": not matched})
        if not matched:
            rejected += 1

    return rejected / len(must_reject), details


def _score_severity(
    actual: str | None, severity_range: list[str],
) -> float:
    """severity가 정답 범위 내인지 확인. ±1단계 부분 점수."""
    if not severity_range or not actual:
        return 0.5  # 판단 불가

    actual_ord = _SEVERITY_ORDINAL.get(actual.lower(), -1)
    if actual_ord < 0:
        return 0.0

    low = _SEVERITY_ORDINAL.get(severity_range[0].lower(), 0)
    high = _SEVERITY_ORDINAL.get(severity_range[-1].lower(), 4)

    if low <= actual_ord <= high:
        return 1.0
    # ±1단계 이내면 부분 점수
    if abs(actual_ord - low) <= 1 or abs(actual_ord - high) <= 1:
        return 0.5
    return 0.0


def _score_evidence(result: dict, golden_input: dict) -> float:
    """evidence ref 유효성. 사용된 ref가 골든 입력에 정의된 ref인지 확인."""
    used_refs = result.get("usedEvidenceRefs", [])
    if not used_refs:
        return 0.5  # ref 없으면 중립

    # 골든 입력의 evidence refs
    allowed = {r.get("refId", "") for r in golden_input.get("evidence_refs", [])}
    # SAST finding 기반 자동 생성 refs (eref-sast-*)
    for i, f in enumerate(golden_input.get("sast_findings", [])):
        rule = f.get("ruleId", f"finding-{i}")
        allowed.add(f"eref-sast-{rule}")

    if not allowed:
        return 0.5

    valid_count = sum(1 for r in used_refs if r in allowed)
    return valid_count / len(used_refs)


def _score_cwe_coverage(claims: list[dict], required_cwes: list[str]) -> float:
    """필수 CWE 중 하나라도 claim에 언급되면 1.0. 전부 없으면 0.0."""
    if not required_cwes:
        return 1.0

    all_text = " ".join(_claim_text(c) for c in claims)
    found = any(cwe.lower() in all_text for cwe in required_cwes)
    return 1.0 if found else 0.0


def _score_detail_heuristics(claims: list[dict]) -> dict[str, float]:
    """claim detail의 휴리스틱 품질 점수."""
    if not claims:
        return {
            "has_detail": 0.0, "has_attack_scenario": 0.0,
            "has_code_path": 0.0, "has_location": 0.0,
            "detail_length_adequate": 0.0,
        }

    checks = {
        "has_detail": [],
        "has_attack_scenario": [],
        "has_code_path": [],
        "has_location": [],
        "detail_length_adequate": [],
    }

    attack_keywords = ["공격", "attack", "악용", "exploit", "inject", "overflow", "오버플로우"]
    path_keywords = ["호출", "call", "경로", "path", "함수", "function", "→", "->"]

    for claim in claims:
        detail = claim.get("detail") or ""
        detail_lower = detail.lower()
        location = claim.get("location") or ""

        checks["has_detail"].append(1.0 if len(detail) > 50 else 0.0)
        checks["has_attack_scenario"].append(
            1.0 if any(kw in detail_lower for kw in attack_keywords) else 0.0
        )
        checks["has_code_path"].append(
            1.0 if any(kw in detail_lower for kw in path_keywords) else 0.0
        )
        checks["has_location"].append(
            1.0 if re.match(r".+:\d+", location) else 0.0
        )
        checks["detail_length_adequate"].append(1.0 if len(detail) > 200 else 0.0)

    return {k: _avg(v) for k, v in checks.items()}


def _score_claim_count(actual: int, min_count: int, max_count: int) -> bool:
    """claim 수가 허용 범위 내인지."""
    return min_count <= actual <= max_count


# ── 유틸 ─────────────────────────────────────────────────────


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0
