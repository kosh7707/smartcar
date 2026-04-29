from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from app.config import settings
from app.context import get_request_id
from app.errors import LlmCircuitOpenError, LlmHttpError, LlmInputTooLargeError, LlmTimeoutError, LlmUnavailableError
from app.metrics import prom
from app.pipeline.confidence import ConfidenceCalculator
from app.pipeline.prompt_builder import V1PromptBuilder
from app.pipeline.response_parser import V1ResponseParser
from app.registry.model_registry import ModelProfileRegistry
from app.registry.prompt_registry import PromptRegistry
from app.schemas.request import TaskRequest
from app.schemas.response import (
    AssessmentResult,
    AuditInfo,
    Claim,
    TaskFailureResponse,
    TaskSuccessResponse,
    TestPlan,
    TokenUsage,
    ValidationInfo,
)
from app.types import FailureCode, TaskStatus, TaskType
from app.validators.evidence_validator import EvidenceValidator
from app.validators.schema_validator import SchemaValidator

logger = logging.getLogger(__name__)

# 출력 품질 문제로 재시도 가능한 실패 코드
_RETRYABLE_FAILURE_CODES = frozenset({
    FailureCode.INVALID_SCHEMA,
    FailureCode.INVALID_GROUNDING,
    FailureCode.EMPTY_RESPONSE,
})


@dataclass
class _LlmAttemptFailure:
    status: TaskStatus
    code: FailureCode
    detail: str
    token_usage: TokenUsage


