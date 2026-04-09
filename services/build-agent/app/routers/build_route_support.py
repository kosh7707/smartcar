"""Support helpers for build-agent task routing."""

from __future__ import annotations

import hashlib
import json
import glob
import os
from datetime import datetime, timezone

from fastapi.responses import JSONResponse

from agent_shared.context import get_request_id
from agent_shared.llm.prompt_builder import SystemPromptBuilder
from app.schemas.request import TaskRequest
from app.schemas.response import AuditInfo, TaskFailureResponse, TaskSuccessResponse, TokenUsage
from app.types import FailureCode, TaskStatus
from app.validators.build_request_contract import (
    BuildRequestContractValidator,
    BuildRequestPreflight,
    normalize_contract_version,
)


def json_response(data: TaskSuccessResponse | TaskFailureResponse) -> JSONResponse:
    request_id = get_request_id()
    headers = {"X-Request-Id": request_id} if request_id else {}
    return JSONResponse(content=data.model_dump(mode="json"), headers=headers)


def build_invalid_contract_failure(
    request: TaskRequest,
    errors: list[str],
) -> TaskFailureResponse:
    input_str = json.dumps(request.model_dump(mode="json"), sort_keys=True)
    input_hash = f"sha256:{hashlib.sha256(input_str.encode()).hexdigest()[:16]}"
    request_id = get_request_id() or request.taskId

    trusted = request.context.trusted if isinstance(request.context.trusted, dict) else {}
    return TaskFailureResponse(
        taskId=request.taskId,
        taskType=request.taskType,
        contractVersion=trusted.get("contractVersion"),
        strictMode=trusted.get("strictMode"),
        status=TaskStatus.VALIDATION_FAILED,
        failureCode=FailureCode.INVALID_SCHEMA,
        failureDetail="Invalid build-resolve contract: " + " | ".join(errors),
        retryable=False,
        audit=AuditInfo(
            inputHash=input_hash,
            latencyMs=0,
            tokenUsage=TokenUsage(),
            retryCount=0,
            ragHits=0,
            createdAt=datetime.now(timezone.utc).isoformat(),
            agentAudit={
                "requestId": request_id,
                "preflight": "build-request-contract",
                "errors": errors,
            },
        ),
    )


async def run_build_request_preflight(
    request: TaskRequest,
) -> tuple[BuildRequestPreflight | None, TaskFailureResponse | None]:
    validator = BuildRequestContractValidator()
    preflight, errors = validator.validate(request)
    if preflight is None:
        return None, build_invalid_contract_failure(request, errors)
    return preflight, None


def discover_build_files(project_path: str, target_path: str = "") -> list[str]:
    """프로젝트 내 빌드 관련 파일을 탐색한다. depth 3 이내, 노이즈 디렉토리 제외."""
    exclude_dirs = {
        "build", "build-wsl", "build-aegis", "CMakeFiles", ".git", "__pycache__",
        "test", "tests", "doc", "docs", "example", "examples", "unittest",
        "third_party", "vendor", "external", "deps",
    }

    search_root = os.path.join(project_path, target_path) if target_path else project_path
    if not os.path.isdir(search_root):
        search_root = project_path

    found: list[str] = []
    for pattern in ("**/CMakeLists.txt", "**/Makefile", "**/*.sh", "**/*.cmake"):
        matches = glob.glob(os.path.join(search_root, pattern), recursive=True)
        for match in matches:
            rel = os.path.relpath(match, project_path)
            parts = rel.split(os.sep)
            if len(parts) > 4:
                continue
            if any(part in exclude_dirs for part in parts):
                continue
            if rel not in found:
                found.append(rel)
    return sorted(found)[:20]


