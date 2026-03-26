import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from agent_shared.context import get_request_id, set_request_id
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
    from agent_shared.llm.caller import LlmCaller
    from agent_shared.llm.message_manager import MessageManager
    from agent_shared.llm.turn_summarizer import TurnSummarizer
    from agent_shared.policy.retry import RetryPolicy
    from app.policy.termination import TerminationPolicy
    from app.policy.tool_failure import ToolFailurePolicy
    from agent_shared.schemas.agent import BudgetState, ToolCostTier
    from agent_shared.tools.executor import ToolExecutor
    from app.tools.implementations.mock_tools import MockKnowledgeTool
    from agent_shared.tools.registry import ToolRegistry, ToolSchema
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
        name="code_graph.callers",
        description="특정 함수를 호출하는 함수 체인을 조회한다 (코드 그래프 기반). Phase 1에서 적재된 코드 그래프에서 역방향 BFS로 호출자를 추적한다.",
        parameters={
            "type": "object",
            "properties": {
                "function_name": {"type": "string", "description": "조회할 함수명 (예: 'popen', 'getenv')"},
                "depth": {"type": "integer", "description": "탐색 깊이 (기본 2)", "default": 2},
            },
            "required": ["function_name"],
        },
        cost_tier=ToolCostTier.MEDIUM,
    ))
    registry.register(ToolSchema(
        name="code_graph.search",
        description="자연어 쿼리로 코드 함수를 시맨틱 검색한다. 함수명 정확 매칭 + 벡터 유사도 + 호출 그래프 확장을 결합. 예: '시스템 명령을 실행하는 네트워크 핸들러'",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "자연어 검색 쿼리 또는 함수명 (예: 'popen을 호출하는 네트워크 함수')"},
                "top_k": {"type": "integer", "description": "최대 반환 건수 (기본 10)", "default": 10},
                "include_call_chain": {"type": "boolean", "description": "결과에 callers/callees 포함 (기본 true)", "default": True},
            },
            "required": ["query"],
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
                "source_filter": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "검색 소스 필터 (예: ['CWE'], ['ATT&CK'], ['CWE', 'CVE']). 미지정 시 전체 검색",
                },
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
    callers_tool = None

    search_tool = None

    if settings.llm_mode == "real":
        from app.tools.implementations.sast_tool import SastScanTool
        from app.tools.implementations.codegraph_phase1_tool import CodeGraphPhase1Tool
        from app.tools.implementations.codegraph_tool import CodeGraphCallersTool
        from app.tools.implementations.codegraph_search_tool import CodeGraphSearchTool
        from app.tools.implementations.knowledge_tool import KnowledgeTool
        from app.tools.implementations.sca_tool import ScaTool
        # 요청 timeoutMs의 절반을 SAST에 할당 (최소 120s)
        sast_timeout = max(120.0, request.constraints.timeoutMs / 1000.0 * 0.5)
        sast_impl = SastScanTool(timeout_s=sast_timeout)
        codegraph_impl = CodeGraphPhase1Tool()  # Phase 1: S4 /v1/functions
        sca_impl = ScaTool()
        # Phase 2 도구 등록 (LLM이 호출)
        callers_tool = CodeGraphCallersTool(base_url=settings.kb_endpoint)
        search_tool = CodeGraphSearchTool(base_url=settings.kb_endpoint)
        router.register_implementation("sast.scan", sast_impl)
        router.register_implementation("code_graph.callers", callers_tool)
        router.register_implementation("code_graph.search", search_tool)
        router.register_implementation("knowledge.search", KnowledgeTool())
    else:
        router.register_implementation("knowledge.search", MockKnowledgeTool())

    # ─── Phase 1: 결정론적 도구 실행 (LLM 없이) ───
    from app.core.phase_one import Phase1Executor, build_phase2_prompt

    phase1_budget_ms = int(request.constraints.timeoutMs * 0.6)
    phase1_executor = Phase1Executor(
        sast_tool=sast_impl,
        codegraph_tool=codegraph_impl,
        sca_tool=sca_impl,
        kb_endpoint=settings.kb_endpoint,
        sast_endpoint=settings.sast_endpoint,
        timeout_budget_ms=phase1_budget_ms,
    )
    phase1_result = await phase1_executor.execute(session)

    # Phase 2 코드 그래프 도구에 project_id 주입
    project_id = session.request.context.trusted.get("projectId", session.request.taskId)
    if settings.llm_mode == "real" and callers_tool:
        callers_tool.set_project_id(project_id)
    if settings.llm_mode == "real" and search_tool:
        search_tool.set_project_id(project_id)

    # ─── Phase 2 준비: LLM 프롬프트에 Phase 1 결과 주입 ───

    # LLM 구성
    if settings.llm_mode == "real":
        profile = _model_registry.get_default()
        llm_caller = LlmCaller(
            endpoint=profile.endpoint if profile else settings.llm_endpoint,
            model=profile.modelName if profile else settings.llm_model,
            api_key=profile.apiKey if profile else settings.llm_api_key,
            default_max_tokens=settings.agent_llm_max_tokens,
            service_id="s3-agent",
        )
    else:
        # mock 모드: 즉시 content 반환하는 mock caller
        from unittest.mock import AsyncMock, MagicMock
        import json
        from agent_shared.schemas.agent import LlmResponse
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
        result = await loop.run(session)

        # 분석 완료 시 프로젝트 메모리에 결과 저장
        if isinstance(result, TaskSuccessResponse) and project_id and settings.llm_mode == "real":
            await _save_analysis_memory(project_id, result)

        return result
    finally:
        if settings.llm_mode == "real" and hasattr(llm_caller, 'aclose'):
            await llm_caller.aclose()


