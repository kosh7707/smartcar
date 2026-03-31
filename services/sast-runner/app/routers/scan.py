"""SAST Runner API 라우터."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from fastapi import APIRouter, Request, Response

from app.config import settings
from app.context import set_request_id
from app.errors import NoFilesError, SastRunnerError
from app.scanner.ast_dumper import AstDumper
from app.scanner.build_metadata import BuildMetadataExtractor
from app.scanner.build_runner import BuildRunner
from app.scanner.include_resolver import IncludeResolver
from app.scanner.orchestrator import ScanOrchestrator
from app.scanner.sca_service import analyze_libraries, identify_libraries
from app.scanner.sdk_resolver import get_sdk_registry, register_sdk, unregister_sdk, validate_sdk
from app.scanner.ruleset_selector import resolve_rulesets
from app.schemas.request import BuildProfile, ScanRequest
from app.schemas.response import (
    ErrorDetail,
    HealthResponse,
    ScanResponse,
    ScanStats,
)

logger = logging.getLogger("aegis-sast-runner")

router = APIRouter(prefix="/v1", tags=["v1"])
orchestrator = ScanOrchestrator()
ast_dumper = AstDumper()
include_resolver = IncludeResolver()
metadata_extractor = BuildMetadataExtractor()
build_runner = BuildRunner()
_scan_semaphore = asyncio.Semaphore(settings.max_concurrent_scans)


DEFAULT_TIMEOUT_S = 600


def _get_request_id(request: Request) -> str:
    return request.headers.get("X-Request-Id") or f"req-{uuid.uuid4()}"


def _get_timeout(request: Request, body_timeout: int | None = None) -> int:
    """타임아웃 해석: X-Timeout-Ms 헤더 > body > 기본값 600초."""
    header = request.headers.get("X-Timeout-Ms")
    if header:
        try:
            return max(int(header) // 1000, 1)
        except (ValueError, TypeError):
            pass
    if body_timeout and body_timeout != 120:  # 120은 ScanOptions 기본값이므로 명시적 지정만 존중
        return body_timeout
    return DEFAULT_TIMEOUT_S


def _error_response(
    request_id: str,
    exc: Exception,
    response: Response,
) -> dict:
    """observability.md 준수 에러 응답을 생성한다."""
    if isinstance(exc, SastRunnerError):
        response.status_code = exc.status_code
        code = exc.code
        message = exc.message
        retryable = exc.retryable
    else:
        response.status_code = 500
        code = "INTERNAL_ERROR"
        message = str(exc)
        retryable = False

    logger.error(
        "Request failed: %s", message,
        extra={"requestId": request_id, "code": code},
        exc_info=not isinstance(exc, SastRunnerError),
    )

    return {
        "success": False,
        "error": message,
        "errorDetail": {
            "code": code,
            "message": message,
            "requestId": request_id,
            "retryable": retryable,
        },
    }


def _prepare_scan_dir(body: ScanRequest) -> tuple[Path, list[str], bool]:
    """스캔 디렉토리를 준비한다.

    Returns:
        (scan_dir, source_files, should_cleanup)
        - projectPath가 있으면 → 파일시스템 직접 사용, cleanup=False
        - files[]가 있으면 → temp dir에 파일 쓰기, cleanup=True
    """
    if body.project_path:
        project_dir = Path(body.project_path)
        if not project_dir.is_dir():
            raise NoFilesError(f"projectPath not found: {body.project_path}")

        # 프로젝트 디렉토리에서 C/C++ 소스 파일 자동 탐색
        extensions = {".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"}
        source_files = []
        for f in project_dir.rglob("*"):
            if f.suffix in extensions and f.is_file():
                rel = str(f.relative_to(project_dir))
                # libraries/, build/, .git 등 제외
                if not any(part.startswith(".") or part in ("build", "node_modules")
                           for part in rel.split("/")):
                    source_files.append(rel)

        return project_dir, source_files, False

    # 기존: files[] → temp dir
    scan_dir = Path(tempfile.mkdtemp(prefix="sast-scan-"))
    source_files = []
    for f in body.files:
        file_path = scan_dir / f.path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(f.content, encoding="utf-8")
        source_files.append(f.path)

    return scan_dir, source_files, True


def _validate_path(file_path: str) -> None:
    """경로 순회 공격 방지."""
    if os.path.isabs(file_path):
        raise NoFilesError(f"Absolute path not allowed: {file_path}")
    if ".." in Path(file_path).parts:
        raise NoFilesError(f"Path traversal not allowed: {file_path}")


@router.post("/scan", response_model=ScanResponse, response_model_exclude_none=True)
async def scan(request: Request, body: ScanRequest, response: Response) -> ScanResponse:
    """소스 파일을 받아 멀티 도구 SAST 분석을 수행하고 SastFinding[]을 반환."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    scan_id = body.scan_id
    t0 = time.perf_counter()

    try:
        # 1. 입력 검증
        if not body.files and not body.project_path:
            raise NoFilesError("No files or projectPath provided for scanning")

        for f in body.files:
            _validate_path(f.path)

        rulesets = resolve_rulesets(
            body.rulesets, body.build_profile, settings.default_rulesets,
        )
        timeout = _get_timeout(request, body.options.timeout_seconds)

        # 2. 동시성 제어
        async with _scan_semaphore:
            # 3. 스캔 디렉토리 준비
            scan_dir, source_files, should_cleanup = _prepare_scan_dir(body)
            try:
                bp = body.build_profile
                logger.info(
                    "Scan started",
                    extra={
                        "requestId": request_id,
                        "scanId": scan_id,
                        "filesCount": len(source_files),
                        "rulesets": rulesets,
                        "projectPath": body.project_path,
                        "sdkId": bp.sdk_id if bp else None,
                        "languageStandard": bp.language_standard if bp else None,
                        "targetArch": bp.target_arch if bp else None,
                    },
                )

                # 4. 멀티 도구 병렬 실행
                findings, execution = await orchestrator.run(
                    scan_dir=scan_dir,
                    source_files=source_files,
                    profile=bp,
                    rulesets=rulesets,
                    compile_commands=body.compile_commands,
                    tools=body.options.tools,
                    timeout=timeout,
                    third_party_paths=body.third_party_paths,
                )

                # 5. projectPath 모드: codeGraph + SCA
                code_graph_result = None
                sca_result = None
                if body.project_path:
                    # 라이브러리 식별 먼저 (origin 태깅에 필요)
                    libs = await identify_libraries(scan_dir)

                    # SCA: 라이브러리 정보 (CVE는 S5 담당)
                    sca_libs = []
                    for lib in libs:
                        sca_libs.append({
                            "name": lib["name"],
                            "version": lib.get("version"),
                            "path": lib["path"],
                            "repoUrl": lib.get("repoUrl"),
                        })
                    sca_result = {"libraries": sca_libs}

                    # 코드그래프: 라이브러리 경로 스킵 + origin 태깅
                    lib_skip = [lib["path"] for lib in libs if lib.get("path")]
                    func_skip = list(set((body.third_party_paths or []) + lib_skip))
                    code_graph_result = await ast_dumper.dump_functions(
                        scan_dir, source_files, bp, libraries=libs,
                        skip_paths=func_skip if func_skip else None,
                    )

            finally:
                # 6. temp dir 정리 (projectPath 모드에서는 실제 디렉토리이므로 삭제 안 함)
                if should_cleanup:
                    shutil.rmtree(scan_dir, ignore_errors=True)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        logger.info(
            "Scan completed",
            extra={
                "requestId": request_id,
                "scanId": scan_id,
                "findingsCount": len(findings),
                "toolsRun": execution.tools_run,
                "hasCodeGraph": code_graph_result is not None,
                "scaLibraries": len(sca_result["libraries"]) if sca_result else 0,
                "elapsedMs": elapsed_ms,
            },
        )

        return ScanResponse(
            success=True,
            scanId=scan_id,
            status="completed",
            findings=findings,
            stats=ScanStats(
                filesScanned=len(source_files),
                rulesRun=len(execution.tools_run),
                findingsTotal=len(findings),
                elapsedMs=elapsed_ms,
            ),
            execution=execution,
            codeGraph=code_graph_result,
            sca=sca_result,
        )

    except SastRunnerError as exc:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.error(
            "Scan failed: %s",
            exc.message,
            extra={"requestId": request_id, "scanId": scan_id, "code": exc.code},
        )
        response.status_code = exc.status_code
        return ScanResponse(
            success=False,
            scanId=scan_id,
            status="failed",
            error=exc.message,
            errorDetail=ErrorDetail(
                code=exc.code,
                message=exc.message,
                requestId=request_id,
                retryable=exc.retryable,
            ),
        )

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.error(
            "Unexpected error: %s",
            str(exc),
            extra={"requestId": request_id, "scanId": scan_id},
            exc_info=True,
        )
        response.status_code = 500
        return ScanResponse(
            success=False,
            scanId=scan_id,
            status="failed",
            error=str(exc),
            errorDetail=ErrorDetail(
                code="INTERNAL_ERROR",
                message=str(exc),
                requestId=request_id,
                retryable=False,
            ),
        )


