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
    from agent_shared.errors import StrictJsonContractError
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
    build_preparation = trusted.get("buildPreparation") or {}
    # Evidence refs carried by the input claim (typically produced by deep-analyze).
    # Used both in the user-message evidence list and later to widen allowed_refs
    # so the sanitizer does not strip refs that came from a trusted upstream result.
    _claim_sr = claim.get("supportingEvidenceRefs")
    claim_supporting: list[str] = (
        [r for r in _claim_sr if isinstance(r, str) and r] if isinstance(_claim_sr, list) else []
    )
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

    request_summary_tracker.mark_transport_only(request_id, source="kb-lookup")
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
        "## Shell quoting awareness (CRITICAL)\n"
        "Target sink 분석 시, 사용자 입력이 shell command string에 어떻게 interpolate 되는지 반드시 단계적으로 추적하라:\n"
        "1. `popen`/`system`/`exec` 등 shell-exec sink까지의 호출 체인을 식별\n"
        "2. 각 interpolation 지점의 quote context를 명시: 단일따옴표 `'...'`, 이중따옴표 `\"...\"`, unquoted\n"
        "3. 단일따옴표 안이라면 `;`, `|`, `$()`, backtick 등 shell metachar는 **literal로 해석되어 실행되지 않는다**. payload는 먼저 현재 quote 를 break out 해야 한다.\n"
        "4. 예: `popen(\"openssl req ... -subj '/CN=\" + cn + \"'\")` — `cn` 이 단일따옴표 안. 단순 `test; echo X` 주입은 openssl의 CN 문자열 일부로 전달될 뿐 쉘에서 실행되지 않는다. 탈출 payload 예: `test' && echo X && echo '` (단일따옴표 구조를 깨지 않고 이어지게).\n"
        "5. quote context 분석 결과를 claim.detail의 \"## Injection 분석\" 섹션에 명시적으로 적어라 (sink/quote context/escape 경로).\n\n"
        "## Detection self-check (CRITICAL)\n"
        "PoC의 탐지 로직이 **명령 에코와 실제 실행을 구별**할 수 있는지 반드시 검토하라:\n"
        "- 타겟 프로그램이 verbose 모드로 `[exec] <cmd>` 같은 문자열을 stdout에 출력한다면, canary 문자열이 payload 자체의 일부로 stdout에 에코되어 탐지 로직이 false positive를 낸다.\n"
        "- 단순 `\"CANARY\" in stdout` 탐지보다 **side-effect 기반 탐지를 우선하라**:\n"
        "  - `touch /tmp/pwned.<random>` → 실행 후 파일 존재 검사\n"
        "  - 비활성 포트로 `nc -z 127.0.0.1 PORT` → 연결 시도 관찰\n"
        "  - 환경변수/파일시스템의 관찰 가능한 부작용\n"
        "- stdout 기반 탐지가 불가피하다면, canary는 **입력 payload 문자열에 등장하지 않는 랜덤 토큰**(UUID, sha 해시 prefix)이어야 한다.\n\n"
        "## Target metadata honesty\n"
        "빌드 산출물 이름, 컴파일 명령, 실행 방식은 **context에 주어진 것만 사용하라. 없으면 추측하지 말고 명시하라**:\n"
        "- 입력에 `Build metadata` 섹션이 있으면 거기 적힌 `buildCommand`/`buildScript`/`declaredMode`/`buildDir` 값을 그대로 사용\n"
        "- 없으면 PoC의 실행 방법 섹션에 `<unknown: please compile from source; check CMakeLists.txt/Makefile for target name>` 같이 명시적으로 표기\n"
        "- 바이너리 이름을 확신할 수 없으면 `./<binary-from-CMakeLists-add_executable>` 같이 플레이스홀더로 남겨 분석가가 채우도록\n\n"
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
        "- caveats가 없으면 필드를 생략하지 말고 반드시 `\"caveats\": []`로 출력하라.\n"
        "- usedEvidenceRefs가 없으면 필드를 생략하지 말고 반드시 `\"usedEvidenceRefs\": []`로 출력하라.\n"
    )

    # 소스코드 포맷팅
    source_sections = []
    for f in files[:5]:
        source_sections.append(f"### {f.get('path', '?')}\n```cpp\n{f.get('content', '')}\n```")
    source_text = "\n\n".join(source_sections) if source_sections else "(소스코드 없음)"

    # Build metadata from caller (buildPreparation alias). Prevents LLM from inventing
    # binary names / compile commands when caller actually provided them.
    build_meta_lines: list[str] = []
    for key in ("declaredMode", "buildCommand", "buildScript", "buildDir"):
        value = build_preparation.get(key)
        if value:
            build_meta_lines.append(f"- **{key}**: `{value}`")
    expected_artifacts = build_preparation.get("expectedArtifacts")
    if isinstance(expected_artifacts, list) and expected_artifacts:
        names: list[str] = []
        for item in expected_artifacts:
            if isinstance(item, str):
                names.append(item)
            elif isinstance(item, dict) and item.get("name"):
                names.append(str(item["name"]))
        if names:
            build_meta_lines.append(f"- **expectedArtifacts**: {', '.join(names)}")
    produced_artifacts = build_preparation.get("producedArtifacts")
    if isinstance(produced_artifacts, list) and produced_artifacts:
        parts: list[str] = []
        for item in produced_artifacts:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(str(item.get("path") or item.get("name") or item))
        if parts:
            build_meta_lines.append(f"- **producedArtifacts**: {', '.join(parts)}")
    if build_meta_lines:
        build_meta_section = "## Build metadata (caller-provided, use as-is)\n" + "\n".join(build_meta_lines) + "\n\n"
    else:
        build_meta_section = (
            "## Build metadata\n"
            "(no buildPreparation provided; do not invent binary names — state `<unknown>` or placeholder)\n\n"
        )

    user_message = (
        f"## 분석된 취약점\n"
        f"- **statement**: {claim.get('statement', '?')}\n"
        f"- **detail**: {claim.get('detail', '?')}\n"
        f"- **location**: {claim.get('location', '?')}\n\n"
        f"{build_meta_section}"
        f"{kb_context}\n\n"
        f"## 소스코드\n{source_text}\n\n"
        f"## 사용 가능한 Evidence Refs\n"
    )
    for ref in request.evidenceRefs:
        user_message += f"- `{ref.refId}` ({ref.artifactType}: {ref.locator.get('file', '?')})\n"
    # Also list refs carried by the input claim so the LLM can cite them in output.
    _top_level_ids = {ref.refId for ref in request.evidenceRefs}
    for r in claim_supporting:
        if r not in _top_level_ids:
            user_message += f"- `{r}` (carried over from input claim)\n"

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
            content='{"summary":"Mock PoC","claims":[{"statement":"mock","detail":"mock poc code","supportingEvidenceRefs":["eref-file-00"],"location":"clients/http_client.cpp:62"}],"caveats":[],"usedEvidenceRefs":["eref-file-00"],"suggestedSeverity":"info","needsHumanReview":true,"recommendedNextSteps":[],"policyFlags":[]}',
            prompt_tokens=100, completion_tokens=50,
        ))
        llm.aclose = AsyncMock()

    schema_repair_used = False
    strict_json_retry_used = False
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    try:
        request_summary_tracker.mark_transport_only(request_id, source="llm-inference")
        llm_response = await llm.call(
            messages,
            max_tokens=request.constraints.maxTokens or 8192,
            temperature=0.3,
            prefer_async_ownership=True,
        )
        raw = llm_response.content or ""
        prompt_tokens = llm_response.prompt_tokens
        completion_tokens = llm_response.completion_tokens
        request_summary_tracker.mark_phase_advancing(request_id, source="llm-response")
    except StrictJsonContractError as e:
        strict_json_retry_used = True
        try:
            retry_messages = [
                *messages,
                {
                    "role": "user",
                    "content": (
                        "[시스템] S7 strict JSON contract violation이 발생했습니다. "
                        "동일한 요청을 순수 JSON Assessment 객체로 한 번만 재시도합니다. "
                        "설명문/코드펜스 없이 첫 문자는 반드시 `{`이어야 하며, 모든 required key를 포함하십시오."
                    ),
                },
            ]
            request_summary_tracker.mark_transport_only(request_id, source="llm-strict-json-retry")
            llm_response = await llm.call(
                retry_messages,
                max_tokens=request.constraints.maxTokens or 8192,
                temperature=0.0,
                prefer_async_ownership=True,
            )
            raw = llm_response.content or ""
            prompt_tokens = llm_response.prompt_tokens
            completion_tokens = llm_response.completion_tokens
            request_summary_tracker.mark_phase_advancing(request_id, source="llm-strict-json-retry-response")
        except StrictJsonContractError as e2:
            elapsed = int((time.monotonic() - start) * 1000)
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.MODEL_ERROR,
                failureCode=FailureCode.MODEL_UNAVAILABLE,
                failureDetail=_strict_json_failure_detail(e2),
                retryable=True,
                audit=AuditInfo(
                    inputHash="", latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=0, completion=0),
                    retryCount=1, ragHits=0,
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )
        except Exception as e2:
            elapsed = int((time.monotonic() - start) * 1000)
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.MODEL_ERROR,
                failureCode=FailureCode.MODEL_UNAVAILABLE,
                failureDetail=f"strict_json_retry_failed: {e2}",
                retryable=True,
                audit=AuditInfo(
                    inputHash="", latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=0, completion=0),
                    retryCount=1, ragHits=0,
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )
    except Exception as e:
        elapsed = int((time.monotonic() - start) * 1000)
        if hasattr(llm, 'aclose'):
            await llm.aclose()
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

    # ─── 파싱 + 검증 ───
    parser = V1ResponseParser()
    parsed = parser.parse(raw)
    if parsed is None:
        try:
            raw, repair_prompt_tokens, repair_completion_tokens = await _repair_generate_poc_schema(
                llm=llm,
                messages=messages,
                invalid_content=raw,
                schema_errors=["non-JSON output"],
                request=request,
            )
        except Exception as e:
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            elapsed = int((time.monotonic() - start) * 1000)
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.MODEL_ERROR,
                failureCode=FailureCode.MODEL_UNAVAILABLE,
                failureDetail=f"generate-poc schema repair call failed: {e}",
                retryable=True,
                audit=AuditInfo(
                    inputHash="",
                    latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                    retryCount=1 if strict_json_retry_used else 0,
                    ragHits=len(kb_context_lines),
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )
        schema_repair_used = True
        prompt_tokens += repair_prompt_tokens
        completion_tokens += repair_completion_tokens
        parsed = parser.parse(raw)
        if parsed is None:
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            elapsed = int((time.monotonic() - start) * 1000)
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.VALIDATION_FAILED,
                failureCode=FailureCode.INVALID_SCHEMA,
                failureDetail="generate-poc가 strict schema repair 후에도 구조화된 JSON을 반환하지 않음",
                retryable=False,
                audit=AuditInfo(
                    inputHash="",
                    latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                    retryCount=int(schema_repair_used) + int(strict_json_retry_used),
                    ragHits=len(kb_context_lines),
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )

    schema_probe = SchemaValidator().validate(parsed, request.taskType)
    if not schema_probe.valid:
        try:
            raw, repair_prompt_tokens, repair_completion_tokens = await _repair_generate_poc_schema(
                llm=llm,
                messages=messages,
                invalid_content=raw,
                schema_errors=schema_probe.errors,
                request=request,
            )
        except Exception as e:
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            elapsed = int((time.monotonic() - start) * 1000)
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.MODEL_ERROR,
                failureCode=FailureCode.MODEL_UNAVAILABLE,
                failureDetail=f"generate-poc schema repair call failed: {e}",
                retryable=True,
                audit=AuditInfo(
                    inputHash="",
                    latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                    retryCount=int(schema_repair_used) + int(strict_json_retry_used),
                    ragHits=len(kb_context_lines),
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )
        schema_repair_used = True
        prompt_tokens += repair_prompt_tokens
        completion_tokens += repair_completion_tokens
        parsed = parser.parse(raw)
        if parsed is None:
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            elapsed = int((time.monotonic() - start) * 1000)
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.VALIDATION_FAILED,
                failureCode=FailureCode.INVALID_SCHEMA,
                failureDetail="generate-poc schema repair가 non-JSON 응답을 반환함",
                retryable=False,
                audit=AuditInfo(
                    inputHash="",
                    latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                    retryCount=int(schema_repair_used) + int(strict_json_retry_used),
                    ragHits=len(kb_context_lines),
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )
        agent_log(
            logger,
            "generate-poc strict schema repair applied",
            component="generate_poc",
            phase="poc_schema_repair",
            errors=schema_probe.errors,
        )

    if schema_repair_used:
        repaired_schema = SchemaValidator().validate(parsed, request.taskType)
        if not repaired_schema.valid:
            if hasattr(llm, 'aclose'):
                await llm.aclose()
            elapsed = int((time.monotonic() - start) * 1000)
            return TaskFailureResponse(
                taskId=request.taskId,
                taskType=request.taskType,
                status=TaskStatus.VALIDATION_FAILED,
                failureCode=FailureCode.INVALID_SCHEMA,
                failureDetail="generate-poc schema repair failed: " + "; ".join(repaired_schema.errors),
                retryable=False,
                audit=AuditInfo(
                    inputHash="",
                    latencyMs=elapsed,
                    tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                    retryCount=int(schema_repair_used) + int(strict_json_retry_used),
                    ragHits=len(kb_context_lines),
                    createdAt=datetime.now(timezone.utc).isoformat(),
                ),
            )

    if strict_json_retry_used:
        policy_flags = parsed.get("policyFlags")
        if isinstance(policy_flags, list) and "strict_json_retry" not in policy_flags:
            policy_flags.append("strict_json_retry")
            parsed["policyFlags"] = policy_flags

    if hasattr(llm, 'aclose'):
        await llm.aclose()

    # allowed_refs: request-level EvidenceRef IDs ∪ input claim's supportingEvidenceRefs.
    # Input claim's refs come from a trusted upstream (deep-analyze) result, so they are
    # treated as allowed by default — without this, the sanitizer strips them and grounding
    # collapses to the 0.3 ceiling even when the claim already carries valid refs.
    allowed_refs = {ref.refId for ref in request.evidenceRefs} | set(claim_supporting)
    evidence_validator = EvidenceValidator()
    raw_evidence_valid, raw_evidence_errors = evidence_validator.validate(parsed, allowed_refs)
    if not raw_evidence_valid:
        elapsed = int((time.monotonic() - start) * 1000)
        input_str = json.dumps(request.model_dump(mode="json"), sort_keys=True)
        input_hash = f"sha256:{hashlib.sha256(input_str.encode()).hexdigest()[:16]}"
        return TaskFailureResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=TaskStatus.VALIDATION_FAILED,
            failureCode=FailureCode.INVALID_GROUNDING,
            failureDetail="; ".join(raw_evidence_errors),
            retryable=False,
            audit=AuditInfo(
                inputHash=input_hash,
                latencyMs=elapsed,
                tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                retryCount=int(schema_repair_used) + int(strict_json_retry_used),
                ragHits=len(kb_context_lines),
                createdAt=datetime.now(timezone.utc).isoformat(),
            ),
        )

    # Post-LLM heuristic FP scanner — catches common PoC footguns and surfaces as caveats.
    # Always non-destructive (warnings only), never rejects the response.
    fp_warnings = _poc_fp_heuristics(parsed)
    if fp_warnings:
        existing_caveats = parsed.get("caveats") or []
        if not isinstance(existing_caveats, list):
            existing_caveats = []
        parsed["caveats"] = list(existing_caveats) + [f"[auto-detected FP risk] {w}" for w in fp_warnings]
        agent_log(
            logger, "generate-poc FP heuristic triggered",
            component="generate_poc", phase="poc_fp_heuristic",
            warningCount=len(fp_warnings),
        )

    # raw grounding validation 이후의 방어적 ref cleanup
    from app.validators.evidence_sanitizer import EvidenceRefSanitizer
    sanitizer = EvidenceRefSanitizer()
    parsed, sanitize_corrections = sanitizer.sanitize(parsed, allowed_refs)
    if sanitize_corrections:
        from agent_shared.observability import agent_log as _agent_log
        _agent_log(logger, "generate-poc evidence ref defensive cleanup",
                   component="generate_poc", phase="poc_sanitize",
                   corrections=sanitize_corrections[:10])

    quality_repairs = _harden_generate_poc_quality(
        parsed=parsed,
        input_claim=claim,
        files=files,
        build_preparation=build_preparation,
    )
    if quality_repairs:
        agent_log(
            logger,
            "generate-poc quality hardening applied",
            component="generate_poc",
            phase="poc_quality_harden",
            repairs=quality_repairs,
        )

    schema_validator = SchemaValidator()
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
        failure_code = (
            FailureCode.INVALID_SCHEMA
            if not schema_result.valid or not claims
            else FailureCode.INVALID_GROUNDING
        )
        return TaskFailureResponse(
            taskId=request.taskId,
            taskType=request.taskType,
            status=TaskStatus.VALIDATION_FAILED,
            failureCode=failure_code,
            failureDetail="; ".join(errors),
            retryable=False,
            audit=AuditInfo(
                inputHash=input_hash,
                latencyMs=elapsed,
                tokenUsage=TokenUsage(prompt=prompt_tokens, completion=completion_tokens),
                retryCount=int(schema_repair_used) + int(strict_json_retry_used),
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
            retryCount=int(schema_repair_used) + int(strict_json_retry_used),
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


async def _repair_generate_poc_schema(
    *,
    llm,
    messages: list[dict],
    invalid_content: str,
    schema_errors: list[str],
    request: TaskRequest,
) -> tuple[str, int, int]:
    """Repair malformed generate-poc JSON with a deterministic scaffold.

    The LLM is allowed to refine wording, but the required Assessment object
    shape is scaffolded before the retry and preserved after the retry. This
    prevents a repair turn from repeating an invalid ``summary + claims``-only
    shape.
    """
    import json

    from app.pipeline.response_parser import V1ResponseParser

    parser = V1ResponseParser()
    partial = parser.parse(invalid_content) or {}
    scaffold = _build_generate_poc_repair_scaffold(
        partial=partial,
        request=request,
    )
    scaffold_json = json.dumps(scaffold, ensure_ascii=False, indent=2)
    repair_messages = [
        *messages,
        {"role": "assistant", "content": invalid_content[:8000]},
        {
            "role": "user",
            "content": (
                "[시스템] 직전 응답은 generate-poc Assessment 스키마를 위반했습니다. "
                "아래 S3가 제공하는 scaffold의 object shape와 모든 key를 유지한 채 하나의 유효한 JSON 객체로 재작성하십시오. "
                "설명문/코드펜스 없이 첫 문자는 반드시 `{`이어야 합니다.\n\n"
                f"Schema errors: {'; '.join(schema_errors)}\n\n"
                "필수 top-level fields: summary, claims, caveats, usedEvidenceRefs, "
                "suggestedSeverity, needsHumanReview, recommendedNextSteps, policyFlags.\n"
                "각 claims[] 원소는 statement, detail, supportingEvidenceRefs, location을 가진 객체여야 합니다.\n"
                "절대 key를 삭제하지 마십시오. supportingEvidenceRefs와 usedEvidenceRefs에는 scaffold에 있는 refId만 사용하십시오.\n\n"
                "S3 deterministic scaffold:\n"
                f"```json\n{scaffold_json}\n```"
            ),
        },
    ]
    request_summary_tracker.mark_transport_only(
        get_request_id() or request.taskId,
        source="generate-poc-schema-repair",
    )
    response = await llm.call(
        repair_messages,
        max_tokens=request.constraints.maxTokens or 8192,
        temperature=0.0,
        prefer_async_ownership=True,
    )
    request_summary_tracker.mark_phase_advancing(
        get_request_id() or request.taskId,
        source="generate-poc-schema-repair-response",
    )
    refinement = parser.parse(response.content or "")
    repaired = _merge_generate_poc_repair_refinement(
        scaffold=scaffold,
        refinement=refinement,
        request=request,
    )
    return (
        json.dumps(repaired, ensure_ascii=False),
        response.prompt_tokens,
        response.completion_tokens,
    )


def _build_generate_poc_repair_scaffold(
    *,
    partial: dict,
    request: TaskRequest,
) -> dict:
    trusted = request.context.trusted if isinstance(request.context.trusted, dict) else {}
    input_claim = trusted.get("claim", {}) if isinstance(trusted.get("claim"), dict) else {}
    allowed_refs = _allowed_generate_poc_ref_ids(request)
    partial_claims = partial.get("claims")
    claim_sources = [c for c in partial_claims if isinstance(c, dict)] if isinstance(partial_claims, list) else []
    if not claim_sources:
        claim_sources = [input_claim]

    claims: list[dict] = []
    for source in claim_sources:
        refs = _valid_generate_poc_refs(source.get("supportingEvidenceRefs"), allowed_refs)
        if not refs:
            refs = _valid_generate_poc_refs(input_claim.get("supportingEvidenceRefs"), allowed_refs)
        if not refs:
            refs = _matching_request_refs_for_claim(request, input_claim)

        claims.append({
            "statement": _first_nonempty_string(
                source.get("statement"),
                input_claim.get("statement"),
                "Generate a PoC for the supplied security claim.",
            ),
            "detail": _first_nonempty_string(
                source.get("detail"),
                input_claim.get("detail"),
                source.get("statement"),
                input_claim.get("statement"),
                "PoC details require analyst review.",
            ),
            "supportingEvidenceRefs": refs,
            "location": _first_nonempty_string(
                source.get("location"),
                input_claim.get("location"),
                _location_from_request_evidence(request),
            ),
        })

    used_refs = _valid_generate_poc_refs(partial.get("usedEvidenceRefs"), allowed_refs)
    if not used_refs:
        used_refs = list(dict.fromkeys(ref for claim in claims for ref in claim["supportingEvidenceRefs"]))

    caveats = _string_list(partial.get("caveats"))
    recommended_next_steps = _string_list(partial.get("recommendedNextSteps"))
    policy_flags = _string_list(partial.get("policyFlags"))
    if "structured_finalizer" not in policy_flags:
        policy_flags.append("structured_finalizer")

    return {
        "summary": _first_nonempty_string(
            partial.get("summary"),
            input_claim.get("statement"),
            "PoC generated from the supplied security claim.",
        ),
        "claims": claims,
        "caveats": caveats,
        "usedEvidenceRefs": used_refs,
        "suggestedSeverity": _infer_generate_poc_severity(partial, input_claim),
        "needsHumanReview": partial.get("needsHumanReview") if isinstance(partial.get("needsHumanReview"), bool) else True,
        "recommendedNextSteps": recommended_next_steps,
        "policyFlags": policy_flags,
    }


def _merge_generate_poc_repair_refinement(
    *,
    scaffold: dict,
    refinement: dict | None,
    request: TaskRequest,
) -> dict:
    if not isinstance(refinement, dict):
        return scaffold

    allowed_refs = _allowed_generate_poc_ref_ids(request)
    repaired = {
        **scaffold,
        "claims": [dict(c) for c in scaffold.get("claims", []) if isinstance(c, dict)],
    }

    for field in ("summary",):
        if isinstance(refinement.get(field), str) and refinement[field].strip():
            repaired[field] = refinement[field]
    for field in ("caveats", "recommendedNextSteps", "policyFlags"):
        values = _string_list(refinement.get(field))
        if values or field in refinement:
            repaired[field] = values
    severity = _infer_generate_poc_severity(refinement, {})
    if severity:
        repaired["suggestedSeverity"] = severity
    if isinstance(refinement.get("needsHumanReview"), bool):
        repaired["needsHumanReview"] = refinement["needsHumanReview"]

    refined_claims = refinement.get("claims")
    if isinstance(refined_claims, list):
        for index, refined_claim in enumerate(c for c in refined_claims if isinstance(c, dict)):
            if index >= len(repaired["claims"]):
                repaired["claims"].append(dict(scaffold["claims"][-1]))
            target = repaired["claims"][index]
            for field in ("statement", "detail", "location"):
                if isinstance(refined_claim.get(field), str) and refined_claim[field].strip():
                    target[field] = refined_claim[field]
            refs = _valid_generate_poc_refs(refined_claim.get("supportingEvidenceRefs"), allowed_refs)
            if refs:
                target["supportingEvidenceRefs"] = refs

    used_refs = _valid_generate_poc_refs(refinement.get("usedEvidenceRefs"), allowed_refs)
    if used_refs:
        repaired["usedEvidenceRefs"] = used_refs
    if not repaired.get("usedEvidenceRefs"):
        repaired["usedEvidenceRefs"] = list(dict.fromkeys(
            ref
            for claim in repaired.get("claims", [])
            if isinstance(claim, dict)
            for ref in claim.get("supportingEvidenceRefs", [])
            if isinstance(ref, str)
        ))

    if "structured_finalizer" not in repaired.get("policyFlags", []):
        repaired["policyFlags"] = list(repaired.get("policyFlags", [])) + ["structured_finalizer"]
    return repaired


def _allowed_generate_poc_ref_ids(request: TaskRequest) -> list[str]:
    trusted = request.context.trusted if isinstance(request.context.trusted, dict) else {}
    input_claim = trusted.get("claim", {}) if isinstance(trusted.get("claim"), dict) else {}
    refs: list[str] = []
    raw_claim_refs = input_claim.get("supportingEvidenceRefs")
    if isinstance(raw_claim_refs, list):
        refs.extend(ref for ref in raw_claim_refs if isinstance(ref, str) and ref)
    refs.extend(ref.refId for ref in request.evidenceRefs if isinstance(ref.refId, str) and ref.refId)
    return list(dict.fromkeys(refs))


def _matching_request_refs_for_claim(request: TaskRequest, input_claim: dict) -> list[str]:
    location = input_claim.get("location") if isinstance(input_claim, dict) else None
    location_file = location.split(":", 1)[0] if isinstance(location, str) and location else ""
    if not location_file:
        return []
    matched: list[str] = []
    for ref in request.evidenceRefs:
        locator = ref.locator if isinstance(ref.locator, dict) else {}
        ref_file = locator.get("file") or locator.get("path")
        artifact_type = str(ref.artifactType or "").lower()
        if artifact_type and not any(marker in artifact_type for marker in ("source", "sast", "code")):
            continue
        if location_file and isinstance(ref_file, str) and ref_file and ref_file != location_file:
            continue
        if ref.refId:
            matched.append(ref.refId)
    return list(dict.fromkeys(matched))


def _valid_generate_poc_refs(raw_refs, allowed_refs: list[str]) -> list[str]:
    allowed = set(allowed_refs)
    if not isinstance(raw_refs, list):
        return []
    return list(dict.fromkeys(ref for ref in raw_refs if isinstance(ref, str) and ref in allowed))


def _string_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _first_nonempty_string(*values) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _location_from_request_evidence(request: TaskRequest) -> str:
    for ref in request.evidenceRefs:
        locator = ref.locator if isinstance(ref.locator, dict) else {}
        file_name = locator.get("file") or locator.get("path")
        line = locator.get("startLine") or locator.get("fromLine") or locator.get("line")
        if file_name:
            return f"{file_name}:{line}" if line else str(file_name)
    return ""


def _infer_generate_poc_severity(partial: dict, input_claim: dict) -> str:
    allowed = {"critical", "high", "medium", "low", "info"}
    for source in (partial, input_claim):
        for key in ("suggestedSeverity", "severity"):
            value = source.get(key) if isinstance(source, dict) else None
            if isinstance(value, str) and value in allowed:
                return value
    haystack = " ".join(
        [
            *[
                str(value)
                for source in (partial, input_claim)
                if isinstance(source, dict)
                for value in (source.get("summary"), source.get("statement"), source.get("detail"))
                if value
            ],
            *[
                str(value)
                for claim in (partial.get("claims") if isinstance(partial.get("claims"), list) else [])
                if isinstance(claim, dict)
                for value in (claim.get("statement"), claim.get("detail"))
                if value
            ],
        ]
    ).lower()
    if any(marker in haystack for marker in ("critical", "rce", "remote code", "command injection", "cwe-78", "popen")):
        return "high"
    return "medium"


def _strict_json_failure_detail(error) -> str:
    parts = [
        f"blockedReason={getattr(error, 'blocked_reason', 'strict_json_contract_violation')}",
    ]
    if getattr(error, "async_request_id", None):
        parts.append(f"asyncRequestId={error.async_request_id}")
    if getattr(error, "gateway_request_id", None):
        parts.append(f"gatewayRequestId={error.gateway_request_id}")
    if getattr(error, "error_detail", None):
        parts.append(f"errorDetail={error.error_detail}")
    return "strict_json_contract_violation; " + "; ".join(parts)


def _harden_generate_poc_quality(
    *,
    parsed: dict,
    input_claim: dict,
    files: list,
    build_preparation: dict,
) -> list[str]:
    """Add non-evidence PoC quality guards without manufacturing grounding."""
    repairs: list[str] = []

    claims = parsed.get("claims")
    valid_claims = [claim for claim in claims if isinstance(claim, dict)] if isinstance(claims, list) else []

    if _looks_like_command_injection(parsed, input_claim):
        target_binary = _infer_target_binary(build_preparation, files)
        for i, claim in enumerate(valid_claims):
            detail = str(claim.get("detail") or "")
            addendum = _build_poc_quality_guard_addendum(
                detail=detail,
                target_binary=target_binary,
            )
            if addendum:
                claim["detail"] = f"{detail.rstrip()}\n\n{addendum}" if detail.strip() else addendum
                repairs.append(f"claims[{i}].qualityGuard")

        caveats = parsed.get("caveats")
        if not isinstance(caveats, list):
            caveats = []
        if not any("poc" in str(c).lower() or "detection" in str(c).lower() or "heuristic" in str(c).lower() for c in caveats):
            caveats.append(
                "PoC detection heuristic caveat: S3 added/verified side-effect based detection requirements "
                "so the analyst should confirm the generated marker-file check in the target runtime."
            )
            parsed["caveats"] = caveats
            repairs.append("caveats.qualityGuard")

    return list(dict.fromkeys(repairs))


def _looks_like_command_injection(parsed: dict, input_claim: dict) -> bool:
    haystack = " ".join([
        str(input_claim.get("statement") or ""),
        str(input_claim.get("detail") or ""),
        str(parsed.get("summary") or ""),
        " ".join(
            str(claim.get("statement") or "") + " " + str(claim.get("detail") or "")
            for claim in (parsed.get("claims") or [])
            if isinstance(claim, dict)
        ),
    ]).lower()
    return any(marker in haystack for marker in (
        "cwe-78",
        "command injection",
        "os command",
        "shell",
        "popen",
        "system(",
        "명령어 주입",
    ))


def _infer_target_binary(build_preparation: dict, files: list) -> str:
    for key in ("producedArtifacts", "expectedArtifacts"):
        raw_items = build_preparation.get(key) if isinstance(build_preparation, dict) else None
        if isinstance(raw_items, list):
            for item in raw_items:
                if isinstance(item, str) and item.strip():
                    return item.strip()
                if isinstance(item, dict):
                    value = item.get("path") or item.get("name") or item.get("artifactPath")
                    if isinstance(value, str) and value.strip():
                        return value.strip()

    return "<binary-from-build-metadata>"


def _build_poc_quality_guard_addendum(*, detail: str, target_binary: str) -> str:
    missing: list[str] = []
    lowered = detail.lower()
    if "build-aegis" not in detail and target_binary != "<binary-from-build-metadata>":
        missing.append("binary")
    if not any(marker in detail for marker in ("os.path.exists", "exists(", "Path(")) and "-f " not in detail:
        missing.append("side_effect")
    if not any(marker in lowered for marker in ("uuid", "random")) and "$RANDOM" not in detail and "$(date" not in detail:
        missing.append("randomized_canary")
    if not any(marker in detail for marker in ("touch ", "echo ", " id ", "whoami")):
        missing.append("non_destructive")
    if "Quote" not in detail and "따옴표" not in detail and "escape" not in lowered:
        missing.append("quote_awareness")

    if not missing:
        return ""

    binary_hint = target_binary or "<binary-from-build-metadata>"
    return (
        "## S3 quality guard — side-effect based detection\n"
        f"- Target binary hint: `{binary_hint}`. If this is relative, run it from the Build Agent workspace "
        "or replace it with the concrete `build-aegis-*` artifact path.\n"
        "- Quote/escape requirement: for `-subj '/CN=<input>'`, payloads must first break out of the single quote; "
        "metacharacters inside `'...'` are literal.\n"
        "- Non-destructive randomized canary pattern:\n"
        "```python\n"
        "from pathlib import Path\n"
        "import subprocess, uuid\n"
        "nonce = uuid.uuid4().hex\n"
        "marker = Path(f\"/tmp/aegis_poc_{nonce}\")\n"
        "payload = f\"test' && touch {marker} && echo '\"\n"
        "# Feed `payload` to the vulnerable CN prompt and then assert the side effect.\n"
        "assert marker.exists(), 'command injection side effect was not observed'\n"
        "```\n"
        "- This guard avoids echo-only false positives because success is based on a unique marker file side effect, "
        "not merely on stdout containing a payload string."
    )


def _poc_fp_heuristics(parsed: dict) -> list[str]:
    """Scan LLM-generated PoC claims for common false-positive patterns.

    Returns a list of human-readable warnings to append to ``caveats``. Never raises
    and never rejects the response — the analyst gets the PoC plus explicit caveats.

    Heuristics (conservative — prefer false-negative over false-positive warnings):

    H1 "echo-collision canary": PoC detects success by substring-matching a canary
        token in stdout, AND the canary token also appears inside an injection
        payload/input string on the same claim. When the target program echoes its
        command line (verbose mode), the canary will appear in stdout regardless of
        whether the injection actually executed — the detection will false-positive.

    H2 "unescaped single-quote injection": PoC injects into a shell argument that is
        wrapped in single quotes (pattern ``-<flag> '...<payload>...'``), AND the
        payload contains shell metacharacters (``;|&$`` or backticks) but does NOT
        contain a ``'`` to break out of the quote. Shell treats metacharacters inside
        single quotes as literal, so the injection will not execute.
    """
    import re

    warnings: list[str] = []
    claims = parsed.get("claims", []) or []
    if not isinstance(claims, list):
        return warnings

    detection_pattern = re.compile(
        r"""["']([A-Z][A-Z0-9_]{3,})["'].{0,40}?\bin\s+(?:stdout|output|out|result)\b""",
        re.IGNORECASE,
    )
    single_quoted_arg_pattern = re.compile(
        r"""-\w+\s+'(/?[A-Za-z][A-Za-z0-9_]*=)?([^'\n]{0,200})'""",
    )
    shell_metachar_re = re.compile(r"[;|&`]|\$\(")

    for i, claim_obj in enumerate(claims):
        if not isinstance(claim_obj, dict):
            continue
        detail = str(claim_obj.get("detail") or "")
        if not detail:
            continue

        # H1: canary both in detection logic AND in injection payload
        for match in detection_pattern.finditer(detail):
            canary = match.group(1)
            # Ignore generic English words that could appear in any prose
            if canary in {"TRUE", "FALSE", "NULL", "NONE", "OK", "ERROR"}:
                continue
            # Check whether the same token appears inside a quoted payload/input
            # literal earlier in the detail. We scan all single/double-quoted strings
            # and flag if any of them contains the canary token.
            for lit in re.finditer(r"""["']([^"'\n]{3,200})["']""", detail):
                body = lit.group(1)
                if canary in body and "in stdout" not in body.lower() and "in output" not in body.lower():
                    warnings.append(
                        f"claim[{i}]: canary '{canary}' is used for stdout-substring detection "
                        f"and also appears inside an injected/input string. If the target program "
                        f"echoes its command line (verbose mode), '{canary}' will appear in stdout "
                        f"whether or not the injection actually executed — detection may be false "
                        f"positive. Prefer side-effect based detection (touch a unique file, "
                        f"observable network call, etc.) or use a random/nonce canary not present "
                        f"in the payload."
                    )
                    break
            else:
                continue
            break  # one H1 warning per claim is enough

        # H2: shell metachar injection inside a single-quoted arg without breakout
        for match in single_quoted_arg_pattern.finditer(detail):
            inner = match.group(2) or ""
            if not inner:
                continue
            if shell_metachar_re.search(inner) and "'" not in inner:
                warnings.append(
                    f"claim[{i}]: injection payload contains shell metacharacters "
                    f"(;|&`$) but sits inside a single-quoted shell argument "
                    f"({match.group(0)[:80]}...) and does not contain a ' to break out. "
                    f"Shell treats metacharacters inside '...' as literal — the injection "
                    f"will not execute. Payload must close the single quote first "
                    f"(e.g., `...'; <cmd>; echo '...`) or target an unquoted interpolation."
                )
                break  # one H2 warning per claim is enough

    return warnings