async def _save_analysis_memory(project_id: str, result: TaskSuccessResponse) -> None:
    """분석 결과를 S5 프로젝트 메모리에 저장한다."""
    import httpx
    from datetime import datetime, timezone

    try:
        claims_summary = [
            {
                "statement": c.statement,
                "location": c.location,
                "severity": result.result.suggestedSeverity,
            }
            for c in result.result.claims
        ]

        memory_data = {
            "type": "analysis_history",
            "data": {
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "claimCount": len(result.result.claims),
                "severity": result.result.suggestedSeverity,
                "confidence": result.result.confidence,
                "claims": claims_summary,
            },
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {}
            request_id = get_request_id()
            if request_id:
                headers["X-Request-Id"] = request_id
            resp = await client.post(
                f"{settings.kb_endpoint}/v1/project-memory/{project_id}",
                json=memory_data,
                headers=headers,
            )
            if resp.status_code == 409:
                logger.info("[memory] 중복 메모리 (deduplicated): projectId=%s", project_id)
            elif resp.status_code == 503:
                logger.warning("[memory] S5 KB 미초기화 (503): projectId=%s", project_id)
            else:
                resp.raise_for_status()
                logger.info("[memory] 분석 결과 메모리 저장 완료: projectId=%s", project_id)
    except Exception as e:
        logger.warning("[memory] 분석 결과 메모리 저장 실패 (무시): %s", e)


async def _handle_generate_poc(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """generate-poc 요청: 미니 Phase 1(KB 조회) + 단일 LLM 호출로 PoC 생성."""
    import hashlib
    import json
    import re
    import time
    from datetime import datetime, timezone

    import httpx

    from agent_shared.context import get_request_id
    from agent_shared.observability import agent_log
    from app.pipeline.confidence import ConfidenceCalculator
    from app.pipeline.response_parser import V1ResponseParser
    from app.schemas.response import (
        AssessmentResult,
        AuditInfo,
        Claim,
        TokenUsage,
        ValidationInfo,
    )
    from app.types import FailureCode, TaskStatus
    from app.validators.evidence_validator import EvidenceValidator
    from app.validators.schema_validator import SchemaValidator

    start = time.monotonic()
    trusted = request.context.trusted
    claim = trusted.get("claim", {})
    files = trusted.get("files", [])
    project_id = trusted.get("projectId")
    request_id = get_request_id() or request.taskId

    agent_log(
        logger, "generate-poc 시작",
        component="generate_poc", phase="poc_start",
        claimLocation=claim.get("location"),
        fileCount=len(files),
    )

    # ─── 미니 Phase 1: KB 컨텍스트 수집 ───
    kb_context_lines = []

    async with httpx.AsyncClient(base_url=settings.kb_endpoint, timeout=10.0) as kb:
        headers = {"X-Request-Id": request_id} if request_id else {}

        # 1. 호출자 체인 조회 (claim.location에서 함수명 추출)
        target_func = _extract_function_from_claim(claim)
        if target_func and project_id:
            try:
                resp = await kb.get(
                    f"/v1/code-graph/{project_id}/callers/{target_func}",
                    params={"depth": 3},
                    headers=headers,
                )
                resp.raise_for_status()
                callers_data = resp.json()
                callers = callers_data.get("callers", [])
                if callers:
                    kb_context_lines.append(f"## 호출자 체인 ({target_func})")
                    for c in callers[:10]:
                        origin = ""
                        if c.get("origin"):
                            lib = c.get("original_lib") or c.get("originalLib") or "?"
                            origin = f" [{c['origin']}: {lib}]"
                        kb_context_lines.append(
                            f"- {c.get('name', '?')} ({c.get('file', '?')}:{c.get('line', '?')}){origin}"
                        )
                    kb_context_lines.append("")
            except Exception as e:
                agent_log(logger, f"PoC KB callers 조회 실패: {e}",
                          component="generate_poc", phase="kb_error", level=logging.WARNING)

        # 2. 위협 지식 검색 (CWE 기반)
        cwe_match = re.search(r"CWE-\d+", f"{claim.get('statement', '')} {claim.get('detail', '')}")
        if cwe_match:
            cwe_id = cwe_match.group(0)
            try:
                resp = await kb.post(
                    "/v1/search",
                    json={"query": cwe_id, "top_k": 3, "source_filter": ["CWE", "CAPEC"]},
                    headers=headers,
                )
                resp.raise_for_status()
                hits = resp.json().get("hits", [])
                if hits:
                    kb_context_lines.append(f"## 위협 지식 ({cwe_id})")
                    for h in hits:
                        kb_context_lines.append(
                            f"- [{h.get('source', '?')}/{h.get('id', '?')}] {h.get('title', '?')}"
                        )
                    kb_context_lines.append("")
            except Exception as e:
                agent_log(logger, f"PoC KB search 실패: {e}",
                          component="generate_poc", phase="kb_error", level=logging.WARNING)

    kb_context = "\n".join(kb_context_lines) if kb_context_lines else "(KB 컨텍스트 없음)"

    agent_log(
        logger, "generate-poc 미니 Phase 1 완료",
        component="generate_poc", phase="poc_phase1_end",
        kbContextLines=len(kb_context_lines),
    )

    # ─── LLM 프롬프트 조립 ───
    system_prompt = (
        "당신은 자동차 임베디드 보안 연구원입니다.\n"
        "정적 분석으로 발견된 취약점에 대한 PoC(Proof of Concept)를 작성합니다.\n\n"
        "## 당신의 임무\n"
        "1. 제공된 소스코드와 호출자 체인을 분석하여 취약점의 실제 트리거 조건을 파악하라\n"
        "2. 취약점 존재를 증명하는 최소한의 PoC 코드를 작성하라\n"
        "3. 실행 방법과 예상 결과를 명확하게 기술하라\n\n"
        "## PoC 작성 원칙\n"
        "- 취약점 존재를 **증명**하되, **파괴적 동작은 포함하지 마라** (id, whoami, echo 등 무해한 커맨드 사용)\n"
        "- PoC는 Python, curl, 또는 셸 스크립트로 작성하라 (재현 용이성 우선)\n"
        "- 실행 환경의 전제 조건 (타겟 서비스 기동, 포트, 인증 등)을 명시하라\n"
        "- 방어 우회가 필요한 경우 (ASLR, 스택 카나리 등) 그 한계를 caveat에 명시하라\n\n"
        "## 출력 형식\n"
        "**순수 JSON만 출력하라. ```json 코드 펜스, 인사말, 설명문을 절대 붙이지 마라. 첫 문자는 반드시 `{`이어야 한다.**\n"
        "반드시 아래 스키마를 정확히 따라라:\n"
        "```json\n"
        "{\n"
        '  "summary": "PoC 요약 (1문장)",\n'
        '  "claims": [{\n'
        '    "statement": "PoC가 증명하는 취약점 (1문장)",\n'
        '    "detail": "## PoC 코드\\n```python\\n...코드...\\n```\\n\\n## 실행 방법\\n1. ...\\n\\n## 예상 결과\\n...",\n'
        '    "supportingEvidenceRefs": ["eref-file-00"],\n'
        '    "location": "src/파일.cpp:줄번호"\n'
        "  }],\n"
        '  "caveats": ["PoC의 한계, 전제 조건"],\n'
        '  "usedEvidenceRefs": ["eref-file-00"],\n'
        '  "suggestedSeverity": "critical",\n'
        '  "needsHumanReview": true,\n'
        '  "recommendedNextSteps": ["취약점 수정 방법"],\n'
        '  "policyFlags": []\n'
        "}\n"
        "```\n"
        "- summary, claims, caveats, usedEvidenceRefs는 **최상위 필드로 필수**이다.\n"
        "- claims 안에 caveats를 넣지 마라. caveats는 최상위 필드이다.\n"
    )

    # 소스코드 포맷팅
    source_sections = []
    for f in files[:5]:
        source_sections.append(f"### {f.get('path', '?')}\n```cpp\n{f.get('content', '')}\n```")
    source_text = "\n\n".join(source_sections) if source_sections else "(소스코드 없음)"

    user_message = (
        f"## 분석된 취약점\n"
        f"- **statement**: {claim.get('statement', '?')}\n"
        f"- **detail**: {claim.get('detail', '?')}\n"
        f"- **location**: {claim.get('location', '?')}\n\n"
        f"{kb_context}\n\n"
        f"## 소스코드\n{source_text}\n\n"
        f"## 사용 가능한 Evidence Refs\n"
    )
    for ref in request.evidenceRefs:
        user_message += f"- `{ref.refId}` ({ref.artifactType}: {ref.locator.get('file', '?')})\n"

    # ─── LLM 호출 (LlmCaller — adaptive timeout + X-Timeout-Seconds 적용) ───
    from agent_shared.llm.caller import LlmCaller

    if settings.llm_mode == "real":
        profile = _model_registry.get_default()
        llm = LlmCaller(
            endpoint=profile.endpoint if profile else settings.llm_endpoint,
            model=profile.modelName if profile else settings.llm_model,
            api_key=profile.apiKey if profile else settings.llm_api_key,
            default_max_tokens=request.constraints.maxTokens or 8192,
            service_id="s3-agent",
        )
    else:
        from unittest.mock import AsyncMock, MagicMock
        from agent_shared.schemas.agent import LlmResponse as _LlmResp
        llm = MagicMock()
        llm.call = AsyncMock(return_value=_LlmResp(
            content='{"summary":"Mock PoC","claims":[{"statement":"mock","detail":"mock poc code"}],"caveats":[],"usedEvidenceRefs":[],"needsHumanReview":true,"recommendedNextSteps":[],"policyFlags":[]}',
            prompt_tokens=100, completion_tokens=50,
        ))
        llm.aclose = AsyncMock()

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]
        llm_response = await llm.call(
            messages,
            max_tokens=request.constraints.maxTokens or 8192,
            temperature=0.3,
        )
        raw = llm_response.content or ""
        prompt_tokens = llm_response.prompt_tokens
        completion_tokens = llm_response.completion_tokens
    except Exception as e:
        elapsed = int((time.monotonic() - start) * 1000)
        return TaskFailureResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=TaskStatus.MODEL_ERROR,
            failureCode=FailureCode.MODEL_UNAVAILABLE,
            failureDetail=str(e),
            retryable=True,
            audit=AuditInfo(
                inputHash="", latencyMs=elapsed,
                tokenUsage=TokenUsage(prompt=0, completion=0),
                retryCount=0, ragHits=0,
                createdAt=datetime.now(timezone.utc).isoformat(),
            ),
        )
    finally:
        if hasattr(llm, 'aclose'):
            await llm.aclose()

    # ─── 파싱 + 검증 ───
    parser = V1ResponseParser()
    parsed = parser.parse(raw)
    if parsed is None:
        parsed = {
            "summary": raw[:2000],
            "claims": [],
            "caveats": ["LLM이 구조화된 JSON 대신 자연어로 응답함"],
            "usedEvidenceRefs": [],
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }

    allowed_refs = {ref.refId for ref in request.evidenceRefs}
    schema_validator = SchemaValidator()
    evidence_validator = EvidenceValidator()
    schema_result = schema_validator.validate(parsed, request.taskType)
    evidence_valid, evidence_errors = evidence_validator.validate(parsed, allowed_refs)

    confidence_calc = ConfidenceCalculator()
    confidence, breakdown = confidence_calc.calculate(
        parsed, input_ref_ids=allowed_refs,
        schema_valid=schema_result.valid and evidence_valid,
        has_rule_results=True, rag_hits=len(kb_context_lines),
    )

    claims = [
        Claim(
            statement=c.get("statement", ""),
            detail=c.get("detail"),
            supportingEvidenceRefs=c.get("supportingEvidenceRefs", []),
            location=c.get("location"),
        )
        for c in parsed.get("claims", [])
        if isinstance(c, dict)
    ]

    elapsed = int((time.monotonic() - start) * 1000)
    input_str = json.dumps(request.model_dump(mode="json"), sort_keys=True)
    input_hash = f"sha256:{hashlib.sha256(input_str.encode()).hexdigest()[:16]}"

    agent_log(
        logger, "generate-poc 완료",
        component="generate_poc", phase="poc_end",
        claimCount=len(claims), latencyMs=elapsed,
        promptTokens=prompt_tokens, completionTokens=completion_tokens,
    )

    return TaskSuccessResponse(
        taskId=request.taskId,
        taskType=request.taskType,
        status=TaskStatus.COMPLETED,
        modelProfile="poc-v1",
        promptVersion="generate-poc-v1",
        schemaVersion="agent-v1",
        validation=ValidationInfo(
            valid=schema_result.valid and evidence_valid,
            errors=schema_result.errors + evidence_errors,
        ),
        result=AssessmentResult(
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
        ),
        audit=AuditInfo(
            inputHash=input_hash,
            latencyMs=elapsed,
            tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
            retryCount=0,
            ragHits=len(kb_context_lines),
            createdAt=datetime.now(timezone.utc).isoformat(),
        ),
    )


def _extract_function_from_claim(claim: dict) -> str | None:
    """claim의 statement/detail에서 위험 함수명을 추출한다."""
    import re
    text = f"{claim.get('statement', '')} {claim.get('detail', '')}"
    # 위험 함수 목록에서 매칭
    dangerous = {"popen", "system", "exec", "getenv", "readlink", "strcpy", "sprintf", "gets"}
    for func in dangerous:
        if func in text.lower():
            return func
    # 일반 함수명 패턴 (xxx() 형태)
    match = re.search(r"\b([a-zA-Z_]\w+)\(\)", text)
    return match.group(1) if match else None


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
        elif request.taskType == TaskType.GENERATE_POC:
            result = await _handle_generate_poc(request)
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
        "service": "s3-agent",
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
