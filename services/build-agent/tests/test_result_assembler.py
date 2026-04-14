"""ResultAssembler 단위 테스트."""

from __future__ import annotations

import json

from agent_shared.schemas.agent import BudgetState, ToolTraceStep
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from app.types import FailureCode, TaskStatus, TaskType


def _make_session(
    budget: BudgetState | None = None,
    evidence_refs: list[EvidenceRef] | None = None,
    task_type: TaskType = TaskType.BUILD_RESOLVE,
    termination_reason: str = "",
    metadata: dict | None = None,
    trusted: dict | None = None,
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
        context=Context(trusted=trusted or {"finding": {"id": "CVE-2025-0001"}}),
        evidenceRefs=refs,
        metadata=metadata,
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


def _strict_metadata(expected_artifacts: list[str] | None = None) -> dict:
    metadata = {
        "contractVersion": "build-resolve-v1",
        "strictMode": True,
        "buildMode": "native",
    }
    if expected_artifacts is not None:
        metadata["expectedArtifacts"] = expected_artifacts
    return metadata


def _record_build_success(session: AgentSession, refs: list[str] | None = None) -> None:
    session.trace.append(ToolTraceStep(
        step_id="step_build_01",
        turn_number=1,
        tool="try_build",
        args_hash="hash-build-01",
        cost_tier="expensive",
        duration_ms=10,
        success=True,
        new_evidence_refs=refs or ["eref-build-success"],
    ))


def _valid_build_json(*, produced_artifacts: list[object] | None = None) -> str:
    build_result: dict[str, object] = {
        "success": True,
        "buildCommand": "bash build-aegis/aegis-build.sh",
        "buildScript": "build-aegis/aegis-build.sh",
        "buildDir": "build-aegis",
        "errorLog": None,
    }
    if produced_artifacts is not None:
        build_result["producedArtifacts"] = produced_artifacts
    return json.dumps({
        "summary": "Build failure resolved",
        "claims": [
            {
                "statement": "Missing dependency found",
                "supportingEvidenceRefs": ["ref-001"],
            },
        ],
        "caveats": [],
        "usedEvidenceRefs": ["ref-001"],
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
        "buildResult": build_result,
    })


def test_build_success_from_valid_json() -> None:
    """strict compile contract + build evidence → TaskSuccessResponse."""
    assembler = ResultAssembler()
    session = _make_session(metadata=_strict_metadata())
    _record_build_success(session)

    resp = assembler.build(_valid_build_json(), session)

    assert isinstance(resp, TaskSuccessResponse)
    assert resp.status == TaskStatus.COMPLETED
    assert resp.contractVersion == "build-resolve-v1"
    assert resp.strictMode is True
    assert resp.promptVersion == "build-v3"
    assert resp.result.summary == "Build failure resolved"
    assert len(resp.result.claims) == 1
    assert resp.result.buildResult is not None
    assert resp.result.buildResult.success is True
    assert resp.result.buildResult.declaredMode == "native"


def test_build_success_includes_explicit_build_preparation_bundle() -> None:
    """build-resolve 성공 응답은 다음 단계용 buildPreparation을 함께 제공한다."""
    assembler = ResultAssembler()
    session = _make_session(
        metadata=_strict_metadata(expected_artifacts=["build-aegis/gateway"]),
        trusted={
            "projectPath": "/tmp/project",
            "subprojectPath": "gateway",
            "subprojectName": "gateway",
            "buildEnvironment": {"CC": "arm-none-linux-gnueabihf-gcc"},
            "provenance": {"buildSnapshotId": "bsnap-1", "buildUnitId": "bunit-1"},
        },
    )
    _record_build_success(session)

    resp = assembler.build(
        _valid_build_json(produced_artifacts=[{"path": "build-aegis/gateway", "kind": "file"}]),
        session,
    )

    assert isinstance(resp, TaskSuccessResponse)
    assert resp.result.buildPreparation is not None
    assert resp.result.buildPreparation.buildCommand == "bash build-aegis/aegis-build.sh"
    assert resp.result.buildPreparation.buildEnvironment == {"CC": "arm-none-linux-gnueabihf-gcc"}
    assert resp.result.buildPreparation.provenance == {
        "buildSnapshotId": "bsnap-1",
        "buildUnitId": "bunit-1",
    }
    assert resp.result.buildPreparation.expectedArtifacts == ["gateway"]
    assert resp.result.buildPreparation.producedArtifacts == ["build-aegis/gateway"]


def test_build_fallback_on_invalid_json_becomes_strict_failure() -> None:
    """strict compile contract에서는 비JSON fallback을 성공으로 처리하지 않는다."""
    assembler = ResultAssembler()
    session = _make_session(metadata=_strict_metadata())

    resp = assembler.build("This is plain text, not JSON.", session)

    assert isinstance(resp, TaskFailureResponse)
    assert resp.status == TaskStatus.VALIDATION_FAILED
    assert resp.contractVersion == "build-resolve-v1"
    assert resp.failureCode == FailureCode.BUILD_SCRIPT_SYNTHESIS_FAILED
    assert resp.failureContext is not None
    assert resp.failureContext.strictMode is True


def test_build_sanitizes_invalid_evidence_refs() -> None:
    """환각 evidence ref는 제거하고 유효한 ref만 유지한다."""
    assembler = ResultAssembler()
    session = _make_session(evidence_refs=[], task_type=TaskType.SDK_ANALYZE)
    _record_build_success(session)
    content = json.dumps({
        "summary": "SDK 분석 완료",
        "claims": [
            {
                "statement": "SDK 환경을 확인했다",
                "supportingEvidenceRefs": [
                    "ls -la /home/kosh/sdks/ti-am335x",
                    "eref-build-success",
                ],
            },
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


def test_strict_build_requires_success_evidence() -> None:
    assembler = ResultAssembler()
    session = _make_session(metadata=_strict_metadata())

    resp = assembler.build(_valid_build_json(), session)

    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.INVALID_GROUNDING
    assert resp.failureContext is not None
    assert resp.failureContext.buildCommand == "bash build-aegis/aegis-build.sh"


def test_strict_build_classifies_sdk_mismatch() -> None:
    assembler = ResultAssembler()
    session = _make_session(metadata=_strict_metadata())
    content = json.dumps({
        "summary": "SDK 설정 실패",
        "claims": [],
        "caveats": ["arm-none-linux-gnueabihf-gcc: command not found"],
        "usedEvidenceRefs": ["ref-001"],
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
        "buildResult": {
            "success": False,
            "buildCommand": "bash build-aegis/aegis-build.sh",
            "buildScript": "build-aegis/aegis-build.sh",
            "buildDir": "build-aegis",
            "errorLog": "toolchain lookup failed: arm-none-linux-gnueabihf-gcc: command not found",
        },
    })

    resp = assembler.build(content, session)

    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.SDK_MISMATCH
    assert resp.failureContext is not None
    assert resp.failureContext.strictMode is True


def test_strict_build_detects_expected_artifact_mismatch() -> None:
    assembler = ResultAssembler()
    session = _make_session(metadata=_strict_metadata(expected_artifacts=["gateway"]))
    _record_build_success(session)

    resp = assembler.build(
        _valid_build_json(produced_artifacts=[{"path": "build/bin/helper"}]),
        session,
    )

    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.EXPECTED_ARTIFACTS_MISMATCH
    assert resp.failureContext is not None
    assert resp.failureContext.expectedArtifacts == ["gateway"]
    assert resp.failureContext.missingArtifacts == ["gateway"]


def test_strict_build_records_artifact_verification_on_success() -> None:
    assembler = ResultAssembler()
    session = _make_session(metadata=_strict_metadata(expected_artifacts=["gateway"]))
    _record_build_success(session)

    resp = assembler.build(
        _valid_build_json(produced_artifacts=[{"path": "build/bin/gateway"}]),
        session,
    )

    assert isinstance(resp, TaskSuccessResponse)
    assert resp.result.buildResult is not None
    assert resp.result.buildResult.artifactVerification is not None
    assert resp.result.buildResult.artifactVerification.matched is True
    assert resp.result.buildResult.artifactVerification.expected == ["gateway"]


def test_strict_build_infers_expected_artifact_from_filesystem(tmp_path) -> None:
    project_root = tmp_path / "project"
    build_dir = project_root / "build-aegis"
    build_dir.mkdir(parents=True)
    (build_dir / "certificate-maker").write_text("binary")

    assembler = ResultAssembler()
    session = _make_session(
        metadata=_strict_metadata(expected_artifacts=["certificate-maker"]),
        trusted={
            "projectPath": str(project_root),
            "subprojectPath": ".",
            "subprojectName": "certificate-maker",
        },
    )
    _record_build_success(session)

    resp = assembler.build(_valid_build_json(produced_artifacts=[]), session)

    assert isinstance(resp, TaskSuccessResponse)
    assert resp.result.buildResult is not None
    produced_paths = [artifact.path for artifact in resp.result.buildResult.producedArtifacts]
    assert "build-aegis/certificate-maker" in produced_paths
    assert resp.result.buildResult.artifactVerification is not None
    assert resp.result.buildResult.artifactVerification.matched is True


def test_strict_build_infers_artifact_from_build_script_directory(tmp_path) -> None:
    project_root = tmp_path / "project"
    build_dir = project_root / "build-aegis-custom"
    build_dir.mkdir(parents=True)
    (build_dir / "certificate-maker").write_text("binary")

    assembler = ResultAssembler()
    session = _make_session(
        metadata=_strict_metadata(expected_artifacts=["certificate-maker"]),
        trusted={
            "projectPath": str(project_root),
            "subprojectPath": ".",
            "subprojectName": "certificate-maker",
        },
    )
    _record_build_success(session)
    content = json.dumps({
        "summary": "Build complete",
        "claims": [],
        "usedEvidenceRefs": ["ref-001"],
        "needsHumanReview": False,
        "recommendedNextSteps": [],
        "policyFlags": [],
        "buildResult": {
            "success": True,
            "buildCommand": "bash build-aegis-custom/aegis-build.sh",
            "buildScript": "build-aegis-custom/aegis-build.sh",
            "buildDir": "build-aegis",
            "errorLog": None,
            "producedArtifacts": [],
        },
    })

    resp = assembler.build(content, session)

    assert isinstance(resp, TaskSuccessResponse)
    assert resp.result.buildResult is not None
    produced_paths = [artifact.path for artifact in resp.result.buildResult.producedArtifacts]
    assert "build-aegis-custom/certificate-maker" in produced_paths
    assert resp.result.buildResult.artifactVerification is not None
    assert resp.result.buildResult.artifactVerification.matched is True


def test_exhaustion_max_steps() -> None:
    assembler = ResultAssembler()
    session = _make_session(termination_reason="max_steps")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.MAX_STEPS_EXCEEDED
    assert resp.status == TaskStatus.BUDGET_EXCEEDED
    assert resp.retryable is False


def test_exhaustion_budget() -> None:
    assembler = ResultAssembler()
    session = _make_session(termination_reason="budget_exhausted")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.TOKEN_BUDGET_EXCEEDED
    assert resp.retryable is False


def test_exhaustion_timeout() -> None:
    assembler = ResultAssembler()
    session = _make_session(termination_reason="timeout")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.TIMEOUT
    assert resp.status == TaskStatus.TIMEOUT
    assert resp.retryable is True


def test_exhaustion_no_evidence() -> None:
    assembler = ResultAssembler()
    session = _make_session(termination_reason="no_new_evidence")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.INSUFFICIENT_EVIDENCE


def test_exhaustion_all_tiers() -> None:
    assembler = ResultAssembler()
    session = _make_session(termination_reason="all_tiers_exhausted")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.ALL_TOOLS_EXHAUSTED


def test_exhaustion_unknown_reason() -> None:
    assembler = ResultAssembler()
    session = _make_session(termination_reason="????")
    resp = assembler.build_from_exhaustion(session)
    assert isinstance(resp, TaskFailureResponse)
    assert resp.failureCode == FailureCode.TOKEN_BUDGET_EXCEEDED
    assert resp.status == TaskStatus.BUDGET_EXCEEDED
