"""Phase 1 — LLM 개입 없이 결정론적 도구 실행.

SAST 스캔과 코드 그래프 추출을 AgentLoop 진입 전에 수행하여,
LLM이 "도구를 안 써도 되겠다"고 판단하는 문제를 원천 차단한다.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

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
    sast_duration_ms: int = 0
    code_graph_duration_ms: int = 0
    sca_duration_ms: int = 0
    total_duration_ms: int = 0


class Phase1Executor:
    """LLM 없이 결정론적으로 SAST + 코드 그래프 + SCA를 실행한다."""

    def __init__(
        self,
        sast_tool: ToolImplementation | None = None,
        codegraph_tool: ToolImplementation | None = None,
        sca_tool: ToolImplementation | None = None,
    ) -> None:
        self._sast_tool = sast_tool
        self._codegraph_tool = codegraph_tool
        self._sca_tool = sca_tool

    async def execute(self, session: AgentSession) -> Phase1Result:
        """Phase 1: SAST 스캔 + 코드 그래프 추출."""
        result = Phase1Result()
        start = time.monotonic()

        # context에서 파일 목록 추출
        trusted = session.request.context.trusted
        files = trusted.get("files", [])
        if not files:
            agent_log(
                logger, "Phase 1 스킵: 파일 없음",
                component="phase_one", phase="skip",
            )
            return result

        project_id = trusted.get("projectId", session.request.taskId)
        build_profile = trusted.get("buildProfile")
        request_id = get_request_id() or session.request.taskId

        agent_log(
            logger, "Phase 1 시작",
            component="phase_one", phase="phase1_start",
            fileCount=len(files), projectId=project_id,
        )

        # 1. SAST 스캔 (필수)
        if self._sast_tool:
            result = await self._run_sast(result, files, project_id, build_profile, request_id)

        # 2. 코드 그래프 추출 (선택)
        if self._codegraph_tool:
            result = await self._run_codegraph(result, files, project_id, build_profile, request_id)

        # 3. SCA 라이브러리 식별 (선택, projectPath 필요)
        project_path = trusted.get("projectPath")
        if self._sca_tool and project_path:
            result = await self._run_sca(result, project_id, project_path, request_id)

        result.total_duration_ms = int((time.monotonic() - start) * 1000)

        agent_log(
            logger, "Phase 1 완료",
            component="phase_one", phase="phase1_end",
            findings=len(result.sast_findings),
            functions=len(result.code_functions),
            totalMs=result.total_duration_ms,
        )

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


def build_phase2_prompt(
    phase1: Phase1Result,
    trusted_context: dict,
    evidence_refs: list[dict] | None = None,
) -> tuple[str, str]:
    """Phase 1 결과를 포함한 Phase 2 프롬프트를 생성한다.

    Returns: (system_prompt, user_message)
    """
    system_prompt = (
        "당신은 자동차 사이버보안 분석 에이전트입니다.\n"
        "아래에 SAST 도구가 사전 실행한 분석 결과가 포함되어 있습니다.\n"
        "이 결과를 해석하고, 필요하면 추가 도구(knowledge.search, code_graph.get_functions)를 호출하여 심층 분석하세요.\n\n"
        "[출력 형식]\n"
        "반드시 아래 JSON 스키마를 정확히 따르라. JSON만 출력하라.\n"
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
        "## 출력 규칙\n"
        "- summary, claims, caveats, usedEvidenceRefs는 **필수**이다.\n"
        "- claims[].supportingEvidenceRefs에는 [사용 가능한 Evidence Refs]에 나열된 refId만 사용하라.\n"
        "- 각 SAST finding마다 별도의 claim을 만들어라.\n"
        "- JSON만 출력하라. 앞뒤에 설명문, 마크다운을 붙이지 마라.\n"
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
