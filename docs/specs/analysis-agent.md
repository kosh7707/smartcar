# S3. Analysis Agent 기능 명세

> **소유자**: S3
> **최종 업데이트**: 2026-03-24

> Analysis Agent는 자동차 임베디드 소프트웨어의 **증거 기반 보안 심층 분석**을 수행하는 서비스다.
> 결정론적 도구 실행(Phase 1)과 LLM 해석(Phase 2)을 분리하여,
> 감사 가능하고 재현 가능한 분석 결과를 생산한다.

---

## 1. 핵심 설계 원칙

1. **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화한다** — SAST, 코드 그래프, SCA는 LLM 없이 실행. LLM은 해석만.
2. **Evidence-first** — 모든 Claim은 증적(EvidenceRef)에 근거해야 한다. LLM이 없는 refId를 발명하면 `INVALID_GROUNDING`.
3. **Analyst-first** — LLM은 보조 정보. 최종 판단은 분석가(사용자)가 한다.
4. **LLM 접근은 S7 경유** — 모든 LLM 호출은 S7 Gateway(`POST /v1/chat`)를 통해 수행. LLM Engine 직접 호출 금지.

---

## 2. 기술 스택

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Python | 3.12 |
| 프레임워크 | FastAPI | 0.115.0 |
| ASGI 서버 | uvicorn | 0.30.0 |
| HTTP 클라이언트 | httpx | 0.27.0 |
| 데이터 검증 | pydantic | 2.9.0 |
| 설정 | pydantic-settings | 2.5.0 |
| 로깅 | python-json-logger | 2.0.7 |

---

## 3. 엔드포인트

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `deep-analyze` taskType — Phase 1/2 자동 실행 |
| POST | `/v1/tasks` | `generate-poc` taskType — 특정 클레임 PoC 코드 생성 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 + S7 Gateway 연결 상태 |

---

## 4. Phase 1/2 분리 아키텍처

```
POST /v1/tasks (taskType: "deep-analyze")
  │
  ├── Phase 1: 결정론적 (LLM 없이)
  │   ├── sast.scan        → S4 SAST Runner → findings
  │   ├── code.functions   → S4 SAST Runner → 함수+호출 관계
  │   ├── sca.libraries    → S4 SAST Runner → 라이브러리 + 버전
  │   ├── cve.batch-lookup → S5 KB → 버전 매칭된 CVE (NEW)
  │   ├── threat.search    → S5 KB → CWE별 위협 지식 (NEW)
  │   └── dangerous-callers → S5 KB → 위험 함수 호출자 (NEW)
  │
  ├── Phase 2: LLM 해석 (~34초)
  │   ├── Phase 1 결과를 프롬프트에 주입 (출력 스키마 명시)
  │   ├── LLM이 추가 tool 호출 가능: knowledge.search, code_graph.callers
  │   ├── LLM 호출은 S7 Gateway 경유 (POST /v1/chat)
  │   └── Qwen 122B GPTQ-Int4 → 구조화 JSON (claims + evidence refs)
  │
  └── 응답: TaskSuccessResponse (API 계약 준수)
```

---

## 5. Phase 1: 결정론적 도구 실행

`Phase1Executor`가 LLM 개입 없이 6개 도구를 실행한다.

### 5.1 SAST 스캔

- S4 `POST /v1/scan` 호출
- 6개 SAST 도구(Semgrep, Cppcheck, clang-tidy, Flawfinder, scan-build, gcc -fanalyzer) 병렬 실행
- SDK 노이즈 자동 필터링

### 5.2 코드 그래프 추출

- S4 `POST /v1/functions` 호출 (projectPath 모드)
- clang AST 기반 함수+호출 관계 추출
- S5 KB `POST /v1/code-graph/{project_id}/ingest`에 적재

### 5.3 SCA 라이브러리 분석

- S4 `POST /v1/libraries` 호출
- vendored 라이브러리 식별, upstream diff, CVE 조회
- SCA 결과는 claims가 아닌 caveats에 포함 (라이브러리 코드는 미분석)

### 5.4 CVE 실시간 조회

- SCA 결과의 라이브러리명+버전으로 S5 `POST /v1/cve/batch-lookup` 호출
- `version_match: true`인 CVE만 필터하여 Phase 2 프롬프트에 주입
- `repo_url` 전달로 CPE 정밀 조회 지원
- 결정론적: LLM 판단 불필요

### 5.5 KB 위협 조회

- SAST findings에서 CWE ID를 정규식으로 추출 (CWE-\d+)
- 고유 CWE별로 S5 `POST /v1/search` 호출 (최대 10개)
- CWE/CVE/ATT&CK 위협 지식을 Phase 2 프롬프트에 주입
- 결정론적: LLM 판단 불필요

