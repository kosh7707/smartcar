"""Build Agent v2 — build-resolve 태스크 라우터.

S4 sdk-registry 조회 → 빌드 파일 자동 탐색 → AgentLoop(read/write/edit/delete/try_build) 실행.
목표: 빌드 스크립트(build-aegis/aegis-build.sh) 작성 + 빌드 성공.
"""
import glob
import json
import logging
import os
import time
from datetime import datetime, timezone

from agent_shared.llm.prompt_builder import SystemPromptBuilder

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import settings
from agent_shared.context import get_request_id, set_request_id
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


def _discover_build_files(project_path: str, target_path: str = "") -> list[str]:
    """프로젝트 내 빌드 관련 파일을 탐색한다. depth 3 이내, 노이즈 디렉토리 제외."""
    _EXCLUDE_DIRS = {"build", "build-wsl", "build-aegis", "CMakeFiles", ".git", "__pycache__",
                     "test", "tests", "doc", "docs", "example", "examples", "unittest",
                     "third_party", "vendor", "external", "deps"}

    search_root = os.path.join(project_path, target_path) if target_path else project_path
    if not os.path.isdir(search_root):
        search_root = project_path

    patterns = ["**/CMakeLists.txt", "**/Makefile", "**/*.sh", "**/*.cmake"]
    found: list[str] = []
    for pat in patterns:
        matches = glob.glob(os.path.join(search_root, pat), recursive=True)
        for m in matches:
            rel = os.path.relpath(m, project_path)
            parts = rel.split(os.sep)
            # depth 4 이상은 서드파티일 가능성 높음 → 제외
            if len(parts) > 4:
                continue
            if any(p in _EXCLUDE_DIRS for p in parts):
                continue
            if rel not in found:
                found.append(rel)
    return sorted(found)[:20]


