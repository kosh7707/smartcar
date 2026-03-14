from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone

from app.config import settings
from app.errors import LlmHttpError, LlmTimeoutError, LlmUnavailableError
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

# 단일 GPU — 동시 요청 시 응답 시간 증가 방지.
# vLLM은 concurrent 가능하지만, 단일 GPU에서는 순차가 안정적이다.
_llm_semaphore = asyncio.Semaphore(1)


class TaskPipeline:
    """v1 Task 처리 오케스트레이터.

    validate → build prompt → call LLM → parse → validate output
    → compute confidence → build response
    """

    def __init__(
        self,
        prompt_registry: PromptRegistry,
        model_registry: ModelProfileRegistry,
    ) -> None:
        self._prompt_registry = prompt_registry
        self._model_registry = model_registry
        self._prompt_builder = V1PromptBuilder()
        self._response_parser = V1ResponseParser()
        self._schema_validator = SchemaValidator()
        self._evidence_validator = EvidenceValidator()
        self._confidence_calculator = ConfidenceCalculator()

    async def execute(
        self,
        request: TaskRequest,
    ) -> TaskSuccessResponse | TaskFailureResponse:
        start = time.time()

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

        # 4. 프롬프트 조립
        messages = self._prompt_builder.build(request, prompt_entry)
        logger.debug(
            "[%s] Prompt built (%d messages)",
            request.taskType, len(messages),
        )

        # 5. LLM 호출
        raw_response: str
        token_usage = TokenUsage()
        try:
            raw_response, token_usage = await self._call_llm(request, messages)
        except LlmTimeoutError:
            return self._failure(
                request, start,
                TaskStatus.TIMEOUT,
                FailureCode.TIMEOUT,
                "LLM 요청 시간 초과",
            )
        except (LlmUnavailableError, LlmHttpError) as e:
            return self._failure(
                request, start,
                TaskStatus.MODEL_ERROR,
                FailureCode.MODEL_UNAVAILABLE,
                str(e),
            )

        # 5.5 빈 응답 조기 차단 (Qwen3 thinking 모드에서 content 빈 문자열 가능)
        if not raw_response or not raw_response.strip():
            return self._failure(
                request, start,
                TaskStatus.EMPTY_RESULT,
                FailureCode.EMPTY_RESPONSE,
                "LLM이 빈 응답을 반환했습니다 (thinking 모드 토큰 소진 가능성)",
            )

        # 6. 응답 파싱
        parsed = self._response_parser.parse(raw_response)
        if parsed is None:
            return self._failure(
                request, start,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_SCHEMA,
                "LLM 응답 JSON 파싱 실패",
            )

        # 7. 빈 결과 확인
        if not parsed.get("summary") and not parsed.get("claims"):
            return self._failure(
                request, start,
                TaskStatus.EMPTY_RESULT,
                FailureCode.EMPTY_RESPONSE,
                "LLM이 빈 응답을 반환했습니다",
            )

        # 8. Schema 검증
        validation = self._schema_validator.validate(parsed, request.taskType)

        # 9. Evidence 검증
        allowed_refs = {ref.refId for ref in request.evidenceRefs}
        ev_valid, ev_errors = self._evidence_validator.validate(
            parsed, allowed_refs,
        )
        if not ev_valid:
            return self._failure(
                request, start,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_GROUNDING,
                "; ".join(ev_errors),
            )

        # 10. Confidence 산출
        has_rules = bool(
            request.context.trusted.get("finding")
            or request.context.trusted.get("ruleMatches")
        )
        confidence, breakdown = self._confidence_calculator.calculate(
            parsed, allowed_refs,
            schema_valid=validation.valid,
            has_rule_results=has_rules,
        )

        # 11. Assessment 조립
        claims = [
            Claim(
                statement=c.get("statement", ""),
                supportingEvidenceRefs=c.get("supportingEvidenceRefs", []),
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

        elapsed_ms = int((time.time() - start) * 1000)
        audit = self._build_audit(request, elapsed_ms, token_usage)

        logger.info(
            "[%s] Task completed (%.2fs, confidence=%.4f)",
            request.taskType, elapsed_ms / 1000, confidence,
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
            from app.clients.real import RealLlmClient

            profile = self._model_registry.get_default()
            endpoint = profile.endpoint if profile else settings.llm_endpoint
            model = profile.modelName if profile else settings.llm_model
            api_key = profile.apiKey if profile else settings.llm_api_key

            client = RealLlmClient(
                endpoint=endpoint, model=model, api_key=api_key,
                enable_thinking=False, json_mode=True,
            )

            async with _llm_semaphore:
                content = await client.generate(
                    messages,
                    max_tokens=request.constraints.maxTokens,
                    temperature=0.3,
                )
                usage = TokenUsage(
                    prompt=client.last_prompt_tokens,
                    completion=client.last_completion_tokens,
                )
                return content, usage

        from app.mock.dispatcher import V1MockDispatcher

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
    ) -> TaskFailureResponse:
        elapsed_ms = int((time.time() - start) * 1000)
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
            audit=self._build_audit(request, elapsed_ms),
        )

    def _build_audit(
        self,
        request: TaskRequest,
        elapsed_ms: int,
        token_usage: TokenUsage | None = None,
    ) -> AuditInfo:
        input_str = request.model_dump_json()
        input_hash = f"sha256:{hashlib.sha256(input_str.encode()).hexdigest()[:16]}"
        return AuditInfo(
            inputHash=input_hash,
            latencyMs=elapsed_ms,
            tokenUsage=token_usage or TokenUsage(),
            retryCount=0,
            createdAt=datetime.now(timezone.utc).isoformat(),
        )
