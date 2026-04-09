"""Build-resolve task handler extracted from tasks router."""

from __future__ import annotations

import hashlib
import json
import logging
import os

from app.config import settings
from agent_shared.context import get_request_id
from app.routers.build_route_support import (
    build_system_prompt as _build_system_prompt,
    run_build_request_preflight as _run_build_request_preflight,
)
from app.schemas.request import TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse
from app.validators.build_request_contract import normalize_contract_version

logger = logging.getLogger(__name__)


async def handle_build_resolve(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """build-resolve v2: 빌드 스크립트 작성 + 빌드 성공."""
    from app.budget.manager import BudgetManager
    from app.budget.token_counter import TokenCounter
    from app.core.agent_loop import AgentLoop
    from app.core.agent_session import AgentSession
    from app.core.result_assembler import ResultAssembler
    from agent_shared.llm.caller import LlmCaller
    from agent_shared.llm.message_manager import MessageManager
    from agent_shared.llm.turn_summarizer import TurnSummarizer
    from agent_shared.policy.retry import RetryPolicy
    from app.policy.file_policy import FilePolicy
    from app.policy.termination import TerminationPolicy
    from app.policy.tool_failure import ToolFailurePolicy
    from agent_shared.schemas.agent import BudgetState, ToolCostTier
    from agent_shared.tools.executor import ToolExecutor
    from agent_shared.tools.registry import ToolRegistry, ToolSchema, ToolSideEffect
    from app.tools.router import ToolRouter
    from app.tools.implementations.list_files import ListFilesTool
    from app.tools.implementations.read_file import ReadFileTool
    from app.tools.implementations.write_file import WriteFileTool
    from app.tools.implementations.edit_file import EditFileTool
    from app.tools.implementations.delete_file import DeleteFileTool
    from app.tools.implementations.try_build import TryBuildTool

    preflight, failure = await _run_build_request_preflight(request)
    if failure is not None:
        return failure
    assert preflight is not None

    project_path = preflight.project_path
    target_path = preflight.target_path
    target_name = preflight.target_name
    request_id = get_request_id() or request.taskId

    # 서브프로젝트 스코핑: build-aegis/는 canonical subprojectPath 기준
    effective_root = os.path.join(project_path, target_path) if target_path else project_path

    # ─── 0. Request-scoped 빌드 워크스페이스 (동시 요청 격리) ───
    import shutil
    short_id = request_id[:8] if request_id else "default"
    build_subdir = f"build-aegis-{short_id}"
    build_aegis_dir = os.path.join(effective_root, build_subdir)
    if os.path.isdir(build_aegis_dir):
        shutil.rmtree(build_aegis_dir, ignore_errors=True)
        logger.info("[build] 이전 빌드 캐시 정리: %s", build_aegis_dir)

    # ─── 1. Phase 0 결정론적 사전 분석 ───
    from app.core.phase_zero import Phase0Executor
    phase0 = Phase0Executor(project_path, target_path)
    phase0_result = await phase0.execute(request_id)
    if preflight.contract.buildScriptHintText:
        phase0_result.build_system = "shell"
    build_material = {
        "setupScript": preflight.contract.setupScript or "",
        "toolchainTriplet": preflight.contract.toolchainTriplet or "",
        "buildEnvironment": preflight.contract.buildEnvironment,
        "buildScriptHintText": preflight.contract.buildScriptHintText or "",
    }
    build_files = phase0_result.build_files

    # ─── 1b. 초기 빌드 스크립트 결정론적 생성 (cmake/make/autotools 템플릿) ───
    initial_script = phase0.generate_initial_script(preflight.contract.setupScript)
    hint_preseeded = False
    if not initial_script and preflight.contract.buildScriptHintText:
        from app.policy.file_policy import FilePolicy
        hint_warnings = FilePolicy.scan_content(preflight.contract.buildScriptHintText)
        if not hint_warnings:
            initial_script = preflight.contract.buildScriptHintText
            hint_preseeded = True
        else:
            logger.warning("[build] caller build script hint ignored due to forbidden content: %s", hint_warnings)
    initial_script_hint = ""
    if initial_script:
        os.makedirs(os.path.join(effective_root, build_subdir), exist_ok=True)
        script_path = os.path.join(effective_root, build_subdir, "aegis-build.sh")
        with open(script_path, "w") as f:
            f.write(initial_script)
        initial_script_hint = (
            f"\n\n[Phase 0 자동 생성] {build_subdir}/aegis-build.sh에 "
            f"{phase0_result.build_system} 템플릿 스크립트가 생성되었다. "
            "이 스크립트를 기반으로 수정하거나, 필요 시 새로 작성하라."
        )
        logger.info("[build] 초기 스크립트 생성: %s (%s)", script_path, phase0_result.build_system)

    # ─── 2. 정책 엔진 (request-scoped build dir) ───
    file_policy = FilePolicy(effective_root, build_dir=build_subdir)

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

    # ─── 4. Tool 스키마 등록 ───
    registry = ToolRegistry()
    registry.register(ToolSchema(
        name="list_files",
        description="프로젝트 디렉토리 구조를 트리 형태로 반환한다. 전체 구조를 파악할 때 가장 먼저 사용하라.",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "(선택) 특정 하위 디렉토리만 탐색. 기본: 프로젝트 루트"},
                "max_depth": {"type": "integer", "description": "(선택) 탐색 깊이 제한. 기본: 3"},
            },
        },
        cost_tier=ToolCostTier.CHEAP,
        side_effect=ToolSideEffect.PURE,
    ))
    registry.register(ToolSchema(
        name="read_file",
        description="프로젝트 내 파일을 읽는다 (읽기 전용, 8KB 제한).",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "프로젝트 루트 기준 상대 경로"},
            },
            "required": ["path"],
        },
        cost_tier=ToolCostTier.CHEAP,
        side_effect=ToolSideEffect.READ,
    ))
    registry.register(ToolSchema(
        name="write_file",
        description=f"{build_subdir}/ 폴더 안에 파일을 생성한다 (빌드 스크립트, toolchain 파일 등).",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": f"{build_subdir}/ 기준 상대 경로 (예: 'aegis-build.sh')"},
                "content": {"type": "string", "description": "파일 내용"},
            },
            "required": ["path", "content"],
        },
        cost_tier=ToolCostTier.CHEAP,
        side_effect=ToolSideEffect.WRITE,
    ))
    registry.register(ToolSchema(
        name="edit_file",
        description=f"{build_subdir}/ 내 에이전트가 생성한 파일을 수정한다 (전체 덮어쓰기).",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": f"{build_subdir}/ 기준 상대 경로"},
                "content": {"type": "string", "description": "새 파일 내용 (전체 교체)"},
            },
            "required": ["path", "content"],
        },
        cost_tier=ToolCostTier.CHEAP,
        side_effect=ToolSideEffect.WRITE,
    ))
    registry.register(ToolSchema(
        name="delete_file",
        description=f"{build_subdir}/ 내 에이전트가 생성한 파일을 삭제한다.",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": f"{build_subdir}/ 기준 상대 경로"},
            },
            "required": ["path"],
        },
        cost_tier=ToolCostTier.CHEAP,
        side_effect=ToolSideEffect.WRITE,
    ))
    registry.register(ToolSchema(
        name="try_build",
        description="S4에 빌드 명령어를 전송하여 실행한다. exitCode=0이면 성공.",
        parameters={
            "type": "object",
            "properties": {
                "build_command": {"type": "string", "description": f"빌드 명령어 (예: 'bash {build_subdir}/aegis-build.sh')"},
                "build_environment": {
                    "type": "object",
                    "description": "(선택) caller가 제공한 명시적 환경변수 주입. 값은 문자열이어야 한다.",
                    "additionalProperties": {"type": "string"},
                },
            },
            "required": ["build_command"],
        },
        cost_tier=ToolCostTier.EXPENSIVE,
        side_effect=ToolSideEffect.EXECUTE,
    ))

    # ─── 5. Tool 구현체 등록 ───
    executor = ToolExecutor(timeout_ms=settings.agent_tool_timeout_ms)
    failure_policy = ToolFailurePolicy()
    tool_router = ToolRouter(registry, executor, bm, failure_policy)

    list_tool = ListFilesTool(effective_root)
    read_tool = ReadFileTool(effective_root)
    write_tool = WriteFileTool(effective_root, build_dir=build_subdir, file_policy=file_policy)
    edit_tool = EditFileTool(effective_root, file_policy, build_dir=build_subdir)
    delete_tool = DeleteFileTool(effective_root, file_policy, build_dir=build_subdir)
    provenance = request.context.trusted.get("provenance", {}) if isinstance(request.context.trusted, dict) else {}
    if not isinstance(provenance, dict):
        provenance = {}
    build_tool = TryBuildTool(
        settings.sast_endpoint,
        effective_root,
        request_id,
        default_build_environment=preflight.contract.buildEnvironment,
        provenance=provenance,
    )

    tool_router.register_implementation("list_files", list_tool)
    tool_router.register_implementation("read_file", read_tool)
    tool_router.register_implementation("write_file", write_tool)
    tool_router.register_implementation("edit_file", edit_tool)
    tool_router.register_implementation("delete_file", delete_tool)
    tool_router.register_implementation("try_build", build_tool)

    # ─── 6. 시스템 프롬프트 + LLM ───
    system_prompt = _build_system_prompt(
        build_material, build_files, project_path,
        target_path=target_path, target_name=target_name,
        phase0=phase0_result,
        build_subdir=build_subdir,
        initial_script_hint=initial_script_hint,
        build_contract=preflight,
    )
    build_source = os.path.join(project_path, target_path) if target_path else project_path
    user_message = (
        f"## 빌드 목표\n"
        f"`{build_source}` 프로젝트를 빌드하는 스크립트를 작성하고 빌드를 성공시켜라.\n\n"
        f"## 프로젝트 경로\n{project_path}\n"
    )
    if target_path:
        user_message += f"## 빌드 대상 서브프로젝트\n{target_path}\n"
    if preflight.contract.strictMode:
        user_message += (
            f"## 호출자 선언 contractVersion\n{normalize_contract_version(preflight.contract)}\n"
            f"## 호출자 선언 build.mode\n{preflight.contract.buildMode.value if preflight.contract.buildMode else 'unspecified'}\n"
        )
    if preflight.contract.buildScriptHintText:
        user_message += "## caller build script hint\nprovided (text-only, reference-only)\n"

    if settings.llm_mode == "real":
        llm_caller = LlmCaller(
            endpoint=settings.llm_endpoint,
            model=settings.llm_model,
            api_key=settings.llm_api_key,
            default_max_tokens=settings.agent_llm_max_tokens,
            service_id="s3-build",
        )
    else:
        from unittest.mock import AsyncMock, MagicMock
        from agent_shared.schemas.agent import LlmResponse

        mock_build_result = json.dumps({
            "summary": "[Mock] 빌드 에이전트 mock 응답",
            "buildResult": {
                "success": True,
                "buildCommand": f"bash {build_subdir}/aegis-build.sh",
                "buildScript": f"{build_subdir}/aegis-build.sh",
                "buildDir": build_subdir,
                "errorLog": None,
            },
            "claims": [{"statement": "Mock 빌드 완료", "supportingEvidenceRefs": []}],
            "caveats": ["Mock 모드"],
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
        result_assembler=ResultAssembler(model_name=settings.llm_model, prompt_version="build-v3"),
        turn_summarizer=TurnSummarizer(),
        retry_policy=RetryPolicy(max_retries=settings.agent_llm_retry_max),
    )

    try:
        if hint_preseeded:
            from agent_shared.schemas.agent import ToolTraceStep

            direct_command = f"bash {os.path.join(effective_root, build_subdir, 'aegis-build.sh')}"
            direct_result = await build_tool.execute({"build_command": direct_command})
            session.trace.append(
                ToolTraceStep(
                    step_id="step_hint_seed_01",
                    turn_number=0,
                    tool="try_build",
                    args_hash=hashlib.sha256(direct_command.encode()).hexdigest()[:16],
                    cost_tier="expensive",
                    duration_ms=0,
                    success=direct_result.success,
                    new_evidence_refs=direct_result.new_evidence_refs,
                    error=direct_result.error,
                )
            )
            if direct_result.success:
                direct_data = json.loads(direct_result.content)
                build_evidence = direct_data.get("buildEvidence", {})
                direct_content = json.dumps(
                    {
                        "summary": "caller build script hint를 참고해 생성한 build 스크립트로 빌드에 성공했다.",
                        "claims": [
                            {
                                "statement": "caller hint 기반 초기 build script가 성공적으로 실행되었다.",
                                "supportingEvidenceRefs": [],
                            }
                        ],
                        "caveats": [],
                        "usedEvidenceRefs": [],
                        "needsHumanReview": False,
                        "recommendedNextSteps": [],
                        "policyFlags": [],
                        "buildResult": {
                            "success": True,
                            "buildCommand": direct_command,
                            "buildScript": f"{build_subdir}/aegis-build.sh",
                            "buildDir": build_subdir,
                            "errorLog": None,
                            "producedArtifacts": [],
                            "declaredMode": preflight.contract.buildMode.value if preflight.contract.buildMode else None,
                            "sdkId": preflight.contract.sdkId,
                        },
                    },
                    ensure_ascii=False,
                )
                return ResultAssembler(model_name=settings.llm_model, prompt_version="build-v3").build(
                    direct_content,
                    session,
                )

        result = await loop.run(session)
        return result
    finally:
        if settings.llm_mode == "real" and hasattr(llm_caller, "aclose"):
            await llm_caller.aclose()