### 5.6 위험 함수 호출자

- SAST findings의 메시지에서 위험 함수명 매칭 (popen, system, getenv 등 14종)
- S5 `POST /v1/code-graph/{project_id}/dangerous-callers` 호출
- 위험 함수를 호출하는 사용자 코드 함수를 Phase 2 프롬프트에 주입

### Phase 1 결과

```python
@dataclass
class Phase1Result:
    sast_findings: list[dict]
    sast_stats: dict
    code_functions: list[dict]
    sca_libraries: list[dict]
    threat_context: list[dict]       # KB CWE별 위협 지식
    dangerous_callers: list[dict]    # 위험 함수 호출자
    cve_lookup: list[dict]           # 실시간 CVE 조회 결과
    sast_duration_ms: int
    code_graph_duration_ms: int
    sca_duration_ms: int
    cve_lookup_duration_ms: int
    threat_query_duration_ms: int
    dangerous_callers_duration_ms: int
    total_duration_ms: int
```

Phase 1 완료 후 `build_phase2_prompt()`가 결과를 시스템 프롬프트 + 유저 메시지로 조립한다.

---

## 6. Phase 2: LLM 에이전트 루프

`AgentLoop`이 멀티턴 LLM 루프를 실행한다.

### 6.1 루프 흐름

```
1. Phase 1 결과 → 프롬프트 조립 (system + user)
2. while not should_stop():
   a. S7 Gateway POST /v1/chat 호출 (messages + tools)
   b. 응답 분기:
      - tool_calls → ToolRouter로 실행 → 결과를 메시지에 추가 → 다음 턴
      - content → ResultAssembler로 파싱 → 응답 반환
3. 예산 초과 시 TaskFailureResponse(budget_exceeded) 반환
```

### 6.2 LLM 호출

- `LlmCaller`가 S7 Gateway `POST /v1/chat`을 호출
- OpenAI chat completion 포맷 (messages, model, tools, tool_choice, response_format)
- tool_calls 파싱: id, function.name, function.arguments → `ToolCallRequest`
- 토큰 추적: prompt_tokens, completion_tokens → `TokenCounter`
- 교환 로그: `logs/llm-exchange.jsonl` + `logs/llm-dumps/{requestId}_turn-{nn}_{ts}.json`

### 6.3 Phase 2 도구

| 도구 | cost tier | 대상 | 용도 |
|------|-----------|------|------|
| `knowledge.search` | CHEAP | S5 KB `POST /v1/search` | CWE/CVE/ATT&CK 위협 지식 검색 |
| `code_graph.callers` | MEDIUM | S5 KB `GET /v1/code-graph/{pid}/callers/{fn}` | 특정 함수의 호출자 체인 조회 |

> `sast.scan`과 `sca.libraries`는 Phase 1에서 이미 실행되므로 Phase 2 도구에 포함되지 않는다.

---

## 7. 도구 프레임워크

| 컴포넌트 | 역할 |
|----------|------|
| `ToolRegistry` | ToolSchema 등록, OpenAI function calling 포맷 생성 |
| `ToolRouter` | tool_call 디스패치, 예산 차감, 중복 차단 (args_hash) |
| `ToolExecutor` | 단건 실행 + `asyncio.wait_for` 타임아웃 |
| `ToolImplementation` (Protocol) | 각 도구의 `execute(arguments) → ToolResult` |

### 구현체

| 파일 | 도구명 | 호출 대상 |
|------|--------|-----------|
| `sast_tool.py` | `sast.scan` | S4 `/v1/scan` |
| `codegraph_tool.py` | `code_graph.callers` | S5 KB `/v1/code-graph/callers/` |
| `codegraph_phase1_tool.py` | (Phase 1 전용) | S4 `/v1/functions` |
| `knowledge_tool.py` | `knowledge.search` | S5 `/v1/search` |
| `sca_tool.py` | `sca.libraries` | S4 `/v1/libraries` |

---

## 8. 예산 시스템

3-tier 예산으로 LLM 루프의 무한 실행을 방지한다.

```python
BudgetState:
    max_steps: 6              # 총 턴 수
    max_completion_tokens: 2000  # LLM 생성 토큰 한도
    max_cheap_calls: 3        # knowledge.search 등
    max_medium_calls: 2       # code_graph.callers
    max_expensive_calls: 1    # 향후 고비용 도구
    max_consecutive_no_evidence: 2  # 증거 없는 턴 연속 한도
```

### 종료 조건 (TerminationPolicy)