def _build_system_prompt(
    sdk_info: dict,
    build_files: list[str],
    project_path: str,
    target_path: str = "",
    target_name: str = "",
    phase0: object | None = None,
    build_subdir: str = "build-aegis",
    initial_script_hint: str = "",
) -> str:
    """빌드 에이전트 v3 시스템 프롬프트."""

    sdk_section = ""
    sdk_dir_hint = ""
    if sdk_info:
        # SDK 경로 추출 (setupScript에서 상위 디렉토리)
        sdks = sdk_info.get("sdks", [])
        if sdks:
            setup = sdks[0].get("setupScript", "")
            if setup:
                # e.g. /home/kosh/sdks/ti-am335x/linux-devkit/environment-setup-... → /home/kosh/sdks/ti-am335x
                parts = setup.split("/linux-devkit/")
                if len(parts) >= 2:
                    sdk_dir_hint = parts[0]
        sdk_section = (
            "## SDK / 툴체인 정보 (S4 sdk-registry)\n"
            f"```json\n{json.dumps(sdk_info, indent=2, ensure_ascii=False)}\n```\n"
        )
        if sdk_dir_hint:
            sdk_section += (
                f"SDK 경로: `{sdk_dir_hint}`\n"
                f"try_build 호출 시 buildCommand 앞에 `SDK_DIR={sdk_dir_hint}`를 붙여라.\n"
                f"예: `SDK_DIR={sdk_dir_hint} bash {build_subdir}/aegis-build.sh`\n\n"
            )
        else:
            sdk_section += "\n"

    build_file_section = ""
    if build_files:
        listing = "\n".join(f"- {f}" for f in build_files)
        build_file_section = f"## 발견된 빌드 파일\n{listing}\n\n"
    else:
        build_file_section = "## 발견된 빌드 파일\n(없음 — 빌드 스크립트를 처음부터 작성해야 함)\n\n"

    # Phase 0 결정론적 사전 분석 결과
    phase0_section = ""
    if phase0 is not None:
        bs = getattr(phase0, "build_system", "unknown")
        langs = ", ".join(getattr(phase0, "detected_languages", [])) or "미탐지"
        tree = getattr(phase0, "project_tree", "")
        has_script = getattr(phase0, "has_existing_build_script", False)
        script_path = getattr(phase0, "existing_script_path", "")

        strategy_hint = {
            "cmake": "CMakeLists.txt를 read_file로 읽고, cmake 기반 빌드 스크립트를 작성하라.",
            "make": "Makefile를 read_file로 읽고, make 기반 빌드 스크립트를 작성하라.",
            "autotools": "./configure를 실행한 뒤 make를 호출하는 스크립트를 작성하라.",
            "shell": f"기존 빌드 스크립트({script_path})를 read_file로 읽고 참고하여 {build_subdir}/aegis-build.sh를 작성하라.",
            "unknown": "프로젝트 구조를 list_files로 탐색한 뒤 빌드 방법을 추론하라.",
        }.get(bs, "")

        phase0_section = (
            "## 사전 분석 결과 (Phase 0 — 자동 탐지)\n"
            f"- **빌드 시스템**: {bs}\n"
            f"- **탐지된 언어**: {langs}\n"
            f"- **기존 빌드 스크립트**: {'있음 — `' + script_path + '`' if has_script else '없음'}\n"
        )
        if tree:
            phase0_section += f"\n### 프로젝트 구조 (자동 생성)\n```\n{tree}\n```\n"
        if strategy_hint:
            phase0_section += f"\n**권장 전략**: {strategy_hint}\n\n"
        if initial_script_hint:
            phase0_section += initial_script_hint + "\n\n"

    if target_path:
        build_source = os.path.join(project_path, target_path)
        target_desc = f"`{target_path}` (서브프로젝트)"
    else:
        build_source = project_path
        target_desc = "프로젝트 루트"

    target_section = ""
    if target_path or target_name:
        target_section = (
            "## 빌드 대상\n"
            f"- **타겟 이름**: {target_name or '(미지정)'}\n"
            f"- **빌드 소스 디렉토리**: {build_source}\n"
            f"- **범위**: {target_desc}\n"
            "- **이 타겟만 빌드하라.** 다른 디렉토리의 빌드는 시도하지 마라.\n\n"
        )

    builder = SystemPromptBuilder()

    builder.add_section("역할",
        "당신은 AEGIS Build Agent입니다.\n"
        "주어진 자동차 임베디드 C/C++ 프로젝트를 빌드하는 스크립트를 작성하는 것이 유일한 목표입니다."
    )

    builder.add_section("최종 산출물",
        f"1. `{build_subdir}/aegis-build.sh` — 프로젝트를 빌드하는 완전한 셸 스크립트\n"
        f"2. `buildCommand` — 해당 스크립트를 실행하는 명령어 (예: `bash {build_source}/{build_subdir}/aegis-build.sh`)"
    )

    builder.add_section("절대 규칙",
        "1. **소스 코드를 절대 수정하지 마라.** read_file로 읽기만 허용된다.\n"
        f"2. **write_file/edit_file/delete_file은 `{build_subdir}/` 하위만 허용된다.** edit/delete는 네가 생성한 파일만 가능.\n"
        "3. try_build가 성공하면 즉시 최종 보고서를 JSON으로 출력하라.\n"
        "4. 3회 연속 빌드 실패 시 즉시 진단 보고서를 JSON으로 출력하라.\n"
        "5. **bear, compile_commands.json을 언급하거나 사용하지 마라.** 후속 처리는 S4가 담당한다."
    )

    # 동적 섹션 — 조건부 추가
    if target_section:
        builder.add_section("빌드 대상", target_section)
    if phase0_section:
        builder.add_section("사전 분석", phase0_section)
    if sdk_section:
        builder.add_section("SDK 정보", sdk_section)
    if build_file_section:
        builder.add_section("빌드 파일", build_file_section)

    builder.mark_dynamic_boundary("절대 규칙")

    builder.add_section("빌드 전략",
        "### 1단계: 탐색 (list_files → read_file, 최대 2턴)\n"
        "**첫 번째 동작은 반드시 `list_files`로 프로젝트 구조를 파악하라.** 이후 핵심 빌드 파일 1~2개만 read_file로 읽어라.\n"
        "우선순위: 셸 스크립트(scripts/cross_build.sh, build.sh) > CMakeLists.txt > Makefile\n"
        "기존 빌드 스크립트가 있으면 **참고**하되, 그대로 실행하지 말고 **네가 직접 빌드 스크립트를 작성**하라.\n"
        "탐색 시 반드시 확인하라:\n"
        "1. SDK/toolchain 필요 여부 (CC 변수, CMAKE_C_COMPILER 확인)\n"
        "2. 외부 의존성 (find_package, pkg-config, -l 플래그 확인)\n"
        "3. 특수 빌드 요구사항 (autoconf, cmake 최소 버전 등)\n"
        "**read_file 없이 write_file을 호출하지 마라.** 최소 1개의 빌드 관련 파일을 read_file로 읽은 후에만 스크립트를 작성할 수 있다.\n"
        "**3턴째에는 반드시 write_file로 빌드 스크립트를 작성하라. 탐색을 더 하지 마라.**\n\n"
        "### 2단계: 빌드 스크립트 작성 (write_file)\n"
        f"`{build_subdir}/aegis-build.sh`에 빌드 스크립트를 작성하라. 스크립트 요구사항:\n"
        f"- 빌드 출력은 `{build_source}/{build_subdir}/`에 생성\n"
        "- SDK가 필요하면 스크립트 안에서 `$SDK_DIR` 환경변수를 사용. try_build 호출 시 `SDK_DIR=<경로> bash ...` 형태로 전달.\n"
        "- 소스 코드를 수정하지 말 것\n"
        "- 첫 줄은 `#!/bin/bash`\n"
        f"- **중요: 스크립트는 `{build_subdir}/` 안에 위치한다. 프로젝트 루트는 스크립트의 상위 디렉토리이다.**\n"
        f"  올바른 경로 설정: `PROJECT_ROOT=\"$(cd \"$(dirname \"$0\")/..\" && pwd)\"`\n"
        f"  잘못된 예: `ROOT_DIR=\"$(dirname \"$0\")\"` ← 이러면 {build_subdir}/ 자체를 루트로 잡음\n\n"
        "### 3단계: 빌드 실행 (try_build) — write_file 직후 즉시 실행\n"
        f"SDK가 있으면: `build_command: \"SDK_DIR=<sdk경로> bash {build_source}/{build_subdir}/aegis-build.sh\"`\n"
        f"SDK가 없으면: `build_command: \"bash {build_source}/{build_subdir}/aegis-build.sh\"`\n\n"
        "### 4단계: 실패 복구\n"
        "에러 유형에 따라 복구 전략을 선택하라:\n"
        "- **누락 헤더** (*.h not found): `-I` 플래그를 추가하거나, SDK sysroot 내에서 헤더 경로를 찾아라.\n"
        "- **미정의 심볼** (undefined reference): `-l` 링커 플래그를 추가하거나, `-L`로 라이브러리 경로를 지정하라.\n"
        "- **툴체인 미발견** (gcc not found): SDK 환경 스크립트 source 경로가 올바른지 확인하라.\n"
        "- **CMake 오류**: CMakeLists.txt를 read_file로 다시 읽고, 누락 패키지나 경로 오류를 확인하라.\n"
        "- **소스 코드 오류**: 빌드 스크립트 오류인지 소스 코드 오류인지 구분하라. 소스 코드 오류면 caveats에 기록.\n"
        "edit_file로 스크립트를 수정한 후 즉시 try_build를 재시도하라. **같은 수정을 반복하지 마라.**\n"
        "try_build 실패 후 read_file로 스크립트를 확인하여, 수정이 올바르게 적용되었는지 검증하라.\n"
        "**edit_file → try_build를 한 턴 안에서 같이 호출하라. 수정 후 빌드를 분리하지 마라.**"
    )

    builder.add_section("출력 형식",
        "**순수 JSON만 출력하라. 코드 펜스(```), 인사말, 설명문을 절대 붙이지 마라. 첫 문자는 반드시 `{`이어야 한다.**\n"
        "```json\n"
        "{\n"
        '  "summary": "빌드 결과 요약 (1-2문장)",\n'
        '  "buildResult": {\n'
        '    "success": true,\n'
        '    "buildCommand": "실제 사용한 빌드 명령어",\n'
        f'    "buildScript": "{build_subdir}/aegis-build.sh",\n'
        f'    "buildDir": "{build_subdir}",\n'
        '    "errorLog": null\n'
        "  },\n"
        '  "claims": [{"statement": "빌드 성공/실패 요약", "supportingEvidenceRefs": []}],\n'
        '  "caveats": ["빌드 제한사항/경고"],\n'
        '  "usedEvidenceRefs": [],\n'
        '  "needsHumanReview": false,\n'
        '  "recommendedNextSteps": ["다음 단계 제안"],\n'
        '  "policyFlags": []\n'
        "}\n"
        "```"
    )

    builder.set_suffix("/no_think")
    return builder.build()


