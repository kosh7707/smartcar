"""Build Agent — build-resolve 태스크 라우터.

S4 sdk-registry 조회 → 빌드 파일 자동 탐색 → AgentLoop(read/write/try_build) 실행.
"""
import glob
import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.context import get_request_id, set_request_id
from app.schemas.request import TaskRequest
from app.schemas.response import (
    AssessmentResult,
    AuditInfo,
    Claim,
    TaskFailureResponse,
    TaskSuccessResponse,
    TokenUsage,
    ValidationInfo,
)
from app.types import FailureCode, TaskStatus, TaskType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["v1"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json_response(data: TaskSuccessResponse | TaskFailureResponse) -> JSONResponse:
    request_id = get_request_id()
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(content=data.model_dump(mode="json"), headers=headers)


async def _fetch_sdk_registry(sast_endpoint: str, request_id: str | None) -> dict:
    """S4 GET /v1/sdk-registry 로 SDK/툴체인 정보를 가져온다."""
    try:
        headers = {"X-Request-Id": request_id} if request_id else {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{sast_endpoint}/v1/sdk-registry", headers=headers)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning("[build] S4 sdk-registry 조회 실패 (무시): %s", e)
        return {}


def _discover_build_files(project_path: str) -> list[str]:
    """프로젝트 내 빌드 관련 파일을 glob으로 탐색한다."""
    patterns = ["**/CMakeLists.txt", "**/Makefile", "**/*.sh", "**/*.cmake"]
    found: list[str] = []
    for pat in patterns:
        matches = glob.glob(os.path.join(project_path, pat), recursive=True)
        for m in matches:
            rel = os.path.relpath(m, project_path)
            if rel not in found:
                found.append(rel)
    return sorted(found)[:50]  # 상한


def _build_system_prompt(sdk_info: dict, build_files: list[str], project_path: str) -> str:
    """빌드 에이전트 시스템 프롬프트를 조립한다."""

    sdk_section = ""
    if sdk_info:
        sdk_section = (
            "## SDK / 툴체인 정보 (S4 sdk-registry)\n"
            f"```json\n{json.dumps(sdk_info, indent=2, ensure_ascii=False)}\n```\n\n"
        )

    build_file_section = ""
    if build_files:
        listing = "\n".join(f"- {f}" for f in build_files)
        build_file_section = f"## 발견된 빌드 파일\n{listing}\n\n"
    else:
        build_file_section = "## 발견된 빌드 파일\n(없음 — 수동으로 빌드 스크립트를 작성해야 할 수 있음)\n\n"

    return (
        "당신은 AEGIS Build Agent입니다.\n"
        "주어진 자동차 임베디드 C/C++ 프로젝트의 빌드를 성공시키는 것이 목표입니다.\n\n"
        "## 절대 규칙\n"
        "1. **빌드 출력은 반드시 `build-aegis/` 폴더 안에만 생성하라.** 프로젝트 소스 디렉터리에 직접 빌드 아티팩트를 생성하지 마라.\n"
        "2. **소스 코드를 절대 수정하지 마라.** read_file로 읽기만 허용된다.\n"
        "3. **금지 명령어**: rm, dd, curl, wget, git, docker, chmod, chown, patch, `sed -i` — 이 명령어는 try_build에서 자동 차단된다.\n"
        "4. write_file은 `build-aegis/` 하위 경로만 허용된다.\n\n"
        "## 허용 명령어 (try_build에서 사용 가능)\n"
        "source, cmake, make, gcc, g++, bear, mkdir, cd, export, echo\n\n"
        f"{sdk_section}"
        f"{build_file_section}"
        "## 빌드 전략 가이드\n"
        "1. 먼저 read_file로 CMakeLists.txt 또는 Makefile을 읽고 빌드 시스템을 파악하라.\n"
        "2. SDK/툴체인 정보가 있으면 해당 크로스 컴파일러 경로를 활용하라.\n"
        "3. CMake 프로젝트라면:\n"
        f"   - `mkdir -p {project_path}/build-aegis && cd {project_path}/build-aegis && cmake .. && make -j$(nproc)`\n"
        "   - 크로스 컴파일이 필요하면 toolchain 파일을 write_file로 생성 후 `-DCMAKE_TOOLCHAIN_FILE=...`\n"
        "4. bear를 사용하여 compile_commands.json을 생성하면 SAST 분석에 활용할 수 있다:\n"
        f"   - `cd {project_path}/build-aegis && bear -- make -j$(nproc)`\n"
        "5. 빌드 실패 시 에러 메시지를 분석하고 빌드 설정을 수정하여 재시도하라.\n"
        "6. 빌드 성공 후 compile_commands.json이 생성되었는지 확인하라.\n\n"
        "## 출력 형식\n"
        "**순수 JSON만 출력하라. 코드 펜스, 인사말, 설명문을 절대 붙이지 마라. 첫 문자는 반드시 `{`이어야 한다.**\n"
        "빌드 완료 시 다음 JSON 스키마로 최종 응답하라:\n"
        "```json\n"
        "{\n"
        '  "summary": "빌드 결과 요약 (1-2문장)",\n'
        '  "buildResult": {\n'
        '    "success": true,\n'
        '    "buildCommand": "실제 사용한 빌드 명령어",\n'
        '    "buildDir": "build-aegis",\n'
        '    "compileCommandsJson": true,\n'
        '    "artifacts": ["build-aegis/compile_commands.json", "build-aegis/..."],\n'
        '    "errorLog": null\n'
        "  },\n"
        '  "claims": [{"statement": "빌드 성공/실패 요약", "supportingEvidenceRefs": []}],\n'
        '  "caveats": ["빌드 제한사항/경고"],\n'
        '  "usedEvidenceRefs": [],\n'
        '  "needsHumanReview": false,\n'
        '  "recommendedNextSteps": ["다음 단계 제안"],\n'
        '  "policyFlags": []\n'
        "}\n"
        "```\n"
    )


# ---------------------------------------------------------------------------
# build-resolve handler
# ---------------------------------------------------------------------------

async def _handle_build_resolve(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """build-resolve 요청을 AgentLoop로 처리한다."""
    import hashlib

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
    from app.tools.registry import ToolRegistry, ToolSchema
    from app.tools.router import ToolRouter
    from app.tools.implementations.read_file import ReadFileTool
    from app.tools.implementations.write_file import WriteFileTool
    from app.tools.implementations.try_build import TryBuildTool

    start = time.monotonic()
    trusted = request.context.trusted
    project_path = trusted.get("projectPath", "/tmp/unknown")
    request_id = get_request_id() or request.taskId

    # ─── 1. S4 SDK registry 조회 ───
    sdk_info = await _fetch_sdk_registry(settings.sast_endpoint, request_id)

    # ─── 2. 빌드 파일 자동 탐색 ───
    build_files = _discover_build_files(project_path) if os.path.isdir(project_path) else []

    # ─── 3. 예산 구성 ───
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

    # ─── 4. Tool 등록 ───
    registry = ToolRegistry()
    registry.register(ToolSchema(
        name="read_file",
        description="프로젝트 내 파일을 읽는다 (읽기 전용, 50KB 제한). 빌드 설정 파일 확인에 사용.",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "프로젝트 루트 기준 상대 경로 (예: 'CMakeLists.txt')"},
            },
            "required": ["path"],
        },
        cost_tier=ToolCostTier.CHEAP,
    ))
    registry.register(ToolSchema(
        name="write_file",
        description="build-aegis/ 폴더 안에 파일을 생성한다 (toolchain 파일, 빌드 스크립트 등).",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "build-aegis/ 기준 상대 경로 (예: 'toolchain.cmake')"},
                "content": {"type": "string", "description": "파일 내용"},
            },
            "required": ["path", "content"],
        },
        cost_tier=ToolCostTier.CHEAP,
    ))
    registry.register(ToolSchema(
        name="try_build",
        description="S4에 빌드 명령어를 전송하여 실행한다. 빌드 성공 시 compile_commands.json이 생성될 수 있다.",
        parameters={
            "type": "object",
            "properties": {
                "build_command": {"type": "string", "description": "실행할 빌드 명령어 (예: 'cd build-aegis && cmake .. && make -j4')"},
            },
            "required": ["build_command"],
        },
        cost_tier=ToolCostTier.EXPENSIVE,
    ))

    executor = ToolExecutor(timeout_ms=settings.agent_tool_timeout_ms)
    failure_policy = ToolFailurePolicy()
    tool_router = ToolRouter(registry, executor, bm, failure_policy)

    # ─── 5. Tool 구현체 등록 ───
    read_tool = ReadFileTool(project_path)
    write_tool = WriteFileTool(project_path)
    build_tool = TryBuildTool(settings.sast_endpoint, project_path, request_id)

    tool_router.register_implementation("read_file", read_tool)
    tool_router.register_implementation("write_file", write_tool)
    tool_router.register_implementation("try_build", build_tool)

    # ─── 6. 시스템 프롬프트 + LLM ───
    system_prompt = _build_system_prompt(sdk_info, build_files, project_path)
    objective = trusted.get("objective", "프로젝트 빌드를 성공시키고 compile_commands.json을 생성하라.")
    user_message = (
        f"## 빌드 목표\n{objective}\n\n"
        f"## 프로젝트 경로\n{project_path}\n"
    )

    if settings.llm_mode == "real":
        llm_caller = LlmCaller(
            endpoint=settings.llm_endpoint,
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            default_max_tokens=settings.agent_llm_max_tokens,
        )
    else:
        # mock 모드: 즉시 content 반환
        from unittest.mock import AsyncMock, MagicMock
        from app.schemas.agent import LlmResponse

        mock_build_result = json.dumps({
            "summary": "[Mock] 빌드 에이전트 mock 응답 — 실제 빌드 미수행",
            "buildResult": {
                "success": True,
                "buildCommand": "cmake .. && make -j4",
                "buildDir": "build-aegis",
                "compileCommandsJson": False,
                "artifacts": [],
                "errorLog": None,
            },
            "claims": [{"statement": "Mock 빌드 완료", "supportingEvidenceRefs": []}],
            "caveats": ["Mock 모드 — 실제 빌드가 수행되지 않았음"],
            "usedEvidenceRefs": [],
            "needsHumanReview": True,
            "recommendedNextSteps": ["실제 LLM 모드에서 빌드 재시도"],
            "policyFlags": [],
        }, ensure_ascii=False)

        llm_caller = MagicMock()
        llm_caller.call = AsyncMock(return_value=LlmResponse(
            content=mock_build_result,
            prompt_tokens=100,
            completion_tokens=80,
        ))

    mm = MessageManager(system_prompt=system_prompt, initial_user_message=user_message)

    loop = AgentLoop(
        llm_caller=llm_caller,
        message_manager=mm,
        tool_registry=registry,
        tool_router=tool_router,
        termination_policy=TerminationPolicy(timeout_ms=request.constraints.timeoutMs),
        budget_manager=bm,
        token_counter=TokenCounter(),
        result_assembler=ResultAssembler(),
        turn_summarizer=TurnSummarizer(),
        retry_policy=RetryPolicy(max_retries=settings.agent_llm_retry_max),
    )

    try:
        result = await loop.run(session)
        return result
    finally:
        if settings.llm_mode == "real" and hasattr(llm_caller, "aclose"):
            await llm_caller.aclose()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/tasks")
async def create_task(request: TaskRequest, req: Request) -> JSONResponse:
    set_request_id(req.headers.get("x-request-id"))
    logger.info("[v1] Task received: taskId=%s, taskType=%s", request.taskId, request.taskType)

    try:
        if request.taskType == TaskType.BUILD_RESOLVE:
            result = await _handle_build_resolve(request)
        else:
            request_id = get_request_id()
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"Unsupported taskType: {request.taskType}",
                    "errorDetail": {
                        "code": "UNKNOWN_TASK_TYPE",
                        "message": f"Build Agent only supports 'build-resolve', got '{request.taskType}'",
                        "requestId": request_id,
                        "retryable": False,
                    },
                },
                headers={"X-Request-Id": request_id} if request_id else {},
            )
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
async def health() -> dict:
    return {
        "service": "s3-build",
        "status": "ok",
        "version": "0.1.0",
        "llmMode": settings.llm_mode,
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
