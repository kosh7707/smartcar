"""Phase 1 — LLM 개입 없이 결정론적 도구 실행.

SAST 스캔과 코드 그래프 추출을 AgentLoop 진입 전에 수행하여,
LLM이 "도구를 안 써도 되겠다"고 판단하는 문제를 원천 차단한다.
"""

from __future__ import annotations

import json
import logging
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
        project_id = trusted.get("projectId", session.request.taskId)
        build_profile = trusted.get("buildProfile")
        build_command = trusted.get("buildCommand")
        request_id = get_request_id() or session.request.taskId

        if not files and not project_path:
            agent_log(
                logger, "Phase 1 스킵: files와 projectPath 모두 없음",
                component="phase_one", phase="skip",
            )
            return result

        agent_log(
            logger, "Phase 1 시작",
            component="phase_one", phase="phase1_start",
            fileCount=len(files), projectId=project_id,
            hasProjectPath=bool(project_path), hasBuildCommand=bool(build_command),
        )

        # projectPath가 있으면 build-and-analyze 한 번에 시도
        if project_path:
            ba_result = await self._run_build_and_analyze(
                result, project_id, project_path, build_command, build_profile, request_id,
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
                if files:
                    result = await self._run_individual_tools(
                        result, files, project_id, project_path, build_profile, request_id,
                    )
        else:
            # files만 있는 경우 — 개별 도구 실행
            result = await self._run_individual_tools(
                result, files, project_id, project_path, build_profile, request_id,
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
        if self._sast_tool:
            result = await self._run_sast(result, files, project_id, build_profile, request_id)
        if self._codegraph_tool:
            result = await self._run_codegraph(result, files, project_id, build_profile, request_id)
        if self._sca_tool and project_path:
            result = await self._run_sca(result, project_id, project_path, request_id)
        return result

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
            entry: dict[str, str] = {}
            if lib.get("name"):
                entry["name"] = lib["name"]
            else:
                continue
            if lib.get("version"):
                entry["version"] = lib["version"]
            if lib.get("repoUrl"):
                entry["repo_url"] = lib["repoUrl"]
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

        try:
            resp = await self._kb_client.post(
                "/v1/cve/batch-lookup",
                json={"libraries": libraries[:20]},
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
        """SAST findings에서 CWE ID 추출 → S5 KB 위협 조회."""
        cwe_ids = self._extract_cwe_ids(result.sast_findings)
        if not cwe_ids:
            return result

        agent_log(
            logger, "Phase 1: KB 위협 조회",
            component="phase_one", phase="threat_query_start",
            cweCount=len(cwe_ids),
        )

        start = time.monotonic()
        headers: dict[str, str] = {}
        request_id = get_request_id()
        if request_id:
            headers["X-Request-Id"] = request_id

        for cwe_id in sorted(cwe_ids)[:10]:
            try:
                resp = await self._kb_client.post(
                    "/v1/search",
                    json={"query": cwe_id, "top_k": 3, "min_score": 0.35},
                    headers=headers,
                )
                resp.raise_for_status()
                hits = resp.json().get("hits", [])
                result.threat_context.extend(hits)
            except Exception as e:
                agent_log(
                    logger, f"Phase 1: KB 위협 조회 실패 ({cwe_id})",
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
            for field in (f.get("ruleId", ""), f.get("message", "")):
                for match in _CWE_RE.finditer(field):
                    cwe_ids.add(f"CWE-{match.group(1)}")
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
        "   - knowledge.search: CWE/CVE/ATT&CK 위협 지식 검색\n"
        "   - code_graph.get_functions: 함수 호출 관계 상세 조회\n"
        "4. 분석이 완료되면 아래 JSON 스키마로 최종 보고서를 작성하라\n\n"
        "[보고서 스키마]\n"
        "```json\n"
        "{\n"
        '  "summary": "분석 요약 (1~3문장, 전체 findings를 종합)",\n'
        '  "claims": [\n'
        '    {\n'
        '      "statement": "증거가 지지하는 구체적 취약점 주장",\n'
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
        "- 보고서는 JSON으로 출력하라 (앞뒤에 설명문 금지).\n"
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
    if phase1.code_functions:
        # 전체 함수를 넣으면 토큰이 폭발하므로, 요약만
        func_count = len(phase1.code_functions)
        files_set = {f.get("file", "?") for f in phase1.code_functions if f.get("file")}
        sections.append(
            f"## 코드 구조 요약\n"
            f"- 함수 {func_count}개, 파일 {len(files_set)}개\n"
            f"- 추가 정보가 필요하면 `code_graph.get_functions` 도구를 호출하세요."
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
            cve_lines = [
                f"## 라이브러리 CVE (실시간 조회, 버전 매칭 완료 — {len(matched_cves)}건)",
                "**아래 CVE는 프로젝트가 사용하는 라이브러리 버전에 실제로 해당하는 취약점입니다.**",
                "",
            ]
            for cve in matched_cves[:20]:
                line = f"- **{cve.get('id', '?')}** ({cve.get('_library', '?')} {cve.get('_version', '')})"
                if cve.get("title"):
                    line += f" — {cve['title']}"
                if cve.get("severity") is not None:
                    line += f" | CVSS {cve['severity']}"
                if cve.get("affected_versions"):
                    line += f" | 영향 범위: {cve['affected_versions']}"
                if cve.get("related_cwe"):
                    line += f" | {', '.join(cve['related_cwe'][:3])}"
                cve_lines.append(line)
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
            caller_lines.append(
                f"- **{dc.get('name', '?')}** ({dc.get('file', '?')}:{dc.get('line', '?')}) "
                f"→ 위험 호출: {', '.join(dc.get('dangerous_calls', []))}"
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
