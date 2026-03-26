"""AgentSession — 에이전트 루프의 변이 가능한 세션 상태."""

from __future__ import annotations

import time

from agent_shared.schemas.agent import BudgetState, LlmResponse, ToolResult, ToolTraceStep, TurnRecord
from app.schemas.request import TaskRequest


class AgentSession:
    """단일 에이전트 실행의 전체 상태를 보관한다."""

    def __init__(self, request: TaskRequest, budget: BudgetState) -> None:
        self.request = request
        self.budget = budget
        self.turns: list[TurnRecord] = []
        self.trace: list[ToolTraceStep] = []
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
