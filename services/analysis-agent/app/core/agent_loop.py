"""AgentLoop — 에이전트 메인 루프. 분기 판단(tool_call vs content)은 여기서."""

from __future__ import annotations

import asyncio
import logging

from app.budget.manager import BudgetManager
from app.budget.token_counter import TokenCounter
from app.core.agent_session import AgentSession
from app.core.result_assembler import ResultAssembler
from agent_shared.errors import S3Error
from agent_shared.llm.caller import LlmCaller
from agent_shared.llm.message_manager import MessageManager
from agent_shared.llm.turn_summarizer import TurnSummarizer
from agent_shared.observability import agent_log
from agent_shared.policy.retry import RetryPolicy
from app.policy.termination import TerminationPolicy
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from agent_shared.tools.registry import ToolRegistry
from app.tools.router import ToolRouter
from app.types import FailureCode, TaskStatus

logger = logging.getLogger(__name__)

# 메시지 토큰 추정치가 이 값을 초과하면 컨텍스트 압축 실행
_COMPACT_TOKEN_THRESHOLD = 16_000
_COMPACT_KEEP_LAST_N = 4


def _budget_snapshot(session: AgentSession) -> dict:
    b = session.budget
    return {
        "steps": b.total_steps,
        "tokens": b.total_completion_tokens,
        "cheap": b.cheap_calls,
        "medium": b.medium_calls,
        "expensive": b.expensive_calls,
    }


class AgentLoop:
    """멀티 턴 에이전트 루프를 실행한다."""

    def __init__(
        self,
        llm_caller: LlmCaller,
        message_manager: MessageManager,
        tool_registry: ToolRegistry,
        tool_router: ToolRouter,
        termination_policy: TerminationPolicy,
        budget_manager: BudgetManager,
        token_counter: TokenCounter,
        result_assembler: ResultAssembler,
        turn_summarizer: TurnSummarizer,
        retry_policy: RetryPolicy,
    ) -> None:
        self._llm_caller = llm_caller
        self._message_manager = message_manager
        self._tool_registry = tool_registry
        self._tool_router = tool_router
        self._termination_policy = termination_policy
        self._budget_manager = budget_manager
        self._token_counter = token_counter
        self._result_assembler = result_assembler
        self._turn_summarizer = turn_summarizer
        self._retry_policy = retry_policy

    async def run(self, session: AgentSession) -> TaskSuccessResponse | TaskFailureResponse:
        """에이전트 루프를 종료 조건까지 실행한다."""
        tools_schema = self._tool_registry.get_all_schemas() or None
        tool_count = len(tools_schema) if tools_schema else 0

        agent_log(
            logger, "에이전트 세션 시작",
            component="agent_loop", phase="session_start",
            taskId=session.request.taskId, toolCount=tool_count,
            budget={"max_steps": session.budget.max_steps,
                    "max_tokens": session.budget.max_completion_tokens},
        )

        while not self._termination_policy.should_stop(session):
            turn = session.turn_count + 1

            # 도구 예산 소진 시 tools를 제거하여 LLM이 content만 반환하도록 유도
            if self._budget_manager.no_callable_tools_remaining():
                current_tools = None
            else:
                current_tools = tools_schema

            agent_log(
                logger, "턴 시작",
                component="agent_loop", phase="turn_start",
                turn=turn, budget=_budget_snapshot(session),
                toolsAvailable=current_tools is not None,
            )

            # LLM 호출 (재시도 포함)
            try:
                response = await self._call_with_retry(session, current_tools)
            except S3Error as e:
                logger.error("LLM 호출 실패 (재시도 소진): %s", e)
                return self._result_assembler.build_failure(
                    session,
                    TaskStatus.MODEL_ERROR,
                    FailureCode.MODEL_UNAVAILABLE,
                    str(e),
                    retryable=e.retryable,
                )

            # 토큰 기록
            self._token_counter.record(response, session)

            # 분기: tool_call vs content
            if response.has_tool_calls():
                agent_log(
                    logger, "턴 분기: tool_calls",
                    component="agent_loop", phase="turn_branch",
                    turn=turn, responseType="tool_calls",
                    toolCallCount=len(response.tool_calls),
                )
                self._message_manager.add_assistant_tool_calls(response.tool_calls)
                results = await self._tool_router.execute(response.tool_calls, session)
                self._message_manager.add_tool_results(results)
                session.record_tool_turn(response, results)

                agent_log(
                    logger, "턴 종료",
                    component="agent_loop", phase="turn_end",
                    turn=turn,
                    promptTokens=response.prompt_tokens,
                    completionTokens=response.completion_tokens,
                )
            else:
                agent_log(
                    logger, "턴 분기: content",
                    component="agent_loop", phase="turn_branch",
                    turn=turn, responseType="content",
                )
                session.record_content_turn(response)

                agent_log(
                    logger, "턴 종료",
                    component="agent_loop", phase="turn_end",
                    turn=turn,
                    promptTokens=response.prompt_tokens,
                    completionTokens=response.completion_tokens,
                )

                result = self._result_assembler.build(response.content or "", session)

                agent_log(
                    logger, "세션 종료",
                    component="agent_loop", phase="session_end",
                    totalTurns=session.turn_count,
                    totalPromptTokens=session.total_prompt_tokens(),
                    totalCompletionTokens=session.total_completion_tokens(),
                    terminationReason="content_returned",
                    latencyMs=session.elapsed_ms(),
                )
                return result

        # 종료 정책에 의한 종료
        agent_log(
            logger, "세션 종료",
            component="agent_loop", phase="session_end",
            totalTurns=session.turn_count,
            totalPromptTokens=session.total_prompt_tokens(),
            totalCompletionTokens=session.total_completion_tokens(),
            terminationReason=session.termination_reason,
            latencyMs=session.elapsed_ms(),
        )
        return self._result_assembler.build_from_exhaustion(session)

    async def _call_with_retry(self, session, tools_schema):
        """LLM 호출 + 재시도."""
        # 컨텍스트 압축: 토큰 추정치 초과 시 오래된 턴 제거
        token_est = self._message_manager.get_token_estimate()
        if token_est > _COMPACT_TOKEN_THRESHOLD:
            removed = await self._message_manager.compact(
                self._turn_summarizer, keep_last_n=_COMPACT_KEEP_LAST_N,
            )
            if removed > 0:
                agent_log(
                    logger, "컨텍스트 압축",
                    component="agent_loop", phase="context_compact",
                    turn=session.turn_count + 1,
                    tokensBefore=token_est,
                    tokensAfter=self._message_manager.get_token_estimate(),
                    messagesRemoved=removed,
                )

        messages = self._message_manager.get_messages()
        turn = session.turn_count + 1
        last_error = None

        for attempt in range(1 + self._retry_policy._max_retries):
            try:
                return await self._llm_caller.call(
                    messages, session, tools=tools_schema,
                )
            except S3Error as e:
                last_error = e
                if self._retry_policy.should_retry(e, attempt):
                    delay = self._retry_policy.get_delay_seconds(e, attempt)
                    agent_log(
                        logger, "LLM 재시도",
                        component="llm_caller", phase="llm_retry",
                        turn=turn, attempt=attempt + 1,
                        errorCode=type(e).__name__,
                        delaySeconds=delay,
                        level=logging.WARNING,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise

        raise last_error  # type: ignore[misc]