@router.post("/functions")
async def functions(request: Request, body: ScanRequest, response: Response):
    """소스 파일들에서 함수 목록 + 호출 관계를 추출.

    에이전트의 code_graph.get_callers() tool 백엔드용.
    """
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    if not body.files and not body.project_path:
        raise NoFilesError("No files or projectPath provided")

    for f in body.files:
        _validate_path(f.path)

    t0 = time.perf_counter()
    scan_dir, source_files, should_cleanup = _prepare_scan_dir(body)

    logger.info(
        "Functions extraction started",
        extra={"requestId": request_id, "filesCount": len(source_files), "projectPath": body.project_path},
    )

    try:
        # projectPath 모드: 라이브러리 식별 → origin 태깅 + 스킵 경로
        # include_diff=False: diff 없이 식별만 수행 (성능 — 44초 → ~1초)
        libs = None
        func_skip = None
        if body.project_path:
            libs = await analyze_libraries(scan_dir, include_diff=False)
            lib_skip = [lib["path"] for lib in (libs or []) if lib.get("path")]
            func_skip_list = list(set((body.third_party_paths or []) + lib_skip))
            func_skip = func_skip_list if func_skip_list else None

        result = await ast_dumper.dump_functions(
            scan_dir, source_files, body.build_profile, libraries=libs,
            skip_paths=func_skip,
        )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "Functions extraction completed",
            extra={
                "requestId": request_id,
                "functionCount": len(result.get("functions", [])),
                "elapsedMs": elapsed_ms,
            },
        )
        return result
    except Exception as exc:
        return _error_response(request_id, exc, response)
    finally:
        if should_cleanup:
            shutil.rmtree(scan_dir, ignore_errors=True)