| 조건 | 설명 |
|------|------|
| `max_steps` | 총 턴 수 초과 |
| `budget_exhausted` | 토큰 한도 도달 |
| `timeout` | 전체 시간 초과 |
| `no_evidence` | 연속 N턴 새 증거 없음 |
| `all_tiers_exhausted` | 모든 tier의 도구 호출 한도 소진 |

### 중복 차단

`ToolRouter`가 `args_hash`로 동일 인자 도구 호출을 차단한다.

---

## 9. 출력 구조

### TaskSuccessResponse

```python
TaskSuccessResponse:
    taskId, taskType, status="completed"
    result: AssessmentResult
        summary: str
        claims: list[Claim]          # statement + supportingEvidenceRefs + location
        caveats: list[str]
        usedEvidenceRefs: list[str]
        suggestedSeverity: str | None  # critical/high/medium/low/info
        confidence: float [0.0-1.0]
        confidenceBreakdown: dict
        needsHumanReview: bool
        recommendedNextSteps: list[str]
        policyFlags: list[str]       # ISO21434-noncompliant, MISRA-violation 등
    audit: AuditInfo
        inputHash, latencyMs, tokenUsage, createdAt
        agentAudit: {turn_count, tool_call_count, termination_reason, trace}
```

### TaskFailureResponse

```python
TaskFailureResponse:
    taskId, taskType
    status: validation_failed | timeout | model_error | budget_exceeded | empty_result
    failureCode: INVALID_SCHEMA | INVALID_GROUNDING | TIMEOUT | MODEL_UNAVAILABLE | ...
    failureDetail: str
    retryable: bool
```

---

## 10. Confidence 산출

S3가 LLM 응답을 받은 후 **자체적으로 산출**한다 (LLM 자기 평가가 아님).

```
confidence = 0.45 × grounding
           + 0.30 × deterministicSupport
           + 0.15 × ragCoverage
           + 0.10 × schemaCompliance
```

| 항목 | 산출 방식 |
|------|-----------|
| **grounding** (0.45) | usedEvidenceRefs 유효 비율 + claims의 증거 연결 비율 |
| **deterministicSupport** (0.30) | SAST/SCA 결과 존재 여부 + claims 수 + caveats 존재 |
| **ragCoverage** (0.15) | `0.4 + 0.6 × min(rag_hits / top_k, 1.0)` |
| **schemaCompliance** (0.10) | validation.valid이면 1.0, 아니면 0.0 |

---

## 11. 서비스 의존

```
Analysis Agent (:8001)
  ├── S7 Gateway (:8000)     POST /v1/chat                    Phase 2 LLM
  ├── S4 SAST Runner (:9000) POST /v1/scan, /functions, /libraries  Phase 1
  └── S5 KB (:8002)          POST /v1/search, /cve/batch-lookup, /code-graph/*  Phase 1 + Phase 2
```

---

## 12. 관측성

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/s3-analysis-agent.jsonl` |
| 교환 로그 | `logs/llm-exchange.jsonl` (LLM 호출 요약) |
| LLM 전문 덤프 | `logs/llm-dumps/{requestId}_turn-{nn}_{ts}.json` |
| 형식 | JSON structured, `time` epoch ms |
| 요청 추적 | `contextvars` 기반 `requestId` + `X-Request-Id` 전파 |
| 컴포넌트 태깅 | `agent_log()` helper — component, phase, turn 필드 |

### 교차 서비스 추적

```bash
grep '{request-id}' logs/*.jsonl  # Agent + SAST + KB + Gateway 한번에 추적
```

---

## 13. RE100 실측 (2026-03-20)

| Phase | 항목 | 결과 |
|-------|------|------|
| Phase 1 | SAST 스캔 | 49 findings (12파일, 4도구, 11s) |
| Phase 1 | 코드 그래프 | 1,329 함수 추출 → KB 적재 (121노드, 242엣지) |
| Phase 1 | SCA | 6 라이브러리 |
| Phase 1 | KB 위협 조회 | 9 CWE → 43 hits |
| Phase 1 | 위험 호출자 | 2 함수 → KB 조회 |
| Phase 2 | LLM 분석 (122B GPTQ) | 2턴, 도구 3회 (code_graph.callers×2, knowledge.search×1), claims 4개(detail 포함), confidence 0.865, PoC 4/4 성공 |
| 전체 | 파이프라인 | **170초 (SCA + CVE 조회 포함)** |

핵심 결과: LLM이 `code_graph.callers("popen")`으로 `run_curl → popen` 호출 체인을 확인하고, "HTTP 클라이언트 통신 경로에서 악용 가능"이라는 공격 표면을 특정. Claim.detail 포함 상세 분석, CVE-2025-55763 자동 발견, 서드파티 origin 메타데이터 활용
