"""T-3: 계약 테스트 — buildResult/sdkProfile 보존, evidence refs 포함."""

from __future__ import annotations

import json

from agent_shared.schemas.agent import BudgetState, ToolTraceStep
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from app.schemas.request import TaskRequest


def _make_session(trace_refs: list[list[str]] | None = None) -> AgentSession:
    request = TaskRequest(
        taskType="build-resolve",
        taskId="test-001",
        context={"trusted": {}},
    )

    session = AgentSession(request, BudgetState())
    if trace_refs:
        for i, refs in enumerate(trace_refs):
            session.trace.append(ToolTraceStep(
                step_id=f"step_{i:02d}",
                turn_number=1,
                tool="try_build",
                args_hash=f"hash_{i}",
                cost_tier="expensive",
                duration_ms=100,
                success=True,
                new_evidence_refs=refs,
            ))
    return session


class TestBuildResultPreservation:
    def test_build_result_in_response(self):
        """LLM이 buildResult를 반환하면 응답에 보존된다."""
        llm_content = json.dumps({
            "summary": "빌드 성공",
            "claims": [],
            "buildResult": {
                "success": True,
                "buildCommand": "bash build-aegis-abc/aegis-build.sh",
                "buildScript": "build-aegis-abc/aegis-build.sh",
                "buildDir": "build-aegis-abc",
                "errorLog": None,
            },
        })
        session = _make_session(trace_refs=[["eref-build-success"]])
        assembler = ResultAssembler()
        result = assembler.build(llm_content, session)
        assert result.result.buildResult is not None
        assert result.result.buildResult.success is True
        assert result.result.buildResult.buildCommand == "bash build-aegis-abc/aegis-build.sh"


class TestToolEvidenceRefsInAllowedSet:
    def test_tool_generated_refs_accepted(self):
        """도구가 생성한 evidence refs가 LLM 응답에서 사용 가능."""
        llm_content = json.dumps({
            "summary": "빌드 분석 완료",
            "claims": [{
                "statement": "빌드 성공",
                "severity": "info",
                "detail": "빌드 통과",
                "supportingEvidenceRefs": ["eref-build-success"],
            }],
            "usedEvidenceRefs": ["eref-build-success"],
            "buildResult": {
                "success": True,
                "buildCommand": "bash build.sh",
                "buildScript": "build.sh",
                "buildDir": "build-aegis",
            },
        })
        session = _make_session(trace_refs=[["eref-build-success"]])
        assembler = ResultAssembler()
        result = assembler.build(llm_content, session)
        # validation_failed가 아닌 성공 응답이어야 함
        assert result.status.value == "completed"


class TestBuildStateSummary:
    def test_summary_structure(self):
        """build_state_summary가 올바른 구조를 반환한다."""
        session = _make_session(trace_refs=[["eref-build-success"]])
        # read_file trace 추가
        session.trace.append(ToolTraceStep(
            step_id="step_read",
            turn_number=1,
            tool="read_file",
            args_hash="readhash1",
            cost_tier="cheap",
            duration_ms=10,
            success=True,
            new_evidence_refs=[],
        ))
        summary = session.build_state_summary()
        assert "files_read_count" in summary
        assert "build_attempts" in summary
        assert "last_build_success" in summary
        assert "tools_attempted" in summary
        assert summary["files_read_count"] == 1
        assert summary["build_attempts"] == 1
        assert summary["last_build_success"] is True