@router.post("/includes")
async def includes(request: Request, body: ScanRequest, response: Response):
    """파일별 인클루드 의존성 트리를 추출. gcc -E -M 기반."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    if not body.files and not body.project_path:
        raise NoFilesError("No files or projectPath provided")
    for f in body.files:
        _validate_path(f.path)

    t0 = time.perf_counter()
    scan_dir, source_files, should_cleanup = _prepare_scan_dir(body)
    try:
        result = await include_resolver.resolve(
            scan_dir, source_files, body.build_profile,
        )
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "Include resolution completed",
            extra={"requestId": request_id, "filesCount": len(result), "elapsedMs": elapsed_ms,
                    "projectPath": body.project_path},
        )
        return {"includes": result}
    except Exception as exc:
        return _error_response(request_id, exc, response)
    finally:
        if should_cleanup:
            shutil.rmtree(scan_dir, ignore_errors=True)


@router.post("/metadata")
async def metadata(request: Request, body: ScanRequest, response: Response):
    """타겟 빌드 환경 매크로를 추출. gcc -E -dM 기반."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    try:
        result = await metadata_extractor.extract(body.build_profile)
        logger.info(
            "Build metadata extracted",
            extra={
                "requestId": request_id,
                "compiler": result.get("compiler"),
                "macroCount": len(result.get("macros", {})),
            },
        )
        return result
    except Exception as exc:
        return _error_response(request_id, exc, response)


@router.post("/libraries")
async def libraries(request: Request, body: ScanRequest, response: Response):
    """프로젝트 내 vendored 라이브러리 식별 + upstream diff.

    SCA (Software Composition Analysis) 엔드포인트.
    projectPath 필수. CVE 조회는 S5(KB) POST /v1/cve/batch-lookup으로 이관됨.
    """
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    if not body.project_path:
        raise NoFilesError("projectPath is required for library analysis")

    project_dir = Path(body.project_path)
    if not project_dir.is_dir():
        raise NoFilesError(f"projectPath not found: {body.project_path}")

    t0 = time.perf_counter()
    logger.info("Library analysis started", extra={"requestId": request_id, "projectPath": body.project_path})

    try:
        results = await analyze_libraries(project_dir)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "Library analysis completed",
            extra={"requestId": request_id, "libraryCount": len(results), "elapsedMs": elapsed_ms},
        )

        return {"libraries": results, "elapsedMs": elapsed_ms}

    except Exception as exc:
        return _error_response(request_id, exc, response)


