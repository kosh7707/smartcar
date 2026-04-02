"""scorer.py 단위 테스트 — 골든 케이스 채점 로직 검증."""

import pytest

from eval.scorer import score_response, _claim_matches_expected, EvalResult


# ── 골든 케이스 fixture ──────────────────────────────────────

_GOLDEN_CWE78 = {
    "id": "cwe78-test",
    "expected": {
        "must_find": [
            {"cwe": "CWE-78", "file": "main.c", "keywords": ["getenv", "system"]},
        ],
        "must_reject": [],
        "severity_range": ["high", "critical"],
        "min_total_claims": 1,
        "max_total_claims": 3,
        "required_cwe_mentions": ["CWE-78"],
    },
    "input": {
        "evidence_refs": [{"refId": "eref-sast-system-1"}],
        "sast_findings": [{"ruleId": "system-1"}],
    },
}

_GOLDEN_FP_REJECT = {
    "id": "fp-reject-test",
    "expected": {
        "must_find": [],
        "must_reject": [
            {"cwe": "CWE-120", "file": "safe.c", "keywords": ["snprintf"]},
        ],
        "severity_range": ["info", "low"],
        "min_total_claims": 0,
        "max_total_claims": 1,
        "required_cwe_mentions": [],
    },
    "input": {
        "evidence_refs": [],
        "sast_findings": [],
    },
}


# ── _claim_matches_expected ───────────────────────────────


def test_claim_matches_cwe_and_file():
    claim = {
        "statement": "CWE-78 OS command injection via getenv()",
        "detail": "getenv()로 환경변수를 읽어 system()에 전달",
        "location": "main.c:42",
    }
    expected = {"cwe": "CWE-78", "file": "main.c", "keywords": ["getenv", "system"]}
    assert _claim_matches_expected(claim, expected) is True


def test_claim_no_match_wrong_cwe():
    claim = {
        "statement": "CWE-120 buffer overflow",
        "detail": "gets() 사용",
        "location": "input.c:15",
    }
    expected = {"cwe": "CWE-78", "file": "main.c"}
    assert _claim_matches_expected(claim, expected) is False


def test_claim_matches_line_range():
    claim = {
        "statement": "CWE-120 overflow",
        "detail": "buffer overflow",
        "location": "input.c:32",
    }
    expected = {"cwe": "CWE-120", "file": "input.c", "line_range": [28, 35]}
    assert _claim_matches_expected(claim, expected) is True


def test_claim_outside_line_range():
    claim = {
        "statement": "CWE-120 overflow",
        "detail": "buffer overflow",
        "location": "input.c:15",
    }
    expected = {"cwe": "CWE-120", "file": "input.c", "line_range": [28, 35]}
    assert _claim_matches_expected(claim, expected) is False


def test_claim_missing_keyword():
    claim = {
        "statement": "CWE-78 command injection",
        "detail": "system() 호출",
        "location": "main.c:42",
    }
    # "getenv" 키워드가 detail에 없음
    expected = {"cwe": "CWE-78", "file": "main.c", "keywords": ["getenv", "system"]}
    assert _claim_matches_expected(claim, expected) is False


# ── score_response: 정상 응답 ──────────────────────────────


def test_perfect_score():
    """모든 expected를 정확히 맞춘 경우."""
    response = {
        "result": {
            "claims": [
                {
                    "statement": "CWE-78 OS command injection: getenv()로 읽은 값이 system()에 전달",
                    "detail": "getenv('USER_CMD')의 반환값이 검증 없이 system() 함수에 전달되어 "
                              "공격자가 임의 OS 명령을 실행할 수 있다. 호출 경로: main→handle_command→system.",
                    "supportingEvidenceRefs": ["eref-sast-system-1"],
                    "location": "main.c:42",
                },
            ],
            "caveats": ["ASLR 적용 여부 미확인"],
            "usedEvidenceRefs": ["eref-sast-system-1"],
            "suggestedSeverity": "critical",
        },
    }
    result = score_response(_GOLDEN_CWE78, response)

    assert result.status == "completed"
    assert result.metrics["recall"] == 1.0
    assert result.metrics["precision"] == 1.0
    assert result.metrics["fp_rejection"] == 1.0
    assert result.metrics["severity_accuracy"] == 1.0
    assert result.metrics["cwe_coverage"] == 1.0
    assert result.composite_score > 0.8