# ---------------------------------------------------------------------------
# build-resolve handler
# ---------------------------------------------------------------------------

async def _handle_build_resolve(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
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

    trusted = request.context.trusted
    project_path = trusted.get("projectPath", "/tmp/unknown")
    target_path = trusted.get("targetPath", "")
    target_name = trusted.get("targetName", "")
    request_id = get_request_id() or request.taskId

    # 서브프로젝트 스코핑: build-aegis/는 targetPath 기준
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
    phase0 = Phase0Executor(project_path, target_path, settings.sast_endpoint)
    phase0_result = await phase0.execute(request_id)

    sdk_info = phase0_result.sdk_info
    build_files = phase0_result.build_files

    # ─── 1b. 초기 빌드 스크립트 결정론적 생성 (cmake/make/autotools 템플릿) ───
    initial_script = phase0.generate_initial_script(sdk_info)
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
                "sdk_id": {"type": "string", "description": "(선택) SDK ID — S4가 자동으로 SDK 환경을 설정한다"},
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
    build_tool = TryBuildTool(settings.sast_endpoint, effective_root, request_id)

    tool_router.register_implementation("list_files", list_tool)
    tool_router.register_implementation("read_file", read_tool)
    tool_router.register_implementation("write_file", write_tool)
    tool_router.register_implementation("edit_file", edit_tool)
    tool_router.register_implementation("delete_file", delete_tool)
    tool_router.register_implementation("try_build", build_tool)

    # ─── 6. 시스템 프롬프트 + LLM ───
    system_prompt = _build_system_prompt(
        sdk_info, build_files, project_path,
        target_path=target_path, target_name=target_name,
        phase0=phase0_result,
        build_subdir=build_subdir,
        initial_script_hint=initial_script_hint,
    )
    build_source = os.path.join(project_path, target_path) if target_path else project_path
    user_message = (
        f"## 빌드 목표\n"
        f"`{build_source}` 프로젝트를 빌드하는 스크립트를 작성하고 빌드를 성공시켜라.\n\n"
        f"## 프로젝트 경로\n{project_path}\n"
    )
    if target_path:
        user_message += f"## 빌드 대상 서브프로젝트\n{target_path}\n"

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
        result = await loop.run(session)
        return result
    finally:
        if settings.llm_mode == "real" and hasattr(llm_caller, "aclose"):
            await llm_caller.aclose()


# ---------------------------------------------------------------------------
# sdk-analyze handler
# ---------------------------------------------------------------------------

def _build_sdk_analyze_prompt(sdk_path: str) -> str:
    """sdk-analyze 시스템 프롬프트."""
    return (
        "당신은 AEGIS SDK Analyzer입니다.\n"
        "주어진 SDK 디렉토리를 분석하여 프로파일 정보를 추출하는 것이 유일한 목표입니다.\n\n"
        "## 분석 대상\n"
        f"SDK 경로: `{sdk_path}`\n\n"
        "## 분석 전략\n\n"
        "### 1단계: SDK 구조 탐색 (read_file)\n"
        "1. `environment-setup-*` 스크립트를 찾아 읽어라 → compilerPrefix, sysroot, CFLAGS, defines 추출\n"
        "2. `*/bin/*-gcc` 경로를 확인 → compiler 경로\n"
        "3. SDK 루트의 README, Makefile, setup.sh 등을 읽어 → 벤더/제품명 파악\n\n"
        "### 2단계: 컴파일러 확인 (try_build, 선택)\n"
        "컴파일러 버전을 확인하려면 try_build로 `{compiler} --version` 실행 가능.\n\n"
        "### 3단계: 보고서 작성\n"
        "탐색 결과를 아래 JSON 스키마로 출력하라.\n\n"
        "## 절대 규칙\n"
        "1. SDK 파일을 수정하지 마라. read_file로 읽기만.\n"
        "2. write_file/edit_file/delete_file은 사용하지 마라 (SDK 분석에 파일 생성 불필요).\n\n"
        "## 출력 형식\n"
        "**순수 JSON만 출력. 코드 펜스, 인사말 금지. 첫 문자는 `{`.**\n"
        "```json\n"
        "{\n"
        '  "summary": "SDK 분석 결과 요약 (1-2문장)",\n'
        '  "sdkProfile": {\n'
        '    "compiler": "arm-none-linux-gnueabihf-gcc (절대 경로)",\n'
        '    "compilerPrefix": "arm-none-linux-gnueabihf",\n'
        '    "gccVersion": "9.2.1",\n'
        '    "targetArch": "armv7-a",\n'
        '    "languageStandard": "c11",\n'
        '    "sysroot": "SDK 내 상대 경로",\n'
        '    "environmentSetup": "SDK 내 environment-setup 스크립트 상대 경로",\n'
        '    "includePaths": ["sysroot 내 include 경로"],\n'
        '    "defines": {"__ARM_ARCH": "7", ...}\n'
        "  },\n"
        '  "claims": [{"statement": "발견 사항", "supportingEvidenceRefs": []}],\n'
        '  "caveats": ["제한사항"],\n'
        '  "usedEvidenceRefs": [],\n'
        '  "needsHumanReview": false,\n'
        '  "recommendedNextSteps": [],\n'
        '  "policyFlags": []\n'
        "}\n"
        "```\n"
    )


async def _handle_sdk_analyze(request: TaskRequest) -> TaskSuccessResponse | TaskFailureResponse:
    """sdk-analyze: SDK 디렉토리 분석 → sdkProfile 추출."""
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
    from agent_shared.tools.registry import ToolRegistry, ToolSchema, ToolSideEffect
    from app.tools.router import ToolRouter
    from app.tools.implementations.read_file import ReadFileTool
    from app.tools.implementations.try_build import TryBuildTool

    trusted = request.context.trusted
    sdk_path = trusted.get("projectPath", "/tmp/unknown")
    request_id = get_request_id() or request.taskId

    # sdk-analyze는 read_file + try_build(컴파일러 버전 확인용)만 사용
    budget = BudgetState(
        max_steps=settings.agent_max_steps,
        max_completion_tokens=settings.agent_max_completion_tokens,
        max_cheap_calls=settings.agent_max_cheap_calls,
        max_medium_calls=0,
        max_expensive_calls=2,  # 컴파일러 --version 확인용
        max_consecutive_no_evidence=settings.agent_no_evidence_threshold,
    )
    bm = BudgetManager(budget)
    session = AgentSession(request, budget)

    registry = ToolRegistry()
    registry.register(ToolSchema(
        name="read_file",
        description="SDK 내 파일을 읽는다 (읽기 전용, 50KB 제한).",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "SDK 루트 기준 상대 경로"},
            },
            "required": ["path"],
        },
        cost_tier=ToolCostTier.CHEAP,
    ))
    registry.register(ToolSchema(
        name="try_build",
        description="명령어를 실행한다. 컴파일러 버전 확인에 사용 (예: 'arm-gcc --version').",
        parameters={
            "type": "object",
            "properties": {
                "build_command": {"type": "string", "description": "실행할 명령어"},
            },
            "required": ["build_command"],
        },
        cost_tier=ToolCostTier.EXPENSIVE,
    ))

    executor = ToolExecutor(timeout_ms=30_000)
    failure_policy = ToolFailurePolicy()
    tool_router = ToolRouter(registry, executor, bm, failure_policy)

    read_tool = ReadFileTool(sdk_path)
    build_tool = TryBuildTool(settings.sast_endpoint, sdk_path, request_id)
    tool_router.register_implementation("read_file", read_tool)
    tool_router.register_implementation("try_build", build_tool)

    system_prompt = _build_sdk_analyze_prompt(sdk_path)
    user_message = f"## SDK 분석 목표\n`{sdk_path}` SDK를 분석하여 프로파일을 추출하라.\n"

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

        mock_result = json.dumps({
            "summary": "[Mock] SDK 분석 mock 응답",
            "sdkProfile": {
                "compiler": "mock-gcc",
                "compilerPrefix": "mock",
                "gccVersion": "0.0.0",
                "targetArch": "mock-arch",
                "languageStandard": "c11",
                "sysroot": "",
                "environmentSetup": "",
                "includePaths": [],
                "defines": {},
            },
            "claims": [{"statement": "Mock SDK 분석 완료", "supportingEvidenceRefs": []}],
            "caveats": ["Mock 모드"],
            "usedEvidenceRefs": [],
            "needsHumanReview": True,
            "recommendedNextSteps": [],
            "policyFlags": [],
        }, ensure_ascii=False)

        llm_caller = MagicMock()
        llm_caller.call = AsyncMock(return_value=LlmResponse(
            content=mock_result, prompt_tokens=50, completion_tokens=40,
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
        return await loop.run(session)
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
        elif request.taskType == TaskType.SDK_ANALYZE:
            result = await _handle_sdk_analyze(request)
        else:
            request_id = get_request_id()
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"Unsupported taskType: {request.taskType}",
                    "errorDetail": {
                        "code": "UNKNOWN_TASK_TYPE",
                        "message": f"Build Agent supports 'build-resolve' and 'sdk-analyze', got '{request.taskType}'",
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
        "version": "0.2.0",
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
