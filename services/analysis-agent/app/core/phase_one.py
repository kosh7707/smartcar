"""Phase 1 — LLM 개입 없이 결정론적 도구 실행.

SAST 스캔과 코드 그래프 추출을 AgentLoop 진입 전에 수행하여,
LLM이 "도구를 안 써도 되겠다"고 판단하는 문제를 원천 차단한다.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import httpx

from app.context import get_request_id
from app.observability import agent_log
from app.schemas.agent import ToolCallRequest

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession
    from app.tools.implementations.base import ToolImplementation

logger = logging.getLogger(__name__)


@dataclass
class Phase1Result:
    """Phase 1 실행 결과."""
    sast_findings: list[dict] = field(default_factory=list)
    sast_stats: dict = field(default_factory=dict)
    code_functions: list[dict] = field(default_factory=list)
    sca_libraries: list[dict] = field(default_factory=list)
    threat_context: list[dict] = field(default_factory=list)
    dangerous_callers: list[dict] = field(default_factory=list)
    cve_lookup: list[dict] = field(default_factory=list)
    sast_duration_ms: int = 0
    code_graph_duration_ms: int = 0
    sca_duration_ms: int = 0
    cve_lookup_duration_ms: int = 0
    threat_query_duration_ms: int = 0
    dangerous_callers_duration_ms: int = 0
    total_duration_ms: int = 0


_CWE_RE = re.compile(r"CWE-(\d+)")
_DANGEROUS_FUNCS = {
    "popen", "system", "exec", "execl", "execlp", "execle", "execv", "execvp",
    "getenv", "readlink", "access", "mkstemp", "mktemp",
    "strcpy", "strcat", "sprintf", "gets", "scanf",
    "memcpy", "memmove", "alloca",
}


class Phase1Executor:
    """LLM 없이 결정론적으로 SAST + 코드 그래프 + SCA + KB 위협 조회 + 위험 호출자를 실행한다."""

    def __init__(
        self,
        sast_tool: ToolImplementation | None = None,
        codegraph_tool: ToolImplementation | None = None,
        sca_tool: ToolImplementation | None = None,
        kb_endpoint: str = "http://localhost:8002",
        sast_endpoint: str = "http://localhost:9000",
    ) -> None:
        self._sast_tool = sast_tool
        self._codegraph_tool = codegraph_tool
        self._sca_tool = sca_tool
        self._kb_endpoint = kb_endpoint
        self._kb_client = httpx.AsyncClient(base_url=kb_endpoint, timeout=10.0)
        self._sast_client = httpx.AsyncClient(base_url=sast_endpoint, timeout=310.0)

    async def execute(self, session: AgentSession) -> Phase1Result:
        """Phase 1: SAST 스캔 + 코드 그래프 + SCA + KB 위협 조회 + 위험 호출자."""
        result = Phase1Result()
        start = time.monotonic()

        trusted = session.request.context.trusted
        files = trusted.get("files", [])
        project_path = trusted.get("projectPath")
        target_path = trusted.get("targetPath")
        project_id = trusted.get("projectId", session.request.taskId)
        build_profile = trusted.get("buildProfile")
        build_command = trusted.get("buildCommand")
        request_id = get_request_id() or session.request.taskId

        # targetPath가 지정되면 projectPath/targetPath를 분석 루트로 사용
        analysis_path = project_path
        if project_path and target_path:
            combined = os.path.normpath(f"{project_path}/{target_path}")
            # directory traversal 차단: projectPath 밖으로 나가면 무시
            if combined.startswith(project_path.rstrip("/")):
                analysis_path = combined
            else:
                agent_log(
                    logger, "targetPath directory traversal 차단",
                    component="phase_one", phase="security",
                    targetPath=target_path, level=logging.WARNING,
                )
                analysis_path = project_path

        # Pre-computed Phase 1 결과가 있으면 SAST/코드그래프/SCA 스킵
        pre_findings = trusted.get("sastFindings")
        pre_sca = trusted.get("scaLibraries")

        if pre_findings is not None:
            result.sast_findings = pre_findings
            if pre_sca is not None:
                result.sca_libraries = pre_sca
            agent_log(
                logger, "Phase 1: pre-computed 결과 사용 (SAST/SCA 스킵)",
                component="phase_one", phase="phase1_precomputed",
                findings=len(result.sast_findings),
                libraries=len(result.sca_libraries),
            )
        elif not files and not project_path:
            agent_log(
                logger, "Phase 1 스킵: files와 projectPath 모두 없음",
                component="phase_one", phase="skip",
            )
            return result
        else:
            agent_log(
                logger, "Phase 1 시작",
                component="phase_one", phase="phase1_start",
                fileCount=len(files), projectId=project_id,
                hasProjectPath=bool(project_path), targetPath=target_path,
                hasBuildCommand=bool(build_command),
            )

            # projectPath + (buildCommand 또는 buildProfile) → build-and-analyze 시도
            if analysis_path and (build_command or build_profile):
                ba_result = await self._run_build_and_analyze(
                    result, project_id, analysis_path, build_command, build_profile, request_id,
                )
                if ba_result is not None:
                    result = ba_result
                else:
                    # build-and-analyze 실패 시 개별 도구 fallback
                    agent_log(
                        logger, "Phase 1: build-and-analyze 실패, 개별 도구 fallback",
                        component="phase_one", phase="ba_fallback",
                        level=logging.WARNING,
                    )
                    result = await self._run_individual_tools(
                        result, files, project_id, analysis_path, build_profile, request_id,
                    )
            else:
                # files 기반 또는 projectPath만 (빌드 정보 없음) — 개별 도구 실행
                result = await self._run_individual_tools(
                    result, files, project_id, analysis_path, build_profile, request_id,
                )

        # 4. CVE 실시간 조회 — SCA 라이브러리+버전으로 S5 batch-lookup
        if result.sca_libraries:
            result = await self._run_cve_lookup(result)

        # 5. KB 위협 조회 — SAST findings의 CWE ID로 S5 검색
        if result.sast_findings:
            result = await self._run_threat_query(result)

        # 6. 위험 함수 호출자 — SAST findings의 위험 함수로 S5 코드 그래프 조회
        if result.sast_findings and project_id:
            result = await self._run_dangerous_callers(result, project_id)

        result.total_duration_ms = int((time.monotonic() - start) * 1000)

        agent_log(
            logger, "Phase 1 완료",
            component="phase_one", phase="phase1_end",
            findings=len(result.sast_findings),
            functions=len(result.code_functions),
            totalMs=result.total_duration_ms,
        )

        return result

    async def _run_build_and_analyze(
        self, result: Phase1Result, project_id, project_path, build_command, build_profile, request_id,
    ) -> Phase1Result | None:
        """S4 build-and-analyze 한 번에 호출. 실패 시 None 반환 (fallback 유도)."""
        agent_log(
            logger, "Phase 1: build-and-analyze",
            component="phase_one", phase="build_and_analyze_start",
            projectPath=project_path, hasBuildCommand=bool(build_command),
        )

        body: dict = {
            "projectPath": project_path,
            "projectId": project_id,
        }
        if build_command:
            body["buildCommand"] = build_command
        if build_profile:
            body["buildProfile"] = build_profile

        headers: dict[str, str] = {}
        if request_id:
            headers["X-Request-Id"] = request_id

        start = time.monotonic()
        try:
            resp = await self._sast_client.post(
                "/v1/build-and-analyze",
                json=body,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            agent_log(
                logger, "Phase 1: build-and-analyze 실패",
                component="phase_one", phase="build_and_analyze_error",
                error=str(e), latencyMs=elapsed,
                level=logging.WARNING,
            )
            return None

        elapsed = int((time.monotonic() - start) * 1000)

        # 응답에서 각 결과 추출
        scan_data = data.get("scan", {})
        result.sast_findings = scan_data.get("findings", [])
        result.sast_stats = scan_data.get("stats", {})
        result.sast_duration_ms = scan_data.get("execution", {}).get("elapsedMs", 0)

        code_graph = data.get("codeGraph", {})
        result.code_functions = code_graph.get("functions", [])
        result.code_graph_duration_ms = 0  # build-and-analyze에서 개별 시간 미제공

        result.sca_libraries = data.get("libraries", [])
        result.sca_duration_ms = 0

        build_info = data.get("build", {})

        agent_log(
            logger, "Phase 1: build-and-analyze 완료",
            component="phase_one", phase="build_and_analyze_end",
            buildSuccess=build_info.get("success"),
            findings=len(result.sast_findings),
            functions=len(result.code_functions),
            libraries=len(result.sca_libraries),
            totalMs=elapsed,
        )
        return result

    async def _run_individual_tools(
        self, result: Phase1Result, files, project_id, project_path, build_profile, request_id,
    ) -> Phase1Result:
        """개별 도구 호출 (files 기반 fallback)."""
        if self._sast_tool and files:
            result = await self._run_sast(result, files, project_id, build_profile, request_id)
        if self._codegraph_tool and files:
            result = await self._run_codegraph(result, files, project_id, build_profile, request_id)
        if self._sca_tool and project_path:
            result = await self._run_sca(result, project_id, project_path, request_id)

        # 코드 그래프를 S5 KB에 적재 (dangerous_callers 조회에 필요)
        if result.code_functions and project_id:
            await self._ingest_code_graph(result, project_id, request_id)

        return result

    async def _ingest_code_graph(self, result: Phase1Result, project_id: str, request_id: str) -> None:
        """코드 그래프를 S5 KB에 적재한다. 사용자 코드(src/) + 서드파티(origin) 포함."""
        relevant_functions = [
            f for f in result.code_functions
            if f.get("file", "").startswith("src/") or f.get("origin")
        ]
        if not relevant_functions:
            return

        agent_log(
            logger, "Phase 1: KB 코드 그래프 적재",
            component="phase_one", phase="kb_ingest_start",
            functionCount=len(relevant_functions),
        )

        headers: dict[str, str] = {}
        if request_id:
            headers["X-Request-Id"] = request_id

        try:
            resp = await self._kb_client.post(
                f"/v1/code-graph/{project_id}/ingest",
                json={"functions": relevant_functions},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            agent_log(
                logger, "Phase 1: KB 코드 그래프 적재 완료",
                component="phase_one", phase="kb_ingest_end",
                nodeCount=data.get("nodeCount", 0),
                edgeCount=data.get("edgeCount", 0),
            )
        except Exception as e:
            agent_log(
                logger, "Phase 1: KB 코드 그래프 적재 실패",
                component="phase_one", phase="kb_ingest_error",
                error=str(e), level=logging.WARNING,
            )

    async def _run_sast(
        self, result: Phase1Result, files, project_id, build_profile, request_id,
    ) -> Phase1Result:
        """SAST 스캔 실행."""
        agent_log(
            logger, "Phase 1: SAST 스캔",
            component="phase_one", phase="sast_start",
            fileCount=len(files),
        )

        args = {
            "scanId": f"{request_id}-phase1",
            "projectId": project_id,
            "files": files,
        }
        if build_profile:
            args["buildProfile"] = build_profile

        start = time.monotonic()
        try:
            tool_result = await self._sast_tool.execute(args)
            result.sast_duration_ms = int((time.monotonic() - start) * 1000)

            if tool_result.success:
                data = json.loads(tool_result.content)
                result.sast_findings = data.get("findings", [])
                result.sast_stats = data.get("stats", {})
                agent_log(
                    logger, "Phase 1: SAST 완료",
                    component="phase_one", phase="sast_end",
                    findings=len(result.sast_findings),
                    durationMs=result.sast_duration_ms,
                )
            else:
                agent_log(
                    logger, "Phase 1: SAST 실패",
                    component="phase_one", phase="sast_error",
                    error=tool_result.error,
                    level=logging.WARNING,
                )
        except Exception as e:
            result.sast_duration_ms = int((time.monotonic() - start) * 1000)
            agent_log(
                logger, "Phase 1: SAST 예외",
                component="phase_one", phase="sast_error",
                error=str(e), level=logging.ERROR,
            )

        return result

    async def _run_codegraph(
        self, result: Phase1Result, files, project_id, build_profile, request_id,
    ) -> Phase1Result:
        """코드 그래프 추출."""
        agent_log(
            logger, "Phase 1: 코드 그래프 추출",
            component="phase_one", phase="codegraph_start",
        )

        args = {
            "scanId": f"{request_id}-phase1-func",
            "projectId": project_id,
            "files": files,
        }
        if build_profile:
            args["buildProfile"] = build_profile

        start = time.monotonic()
        try:
            tool_result = await self._codegraph_tool.execute(args)
            result.code_graph_duration_ms = int((time.monotonic() - start) * 1000)

            if tool_result.success:
                data = json.loads(tool_result.content)
                result.code_functions = data.get("functions", [])
                agent_log(
                    logger, "Phase 1: 코드 그래프 완료",
                    component="phase_one", phase="codegraph_end",
                    functions=len(result.code_functions),
                    durationMs=result.code_graph_duration_ms,
                )
            else:
                agent_log(
                    logger, "Phase 1: 코드 그래프 실패",
                    component="phase_one", phase="codegraph_error",
                    error=tool_result.error,
                    level=logging.WARNING,
                )
        except Exception as e:
            result.code_graph_duration_ms = int((time.monotonic() - start) * 1000)
            agent_log(
                logger, "Phase 1: 코드 그래프 예외",
                component="phase_one", phase="codegraph_error",
                error=str(e), level=logging.ERROR,
            )

        return result

    async def _run_sca(
        self, result: Phase1Result, project_id, project_path, request_id,
    ) -> Phase1Result:
        """SCA 라이브러리 식별 + upstream diff."""
        agent_log(
            logger, "Phase 1: SCA 라이브러리 식별",
            component="phase_one", phase="sca_start",
            projectPath=project_path,
        )

        args = {
            "scanId": f"{request_id}-phase1-sca",
            "projectId": project_id,
            "projectPath": project_path,
        }

        start = time.monotonic()
        try:
            tool_result = await self._sca_tool.execute(args)
            result.sca_duration_ms = int((time.monotonic() - start) * 1000)

            if tool_result.success:
                data = json.loads(tool_result.content)
                result.sca_libraries = data.get("libraries", [])
                agent_log(
                    logger, "Phase 1: SCA 완료",
                    component="phase_one", phase="sca_end",
                    libraries=len(result.sca_libraries),
                    durationMs=result.sca_duration_ms,
                )
            else:
                agent_log(
                    logger, "Phase 1: SCA 실패",
                    component="phase_one", phase="sca_error",
                    error=tool_result.error,
                    level=logging.WARNING,
                )
        except Exception as e:
            result.sca_duration_ms = int((time.monotonic() - start) * 1000)
            agent_log(
                logger, "Phase 1: SCA 예외",
                component="phase_one", phase="sca_error",
                error=str(e), level=logging.ERROR,
            )

        return result

    async def _run_cve_lookup(self, result: Phase1Result) -> Phase1Result:
        """SCA 라이브러리+버전으로 S5 KB 실시간 CVE 조회."""
        libraries = []
        for lib in result.sca_libraries:
            if not lib.get("name"):
                continue
            entry: dict[str, str] = {"name": lib["name"]}
            if lib.get("version"):
                entry["version"] = lib["version"]
            if lib.get("repoUrl"):
                entry["repoUrl"] = lib["repoUrl"]  # S5가 camelCase alias 지원
            if lib.get("commit"):
                entry["commit"] = lib["commit"]
            libraries.append(entry)

        if not libraries:
            return result

        agent_log(
            logger, "Phase 1: CVE 실시간 조회",
            component="phase_one", phase="cve_lookup_start",
            libraryCount=len(libraries),
        )

        start = time.monotonic()
        headers: dict[str, str] = {}
        request_id = get_request_id()
        if request_id:
            headers["X-Request-Id"] = request_id

        request_body = {"libraries": libraries[:20]}
        try:
            resp = await self._kb_client.post(
                "/v1/cve/batch-lookup",
                json=request_body,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            # 각 라이브러리 결과를 플랫하게 수집 (version_match 포함)
            for lib_result in data.get("results", []):
                for cve in lib_result.get("cves", []):
                    cve["_library"] = lib_result.get("library", "")
                    cve["_version"] = lib_result.get("version", "")
                    result.cve_lookup.append(cve)
        except Exception as e:
            agent_log(
                logger, "Phase 1: CVE 조회 실패",
                component="phase_one", phase="cve_lookup_error_detail",
                requestBody=json.dumps(request_body, ensure_ascii=False)[:500],
                level=logging.WARNING,
            )
            agent_log(
                logger, "Phase 1: CVE 조회 실패",
                component="phase_one", phase="cve_lookup_error",
                error=str(e), level=logging.WARNING,
            )

        result.cve_lookup_duration_ms = int((time.monotonic() - start) * 1000)

        matched = sum(1 for c in result.cve_lookup if c.get("version_match") is True)
        agent_log(
            logger, "Phase 1: CVE 조회 완료",
            component="phase_one", phase="cve_lookup_end",
            totalCves=len(result.cve_lookup),
            versionMatched=matched,
            durationMs=result.cve_lookup_duration_ms,
        )
        return result

    async def _run_threat_query(self, result: Phase1Result) -> Phase1Result:
        """SAST findings에서 CWE ID 추출 → S5 KB 배치 위협 조회."""
        cwe_ids = self._extract_cwe_ids(result.sast_findings)
        if not cwe_ids:
            return result

        agent_log(
            logger, "Phase 1: KB 위협 조회 (배치)",
            component="phase_one", phase="threat_query_start",
            cweCount=len(cwe_ids),
        )

        start = time.monotonic()
        headers: dict[str, str] = {}
        request_id = get_request_id()
        if request_id:
            headers["X-Request-Id"] = request_id

        queries = [
            {"query": cwe_id, "top_k": 3, "min_score": 0.35}
            for cwe_id in sorted(cwe_ids)[:10]
        ]

        try:
            resp = await self._kb_client.post(
                "/v1/search/batch",
                json={"queries": queries},
                headers=headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            for query_result in data.get("results", []):
                result.threat_context.extend(query_result.get("hits", []))
        except Exception as e:
            agent_log(
                logger, "Phase 1: KB 위협 배치 조회 실패",
                component="phase_one", phase="threat_query_error",
                error=str(e), level=logging.WARNING,
            )

        result.threat_query_duration_ms = int((time.monotonic() - start) * 1000)

        agent_log(
            logger, "Phase 1: KB 위협 조회 완료",
            component="phase_one", phase="threat_query_end",
            hits=len(result.threat_context),
            durationMs=result.threat_query_duration_ms,
        )
        return result

    async def _run_dangerous_callers(self, result: Phase1Result, project_id: str) -> Phase1Result:
        """위험 함수(popen, system, getenv 등) 호출자 식별."""
        dangerous_funcs = self._extract_dangerous_funcs(result.sast_findings)
        if not dangerous_funcs:
            return result

        agent_log(
            logger, "Phase 1: 위험 호출자 조회",
            component="phase_one", phase="dangerous_callers_start",
            funcCount=len(dangerous_funcs),
        )

        start = time.monotonic()
        headers: dict[str, str] = {}
        request_id = get_request_id()
        if request_id:
            headers["X-Request-Id"] = request_id

        try:
            resp = await self._kb_client.post(
                f"/v1/code-graph/{project_id}/dangerous-callers",
                json={"dangerous_functions": list(dangerous_funcs)},
                headers=headers,
            )
            resp.raise_for_status()
            result.dangerous_callers = resp.json().get("results", [])
        except Exception as e:
            agent_log(
                logger, "Phase 1: 위험 호출자 조회 실패",
                component="phase_one", phase="dangerous_callers_error",
                error=str(e), level=logging.WARNING,
            )

        result.dangerous_callers_duration_ms = int((time.monotonic() - start) * 1000)

        agent_log(
            logger, "Phase 1: 위험 호출자 조회 완료",
            component="phase_one", phase="dangerous_callers_end",
            callers=len(result.dangerous_callers),
            durationMs=result.dangerous_callers_duration_ms,
        )
        return result

    @staticmethod
    def _extract_cwe_ids(findings: list[dict]) -> set[str]:
        """findings에서 고유 CWE ID를 결정론적으로 추출한다."""
        cwe_ids: set[str] = set()
        for f in findings:
            # ruleId, message에서 정규식 추출
            for field in (f.get("ruleId", ""), f.get("message", "")):
                for match in _CWE_RE.finditer(field):
                    cwe_ids.add(f"CWE-{match.group(1)}")
            # metadata.cwe 배열에서 직접 추출 (S4 v0.4.0+)
            for cwe in f.get("metadata", {}).get("cwe", []):
                if _CWE_RE.search(cwe):
                    cwe_ids.add(cwe)
        return cwe_ids

    @staticmethod
    def _extract_dangerous_funcs(findings: list[dict]) -> set[str]:
        """findings에서 위험 함수명을 결정론적으로 추출한다."""
        found: set[str] = set()
        for f in findings:
            msg = f.get("message", "").lower()
            for func in _DANGEROUS_FUNCS:
                if func in msg:
                    found.add(func)
        return found

    async def aclose(self) -> None:
        """HTTP 클라이언트 종료."""
        await self._kb_client.aclose()
        await self._sast_client.aclose()


def _format_origin_label(func: dict) -> str:
    """서드파티 출처 라벨을 생성한다. S5 snake_case와 S4 camelCase 모두 대응."""
    origin = func.get("origin")
    if not origin:
        return ""
    lib = func.get("original_lib") or func.get("originalLib") or "?"
    ver = func.get("original_version") or func.get("originalVersion")
    ver_str = f" v{ver}" if ver else ""
    if origin == "modified-third-party":
        return f" [수정된 서드파티: {lib}{ver_str}]"
    elif origin == "third-party":
        return f" [서드파티: {lib}{ver_str}]"
    return ""


def _format_cve_line(cve: dict) -> str:
    """CVE 한 줄 포맷 (EPSS/KEV 포함)."""
    line = f"- **{cve.get('id', '?')}** ({cve.get('_library', '?')} {cve.get('_version', '')})"
    if cve.get("title"):
        line += f" — {cve['title']}"
    if cve.get("severity") is not None:
        line += f" | CVSS {cve['severity']}"
    if cve.get("kev") is True:
        line += " | ⚠️ CISA KEV (실제 악용 확인)"
    if cve.get("epss_score") is not None:
        line += f" | EPSS {cve['epss_score']:.2f}"
    if cve.get("affected_versions"):
        line += f" | 영향 범위: {cve['affected_versions']}"
    if cve.get("related_cwe"):
        line += f" | {', '.join(cve['related_cwe'][:3])}"
    return line


def build_phase2_prompt(
    phase1: Phase1Result,
    trusted_context: dict,
    evidence_refs: list[dict] | None = None,
) -> tuple[str, str]:
    """Phase 1 결과를 포함한 Phase 2 프롬프트를 생성한다.

    Returns: (system_prompt, user_message)
    """
    system_prompt = (
        "당신은 자동차 임베디드 보안 분석가입니다.\n\n"
        "아래에 자동화 도구가 수집한 증거가 포함되어 있습니다:\n"
        "- SAST 정적 분석 결과\n"
        "- 코드 구조 (함수 호출 관계)\n"
        "- SCA 라이브러리 분석\n"
        "- 위협 지식 DB 조회 결과 (CWE/CVE/ATT&CK)\n"
        "- 위험 함수 호출자 분석\n\n"
        "## 당신의 임무\n\n"
        "1. 각 SAST finding의 실제 위험도를 위협 지식과 코드 구조를 참고하여 평가하라\n"
        "2. 관련 CWE의 공격 시나리오와 대상 코드의 맥락을 연결하라\n"
        "3. 추가 조사가 필요하면 도구를 호출할 수 있다:\n"
        "   - knowledge.search: CWE/CVE/ATT&CK 위협 지식 검색 (source_filter로 소스 유형 지정 가능)\n"
        "   - code_graph.callers: 특정 함수의 호출자 체인 조회\n"
        "4. 분석이 완료되면 아래 JSON 스키마로 최종 보고서를 작성하라\n\n"
        "## 상세 분석 지침\n"
        "- 각 claim의 detail 필드에 **깊이 있는 분석**을 작성하라. 다음을 포함해야 한다:\n"
        "  - 공격자 관점의 악용 시나리오 (어떻게 악용하는가)\n"
        "  - 취약 코드 경로 (어떤 함수를 거쳐 취약 지점에 도달하는가)\n"
        "  - 영향 범위 (악용 시 어떤 피해가 발생하는가)\n"
        "  - 실제 위험도 근거 (왜 이 심각도를 부여하는가)\n"
        "- detail은 보안 분석가가 추가 조사 없이 취약점을 이해할 수 있을 정도로 상세해야 한다.\n"
        "- statement는 취약점을 한 문장으로 요약하고, detail에서 풀어서 설명하라.\n\n"
        "## 서드파티 코드 분석 지침\n"
        "- 위험 함수 호출자에 `[서드파티]` 또는 `[수정된 서드파티]` 라벨이 있으면, 해당 라이브러리의 알려진 CVE와 교차 분석하라.\n"
        "- 수정된 서드파티 코드(modified-third-party)가 위험 함수를 호출하면, 수정이 원본 보안 패치를 무력화했을 가능성을 caveat에 언급하라.\n"
        "- `code_graph.callers` 도구 응답의 `origin` 필드로 호출자가 서드파티인지 확인할 수 있다.\n\n"
        "## 도구 사용 지침\n"
        "- 분석 근거를 강화하기 위해 **최소 1회 이상 도구를 호출하라**.\n"
        "- 특히 위험 함수(popen, system, getenv 등)의 호출자 체인은 `code_graph.callers`로 반드시 확인하라.\n"
        "- 위협 지식이 부족하면 `knowledge.search`로 CWE/CVE/ATT&CK 정보를 보강하라.\n"
        "- 도구 호출이 실패하면 재시도하지 말고, 현재까지 수집된 정보로 보고서를 작성하라.\n"
        "- 도구를 호출한 후에는 반드시 보고서를 작성하라. 도구 결과를 확인하기 위해 또 다른 도구를 호출하지 마라.\n\n"
        "[보고서 스키마]\n"
        "```json\n"
        "{\n"
        '  "summary": "분석 요약 (1~3문장, 전체 findings를 종합)",\n'
        '  "claims": [\n'
        '    {\n'
        '      "statement": "취약점 요약 (1문장)",\n'
        '      "detail": "상세 분석: 공격 경로, 영향 범위, 코드 흐름, 악용 시나리오를 포함한 깊이 있는 설명",\n'
        '      "supportingEvidenceRefs": ["eref-file-00"],\n'
        '      "location": "src/파일.cpp:줄번호"\n'
        "    }\n"
        "  ],\n"
        '  "caveats": ["분석의 한계, 불확실성, 수동 확인이 필요한 사항"],\n'
        '  "usedEvidenceRefs": ["eref-file-00", "eref-sast-00"],\n'
        '  "suggestedSeverity": "critical|high|medium|low|info",\n'
        '  "needsHumanReview": true,\n'
        '  "recommendedNextSteps": ["후속 조치"],\n'
        '  "policyFlags": []\n'
        "}\n"
        "```\n\n"
        "## 규칙\n"
        "- summary, claims, caveats, usedEvidenceRefs는 **필수**이다.\n"
        "- claims[].supportingEvidenceRefs에는 [사용 가능한 Evidence Refs]에 나열된 refId만 사용하라.\n"
        "- 라이브러리 CVE는 claims가 아닌 caveats 또는 recommendedNextSteps에 언급하라.\n"
        "- **순수 JSON만 출력하라. ```json 코드 펜스, 인사말, 설명문을 절대 붙이지 마라. 첫 문자는 반드시 `{`이어야 한다.**\n"
    )

    # 사용자 메시지 조립
    sections = []

    # 프로젝트 개요
    objective = trusted_context.get("objective", "보안 취약점 심층 분석")
    build_profile = trusted_context.get("buildProfile", {})
    sections.append(f"## 분석 목표\n{objective}")

    if build_profile:
        bp_str = json.dumps(build_profile, ensure_ascii=False)
        sections.append(f"## 빌드 환경\n{bp_str}")

    # Phase 1 SAST 결과
    if phase1.sast_findings:
        sections.append(f"## SAST 스캔 결과 ({len(phase1.sast_findings)}개 findings)")
        # 심각도별 정리
        by_severity: dict[str, list] = {}
        for f in phase1.sast_findings:
            sev = f.get("severity", "unknown")
            by_severity.setdefault(sev, []).append(f)

        for sev in ["error", "warning", "style", "info"]:
            items = by_severity.get(sev, [])
            if items:
                sections.append(f"### {sev.upper()} ({len(items)}개)")
                for item in items[:15]:  # 심각도당 최대 15개
                    loc = item.get("location", {})
                    file = loc.get("file", "?")
                    line = loc.get("line", "?")
                    msg = item.get("message", "")[:200]
                    tool = item.get("toolId", "")
                    rule = item.get("ruleId", "")
                    sections.append(f"- [{tool}:{rule}] {file}:{line} — {msg}")
    else:
        sections.append("## SAST 스캔 결과\nSAST 스캔을 실행하지 못했습니다.")

    # Phase 1 코드 그래프 요약
    project_id = trusted_context.get("projectId")
    if phase1.code_functions:
        func_count = len(phase1.code_functions)
        files_set = {f.get("file", "?") for f in phase1.code_functions if f.get("file")}
        sections.append(
            f"## 코드 구조 요약\n"
            f"- 함수 {func_count}개, 파일 {len(files_set)}개\n"
            f"- 특정 함수의 호출자 체인이 필요하면 `code_graph.callers` 도구를 호출하세요."
        )
    elif project_id:
        # pre-computed 모드: 코드 그래프가 KB에 적재되어 있음
        sections.append(
            "## 코드 구조\n"
            "- 코드 그래프가 Knowledge Base에 적재되어 있습니다.\n"
            "- 위험 함수(popen, system, getenv 등)의 호출자 체인을 확인하려면 `code_graph.callers` 도구를 호출하세요.\n"
            "- 예: `code_graph.callers({\"function_name\": \"popen\"})` → popen을 호출하는 함수 목록"
        )

    # SCA 라이브러리 분석 결과 — 참고 정보 (코드 미분석)
    if phase1.sca_libraries:
        sca_lines = [
            "## [참고] 라이브러리 현황 (SCA)",
            "**주의: 아래는 라이브러리 메타데이터 기반 정보이며, 라이브러리 소스 코드는 분석 대상에 포함되지 않았습니다.**",
            "**claims에는 실제 분석한 src/ 코드의 취약점만 포함하세요. 라이브러리 CVE는 claims가 아닌 caveats 또는 recommendedNextSteps에 언급하세요.**",
            "",
        ]
        for lib in phase1.sca_libraries:
            name = lib.get("name", "?")
            version = lib.get("version")
            diff = lib.get("diff", {})
            match_ratio = diff.get("matchRatio", 0)
            mods = diff.get("modifications", [])
            cves = lib.get("cves", [])
            cve_count = lib.get("cveCount", len(cves))

            ver_str = f" v{version}" if version else ""
            lib_line = f"- **{name}{ver_str}**"

            if mods:
                mod_summary = "; ".join(
                    f"{m.get('file','?')} (+{m.get('insertions',0)}/-{m.get('deletions',0)})"
                    for m in mods
                )
                lib_line += f" — 수정 {len(mods)}파일: {mod_summary}"
            else:
                lib_line += " — 원본 그대로"

            if cves:
                high_cves = [c for c in cves if c.get("severity", "").upper() in ("CRITICAL", "HIGH")]
                if high_cves:
                    cve_ids = ", ".join(c.get("id", "?") for c in high_cves[:3])
                    lib_line += f" | 알려진 CVE {cve_count}건 (CRITICAL/HIGH: {cve_ids})"
                else:
                    lib_line += f" | 알려진 CVE {cve_count}건"

            sca_lines.append(lib_line)

        sections.append("\n".join(sca_lines))

    # CVE 실시간 조회 결과 (Phase 1에서 결정론적 조회, 버전 매칭 완료)
    if phase1.cve_lookup:
        matched_cves = [c for c in phase1.cve_lookup if c.get("version_match") is True]
        unmatched_cves = [c for c in phase1.cve_lookup if c.get("version_match") is False]

        if matched_cves:
            # EPSS/KEV 기반 critical CVE 분류
            critical_cves = [
                c for c in matched_cves
                if c.get("kev") is True or (c.get("epss_score") or 0) > 0.5
            ]
            normal_cves = [c for c in matched_cves if c not in critical_cves]

            cve_lines = [
                f"## 라이브러리 CVE (실시간 조회, 버전 매칭 완료 — {len(matched_cves)}건)",
                "**아래 CVE는 프로젝트가 사용하는 라이브러리 버전에 실제로 해당하는 취약점입니다.**",
                "",
            ]

            if critical_cves:
                cve_lines.append(f"### 🔴 긴급 CVE ({len(critical_cves)}건 — 실제 악용 확인 또는 악용 확률 높음)")
                for cve in critical_cves[:10]:
                    cve_lines.append(_format_cve_line(cve))
                cve_lines.append("")

            if normal_cves:
                cve_lines.append(f"### 일반 CVE ({len(normal_cves)}건)")
                for cve in normal_cves[:10]:
                    cve_lines.append(_format_cve_line(cve))

            sections.append("\n".join(cve_lines))

        if unmatched_cves:
            sections.append(
                f"참고: 버전 미매칭 CVE {len(unmatched_cves)}건은 현재 프로젝트 버전에 해당하지 않아 제외되었습니다."
            )

    # KB 위협 지식 (Phase 1에서 결정론적 조회)
    if phase1.threat_context:
        threat_lines = ["## 위협 지식 (자동 조회 결과)"]
        seen_ids: set[str] = set()
        for hit in phase1.threat_context:
            hit_id = hit.get("id", "")
            if hit_id in seen_ids:
                continue
            seen_ids.add(hit_id)
            line = f"- **[{hit.get('source', '?')}/{hit_id}]** {hit.get('title', '?')}"
            if hit.get("threat_category"):
                line += f" — {hit['threat_category']}"
            relations = hit.get("graph_relations", {})
            xrefs = []
            for key in ("cwe", "cve", "attack"):
                xrefs.extend(relations.get(key, [])[:2])
            if xrefs:
                line += f" (관련: {', '.join(xrefs)})"
            threat_lines.append(line)
        sections.append("\n".join(threat_lines))

    # 위험 함수 호출자 (Phase 1에서 결정론적 조회)
    if phase1.dangerous_callers:
        caller_lines = ["## 위험 함수 호출자 분석"]
        for dc in phase1.dangerous_callers:
            origin_label = _format_origin_label(dc)
            caller_lines.append(
                f"- **{dc.get('name', '?')}** ({dc.get('file', '?')}:{dc.get('line', '?')})"
                f"{origin_label} → 위험 호출: {', '.join(dc.get('dangerous_calls', []))}"
            )
        sections.append("\n".join(caller_lines))

    # 원본 파일 목록 (내용은 제외 — 이미 SAST가 분석함)
    files = trusted_context.get("files", [])
    if files:
        file_list = ", ".join(f.get("path", "?") for f in files)
        sections.append(f"## 분석 대상 파일\n{file_list}")

    # 기존 findings (사전에 이미 있는 경우)
    existing_findings = trusted_context.get("sastFindings")
    if existing_findings and not phase1.sast_findings:
        sections.append(f"## 외부 SAST 결과 ({len(existing_findings)}개)")
        for f in existing_findings[:20]:
            loc = f.get("location", {})
            sections.append(
                f"- [{f.get('toolId','')}:{f.get('ruleId','')}] "
                f"{loc.get('file','?')}:{loc.get('line','?')} — {f.get('message','')[:150]}"
            )

    # 사용 가능한 Evidence Refs
    if evidence_refs:
        ref_lines = [f"- `{r.get('refId', '?')}` ({r.get('artifactType', '?')}: {r.get('locator', {}).get('file', '?')})"
                     for r in evidence_refs[:30]]
        sections.append("## 사용 가능한 Evidence Refs\n" + "\n".join(ref_lines))

    user_message = "\n\n".join(sections)

    return system_prompt, user_message