def test_missed_finding_low_recall():
    """expected를 놓친 경우 recall이 0."""
    response = {
        "result": {
            "claims": [
                {
                    "statement": "코드 스타일 문제: 변수명이 불명확합니다",
                    "detail": "buf라는 변수명 개선 필요",
                    "supportingEvidenceRefs": [],
                    "location": "main.c:10",
                },
            ],
            "caveats": [],
            "usedEvidenceRefs": [],
            "suggestedSeverity": "info",
        },
    }
    result = score_response(_GOLDEN_CWE78, response)

    assert result.metrics["recall"] == 0.0
    assert result.metrics["cwe_coverage"] == 0.0
    assert result.composite_score < 0.5


def test_fp_rejection_success():
    """FP 거부 케이스: claim이 0개면 fp_rejection = 1.0."""
    response = {
        "result": {
            "claims": [],
            "caveats": ["snprintf로 안전하게 처리됨"],
            "usedEvidenceRefs": [],
            "suggestedSeverity": "info",
        },
    }
    result = score_response(_GOLDEN_FP_REJECT, response)

    assert result.metrics["fp_rejection"] == 1.0
    assert result.metrics["claim_count_ok"] is True


def test_fp_rejection_failure():
    """FP를 잡지 못한 경우 (claim에 must_reject 항목 포함)."""
    response = {
        "result": {
            "claims": [
                {
                    "statement": "CWE-120 buffer overflow: snprintf에서 오버플로우 가능",
                    "detail": "snprintf 호출에서 버퍼 초과 가능성",
                    "supportingEvidenceRefs": [],
                    "location": "safe.c:12",
                },
            ],
            "caveats": [],
            "usedEvidenceRefs": [],
            "suggestedSeverity": "high",
        },
    }
    result = score_response(_GOLDEN_FP_REJECT, response)

    assert result.metrics["fp_rejection"] == 0.0
    assert result.metrics["precision"] == 0.0


def test_severity_partial_score():
    """severity가 ±1단계면 부분 점수."""
    response = {
        "result": {
            "claims": [
                {
                    "statement": "CWE-78 command injection getenv system",
                    "detail": "getenv→system 경로",
                    "supportingEvidenceRefs": ["eref-sast-system-1"],
                    "location": "main.c:42",
                },
            ],
            "caveats": [],
            "usedEvidenceRefs": ["eref-sast-system-1"],
            "suggestedSeverity": "medium",  # 정답: high-critical → medium은 1단계 벗어남
        },
    }
    result = score_response(_GOLDEN_CWE78, response)

    assert result.metrics["severity_accuracy"] == 0.5


def test_empty_response_error():
    """result 필드 없는 응답은 error."""
    result = score_response(_GOLDEN_CWE78, {"status": "failed"})
    assert result.status == "error"


def test_detail_heuristics():
    """detail 휴리스틱이 올바르게 계산되는지."""
    response = {
        "result": {
            "claims": [
                {
                    "statement": "CWE-78 command injection getenv system",
                    "detail": (
                        "공격자가 USER_CMD 환경변수에 악성 명령을 주입하면, "
                        "handle_command() 함수 → snprintf → system() 호출 경로를 통해 "
                        "임의 OS 명령이 실행된다. ECU 환경에서 ASLR/DEP 부재로 인해 "
                        "exploit 성공률이 높으며, system() 호출자 권한(root)으로 실행되어 "
                        "전체 시스템 제어가 가능하다. 특히 임베디드 환경에서는 "
                        "프로세스 격리가 미흡하여 공격 영향 범위가 전체 ECU로 확대될 수 있다."
                    ),
                    "supportingEvidenceRefs": ["eref-sast-system-1"],
                    "location": "main.c:42",
                },
            ],
            "caveats": [],
            "usedEvidenceRefs": ["eref-sast-system-1"],
            "suggestedSeverity": "critical",
        },
    }
    result = score_response(_GOLDEN_CWE78, response)
    heuristics = result.metrics["detail_heuristics"]

    assert heuristics["has_detail"] == 1.0
    assert heuristics["has_attack_scenario"] == 1.0
    assert heuristics["has_code_path"] == 1.0
    assert heuristics["has_location"] == 1.0
    assert heuristics["detail_length_adequate"] == 1.0
