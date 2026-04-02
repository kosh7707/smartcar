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

        _FORCE_REPORT_AFTER_TOOLS = 6  # 도구 6회 호출 후 보고서 강제
        _WARN_BEFORE_FORCE = 4        # 도구 4회 도달 시 사전 경고
        force_report = False
        warned_approaching_limit = False

        while not self._termination_policy.should_stop(session):
            turn = session.turn_count + 1

            # 도구 예산: 예산 남은 tier의 도구만 제공, force_report 시 전부 제거
            if force_report:
                current_tools = None
            else:
                current_tools = self._tool_registry.get_available_schemas(self._budget_manager)

            # 도구 4회 도달 → 사전 경고 (자발적 전환 유도)
            if (not warned_approaching_limit
                    and not force_report
                    and session.total_tool_calls() >= _WARN_BEFORE_FORCE):
                warned_approaching_limit = True
                remaining = _FORCE_REPORT_AFTER_TOOLS - session.total_tool_calls()
                self._message_manager.add_user_message(
                    f"[시스템] 도구 호출 잔여 횟수: {remaining}회. "
                    "충분한 증거가 모였으면 JSON 보고서를 작성하라. "
                    "리마인더: 존재하지 않는 refId를 만들지 마라. "
                    "코드를 확인하지 않은 경로에 claim을 작성하지 마라. "
                    "비밀 정보는 마스킹하라. 순수 JSON만 출력하라."
                )
                agent_log(
                    logger, "도구 예산 사전 경고",
                    component="agent_loop", phase="tool_budget_warn",
                    turn=turn, remaining=remaining,
                )

            # 도구 호출 횟수 상한 도달 → 보고서 강제 지시
            if not force_report and session.total_tool_calls() >= _FORCE_REPORT_AFTER_TOOLS:
                force_report = True
                self._message_manager.add_user_message(
                    "[시스템] 도구 호출 한도 도달. "
                    "추가 도구 호출 없이 즉시 JSON 보고서를 출력하십시오."
                )
                agent_log(
                    logger, "보고서 작성 지시 메시지 주입",
                    component="agent_loop", phase="force_report",
                    turn=turn, totalToolCalls=session.total_tool_calls(),
                )

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
                # 도구 결과가 이미 축적되어 있으면 부분 결과 시도
                if session.total_tool_calls() > 0:
                    agent_log(
                        logger, "LLM 실패 — 부분 결과로 대체 시도",
                        component="agent_loop", phase="partial_result_fallback",
                        turn=turn, toolCallsSoFar=session.total_tool_calls(),
                        errorCode=e.code,
                    )
                    session.set_termination_reason(f"llm_failure_partial:{e.code}")
                    return self._result_assembler.build_from_exhaustion(session)
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
                # 도구가 생성한 evidence ref ID를 tool result에 주입 → LLM이 정확한 refId를 볼 수 있게 함
                for r in results:
                    if r.success and r.new_evidence_refs:
                        ref_list = ", ".join(f"`{ref}`" for ref in r.new_evidence_refs)
                        r.content += f"\n\n[Evidence Refs: {ref_list}]"
                self._message_manager.add_tool_results(results)
                session.record_tool_turn(response, results)

                # Plan-before-act 넛지: 첫 턴에서 계획 없이 도구부터 호출 시 다음 턴에 계획 요청
                if session.turn_count == 1:
                    self._message_manager.add_user_message(
                        "[시스템] 다음 도구 호출 전에 남은 findings 분석 계획을 우선순위와 함께 기술하라. "
                        "어떤 finding을 어떤 도구로 분석할 것인지 명시하라."
                    )

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

                final_content = response.content or ""
                if not final_content.strip():
                    agent_log(
                        logger, "LLM이 빈 응답 반환 — failure 처리",
                        component="agent_loop", phase="empty_response",
                        turn=turn, level=logging.WARNING,
                    )
                    return self._result_assembler.build_failure(
                        session, TaskStatus.MODEL_ERROR,
                        FailureCode.MODEL_UNAVAILABLE,
                        "LLM이 유효한 tool_calls도 content도 반환하지 않음",
                        retryable=True,
                    )

                result = self._result_assembler.build(final_content, session)

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
                state_summary=session.analysis_state_summary(),
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