@router.post("/build-and-analyze")
async def build_and_analyze(request: Request, response: Response, body: dict):
    """빌드 실행 + 전체 분석 파이프라인 한 번에.

    사용자가 projectPath + buildCommand만 주면:
    1. bear -- buildCommand → compile_commands.json 자동 생성
    2. /v1/scan (compile_commands 사용)
    3. /v1/functions (projectPath)
    4. /v1/libraries (SCA)
    5. /v1/metadata (빌드 메타데이터)
    전부 한 번에 반환.
    """
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    project_path = body.get("projectPath")
    build_command = body.get("buildCommand")

    if not project_path:
        response.status_code = 400
        return {"error": "projectPath is required"}

    project_dir = Path(project_path)
    if not project_dir.is_dir():
        response.status_code = 400
        return {"error": f"projectPath not found: {project_path}"}

    # buildCommand 자동 감지
    if not build_command:
        build_command = build_runner.detect_build_command(project_dir)
        if not build_command:
            response.status_code = 400
            return {"error": "buildCommand not provided and could not be auto-detected (no Makefile, CMakeLists.txt, or configure found)"}
        logger.info("Auto-detected build command: %s", build_command)

    # buildProfile → SDK environment-setup 적용
    bp_dict = body.get("buildProfile")
    bp = BuildProfile(**bp_dict) if bp_dict else None

    t0 = time.perf_counter()

    try:
        # 1. 빌드 (bear)
        logger.info("Build-and-analyze started", extra={"requestId": request_id, "projectPath": project_path})
        build_result = await build_runner.build(project_dir, build_command, profile=bp)
        if not build_result.get("success"):
            return {"build": build_result, "error": "Build failed"}

        cc_path = build_result.get("compileCommandsPath")

        # 2. 병렬 실행: scan + functions + libraries + metadata
        scan_req = ScanRequest(
            scanId=f"build-analyze-{request_id}",
            projectId=body.get("projectId", "auto"),
            projectPath=project_path,
            compileCommands=cc_path,
        )

        # scan
        scan_dir, source_files, should_cleanup = _prepare_scan_dir(scan_req)
        rulesets = resolve_rulesets(None, bp, settings.default_rulesets)
        findings, execution = await orchestrator.run(
            scan_dir=scan_dir, source_files=source_files,
            profile=bp, rulesets=rulesets,
            compile_commands=cc_path, timeout=120,
        )

        # libraries (functions보다 먼저 — 스킵 경로 확보)
        lib_results = await analyze_libraries(project_dir)

        # functions (라이브러리 경로 스킵)
        lib_skip = [lib["path"] for lib in (lib_results or []) if lib.get("path")]
        func_result = await ast_dumper.dump_functions(
            scan_dir, source_files, bp,
            skip_paths=lib_skip if lib_skip else None,
        )

        # metadata
        meta = await metadata_extractor.extract(bp)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        logger.info(
            "Build-and-analyze completed",
            extra={
                "requestId": request_id,
                "findingsCount": len(findings),
                "functionsCount": len(func_result.get("functions", [])),
                "libraryCount": len(lib_results),
                "elapsedMs": elapsed_ms,
            },
        )

        return {
            "build": build_result,
            "scan": {
                "findings": [f.model_dump(by_alias=True, exclude_none=True) for f in findings],
                "findingsCount": len(findings),
                "execution": execution.model_dump(by_alias=True),
            },
            "codeGraph": func_result,
            "libraries": lib_results,
            "metadata": meta,
            "elapsedMs": elapsed_ms,
        }

    except Exception as exc:
        return _error_response(request_id, exc, response)


