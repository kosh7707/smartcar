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
from app.scanner.cve_lookup import CveLookup
from app.scanner.library_differ import LibraryDiffer
from app.scanner.library_identifier import LibraryIdentifier
from app.scanner.orchestrator import ScanOrchestrator
from app.scanner.ruleset_selector import resolve_rulesets
from app.schemas.request import ScanRequest
from app.schemas.response import (
    ErrorDetail,
    HealthResponse,
    ScanResponse,
    ScanStats,
)

logger = logging.getLogger("s4-sast-runner")

router = APIRouter(prefix="/v1", tags=["v1"])
orchestrator = ScanOrchestrator()
ast_dumper = AstDumper()
include_resolver = IncludeResolver()
metadata_extractor = BuildMetadataExtractor()
lib_identifier = LibraryIdentifier()
lib_differ = LibraryDiffer()
cve_lookup = CveLookup()
build_runner = BuildRunner()
_scan_semaphore = asyncio.Semaphore(settings.max_concurrent_scans)


def _get_request_id(request: Request) -> str:
    return request.headers.get("X-Request-Id") or f"req-{uuid.uuid4()}"


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


@router.post("/scan", response_model=ScanResponse)
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
        timeout = body.options.timeout_seconds

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
                    timeout=timeout,
                )

            finally:
                # 5. temp dir 정리 (projectPath 모드에서는 실제 디렉토리이므로 삭제 안 함)
                if should_cleanup:
                    shutil.rmtree(scan_dir, ignore_errors=True)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        logger.info(
            "Scan completed",
            extra={
                "requestId": request_id,
                "scanId": scan_id,
                "findingsCount": len(findings),
                "toolsRun": execution.get("toolsRun", []),
                "elapsedMs": elapsed_ms,
            },
        )

        return ScanResponse(
            success=True,
            scanId=scan_id,
            status="completed",
            findings=findings,
            stats=ScanStats(
                filesScanned=len(body.files),
                rulesRun=len(execution.get("toolsRun", [])),
                findingsTotal=len(findings),
                elapsedMs=elapsed_ms,
            ),
            execution=execution,
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
        result = await ast_dumper.dump_functions(
            scan_dir, source_files, body.build_profile,
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
    finally:
        if should_cleanup:
            shutil.rmtree(scan_dir, ignore_errors=True)


@router.post("/includes")
async def includes(request: Request, body: ScanRequest, response: Response):
    """파일별 인클루드 의존성 트리를 추출. gcc -E -M 기반."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    if not body.files:
        raise NoFilesError("No files provided")
    for f in body.files:
        _validate_path(f.path)

    t0 = time.perf_counter()
    scan_dir = Path(tempfile.mkdtemp(prefix="includes-"))
    try:
        source_files: list[str] = []
        for f in body.files:
            file_path = scan_dir / f.path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(f.content, encoding="utf-8")
            source_files.append(f.path)

        result = await include_resolver.resolve(
            scan_dir, source_files, body.build_profile,
        )
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.info(
            "Include resolution completed",
            extra={"requestId": request_id, "filesCount": len(result), "elapsedMs": elapsed_ms},
        )
        return {"includes": result}
    finally:
        shutil.rmtree(scan_dir, ignore_errors=True)


@router.post("/metadata")
async def metadata(request: Request, body: ScanRequest, response: Response):
    """타겟 빌드 환경 매크로를 추출. gcc -E -dM 기반."""
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

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


@router.post("/libraries")
async def libraries(request: Request, body: ScanRequest, response: Response):
    """프로젝트 내 vendored 라이브러리 식별 + upstream diff + CVE 정보.

    SCA (Software Composition Analysis) 엔드포인트.
    projectPath 필수.
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

    # 1. 라이브러리 식별
    libs = lib_identifier.identify(project_dir)

    # 2. 각 라이브러리에 대해 upstream diff
    results = []
    for lib in libs:
        lib_path = project_dir / lib["path"]
        repo_url = lib.get("repoUrl")
        version = lib.get("version")

        entry: dict[str, Any] = {
            "name": lib["name"],
            "version": version,
            "path": lib["path"],
            "source": lib.get("source"),
            "repoUrl": repo_url,
        }

        commit = lib.get("commit")

        if repo_url:
            if commit:
                diff_result = await lib_differ.diff(lib_path, repo_url, version, commit=commit)
            elif version:
                diff_result = await lib_differ.diff(lib_path, repo_url, version)
            else:
                diff_result = await lib_differ.find_closest_version(lib_path, repo_url)
            entry["diff"] = diff_result
        else:
            entry["diff"] = None
            entry["note"] = "Unknown library — no upstream repo to compare"

        # CVE 조회 (NVD/OSV)
        cves = await cve_lookup.lookup(
            name=lib.get("name", ""),
            version=lib.get("version"),
            commit=lib.get("commit"),
        )
        entry["cves"] = cves
        entry["cveCount"] = len(cves)

        results.append(entry)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "Library analysis completed",
        extra={"requestId": request_id, "libraryCount": len(results), "elapsedMs": elapsed_ms},
    )

    return {"libraries": results, "elapsedMs": elapsed_ms}


@router.post("/build-and-analyze")
async def build_and_analyze(request: Request, response: Response, body: dict):
    """빌드 실행 + 전체 분석 파이프라인 한 번에.

    사용자가 projectPath + buildCommand만 주면:
    1. bear -- buildCommand → compile_commands.json 자동 생성
    2. /v1/scan (compile_commands 사용)
    3. /v1/functions (projectPath)
    4. /v1/libraries (SCA + CVE)
    5. /v1/metadata (빌드 메타데이터)
    전부 한 번에 반환.
    """
    request_id = _get_request_id(request)
    set_request_id(request_id)
    response.headers["X-Request-Id"] = request_id

    project_path = body.get("projectPath")
    build_command = body.get("buildCommand")

    if not project_path or not build_command:
        response.status_code = 400
        return {"error": "projectPath and buildCommand are required"}

    project_dir = Path(project_path)
    if not project_dir.is_dir():
        response.status_code = 400
        return {"error": f"projectPath not found: {project_path}"}

    t0 = time.perf_counter()

    # 1. 빌드 (bear)
    logger.info("Build-and-analyze started", extra={"requestId": request_id, "projectPath": project_path})
    build_result = await build_runner.build(project_dir, build_command)
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
    rulesets = resolve_rulesets(None, None, settings.default_rulesets)
    findings, execution = await orchestrator.run(
        scan_dir=scan_dir, source_files=source_files,
        profile=None, rulesets=rulesets,
        compile_commands=cc_path, timeout=120,
    )

    # functions
    func_result = await ast_dumper.dump_functions(scan_dir, source_files, None)

    # libraries
    libs = lib_identifier.identify(project_dir)
    lib_results = []
    for lib in libs:
        lib_path = project_dir / lib["path"]
        repo_url = lib.get("repoUrl")
        commit = lib.get("commit")
        version = lib.get("version")
        entry = dict(lib)
        if repo_url:
            if commit:
                entry["diff"] = await lib_differ.diff(lib_path, repo_url, version, commit=commit)
            elif version:
                entry["diff"] = await lib_differ.diff(lib_path, repo_url, version)
        cves = await cve_lookup.lookup(lib.get("name", ""), version, commit)
        entry["cves"] = cves
        entry["cveCount"] = len(cves)
        lib_results.append(entry)

    # metadata
    meta = await metadata_extractor.extract(None)

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
            "execution": execution,
        },
        "codeGraph": func_result,
        "libraries": lib_results,
        "metadata": meta,
        "elapsedMs": elapsed_ms,
    }


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """서비스 상태 및 도구 가용성 확인."""
    tools = await orchestrator.check_tools()

    return HealthResponse(
        semgrep=tools.get("semgrep", {}),
        tools=tools,
        defaultRulesets=settings.default_rulesets,
    )
