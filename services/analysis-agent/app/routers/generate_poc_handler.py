"""Generate-POC task handler extracted from tasks router."""

from __future__ import annotations

import logging

from app.config import settings
from agent_shared.context import get_request_id
from app.runtime.request_summary import request_summary_tracker
from app.schemas.request import TaskRequest
from app.schemas.response import TaskFailureResponse, TaskSuccessResponse

logger = logging.getLogger(__name__)


async def handle_generate_poc(request: TaskRequest, model_registry) -> TaskSuccessResponse | TaskFailureResponse:
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
    request_summary_tracker.mark_phase_advancing(request_id, source="generate-poc-start")

    agent_log(
        logger, "generate-poc 시작",
        component="generate_poc", phase="poc_start",
        claimLocation=claim.get("location"),
        fileCount=len(files),
    )

    # ─── 미니 Phase 1: KB 컨텍스트 수집 ───
    kb_context_lines = []

    async with httpx.AsyncClient(base_url=settings.kb_endpoint, timeout=10.0) as kb:
        headers: dict[str, str] = {"X-Timeout-Ms": "10000"}
        if request_id:
            headers["X-Request-Id"] = request_id

        # 1. 호출자 체인 조회 (claim.location에서 함수명 추출)
        target_func = extract_function_from_claim(claim)
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
                    json={"query": cwe_id, "source_filter": ["CWE", "CAPEC"]},
                    headers=headers,
                )
                if resp.status_code != 200:
                    detail = resp.text[:200] if resp.text else str(resp.status_code)
                    agent_log(logger, f"PoC KB search 실패: {resp.status_code} — {detail}",
                              component="generate_poc", phase="kb_error", level=logging.WARNING)
                else:
                    hits = resp.json().get("hits", [])
                    if hits:
                        kb_context_lines.append(f"## 위협 지식 ({cwe_id})")
                        for h in hits:
                            kb_context_lines.append(
                                f"- [{h.get('source', '?')}/{h.get('id', '?')}] {h.get('title', '?')}"
                            )
                        kb_context_lines.append("")
            except Exception as e:
                agent_log(logger, f"PoC KB search 예외: {e}",
                          component="generate_poc", phase="kb_error", level=logging.WARNING)

    kb_context = "\n".join(kb_context_lines) if kb_context_lines else "(KB 컨텍스트 없음)"
    request_summary_tracker.mark_phase_advancing(request_id, source="kb-phase-complete")

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
        profile = model_registry.get_default()
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
            content='{"summary":"Mock PoC","claims":[{"statement":"mock","detail":"mock poc code","supportingEvidenceRefs":["eref-file-00"],"location":"clients/http_client.cpp:62"}],"caveats":[],"usedEvidenceRefs":["eref-file-00"],"needsHumanReview":true,"recommendedNextSteps":[],"policyFlags":[]}',
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
        request_summary_tracker.mark_phase_advancing(request_id, source="llm-response")
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
        elapsed = int((time.monotonic() - start) * 1000)
        return TaskFailureResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=TaskStatus.VALIDATION_FAILED,
            failureCode=FailureCode.INVALID_SCHEMA,
            failureDetail="generate-poc가 구조화된 JSON 대신 자연어/비JSON 응답을 반환함",
            retryable=False,
            audit=AuditInfo(
                inputHash="",
                latencyMs=elapsed,
                tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                retryCount=0,
                ragHits=len(kb_context_lines),
                createdAt=datetime.now(timezone.utc).isoformat(),
            ),
        )

    allowed_refs = {ref.refId for ref in request.evidenceRefs}

    # 환각 refId 교정/제거
    from app.validators.evidence_sanitizer import EvidenceRefSanitizer
    sanitizer = EvidenceRefSanitizer()
    parsed, sanitize_corrections = sanitizer.sanitize(parsed, allowed_refs)
    if sanitize_corrections:
        from agent_shared.observability import agent_log as _agent_log
        _agent_log(logger, "generate-poc evidence ref 교정",
                   component="generate_poc", phase="poc_sanitize",
                   corrections=sanitize_corrections[:10])

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

    if not schema_result.valid or not evidence_valid or not claims:
        errors = schema_result.errors + evidence_errors
        if not claims:
            errors.append("generate-poc는 최소 1개 이상의 구조화된 claim을 반환해야 함")
        return TaskFailureResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=TaskStatus.VALIDATION_FAILED,
            failureCode=FailureCode.INVALID_SCHEMA,
            failureDetail="; ".join(errors),
            retryable=False,
            audit=AuditInfo(
                inputHash=input_hash,
                latencyMs=elapsed,
                tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                retryCount=0,
                ragHits=len(kb_context_lines),
                createdAt=datetime.now(timezone.utc).isoformat(),
            ),
        )

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

def extract_function_from_claim(claim: dict) -> str | None:
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