class TaskPipeline:
    """v1 Task 처리 오케스트레이터.

    validate → build prompt → call LLM → parse → validate output
    → compute confidence → build response
    """

    def __init__(
        self,
        prompt_registry: PromptRegistry,
        model_registry: ModelProfileRegistry,
        context_enricher: "ContextEnricher | None" = None,
        llm_client: "RealLlmClient | None" = None,
        semaphore: "asyncio.Semaphore | None" = None,
        request_tracker: "RequestTracker | None" = None,
    ) -> None:
        self._prompt_registry = prompt_registry
        self._model_registry = model_registry
        self._prompt_builder = V1PromptBuilder()
        self._response_parser = V1ResponseParser()
        self._schema_validator = SchemaValidator()
        self._evidence_validator = EvidenceValidator()
        self._confidence_calculator = ConfidenceCalculator()
        self._context_enricher = context_enricher
        self._llm_client = llm_client
        self._semaphore = semaphore or asyncio.Semaphore(settings.llm_concurrency)
        self._request_tracker = request_tracker

    async def execute(
        self,
        request: TaskRequest,
    ) -> TaskSuccessResponse | TaskFailureResponse:
        start = time.monotonic()
        request_id = get_request_id()

        if self._request_tracker and request_id:
            self._request_tracker.mark_phase(
                request_id,
                phase="prompt-build",
                state="running",
                ack_source="prompt-build",
            )

        # 1. Prompt 조회
        prompt_entry = self._prompt_registry.get(request.taskType)
        if prompt_entry is None:
            return self._failure(
                request, start,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.UNKNOWN_TASK_TYPE,
                f"등록되지 않은 task type: {request.taskType}",
            )

        # 2. Model profile 조회
        profile = self._model_registry.get_default()
        if profile is None:
            return self._failure(
                request, start,
                TaskStatus.MODEL_ERROR,
                FailureCode.MODEL_UNAVAILABLE,
                "등록된 model profile이 없습니다",
            )

        # 3. Task type 허용 확인
        if request.taskType not in profile.allowedTaskTypes:
            return self._failure(
                request, start,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.UNKNOWN_TASK_TYPE,
                f"model '{profile.profileId}'에서 {request.taskType} 미허용",
            )

        # 3.5 RAG 컨텍스트 증강
        threat_context = ""
        rag_hits_count = 0
        if self._context_enricher:
            try:
                threat_context, rag_hits_count = await self._context_enricher.enrich(
                    request, top_k=settings.rag_top_k,
                    min_score=settings.rag_min_score,
                )
            except Exception:
                logger.warning("[%s] RAG 증강 실패, 건너뜀", request.taskType, exc_info=True)

        # 4. 프롬프트 조립
        messages = self._prompt_builder.build(
            request, prompt_entry, threat_context=threat_context,
        )
        logger.debug(
            "[%s] Prompt built (%d messages, rag_hits=%d)",
            request.taskType, len(messages), rag_hits_count,
        )

        # 4.5 프롬프트 길이 사전 검증
        prompt_chars = sum(len(m.get("content", "")) for m in messages)
        if prompt_chars > settings.llm_max_input_chars:
            logger.warning(
                "[%s] 프롬프트 길이 초과: %d자 > %d자 상한",
                request.taskType, prompt_chars, settings.llm_max_input_chars,
            )
            return self._failure(
                request, start,
                TaskStatus.BUDGET_EXCEEDED,
                FailureCode.INPUT_TOO_LARGE,
                f"프롬프트가 입력 한도를 초과합니다 ({prompt_chars:,}자 > {settings.llm_max_input_chars:,}자 상한). 입력 크기를 줄여 주세요.",
            )

        # 5-9. LLM 호출 → 파싱 → 검증 (retry loop)
        max_attempts = 1 + settings.llm_max_retries
        total_token_usage = TokenUsage()
        last_failure: _LlmAttemptFailure | None = None
        retry_count = 0

        for attempt in range(1, max_attempts + 1):
            try:
                attempt_result = await self._attempt_llm_and_validate(
                    request, messages,
                )
            except (LlmCircuitOpenError, LlmTimeoutError, LlmInputTooLargeError, LlmUnavailableError, LlmHttpError) as e:
                # LLM 인프라 에러는 즉시 실패 (재시도 비대상)
                if isinstance(e, LlmCircuitOpenError):
                    return self._failure(
                        request, start,
                        TaskStatus.MODEL_ERROR, FailureCode.LLM_CIRCUIT_OPEN,
                        str(e), retryable=True,
                    )
                if isinstance(e, LlmTimeoutError):
                    return self._failure(
                        request, start,
                        TaskStatus.TIMEOUT, FailureCode.TIMEOUT,
                        "LLM 요청 시간 초과",
                        retryable=True,
                    )
                if isinstance(e, LlmInputTooLargeError):
                    return self._failure(
                        request, start,
                        TaskStatus.BUDGET_EXCEEDED, FailureCode.INPUT_TOO_LARGE,
                        str(e),
                    )
                # 429/503 과부하 → LLM_OVERLOADED, 연결 불가 → MODEL_UNAVAILABLE
                if isinstance(e, LlmHttpError) and e.retryable:
                    return self._failure(
                        request, start,
                        TaskStatus.MODEL_ERROR, FailureCode.LLM_OVERLOADED,
                        str(e), retryable=True,
                    )
                return self._failure(
                    request, start,
                    TaskStatus.MODEL_ERROR, FailureCode.MODEL_UNAVAILABLE,
                    str(e), retryable=isinstance(e, LlmUnavailableError),
                )

            if isinstance(attempt_result, _LlmAttemptFailure):
                total_token_usage.prompt += attempt_result.token_usage.prompt
                total_token_usage.completion += attempt_result.token_usage.completion
                last_failure = attempt_result
                if attempt < max_attempts:
                    logger.warning(
                        "[%s] 출력 품질 실패 (attempt %d/%d): %s — 재시도",
                        request.taskType, attempt, max_attempts,
                        attempt_result.code,
                    )
                    continue
                # 모든 시도 소진 → 최종 실패
                retry_count = attempt - 1
                elapsed_ms = int((time.monotonic() - start) * 1000)
                logger.warning(
                    "[%s] 재시도 소진 (%d회 시도): %s",
                    request.taskType, max_attempts, last_failure.code,
                )
                return TaskFailureResponse(
                    taskId=request.taskId,
                    taskType=request.taskType,
                    status=last_failure.status,
                    failureCode=last_failure.code,
                    failureDetail=last_failure.detail,
                    retryable=False,
                    audit=self._build_audit(
                        request, elapsed_ms, total_token_usage,
                        rag_hits_count, retry_count=retry_count,
                    ),
                )
            else:
                # 성공
                raw_response, parsed, attempt_usage, validation = attempt_result
                total_token_usage.prompt += attempt_usage.prompt
                total_token_usage.completion += attempt_usage.completion
                retry_count = attempt - 1
                break

        token_usage = total_token_usage

        # 10. Confidence 산출
        # 빈 배열/빈 dict는 False로 평가되므로 실 데이터가 있는지 확인
        allowed_refs = {ref.refId for ref in request.evidenceRefs}
        rule_matches = request.context.trusted.get("ruleMatches", [])
        has_rules = bool(
            request.context.trusted.get("finding")
            or (isinstance(rule_matches, list) and len(rule_matches) > 0)
        )
        confidence, breakdown = self._confidence_calculator.calculate(
            parsed, allowed_refs,
            schema_valid=validation.valid,
            has_rule_results=has_rules,
            rag_hits=rag_hits_count,
        )

        # 11. Assessment 조립
        claims = [
            Claim(
                statement=c.get("statement", ""),
                supportingEvidenceRefs=c.get("supportingEvidenceRefs", []),
                location=c.get("location"),
            )
            for c in parsed.get("claims", [])
            if isinstance(c, dict)
        ]

        test_plan = None
        if request.taskType == TaskType.TEST_PLAN_PROPOSE and parsed.get("plan"):
            plan_data = parsed["plan"]
            test_plan = TestPlan(
                objective=plan_data.get("objective", ""),
                hypotheses=plan_data.get("hypotheses", []),
                targetProtocol=plan_data.get("targetProtocol"),
                targetServiceClass=plan_data.get("targetServiceClass"),
                preconditions=plan_data.get("preconditions", []),
                dataToCollect=plan_data.get("dataToCollect", []),
                stopConditions=plan_data.get("stopConditions", []),
                safetyConstraints=plan_data.get("safetyConstraints", []),
                suggestedExecutorTemplateIds=plan_data.get(
                    "suggestedExecutorTemplateIds", [],
                ),
                suggestedRiskLevel=plan_data.get("suggestedRiskLevel"),
            )

        result = AssessmentResult(
            summary=parsed.get("summary", ""),
            claims=claims,
            caveats=parsed.get("caveats", []),
            usedEvidenceRefs=parsed.get("usedEvidenceRefs", []),
            suggestedSeverity=parsed.get("suggestedSeverity"),
            confidence=confidence,
            confidenceBreakdown=breakdown,
            needsHumanReview=parsed.get("needsHumanReview", True),
            recommendedNextSteps=parsed.get("recommendedNextSteps", []),
            policyFlags=parsed.get("policyFlags", []),
            plan=test_plan,
        )

        elapsed_ms = int((time.monotonic() - start) * 1000)
        audit = self._build_audit(
            request, elapsed_ms, token_usage, rag_hits_count,
            retry_count=retry_count,
        )

        logger.info(
            "[%s] Task completed (%.2fs, confidence=%.4f, rag_hits=%d)",
            request.taskType, elapsed_ms / 1000, confidence, rag_hits_count,
        )

        return TaskSuccessResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=TaskStatus.COMPLETED,
            modelProfile=profile.profileId,
            promptVersion=prompt_entry.version,
            schemaVersion=f"{prompt_entry.promptId}-{prompt_entry.version}",
            validation=validation,
            result=result,
            audit=audit,
        )

    async def _call_llm(
        self,
        request: TaskRequest,
        messages: list[dict[str, str]],
    ) -> tuple[str, TokenUsage]:
        if settings.llm_mode == "real":
            client = self._llm_client
            if client is None:
                from app.clients.real import RealLlmClient

                profile = self._model_registry.get_default()
                endpoint = profile.endpoint if profile else settings.llm_endpoint
                model = profile.modelName if profile else settings.llm_model
                api_key = profile.apiKey if profile else settings.llm_api_key

                client = RealLlmClient(
                    endpoint=endpoint, model=model, api_key=api_key,
                    json_mode=True,
                )

            request_id = get_request_id()
            if self._request_tracker and request_id:
                self._request_tracker.mark_phase(
                    request_id,
                    phase="llm-inference",
                    state="queued",
                    ack_source="llm-ready",
                )

            async with self._semaphore:
                prom.CONCURRENT_REQUESTS.inc()
                try:
                    if self._request_tracker and request_id:
                        self._request_tracker.mark_phase(
                            request_id,
                            phase="llm-inference",
                            state="running",
                            ack_source="queue-exit",
                        )
                        self._request_tracker.mark_transport_only(
                            request_id,
                            phase="llm-inference",
                        )
                    content = await client.generate(
                        messages,
                        max_tokens=request.constraints.maxTokens,
                        temperature=request.constraints.temperature,
                        top_p=request.constraints.topP,
                        top_k=request.constraints.topK,
                        min_p=request.constraints.minP,
                        presence_penalty=request.constraints.presencePenalty,
                        repetition_penalty=request.constraints.repetitionPenalty,
                        enable_thinking=request.constraints.enableThinking,
                        task_type=request.taskType.value,
                    )
                    usage = TokenUsage(
                        prompt=client.last_prompt_tokens,
                        completion=client.last_completion_tokens,
                    )
                    return content, usage
                finally:
                    prom.CONCURRENT_REQUESTS.dec()

        from app.mock.dispatcher import V1MockDispatcher

        request_id = get_request_id()
        if self._request_tracker and request_id:
            self._request_tracker.mark_phase(
                request_id,
                phase="llm-inference",
                state="running",
                ack_source="mock-dispatch",
            )

        dispatcher = V1MockDispatcher()
        content = await dispatcher.dispatch(request)
        return content, TokenUsage()

    def _failure(
        self,
        request: TaskRequest,
        start: float,
        status: TaskStatus,
        code: FailureCode,
        detail: str,
        retryable: bool = False,
    ) -> TaskFailureResponse:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        logger.warning(
            "[%s] Task failed (%s): %s",
            request.taskType, code, detail,
        )
        return TaskFailureResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=status,
            failureCode=code,
            failureDetail=detail,
            retryable=retryable,
            audit=self._build_audit(request, elapsed_ms),
        )

    async def _attempt_llm_and_validate(
        self,
        request: TaskRequest,
        messages: list[dict[str, str]],
    ) -> tuple[str, dict, TokenUsage, ValidationInfo] | _LlmAttemptFailure:
        """Steps 5-9: LLM 호출 → 파싱 → 검증. HTTP 에러는 propagate."""
        request_id = get_request_id()

        # 5. LLM 호출
        raw_response, token_usage = await self._call_llm(request, messages)

        # 5.5 빈 응답 조기 차단
        if not raw_response or not raw_response.strip():
            return _LlmAttemptFailure(
                status=TaskStatus.EMPTY_RESULT,
                code=FailureCode.EMPTY_RESPONSE,
                detail="LLM이 빈 응답을 반환했습니다 (thinking 모드 토큰 소진 가능성)",
                token_usage=token_usage,
            )

        # 6. 응답 파싱
        parsed = self._response_parser.parse(raw_response)
        if parsed is None:
            return _LlmAttemptFailure(
                status=TaskStatus.VALIDATION_FAILED,
                code=FailureCode.INVALID_SCHEMA,
                detail="LLM 응답 JSON 파싱 실패",
                token_usage=token_usage,
            )

        # 7. 빈 결과 확인
        if not parsed.get("summary") and not parsed.get("claims"):
            return _LlmAttemptFailure(
                status=TaskStatus.EMPTY_RESULT,
                code=FailureCode.EMPTY_RESPONSE,
                detail="LLM이 빈 응답을 반환했습니다",
                token_usage=token_usage,
            )

        # 8. Schema 검증
        if self._request_tracker and request_id:
            self._request_tracker.mark_phase(
                request_id,
                phase="validation",
                state="running",
                ack_source="validation-start",
            )
        validation = self._schema_validator.validate(parsed, request.taskType)
        if not validation.valid:
            return _LlmAttemptFailure(
                status=TaskStatus.VALIDATION_FAILED,
                code=FailureCode.INVALID_SCHEMA,
                detail="; ".join(validation.errors),
                token_usage=token_usage,
            )

        # 9. Evidence 검증
        allowed_refs = {ref.refId for ref in request.evidenceRefs}
        ev_valid, ev_errors = self._evidence_validator.validate(
            parsed, allowed_refs,
        )
        if not ev_valid:
            return _LlmAttemptFailure(
                status=TaskStatus.VALIDATION_FAILED,
                code=FailureCode.INVALID_GROUNDING,
                detail="; ".join(ev_errors),
                token_usage=token_usage,
            )

        return raw_response, parsed, token_usage, validation

    def _build_audit(
        self,
        request: TaskRequest,
        elapsed_ms: int,
        token_usage: TokenUsage | None = None,
        rag_hits: int = 0,
        retry_count: int = 0,
    ) -> AuditInfo:
        input_str = request.model_dump_json()
        input_hash = f"sha256:{hashlib.sha256(input_str.encode()).hexdigest()[:16]}"
        return AuditInfo(
            inputHash=input_hash,
            latencyMs=elapsed_ms,
            tokenUsage=token_usage or TokenUsage(),
            retryCount=retry_count,
            ragHits=rag_hits,
            createdAt=datetime.now(timezone.utc).isoformat(),
        )
