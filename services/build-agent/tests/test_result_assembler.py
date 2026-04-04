"""ResultAssembler 단위 테스트."""

from __future__ import annotations

import json

import pytest

from agent_shared.schemas.agent import BudgetState, ToolTraceStep
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from app.types import FailureCode, TaskStatus, TaskType


# ── 헬퍼 ──────────────────────────────────────────────────


def _make_session(
    budget: BudgetState | None = None,
    evidence_refs: list[EvidenceRef] | None = None,
    task_type: TaskType = TaskType.BUILD_RESOLVE,
    termination_reason: str = "",
) -> AgentSession:
    refs = evidence_refs or [
        EvidenceRef(
            refId="ref-001",
            artifactId="art-001",
            artifactType="sast_report",
            locatorType="full_content",
            locator={"path": "/tmp/report.json"},
        ),
    ]
    req = TaskRequest(
        taskType=task_type,
        taskId="test-assemble-001",
        context=Context(trusted={"finding": {"id": "CVE-2025-0001"}}),
        evidenceRefs=refs,
    )
    session = AgentSession(
        request=req,
        budget=budget or BudgetState(
            max_steps=10,
            max_completion_tokens=20000,
            max_cheap_calls=20,
            max_medium_calls=5,
            max_expensive_calls=5,
            max_consecutive_no_evidence=6,
        ),
    )
    if termination_reason:
        session.set_termination_reason(termination_reason)
    return session


def _valid_json_content() -> str:
    return json.dumps({
        "summary": "Build failure resolved",
        "claims": [
            {
                "statement": "Missing dependency found",
                "supportingEvidenceRefs": ["ref-001"],
            }
        ],
        "caveats": [],
        "usedEvidenceRefs": ["ref-001"],
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })


# ── build: 정상 JSON 파싱 ──────────────────────────────


def test_build_success_from_valid_json() -> None:
    """유효한 JSON 응답 → TaskSuccessResponse."""
    assembler = ResultAssembler()
    session = _make_session()
    resp = assembler.build(_valid_json_content(), session)
    assert isinstance(resp, TaskSuccessResponse)
    assert resp.status == TaskStatus.COMPLETED
    assert resp.promptVersion == "build-v3"
    assert resp.result.summary == "Build failure resolved"
    assert len(resp.result.claims) == 1


# ── build: 비JSON fallback ─────────────────────────────


def test_build_fallback_on_invalid_json() -> None:
    """비JSON 응답 → fallback, policyFlags에 'unstructured_response' 포함."""
    assembler = ResultAssembler()
    session = _make_session()
    resp = assembler.build("This is plain text, not JSON.", session)
    assert isinstance(resp, TaskSuccessResponse)
    assert "unstructured_response" in resp.result.policyFlags


def test_build_sanitizes_invalid_evidence_refs() -> None:
    """환각 evidence ref는 제거하고 유효한 ref만 유지한다."""
    assembler = ResultAssembler()
    session = _make_session(evidence_refs=[], task_type=TaskType.SDK_ANALYZE)
    session.trace.append(ToolTraceStep(
        step_id="step_sdk_01",
        turn_number=1,
        tool="try_build",
        args_hash="hash-sdk-01",
        cost_tier="expensive",
        duration_ms=10,
        success=True,
        new_evidence_refs=["eref-build-success"],
    ))
    content = json.dumps({
        "summary": "SDK 분석 완료",
        "claims": [
            {
                "statement": "SDK 환경을 확인했다",
                "supportingEvidenceRefs": [
                    "ls -la /home/kosh/sdks/ti-am335x",
                    "eref-build-success",
                ],
            }
        ],
        "caveats": [],
        "usedEvidenceRefs": [
            "ls -la /home/kosh/sdks/ti-am335x",
            "eref-build-success",
        ],
        "sdkProfile": {
            "compiler": "/home/kosh/sdks/ti-am335x/bin/arm-none-linux-gnueabihf-gcc",
            "compilerPrefix": "arm-none-linux-gnueabihf",
            "gccVersion": "9.2.1",
            "targetArch": "armv7-a",
            "languageStandard": "c11",
            "sysroot": "/home/kosh/sdks/ti-am335x/sysroot",
            "environmentSetup": "linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi",
            "includePaths": [],
            "defines": {},
        },
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    resp = assembler.build(content, session)

    assert isinstance(resp, TaskSuccessResponse)
    assert resp.status == TaskStatus.COMPLETED
    assert resp.result.usedEvidenceRefs == ["eref-build-success"]
    assert resp.result.claims[0].supportingEvidenceRefs == ["eref-build-success"]


# ── build_from_exhaustion: _TERMINATION_MAP ────────────


def test_exhaustion_max_steps() -> None:
    """reason='max_steps' → MAX_STEPS_EXCEEDED."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="max_steps")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.MAX_STEPS_EXCEEDED
    assert resp.status == TaskStatus.BUDGET_EXCEEDED
    assert resp.retryable is False


def test_exhaustion_budget() -> None:
    """reason='budget_exhausted' → TOKEN_BUDGET_EXCEEDED."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="budget_exhausted")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.TOKEN_BUDGET_EXCEEDED
    assert resp.retryable is False


def test_exhaustion_timeout() -> None:
    """reason='timeout' → TIMEOUT, retryable=True."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="timeout")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.TIMEOUT
    assert resp.status == TaskStatus.TIMEOUT
    assert resp.retryable is True


def test_exhaustion_no_evidence() -> None:
    """reason='no_new_evidence' → INSUFFICIENT_EVIDENCE."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="no_new_evidence")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.INSUFFICIENT_EVIDENCE


def test_exhaustion_all_tiers() -> None:
    """reason='all_tiers_exhausted' → ALL_TOOLS_EXHAUSTED."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="all_tiers_exhausted")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.ALL_TOOLS_EXHAUSTED


def test_exhaustion_unknown_reason() -> None:
    """알 수 없는 reason → fallback TOKEN_BUDGET_EXCEEDED."""
    assembler = ResultAssembler()
    session = _make_session(termination_reason="????")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.TOKEN_BUDGET_EXCEEDED
    assert resp.status == TaskStatus.BUDGET_EXCEEDED
