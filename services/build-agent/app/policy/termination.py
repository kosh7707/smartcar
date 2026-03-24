"""TerminationPolicy — 에이전트 루프 종료 조건 판단."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.observability import agent_log

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession

logger = logging.getLogger(__name__)


def _budget_snapshot(session: AgentSession) -> dict:
    b = session.budget
    return {
        "steps": b.total_steps,
        "tokens": b.total_completion_tokens,
        "cheap": b.cheap_calls,
        "medium": b.medium_calls,
        "expensive": b.expensive_calls,
    }


class TerminationPolicy:
    """5가지 종료 조건을 검사하여 루프 중단 여부를 결정한다."""

    def __init__(self, timeout_ms: int = 300_000) -> None:
        self._timeout_ms = timeout_ms

    def should_stop(self, session: AgentSession) -> bool:
        """종료 조건 충족 시 True 반환 + session에 사유 기록."""
        reason = self._check(session)
        snapshot = _budget_snapshot(session)

        if reason:
            agent_log(
                logger, "종료 결정",
                component="termination", phase="policy_triggered",
                turn=session.turn_count, reason=reason,
                budgetSnapshot=snapshot,
            )
            session.set_termination_reason(reason)
            return True

        agent_log(
            logger, "종료 조건 미충족",
            component="termination", phase="policy_check",
            turn=session.turn_count, shouldStop=False,
            budgetSnapshot=snapshot,
            level=logging.DEBUG,
        )
        return False

    def _check(self, session: AgentSession) -> str:
        budget = session.budget

        # 1. max turns (턴 수 기반)
        if session.turn_count >= budget.max_steps:
            return "max_steps"

        # 2. completion token 예산
        if budget.total_completion_tokens >= budget.max_completion_tokens:
            return "budget_exhausted"

        # 3. timeout
        if session.elapsed_ms() >= self._timeout_ms:
            return "timeout"

        # 4. 연속 무증거 턴
        if budget.consecutive_no_evidence_turns >= budget.max_consecutive_no_evidence:
            return "no_new_evidence"

        # 5. 모든 tier 소진
        from app.budget.manager import BudgetManager
        bm = BudgetManager(budget)
        if bm.no_callable_tools_remaining():
            return "all_tiers_exhausted"

        return ""
