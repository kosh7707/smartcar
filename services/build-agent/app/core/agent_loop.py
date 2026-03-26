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
        build_succeeded = False
        force_report = False  # 빌드 성공 또는 연속 실패 시 보고서 강제
        consecutive_build_failures = 0
        max_build_failures = 3

        agent_log(
            logger, "에이전트 세션 시작",
            component="agent_loop", phase="session_start",
            taskId=session.request.taskId, toolCount=tool_count,
            budget={"max_steps": session.budget.max_steps,
                    "max_tokens": session.budget.max_completion_tokens},
        )

        while not self._termination_policy.should_stop(session):
            turn = session.turn_count + 1

            # 빌드 성공/연속 실패/도구 예산 소진 시 → 도구 제거 + 보고서 작성 강제
            if force_report or self._budget_manager.no_callable_tools_remaining():
                current_tools = None
                if force_report:
                    self._message_manager.add_assistant_content(
                        "보고서를 작성합니다."
                    )
                    if build_succeeded:
                        directive = (
                            "빌드가 성공했다 (exitCode=0). "
                            "더 이상 도구를 호출하지 마라. "
                            "시스템 프롬프트의 출력 형식에 맞는 최종 JSON 보고서를 출력하라. "
                            "buildCommand에 성공한 명령어를, buildScript에 스크립트 경로를 기입하라. "
                            "첫 문자는 반드시 `{`이어야 한다."
                        )
                    else:
                        directive = (
                            f"빌드가 {consecutive_build_failures}회 연속 실패했다. "
                            "더 이상 도구를 호출하지 마라. "
                            "시스템 프롬프트의 출력 형식에 맞는 진단 보고서를 JSON으로 출력하라. "
                            "실패 원인과 필요한 조치(누락 라이브러리, SDK 문제 등)를 summary에 명시하라. "
                            "첫 문자는 반드시 `{`이어야 한다."
                        )
                    # NOTE: MessageManager에 add_user_message() 없으므로 직접 접근
                    # agent-shared에 메서드 추가 시 전환할 것
                    self._message_manager._messages.append({
                        "role": "user",
                        "content": directive,
                    })
                    force_report = False  # 메시지 한 번만 주입
                    agent_log(
                        logger, "보고서 작성 지시 메시지 주입",
                        component="agent_loop", phase="force_report",
                        turn=turn, buildSucceeded=build_succeeded,
                        consecutiveFailures=consecutive_build_failures,
                    )
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

                # try_build 결과 감지
                for r in results:
                    if r.name == "try_build":
                        if r.success and "eref-build-success" in r.new_evidence_refs:
                            build_succeeded = True
                            force_report = True
                            consecutive_build_failures = 0
                            agent_log(
                                logger, "try_build 성공 — 보고서 작성 예정",
                                component="agent_loop", phase="build_success_detected",
                                turn=turn,
                            )
                            break
                        elif not r.success:
                            consecutive_build_failures += 1
                            if consecutive_build_failures >= max_build_failures:
                                force_report = True
                                agent_log(
                                    logger, f"try_build {consecutive_build_failures}회 연속 실패 — 진단 보고서 예정",
                                    component="agent_loop", phase="build_failure_threshold",
                                    turn=turn, consecutiveFailures=consecutive_build_failures,
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
