import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.context import get_request_id, set_request_id
from app.pipeline.task_pipeline import TaskPipeline
from app.registry.model_registry import create_default_registry as create_model_registry
from app.registry.prompt_registry import create_default_registry as create_prompt_registry
from app.schemas.request import TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from app.types import TaskType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["v1"])

_prompt_registry = create_prompt_registry()
_model_registry = create_model_registry()

# 레거시 파이프라인 (기존 5개 task type용)
_pipeline = TaskPipeline(_prompt_registry, _model_registry)


def _json_response(
    data: TaskSuccessResponse | TaskFailureResponse,
) -> JSONResponse:
    request_id = get_request_id()
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(
        content=data.model_dump(mode="json"),
        headers=headers,
    )


async def _handle_deep_analyze(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """deep-analyze 요청을 AgentLoop로 처리한다."""
    from app.budget.manager import BudgetManager
    from app.budget.token_counter import TokenCounter
    from app.core.agent_loop import AgentLoop
    from app.core.agent_session import AgentSession
    from app.core.result_assembler import ResultAssembler
    from app.llm.caller import LlmCaller
    from app.llm.message_manager import MessageManager
    from app.llm.turn_summarizer import TurnSummarizer
    from app.policy.retry import RetryPolicy
    from app.policy.termination import TerminationPolicy
    from app.policy.tool_failure import ToolFailurePolicy
    from app.schemas.agent import BudgetState, ToolCostTier
    from app.tools.executor import ToolExecutor
    from app.tools.implementations.mock_tools import MockKnowledgeTool
    from app.tools.registry import ToolRegistry, ToolSchema
    from app.tools.router import ToolRouter

    # 예산 구성
    budget = BudgetState(
        max_steps=settings.agent_max_steps,
        max_completion_tokens=settings.agent_max_completion_tokens,
        max_cheap_calls=settings.agent_max_cheap_calls,
        max_medium_calls=settings.agent_max_medium_calls,
        max_expensive_calls=settings.agent_max_expensive_calls,
        max_consecutive_no_evidence=settings.agent_no_evidence_threshold,
    )
    bm = BudgetManager(budget)
    session = AgentSession(request, budget)

    # Tool 구성 — Phase 2에서 LLM이 호출 가능한 도구만 등록
    # (sast.scan은 Phase 1에서 자동 실행되므로 Phase 2 registry에서 제외)
    registry = ToolRegistry()
    registry.register(ToolSchema(
        name="code_graph.get_functions",
        description="소스 코드에서 함수 목록과 호출 관계를 추출한다 (clang AST 기반)",
        parameters={
            "type": "object",
            "properties": {
                "scanId": {"type": "string"},
                "projectId": {"type": "string"},
                "files": {"type": "array", "items": {"type": "object"}},
                "buildProfile": {"type": "object"},
            },
            "required": ["scanId", "projectId", "files"],
        },
        cost_tier=ToolCostTier.MEDIUM,
    ))
    registry.register(ToolSchema(
        name="knowledge.search",
        description="위협 지식 DB에서 공격 시나리오/CWE/CAPEC/CVE를 검색한다",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "검색 쿼리 (예: 'command injection CWE-78')"},
                "top_k": {"type": "integer", "description": "반환할 최대 결과 수", "default": 5},
            },
            "required": ["query"],
        },
        cost_tier=ToolCostTier.CHEAP,
    ))

    executor = ToolExecutor(timeout_ms=settings.agent_tool_timeout_ms)
    failure_policy = ToolFailurePolicy()
    router = ToolRouter(registry, executor, bm, failure_policy)

    # Tool 구현체 등록
    sast_impl = None
    codegraph_impl = None
    sca_impl = None

    if settings.llm_mode == "real":
        from app.tools.implementations.sast_tool import SastScanTool
        from app.tools.implementations.codegraph_tool import CodeGraphTool
        from app.tools.implementations.knowledge_tool import KnowledgeTool
        from app.tools.implementations.sca_tool import ScaTool
        sast_impl = SastScanTool()
        codegraph_impl = CodeGraphTool()
        sca_impl = ScaTool()
        router.register_implementation("sast.scan", sast_impl)
        router.register_implementation("code_graph.get_functions", codegraph_impl)
        router.register_implementation("knowledge.search", KnowledgeTool())
    else:
        router.register_implementation("knowledge.search", MockKnowledgeTool())

    # ─── Phase 1: 결정론적 도구 실행 (LLM 없이) ───
    from app.core.phase_one import Phase1Executor, build_phase2_prompt

    phase1_executor = Phase1Executor(
        sast_tool=sast_impl,
        codegraph_tool=codegraph_impl,
        sca_tool=sca_impl,
        kb_endpoint=settings.kb_endpoint,
        sast_endpoint=settings.sast_endpoint,
    )
    phase1_result = await phase1_executor.execute(session)

    # ─── Phase 2 준비: LLM 프롬프트에 Phase 1 결과 주입 ───

    # LLM 구성
    if settings.llm_mode == "real":
        profile = _model_registry.get_default()
        llm_caller = LlmCaller(
            endpoint=profile.endpoint if profile else settings.llm_endpoint,
            model=profile.modelName if profile else settings.llm_model,
            api_key=profile.apiKey if profile else settings.llm_api_key,
            default_max_tokens=settings.agent_llm_max_tokens,
        )
    else:
        # mock 모드: 즉시 content 반환하는 mock caller
        from unittest.mock import AsyncMock, MagicMock
        import json
        from app.schemas.agent import LlmResponse
        llm_caller = MagicMock()
        llm_caller.call = AsyncMock(return_value=LlmResponse(
            content=json.dumps({
                "summary": "[Mock] Deep analysis completed",
                "claims": [{"statement": "Mock analysis result", "supportingEvidenceRefs": []}],
                "caveats": ["This is a mock response"],
                "usedEvidenceRefs": [],
                "needsHumanReview": True,
                "recommendedNextSteps": [],
                "policyFlags": [],
            }),
            prompt_tokens=100, completion_tokens=50,
        ))

    # 프롬프트 조립 — Phase 1 결과를 포함
    system_prompt, user_message = build_phase2_prompt(
        phase1_result, request.context.trusted,
        evidence_refs=[ref.model_dump(mode="json") for ref in request.evidenceRefs],
    )
    mm = MessageManager(
        system_prompt=system_prompt,
        initial_user_message=user_message,
    )

    loop = AgentLoop(
        llm_caller=llm_caller,
        message_manager=mm,
        tool_registry=registry,
        tool_router=router,
        termination_policy=TerminationPolicy(timeout_ms=request.constraints.timeoutMs),
        budget_manager=bm,
        token_counter=TokenCounter(),
        result_assembler=ResultAssembler(),
        turn_summarizer=TurnSummarizer(),
        retry_policy=RetryPolicy(max_retries=settings.agent_llm_retry_max),
    )

    try:
        return await loop.run(session)
    finally:
        if settings.llm_mode == "real" and hasattr(llm_caller, 'aclose'):
            await llm_caller.aclose()