@router.post("/build")
async def build(request: Request, response: Response, body: dict):
    """빌드만 수행 — bear → compile_commands.json 생성.

    스캔/SCA/코드그래프는 별도 호출. 서브 프로젝트 파이프라인의 빌드 단계용.
    """
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    project_path = body.get("projectPath")
    if not project_path:
        response.status_code = 400
        return {"success": False, "error": "projectPath is required"}

    project_dir = Path(project_path)
    if not project_dir.is_dir():
        response.status_code = 400
        return {"success": False, "error": f"projectPath not found: {project_path}"}

    build_command = body.get("buildCommand")
    if not build_command:
        build_command = build_runner.detect_build_command(project_dir)
        if not build_command:
            response.status_code = 400
            return {"success": False, "error": "buildCommand not provided and could not be auto-detected"}
        logger.info("Auto-detected build command: %s", build_command)

    bp_dict = body.get("buildProfile")
    bp = None
    if bp_dict:
        try:
            bp = BuildProfile(**bp_dict)
        except Exception as e:
            response.status_code = 400
            return {"success": False, "error": f"Invalid buildProfile: {e}"}
    wrap_with_bear = body.get("wrapWithBear", True)
    build_timeout = _get_timeout(request)

    try:
        logger.info(
            "Build started",
            extra={"requestId": request_id, "projectPath": project_path, "buildCommand": build_command,
                    "wrapWithBear": wrap_with_bear, "timeoutS": build_timeout},
        )
        result = await build_runner.build(project_dir, build_command, profile=bp,
                                          wrap_with_bear=wrap_with_bear,
                                          timeout=build_timeout)

        return result

    except Exception as exc:
        return _error_response(request_id, exc, response)


@router.post("/discover-targets")
async def discover_targets(request: Request, response: Response, body: dict):
    """프로젝트 내 빌드 타겟(독립 빌드 단위)을 자동 탐색.

    빌드 파일(CMakeLists.txt, Makefile, meson.build 등)을 재귀 탐색하여
    각 빌드 단위를 반환한다. 빌드 실행 없이 파일시스템 스캔만 수행.
    """
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    project_path = body.get("projectPath")
    if not project_path:
        response.status_code = 400
        return {"error": "projectPath is required"}

    project_dir = Path(project_path)
    if not project_dir.is_dir():
        response.status_code = 400
        return {"error": f"projectPath not found: {project_path}"}

    try:
        t0 = time.perf_counter()
        targets = build_runner.discover_targets(project_dir)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
    except Exception as exc:
        return _error_response(request_id, exc, response)

    logger.info(
        "Target discovery completed",
        extra={
            "requestId": request_id,
            "projectPath": project_path,
            "targetCount": len(targets),
            "elapsedMs": elapsed_ms,
        },
    )

    return {"targets": targets, "elapsedMs": elapsed_ms}


@router.get("/sdk-registry")
async def sdk_registry():
    """등록된 SDK 목록을 반환. 빌드 Agent가 SDK 매칭에 사용."""
    sdks = get_sdk_registry()
    return {"sdks": sdks}


@router.post("/sdk-registry")
async def register_sdk_endpoint(request: Request, response: Response, body: dict):
    """SDK 등록 — 경로 검증 + sdk-registry.json 저장."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    sdk_id = body.get("sdkId")
    if not sdk_id:
        response.status_code = 400
        return {"success": False, "errors": ["sdkId is required"]}

    path = body.get("path")
    if not path:
        response.status_code = 400
        return {"success": False, "errors": ["path is required"]}

    errors = validate_sdk(body)
    if errors:
        logger.warning(
            "SDK validation failed: %s",
            errors,
            extra={"requestId": request_id, "sdkId": sdk_id},
        )
        response.status_code = 400
        return {"success": False, "errors": errors}

    register_sdk(sdk_id, body)
    logger.info(
        "SDK registered",
        extra={"requestId": request_id, "sdkId": sdk_id, "path": path},
    )
    return {"success": True}


@router.delete("/sdk-registry/{sdk_id}")
async def delete_sdk_endpoint(sdk_id: str, request: Request, response: Response):
    """SDK 등록 해제."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    removed = unregister_sdk(sdk_id)
    if not removed:
        response.status_code = 404
        return {"success": False, "error": f"SDK not found: {sdk_id}"}

    logger.info(
        "SDK unregistered",
        extra={"requestId": request_id, "sdkId": sdk_id},
    )
    return {"success": True}


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """서비스 상태 및 도구 가용성 확인."""
    tools = await orchestrator.check_tools(force=True)

    return HealthResponse(
        semgrep=tools.get("semgrep", {}),
        tools=tools,
        defaultRulesets=settings.default_rulesets,
    )
