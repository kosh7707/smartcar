"""BudgetManager — 예산 할당/차감/잔여 조회/소진 판단."""

from __future__ import annotations

import logging

from agent_shared.observability import agent_log
from agent_shared.schemas.agent import BudgetState, ToolCostTier

logger = logging.getLogger(__name__)


class BudgetManager:
    """BudgetState 기반 예산 관리."""

    def __init__(self, budget: BudgetState) -> None:
        self._budget = budget

    @property
    def state(self) -> BudgetState:
        return self._budget

    def snapshot(self) -> dict:
        """현재 예산 상태를 딕셔너리로 반환."""
        b = self._budget
        return {
            "steps": b.total_steps,
            "tokens": b.total_completion_tokens,
            "cheap": b.cheap_calls,
            "medium": b.medium_calls,
            "expensive": b.expensive_calls,
        }

    def tier_usage(self, tier: ToolCostTier) -> tuple[int, int]:
        """Returns (current_count, max_count) for the given tier."""
        if tier == ToolCostTier.CHEAP:
            return self._budget.cheap_calls, self._budget.max_cheap_calls
        if tier == ToolCostTier.MEDIUM:
            return self._budget.medium_calls, self._budget.max_medium_calls
        if tier == ToolCostTier.EXPENSIVE:
            return self._budget.expensive_calls, self._budget.max_expensive_calls
        return 0, 0

    def can_make_call(self, tier: ToolCostTier) -> bool:
        """해당 tier의 호출 예산이 남아있는지 확인."""
        current, maximum = self.tier_usage(tier)
        return current < maximum

    def record_tool_call(self, tier: ToolCostTier, *, turn: int | None = None) -> None:
        """tier별 호출 카운트 증가 + 전체 step 증가."""
        if tier == ToolCostTier.CHEAP:
            self._budget.cheap_calls += 1
        elif tier == ToolCostTier.MEDIUM:
            self._budget.medium_calls += 1
        elif tier == ToolCostTier.EXPENSIVE:
            self._budget.expensive_calls += 1
        self._budget.total_steps += 1

        agent_log(
            logger, "예산 갱신",
            component="budget", phase="budget_update",
            turn=turn, event="tool_call", budget=self.snapshot(),
            level=logging.DEBUG,
        )

    def record_tokens(self, prompt: int, completion: int, *, turn: int | None = None) -> None:
        self._budget.total_completion_tokens += completion

        agent_log(
            logger, "예산 갱신",
            component="budget", phase="budget_update",
            turn=turn, event="tokens", budget=self.snapshot(),
            level=logging.DEBUG,
        )

    def is_duplicate_call(self, args_hash: str) -> bool:
        return args_hash in self._budget.duplicate_call_hashes

    def register_call_hash(self, args_hash: str) -> None:
        self._budget.duplicate_call_hashes.add(args_hash)

    def record_no_evidence_turn(self, *, turn: int | None = None) -> None:
        self._budget.consecutive_no_evidence_turns += 1

        agent_log(
            logger, "예산 갱신",
            component="budget", phase="budget_update",
            turn=turn, event="no_evidence", budget=self.snapshot(),
            level=logging.DEBUG,
        )

    def reset_no_evidence_counter(self, *, turn: int | None = None) -> None:
        self._budget.consecutive_no_evidence_turns = 0

        agent_log(
            logger, "예산 갱신",
            component="budget", phase="budget_update",
            turn=turn, event="reset", budget=self.snapshot(),
            level=logging.DEBUG,
        )

    def is_exhausted(self) -> bool:
        """토큰 또는 step 예산이 소진되었는지."""
        if self._budget.total_steps >= self._budget.max_steps:
            return True
        if self._budget.total_completion_tokens >= self._budget.max_completion_tokens:
            return True
        return False

    def no_callable_tools_remaining(self) -> bool:
        """모든 tier 예산이 소진되어 호출 가능한 tool이 없는지."""
        return (
            not self.can_make_call(ToolCostTier.CHEAP)
            and not self.can_make_call(ToolCostTier.MEDIUM)
            and not self.can_make_call(ToolCostTier.EXPENSIVE)
        )