def _rebuild_pipeline(threat_search=None, llm_client=None) -> None:
    """lifespan에서 RAG/LLM 클라이언트 초기화 후 파이프라인 재구성."""
    global _pipeline
    enricher = None
    if threat_search:
        from app.rag.context_enricher import ContextEnricher
        enricher = ContextEnricher(threat_search)
    _pipeline = TaskPipeline(
        _prompt_registry, _model_registry,
        context_enricher=enricher, llm_client=llm_client,
    )


@router.post("/tasks")
async def create_task(request: TaskRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id"))
    logger.info(
        "[v1] Task received: taskId=%s, taskType=%s",
        request.taskId, request.taskType,
    )

    try:
        if request.taskType == TaskType.DEEP_ANALYZE:
            result = await _handle_deep_analyze(request)
        else:
            result = await _pipeline.execute(request)
    except Exception:
        logger.error("[v1] Unexpected error", exc_info=True)
        request_id = get_request_id()
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal server error",
                "errorDetail": {
                    "code": "INTERNAL_ERROR",
                    "message": "Internal server error",
                    "requestId": request_id,
                    "retryable": False,
                },
            },
            headers={"X-Request-Id": request_id} if request_id else {},
        )

    return _json_response(result)


@router.get("/health")
async def health(req: Request) -> dict:
    result = {
        "service": "aegis-analysis-agent",
        "status": "ok",
        "version": "0.1.0",
        "llmMode": settings.llm_mode,
        "modelProfiles": [
            p["profileId"] for p in _model_registry.list_all()
        ],
        "activePromptVersions": {
            p["taskType"]: p["version"]
            for p in _prompt_registry.list_all()
        },
        "agentConfig": {
            "maxSteps": settings.agent_max_steps,
            "maxCompletionTokens": settings.agent_max_completion_tokens,
            "toolBudget": {
                "cheap": settings.agent_max_cheap_calls,
                "medium": settings.agent_max_medium_calls,
                "expensive": settings.agent_max_expensive_calls,
            },
        },
    }
    if settings.llm_mode == "real":
        result["llmBackend"] = await _check_llm_backend()
        result["llmConcurrency"] = settings.llm_concurrency

    threat_search = getattr(req.app.state, "threat_search", None)
    result["rag"] = {
        "enabled": settings.rag_enabled,
        "kbEndpoint": settings.kb_endpoint,
        "status": "ok" if threat_search else "disabled",
    }

    return result


async def _check_llm_backend() -> dict:
    """S7 Gateway 연결 상태를 확인한다."""
    import httpx

    endpoint = settings.llm_endpoint  # S7 Gateway 주소

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{endpoint}/v1/health")
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": "ok",
                "gateway": endpoint,
                "gatewayLlmBackend": data.get("llmBackend"),
            }
    except Exception as e:
        return {"status": "unreachable", "gateway": endpoint, "error": str(e)}


@router.get("/models")
async def list_models() -> dict:
    return {"profiles": _model_registry.list_all()}


@router.get("/prompts")
async def list_prompts() -> dict:
    return {"prompts": _prompt_registry.list_all()}
