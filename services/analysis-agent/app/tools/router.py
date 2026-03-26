"""ToolRouter — tool_call 디스패치 + 중복 차단 + 실패 처리."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.budget.manager import BudgetManager
from agent_shared.observability import agent_log
from app.policy.tool_failure import ToolFailurePolicy
from agent_shared.schemas.agent import ToolCallRequest, ToolCostTier, ToolResult, ToolTraceStep
from agent_shared.tools.executor import ToolExecutor
from agent_shared.tools.base import ToolImplementation
from agent_shared.tools.registry import ToolRegistry

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession

logger = logging.getLogger(__name__)


class ToolRouter:
    """tool_call을 구현체로 라우팅하고 실행한다."""

    def __init__(
        self,
        registry: ToolRegistry,
        executor: ToolExecutor,
        budget_manager: BudgetManager,
        tool_failure_policy: ToolFailurePolicy,
    ) -> None:
        self._registry = registry
        self._executor = executor
        self._budget_manager = budget_manager
        self._failure_policy = tool_failure_policy
        self._implementations: dict[str, ToolImplementation] = {}

    def register_implementation(self, name: str, impl: ToolImplementation) -> None:
        self._implementations[name] = impl

    async def execute(
        self,
        tool_calls: list[ToolCallRequest],
        session: AgentSession,
    ) -> list[ToolResult]:
        results: list[ToolResult] = []
        for call in tool_calls:
            result = await self._execute_single(call, session)
            results.append(result)
        return results

    async def _execute_single(
        self,
        call: ToolCallRequest,
        session: AgentSession,
    ) -> ToolResult:
        turn = session.turn_count + 1

        # 1. tool 존재 확인
        schema = self._registry.get(call.name)
        if not schema:
            agent_log(
                logger, "미등록 tool",
                component="tool_router", phase="tool_blocked_unknown",
                turn=turn, toolName=call.name, level=logging.WARNING,
            )
            return ToolResult(
                tool_call_id=call.id,
                name=call.name,
                success=False,
                content=f'{{"error": "Unknown tool: {call.name}"}}',
                error=f"Unknown tool: {call.name}",
            )

        # 2. 구현체 존재 확인
        impl = self._implementations.get(call.name)
        if not impl:
            return self._failure_policy.handle(call, f"No implementation for {call.name}", session)

        # 3. 중복 호출 차단
        if self._budget_manager.is_duplicate_call(call.args_hash):
            agent_log(
                logger, "중복 tool 호출 차단",
                component="tool_router", phase="tool_blocked_duplicate",
                turn=turn, tool=call.name, argsHash=call.args_hash,
            )
            return ToolResult(
                tool_call_id=call.id,
                name=call.name,
                success=False,
                content='{"error": "Duplicate tool call blocked. Same arguments were already used."}',
                error="duplicate_call",
            )

        # 4. tier 예산 확인
        tier = schema.cost_tier
        if not self._budget_manager.can_make_call(tier):
            current, max_count = self._budget_manager.tier_usage(tier)
            agent_log(
                logger, "tier 예산 소진",
                component="tool_router", phase="tool_blocked_budget",
                turn=turn, tool=call.name, tier=tier.value,
                currentCount=current, maxCount=max_count,
                level=logging.WARNING,
            )
            return ToolResult(
                tool_call_id=call.id,
                name=call.name,
                success=False,
                content=f'{{"error": "Budget exhausted for {tier.value} tier tools."}}',
                error=f"{tier.value}_budget_exhausted",
            )

        # 5. 디스패치
        agent_log(
            logger, "Tool 디스패치",
            component="tool_router", phase="tool_dispatch",
            turn=turn, tool=call.name, tier=tier.value,
            argsHash=call.args_hash,
        )

        # 6. 실행
        result = await self._executor.execute(impl, call, turn=turn)

        # 7. 예산 기록
        self._budget_manager.record_tool_call(tier, turn=turn)
        self._budget_manager.register_call_hash(call.args_hash)

        # 8. evidence 추적
        if result.success and result.new_evidence_refs:
            self._budget_manager.reset_no_evidence_counter(turn=turn)
        elif result.success:
            self._budget_manager.record_no_evidence_turn(turn=turn)

        # 9. trace 기록
        session.trace.append(ToolTraceStep(
            step_id=f"step_{len(session.trace) + 1:02d}",
            turn_number=session.turn_count,
            tool=call.name,
            args_hash=call.args_hash,
            cost_tier=tier,
            duration_ms=result.duration_ms,
            success=result.success,
            new_evidence_refs=result.new_evidence_refs,
            error=result.error,
        ))

        # 10. 완료 로그
        agent_log(
            logger, "Tool 완료",
            component="tool_router", phase="tool_complete",
            turn=turn, tool=call.name, success=result.success,
            durationMs=result.duration_ms,
            newEvidenceCount=len(result.new_evidence_refs),
        )

        return result