def build_system_prompt(
    build_material: dict,
    build_files: list[str],
    project_path: str,
    target_path: str = "",
    target_name: str = "",
    phase0: object | None = None,
    build_subdir: str = "build-aegis",
    initial_script_hint: str = "",
    build_contract: BuildRequestPreflight | None = None,
) -> str:
    """빌드 에이전트 v3 시스템 프롬프트."""

    build_material_section = ""
    script_hint_section = ""
    if build_material:
        material_lines: list[str] = []
        setup_script = build_material.get("setupScript", "")
        toolchain_triplet = build_material.get("toolchainTriplet", "")
        build_environment = build_material.get("buildEnvironment", {})
        script_hint_text = build_material.get("buildScriptHintText", "")

        if setup_script:
            material_lines.append(f"- **setupScript**: `{setup_script}`")
        if toolchain_triplet:
            material_lines.append(f"- **toolchainTriplet**: `{toolchain_triplet}`")
        if isinstance(build_environment, dict) and build_environment:
            env_keys = ", ".join(sorted(build_environment.keys()))
            material_lines.append(f"- **buildEnvironment keys**: {env_keys}")

        if material_lines:
            build_material_section = "## 호출자 제공 build material\n" + "\n".join(material_lines) + "\n\n"

        if script_hint_text:
            truncated = script_hint_text[:8000]
            truncation_note = (
                "\n# ... (caller hint truncated for prompt budget)"
                if len(script_hint_text) > len(truncated) else ""
            )
            script_hint_section = (
                "## 호출자 제공 build script hint (reference only)\n"
                "아래 스크립트 텍스트는 **참고용**이다. 그대로 실행하지 말고, "
                f"`{build_subdir}/aegis-build.sh`를 작성할 때만 참고하라.\n"
                "```bash\n"
                f"{truncated}{truncation_note}\n"
                "```\n\n"
            )

    build_file_section = ""
    if build_files:
        listing = "\n".join(f"- {build_file}" for build_file in build_files)
        build_file_section = f"## 발견된 빌드 파일\n{listing}\n\n"
    else:
        build_file_section = "## 발견된 빌드 파일\n(없음 — 빌드 스크립트를 처음부터 작성해야 함)\n\n"

    phase0_section = ""
    if phase0 is not None:
        build_system = getattr(phase0, "build_system", "unknown")
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
        }.get(build_system, "")

        phase0_section = (
            "## 사전 분석 결과 (Phase 0 — 자동 탐지)\n"
            f"- **빌드 시스템**: {build_system}\n"
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

    contract_section = ""
    if build_contract is not None:
        contract = build_contract.contract
        expected_artifacts = ", ".join(
            artifact.path
            or artifact.name
            or artifact.artifactType.value
            for artifact in contract.expectedArtifacts
        ) or "(legacy caller — unspecified)"
        build_mode = contract.buildMode.value if contract.buildMode else "(legacy caller — unspecified)"
        strict_mode = "true" if contract.strictMode else "false"
        contract_section = (
            "## 호출자 선언 계약\n"
            f"- **contractVersion**: {normalize_contract_version(contract)}\n"
            f"- **strictMode**: {strict_mode}\n"
            f"- **declared build.mode**: {build_mode}\n"
            f"- **declared build.sdkId**: {contract.sdkId or '(none)'}\n"
            f"- **expectedArtifacts**: {expected_artifacts}\n"
        )
        if contract.buildScriptHintText:
            contract_section += "- **caller build script hint**: provided (text-only, reference-only)\n"
        if contract.strictMode:
            contract_section += (
                "- **선언되지 않은 SDK/native fallback을 하지 마라.**\n"
                "- **호출자가 선언한 expectedArtifacts를 기준으로 성공을 판단하라.**\n\n"
            )
        else:
            contract_section += "\n"

    builder = SystemPromptBuilder()
    builder.add_section(
        "역할",
        "당신은 AEGIS Build Agent입니다.\n"
        "주어진 자동차 임베디드 C/C++ 프로젝트를 빌드하는 스크립트를 작성하는 것이 유일한 목표입니다.",
    )
    builder.add_section(
        "최종 산출물",
        f"1. `{build_subdir}/aegis-build.sh` — 프로젝트를 빌드하는 완전한 셸 스크립트\n"
        f"2. `buildCommand` — 해당 스크립트를 실행하는 명령어 (예: `bash {build_source}/{build_subdir}/aegis-build.sh`)",
    )
    builder.add_section(
        "절대 규칙",
        "1. **소스 코드를 절대 수정하지 마라.** read_file로 읽기만 허용된다.\n"
        f"2. **write_file/edit_file/delete_file은 `{build_subdir}/` 하위만 허용된다.** edit/delete는 네가 생성한 파일만 가능.\n"
        "3. try_build가 성공하면 즉시 최종 보고서를 JSON으로 출력하라.\n"
        "4. 3회 연속 빌드 실패 시 즉시 진단 보고서를 JSON으로 출력하라.\n"
        "5. **bear, compile_commands.json을 언급하거나 사용하지 마라.** 후속 처리는 S4가 담당한다.\n"
        "6. **apt-get, yum, pip install, sudo, curl, wget, git clone 같은 환경 변경/패키지 설치를 스크립트에 넣지 마라.** "
        "이런 명령은 write_file/edit_file 단계에서 차단된다.",
    )
    if target_section:
        builder.add_section("빌드 대상", target_section)
    if contract_section:
        builder.add_section("호출자 선언 계약", contract_section)
    if phase0_section:
        builder.add_section("사전 분석", phase0_section)
    if build_material_section:
        builder.add_section("호출자 제공 build material", build_material_section)
    if script_hint_section:
        builder.add_section("호출자 제공 build script hint", script_hint_section)
    if build_file_section:
        builder.add_section("빌드 파일", build_file_section)

    builder.mark_dynamic_boundary("절대 규칙")
    builder.add_section(
        "빌드 전략",
        "### 1단계: 탐색 (list_files → read_file, 최대 2턴)\n"
        "**첫 번째 동작은 반드시 `list_files`로 프로젝트 구조를 파악하라.** 이후 핵심 빌드 파일 1~2개만 read_file로 읽어라.\n"
        "우선순위: 셸 스크립트(scripts/cross_build.sh, build.sh) > CMakeLists.txt > Makefile\n"
        "기존 빌드 스크립트가 있으면 **참고**하되, 그대로 실행하지 말고 **네가 직접 빌드 스크립트를 작성**하라.\n"
        "호출자가 build script hint를 제공했다면, **텍스트 참고 자료**로만 사용하라. 그대로 실행하거나 복붙하지 마라.\n"
        "기존 프로젝트의 build/dist 산출물이나 cache가 이미 의미가 있으면 불필요하게 삭제하지 마라. "
        "clean step은 반드시 필요한 경우에만 최소 범위로 수행하라.\n"
        "탐색 시 반드시 확인하라:\n"
        "1. SDK/toolchain 필요 여부 (CC 변수, CMAKE_C_COMPILER 확인)\n"
        "2. 외부 의존성 (find_package, pkg-config, -l 플래그 확인)\n"
        "3. 특수 빌드 요구사항 (autoconf, cmake 최소 버전 등)\n"
        "**read_file 없이 write_file을 호출하지 마라.** 최소 1개의 빌드 관련 파일을 read_file로 읽은 후에만 스크립트를 작성할 수 있다.\n"
        "**3턴째에는 반드시 write_file로 빌드 스크립트를 작성하라. 탐색을 더 하지 마라.**\n\n"
        "### 2단계: 빌드 스크립트 작성 (write_file)\n"
        f"`{build_subdir}/aegis-build.sh`에 빌드 스크립트를 작성하라. 스크립트 요구사항:\n"
        f"- 빌드 출력은 `{build_source}/{build_subdir}/`에 생성\n"
        "- SDK build material이 setupScript로 선언되었으면, 스크립트 안에서 해당 setupScript를 source하라.\n"
        "- caller buildEnvironment가 선언되었으면 try_build의 `build_environment` 인자로 전달하거나, 스크립트 안에서 필요한 env를 명시적으로 소비하라.\n"
        "- 소스 코드를 수정하지 말 것\n"
        "- 첫 줄은 `#!/bin/bash`\n"
        f"- **중요: 스크립트는 `{build_subdir}/` 안에 위치한다. 프로젝트 루트는 스크립트의 상위 디렉토리이다.**\n"
        f"  올바른 경로 설정: `PROJECT_ROOT=\"$(cd \"$(dirname \"$0\")/..\" && pwd)\"`\n"
        f"  잘못된 예: `ROOT_DIR=\"$(dirname \"$0\")\"` ← 이러면 {build_subdir}/ 자체를 루트로 잡음\n\n"
        "### 3단계: 빌드 실행 (try_build) — write_file 직후 즉시 실행\n"
        f"기본 예: `build_command: \"bash {build_source}/{build_subdir}/aegis-build.sh\"`\n"
        "caller buildEnvironment가 있으면 `build_environment`에 key/value를 명시하라.\n"
        "직접 실행해야 할 외부 스크립트를 `build_command`로 넘기지 말고, 네가 생성한 `aegis-build.sh`만 실행하라.\n\n"
        "### 4단계: 실패 복구\n"
        "에러 유형에 따라 복구 전략을 선택하라:\n"
        "- **누락 헤더** (*.h not found): `-I` 플래그를 추가하거나, SDK sysroot 내에서 헤더 경로를 찾아라.\n"
        "- **미정의 심볼** (undefined reference): `-l` 링커 플래그를 추가하거나, `-L`로 라이브러리 경로를 지정하라.\n"
        "- **툴체인 미발견** (gcc not found): SDK 환경 스크립트 source 경로가 올바른지 확인하라.\n"
        "- **CMake 오류**: CMakeLists.txt를 read_file로 다시 읽고, 누락 패키지나 경로 오류를 확인하라.\n"
        "- **소스 코드 오류**: 빌드 스크립트 오류인지 소스 코드 오류인지 구분하라. 소스 코드 오류면 caveats에 기록.\n"
        "edit_file로 스크립트를 수정한 후 즉시 try_build를 재시도하라. **같은 수정을 반복하지 마라.**\n"
        "try_build 실패 후 read_file로 스크립트를 확인하여, 수정이 올바르게 적용되었는지 검증하라.\n"
        "**edit_file → try_build를 한 턴 안에서 같이 호출하라. 수정 후 빌드를 분리하지 마라.**",
    )
    builder.add_section(
        "출력 형식",
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
        "```",
    )
    builder.set_suffix("/no_think")
    return builder.build()
