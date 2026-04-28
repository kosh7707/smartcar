"""AgentSession — 에이전트 루프의 변이 가능한 세션 상태."""

from __future__ import annotations

import time

from app.agent_runtime.schemas.agent import BudgetState, LlmResponse, ToolResult, ToolTraceStep, TurnRecord
from app.core.evidence_catalog import EvidenceCatalog
from app.schemas.request import TaskRequest


class AgentSession:
    """단일 에이전트 실행의 전체 상태를 보관한다."""

    def __init__(self, request: TaskRequest, budget: BudgetState) -> None:
        self.request = request
        self.budget = budget
        self.turns: list[TurnRecord] = []
        self.trace: list[ToolTraceStep] = []
        self.extra_allowed_refs: set[str] = set()  # Phase 1 생성 refs 등
        self.planned_action_keys: set[str] = set()  # deterministic acquisition planner dedup
        self.evidence_catalog = EvidenceCatalog()
        self.evidence_catalog.ingest_request(request)
        self._start_time = time.monotonic()
        self._termination_reason = ""

    @property
    def turn_count(self) -> int:
        return len(self.turns)

    @property
    def termination_reason(self) -> str:
        return self._termination_reason

    def set_termination_reason(self, reason: str) -> None:
        self._termination_reason = reason

    def record_tool_turn(self, response: LlmResponse, results: list[ToolResult]) -> None:
        """tool_call 턴을 기록한다."""
        # 이 턴에 해당하는 trace steps 수집
        turn_steps = [s for s in self.trace if s.turn_number == self.turn_count + 1]
        self.turns.append(TurnRecord(
            turn_number=self.turn_count + 1,
            llm_response_type="tool_calls",
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            tool_steps=turn_steps,
        ))

    def record_content_turn(self, response: LlmResponse) -> None:
        """content 반환 턴을 기록한다."""
        self.turns.append(TurnRecord(
            turn_number=self.turn_count + 1,
            llm_response_type="content",
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
        ))

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self._start_time) * 1000)

    def total_prompt_tokens(self) -> int:
        return sum(t.prompt_tokens for t in self.turns)

    def total_completion_tokens(self) -> int:
        return sum(t.completion_tokens for t in self.turns)

    def total_tool_calls(self) -> int:
        return sum(len(t.tool_steps) for t in self.turns)

    def analysis_state_summary(self) -> dict:
        """compaction 시 LLM에게 전달할 분석 상태 요약."""
        return {
            "tools_used": sorted({s.tool for s in self.trace}),
            "total_tool_calls": len(self.trace),
            "evidence_refs_collected": sorted({
                ref for s in self.trace for ref in s.new_evidence_refs
            }),
            "failed_tools": [s.tool for s in self.trace if not s.success],
        }

    def live_recovery_trace_summary(self, *, limit_each: int = 5) -> dict:
        """Return a bounded, proof-neutral summary of recovery/acquisition attempts."""
        attempts: list[dict] = []
        for index, entry in enumerate(self.evidence_catalog.history()):
            if entry.evidence_class not in {"negative", "operational"}:
                continue
            attempts.append({
                "index": index,
                "refId": entry.ref_id,
                "class": entry.evidence_class,
                "sourceTool": entry.source_tool,
                "status": entry.operational_status or _status_from_summary(entry.summary),
                "roles": list(entry.roles),
                "summary": entry.summary,
                "toolArguments": entry.tool_arguments or {},
            })

        for index, step in enumerate(self.trace):
            if step.success and step.new_evidence_refs:
                continue
            attempts.append({
                "index": len(attempts) + index,
                "refId": None,
                "class": "operational" if not step.success else "negative",
                "sourceTool": step.tool,
                "status": step.error or ("no_evidence_refs" if not step.new_evidence_refs else "ok"),
                "roles": ["tool_trace"],
                "summary": step.error or f"{step.tool} produced no new evidence refs",
                "toolArguments": {"argsHash": step.args_hash},
            })

        total = len(attempts)
        if total > limit_each * 2:
            shown = attempts[:limit_each] + attempts[-limit_each:]
            truncated = True
        else:
            shown = attempts
            truncated = False
        return {
            "totalAttempts": total,
            "shownAttempts": shown,
            "truncated": truncated,
            "negativeCount": sum(1 for item in attempts if item.get("class") == "negative"),
            "operationalCount": sum(1 for item in attempts if item.get("class") == "operational"),
        }


def _status_from_summary(summary: str | None) -> str | None:
    if not summary or ": " not in summary:
        return None
    return summary.split(": ", 1)[1]
