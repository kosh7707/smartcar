# S3. Analysis Agent + LLM Gateway 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S3(Analysis Agent + LLM Gateway) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-18**

---

## 1. 프로젝트 전체 그림

### AEGIS 6인 체제에서 S3의 위치

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
           LLM Engine (DGX Spark)
```

### S3 소유 서비스

| 서비스 | 포트/위치 | 역할 |
|--------|-----------|------|
| **Analysis Agent** | :8001 | `deep-analyze` taskType. Phase 1(SAST+코드그래프+SCA) → Phase 2(LLM 해석) |
| **LLM Gateway** | :8000 | 레거시 5개 taskType (분리 유지 결정, 2026-03-18) |
| **LLM Engine** | 10.126.37.19:8000 (DGX Spark) | Qwen3.5-35B-A3B FP8, vLLM 0.17.1rc1 서빙 |

### LLM Engine 운영 정보 (S4에서 이전받음, 2026-03-18)

```bash
# 기동
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 \
  "source \$HOME/.local/bin/env && cd ~/spark-vllm-docker && \
   nohup ./run-recipe.sh qwen3.5-35b-a3b-fp8 --solo --tensor-parallel 1 --port 8000 \
   > /tmp/vllm-launch.log 2>&1 &"

# 중지
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker stop vllm_node && docker rm vllm_node'

# 헬스체크
curl http://10.126.37.19:8000/health
```

- 성능: 단일 ~26 tok/s, 배치4 60~113 tok/s, 기동 ~2분
- 트러블슈팅: `LLM_UNAVAILABLE` → 컨테이너 미기동, `LLM_TIMEOUT` → 첫 요청 워밍업(120s)
- 상세: `docs/s4-handoff/README.md` Section 2~10

### S3 소유 문서

| 문서 | 경로 | 비고 |
|------|------|------|
| S3 인수인계서 | `docs/s3-handoff/README.md` | 이 문서 |
| S3 기능 명세 | `docs/specs/llm-gateway.md` | |
| S2↔S3 API 계약 | `docs/api/llm-gateway-api.md` | |
| LLM Engine API | `docs/api/llm-engine-api.md` | S4에서 인수 (2026-03-18) |
| LLM Engine 명세 | `docs/specs/llm-engine.md` | S4에서 인수 (2026-03-18) |

### S3가 호출하는 서비스 (소유 X)

| 서비스 | 소유 | 엔드포인트 | 역할 |
|--------|------|-----------|------|
| **SAST Runner** (:9000) | S4 | scan, functions, includes, metadata, libraries, build-and-analyze, health (7개) | Phase 1 도구 실행 |
| **Knowledge Base** (:8002) | **S5** (S3가 구축, 인수인계 예정) | search, graph/*, code-graph/* | Phase 2 위협 지식 + 코드 그래프 |

### S3의 정체성

> S3는 **감사 가능하고, 재현 가능하며, 자동화 가능한 증거 기반 보안 분석** 통제 계층이다.
> 결정론적 처리(Phase 1)를 최대화하고, LLM의 결정 표면(Phase 2)을 최소화한다.

**S3의 성공 기준:**
1. 항상 파싱 가능할 것 → `parsedOk: true`
2. 항상 supplied evidence 안에서만 말할 것 → `evidenceValid: true`
3. 전 구간 requestId로 추적 가능할 것 → 구조화 JSON 로깅
4. SAST 결과는 결정론적으로, LLM 해석은 구조화된 JSON으로 → Phase 1/2 분리

---

## 2. 너의 역할과 경계

### 너는

- **S3 — Analysis Agent + LLM Engine 관리**
- 소유 코드:
  - `services/analysis-agent/` — 에이전트 기반 심층 분석 (Phase 1/2)
  - `services/llm-gateway/` — 레거시 Task API (추후 :8001로 통합)
- LLM Engine(DGX Spark) 관리
- 관리하는 문서:
  - `docs/api/llm-gateway-api.md` — S2↔S3 API 계약서
  - `docs/specs/llm-gateway.md` — S3 기능 명세
  - `docs/s3-handoff/README.md` — 이 인수인계서

### KB(S5) 인수인계 상태

- S3가 `services/knowledge-base/` 코드를 구축했지만, AEGIS 체제에서 **S5로 분리**
- S5 담당자 투입 시 `docs/s5-handoff/README.md` 초안 작성 + 소유권 이전 예정
- **그때까지 S3가 KB 코드/운영을 임시 관리**

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**

### 다른 서비스 코드

- S1(프론트), S2(백엔드) 코드는 기본적으로 수정하지 않으며 **읽는 것도 금지** (API 계약서로만 소통)

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md` (예: `s2-to-s3-mock-enhancement.md`)
- S1이나 S2에게 요청할 일이 있으면 이 폴더에 문서를 작성한다
- 반대로 S1/S2가 너에게 요청한 문서도 여기에 있다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크한다

---

## 3. API

### LLM Gateway (:8000) — 레거시

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | Task 기반 AI 분석 요청 (5개 taskType) |
| GET | `/v1/health` | 서비스 상태 |
| GET | `/v1/models` | 등록된 model profile 목록 |
| GET | `/v1/prompts` | 등록된 prompt template 목록 |

### Analysis Agent (:8001) — 심층 분석

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `deep-analyze` taskType. Phase 1/2 자동 실행. |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 |

### Knowledge Base (:8002) — GraphRAG

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/search` | 하이브리드 검색 (ID exact + graph neighbor + vector) |
| GET | `/v1/graph/stats` | 위협 지식 그래프 통계 |
| GET | `/v1/graph/neighbors/{node_id}` | CWE/CVE/ATT&CK 관계 탐색 |
| POST | `/v1/code-graph/{project_id}/ingest` | 프로젝트 코드 그래프 적재 |
| GET | `/v1/code-graph/{project_id}/callers/{func}` | 함수 호출자 추적 |
| POST | `/v1/code-graph/{project_id}/dangerous-callers` | 위험 함수 호출자 식별 |
| GET | `/v1/health` | 서비스 상태 + Neo4j 연결 + Qdrant 상태 |

### Task Type Allowlist

| Task Type | 서비스 | 용도 |
|-----------|--------|------|
| `static-explain` | LLM Gateway (:8000) | 정적 분석 finding 심층 설명 |
| `static-cluster` | LLM Gateway (:8000) | 유사 finding 그룹핑 |
| `dynamic-annotate` | LLM Gateway (:8000) | 동적 분석 이벤트 해석 |
| `test-plan-propose` | LLM Gateway (:8000) | 테스트 시나리오 제안 |
| `report-draft` | LLM Gateway (:8000) | 보고서 초안 생성 |
| **`deep-analyze`** | **Analysis Agent (:8001)** | **프로젝트 전반 보안 분석 (Phase 1/2)** |

---

## 4. Analysis Agent 아키텍처 (2026-03-18 신규)

### Phase 1/2 분리 아키텍처

```
POST /v1/tasks (taskType: "deep-analyze")
  │
  ├── Phase 1: 결정론적 (LLM 없이, ~140초)
  │   ├── sast.scan        → SAST Runner (:9000) → findings (SDK 필터링)
  │   ├── code.functions   → SAST Runner (:9000) → 함수+호출 관계 (projectPath 모드)
  │   └── sca.libraries    → SAST Runner (:9000) → 라이브러리 식별 + diff + CVE
  │
  ├── Phase 2: LLM 해석 (~34초)
  │   ├── Phase 1 결과를 프롬프트에 주입 (출력 스키마 명시)
  │   ├── LLM이 추가 tool 호출 가능: knowledge.search, code_graph.get_functions
  │   └── Qwen 35B → 구조화 JSON (claims + evidence refs)
  │
  └── 응답: TaskSuccessResponse (기존 API 계약 준수)
```

### 핵심 설계 원칙

- **결정론적 처리를 최대화** — Phase 1에서 SAST, 코드 그래프, SCA를 LLM 없이 실행
- **LLM의 결정 표면을 최소화** — Phase 2에서 LLM은 해석만 담당
- **증거 기반** — 모든 claim은 eref(Evidence Reference)로 근거 연결 필수
- **SCA CVE는 참고 정보** — 라이브러리 코드는 미분석이므로 claims가 아닌 caveats에 포함

### 파일 구조 (analysis-agent)

```
services/analysis-agent/
├── app/
│   ├── main.py                    # FastAPI 앱, lifespan (RAG 비활성화, KB 전담)
│   ├── config.py                  # Settings (agent_*, llm_*)
│   ├── context.py                 # requestId ContextVar
│   ├── observability.py           # 구조화 JSON 로깅 + agent_log()
│   ├── core/
│   │   ├── phase_one.py           # Phase1Executor (SAST+코드그래프+SCA) + build_phase2_prompt()
│   │   ├── agent_loop.py          # AgentLoop (멀티턴 LLM 루프)
│   │   ├── agent_session.py       # AgentSession (변이 가능 상태)
│   │   └── result_assembler.py    # 결과 조립 + 검증 + confidence
│   ├── llm/
│   │   ├── caller.py              # LlmCaller (vLLM HTTP + exchange log + LLM dump)
│   │   ├── message_manager.py     # 메시지 히스토리 관리
│   │   └── turn_summarizer.py     # 턴 요약
│   ├── tools/
│   │   ├── registry.py            # ToolSchema 등록
│   │   ├── router.py              # ToolRouter (디스패치 + 예산 + 중복 차단)
│   │   ├── executor.py            # ToolExecutor (타임아웃)
│   │   └── implementations/
│   │       ├── sast_tool.py       # SAST Runner /v1/scan
│   │       ├── codegraph_tool.py  # SAST Runner /v1/functions
│   │       ├── knowledge_tool.py  # KB /v1/search
│   │       └── sca_tool.py        # SAST Runner /v1/libraries
│   ├── budget/                    # BudgetManager, TokenCounter
│   ├── policy/                    # TerminationPolicy, RetryPolicy, ToolFailurePolicy
│   ├── validators/                # SchemaValidator, EvidenceValidator
│   └── routers/tasks.py           # POST /v1/tasks (deep-analyze → Phase1 → AgentLoop)
├── scripts/
│   ├── integration-test.sh        # 단일 파일 통합 테스트
│   └── project-scan.sh            # 프로젝트 전반 분석 파이프라인
└── tests/                         # 96 tests
```

## 5. Knowledge Base 아키텍처 (2026-03-18 신규)

### Neo4j + Qdrant 하이브리드 GraphRAG

```
쿼리: "CWE-78 command injection popen"
  │
  ├─ 경로 1: ID 직접 조회 (Neo4j)
  │  "CWE-78" → 노드 정보 + 이웃 (score=1.0)
  │
  ├─ 경로 2: 그래프 이웃 확장 (Neo4j)
  │  CWE-78의 depth=2 이웃 (score=0.8)
  │
  └─ 경로 3: 시맨틱 검색 (Qdrant)
     임베딩 유사도 (score=가변)
  │
  └─ 병합 + 중복 제거 + 점수 정렬
```

### Neo4j 인프라

- **설치 경로**: `~/neo4j-community-5.26.3`
- **포트**: 7687 (Bolt), 7474 (HTTP/Browser)
- **인증**: neo4j / smartcar
- **시드**: `python scripts/neo4j-seed.py --qdrant-path <path>` (1회 실행, 영속)

### 파일 구조 (knowledge-base)

```
services/knowledge-base/
├── app/
│   ├── main.py                    # Neo4j driver + Qdrant + KnowledgeAssembler 초기화
│   ├── config.py                  # Settings (neo4j_uri/user/password, qdrant_path)
│   ├── graphrag/
│   │   ├── neo4j_graph.py         # Neo4jGraph (RelationGraph 대체, 동일 인터페이스)
│   │   ├── code_graph_service.py  # CodeGraphService (프로젝트별 코드 그래프)
│   │   ├── knowledge_assembler.py # 하이브리드 검색 오케스트레이터
│   │   └── vector_search.py       # Qdrant 래퍼
│   ├── rag/
│   │   └── threat_search.py       # Qdrant 클라이언트 + scroll_all_metadata()
│   └── routers/
│       ├── api.py                 # /v1/search, /v1/graph/*, /v1/health
│       └── code_graph_api.py      # /v1/code-graph/*
├── scripts/
│   ├── neo4j-seed.py              # Qdrant → Neo4j 마이그레이션
│   └── threat-db/                 # ETL 파이프라인 (CWE/NVD/ATT&CK/CAPEC)
└── tests/                         # 19 tests
```

## 6. 구조화된 로깅 체계 (2026-03-18 신규)

### 로그 파일

| 파일 | 서비스 | 내용 |
|------|--------|------|
| `logs/s3-analysis-agent.jsonl` | Agent | Phase 1/2 전체 이벤트 (phase_one, agent_loop, llm_caller, tool_router 등) |
| `logs/s4-exchange.jsonl` | Agent | LLM 호출 요약 (turn, tokens, latency, dumpFile) |
| `logs/llm-dumps/*.json` | Agent | LLM 호출별 request+response 전문 (프롬프트 재현용) |
| `logs/smartcar-knowledge-base.jsonl` | KB | 검색 요청, 코드 그래프 적재 |
| `logs/s3-llm-gateway.jsonl` | Gateway | 레거시 요청 처리 |
| `logs/s4-sast-runner.jsonl` | SAST Runner (S4) | 도구 실행 상세 |

### 교차 서비스 추적

```bash
grep '{request-id}' logs/*.jsonl  # 4개 서비스 한번에 추적
```

## 7. 이전 구현 상태 (LLM Gateway)

### 파일 구조

```
services/llm-gateway/
├── .env                          # 환경변수 (git 추적 제외)
├── .venv/                        # Python 가상환경
├── requirements.txt              # fastapi, uvicorn, pydantic, pydantic-settings, httpx, python-json-logger, qdrant-client, fastembed
├── README.md                     # 실행법, 환경변수, 내부 구조
├── app/
│   ├── main.py                   # FastAPI 앱 진입점, CORS, JSON 로깅, S4 교환 로거, 라우터 등록, RAG lifespan
│   ├── config.py                 # pydantic-settings 환경변수 → Settings 객체 (.env 자동 로드)
│   ├── context.py                # contextvars 기반 요청 컨텍스트 (requestId)
│   ├── errors.py                 # S3Error 계층 (LlmTimeoutError, LlmUnavailableError, LlmHttpError)
│   ├── types.py                  # TaskType, TaskStatus, FailureCode StrEnum
│   ├── clients/
│   │   ├── base.py               # LlmClient ABC
│   │   └── real.py               # RealLlmClient (OpenAI-compatible, vLLM 대상, httpx connection pooling, thinking 제어, 토큰 캡처, structured output, S4 교환 전문 로깅)
│   ├── schemas/
│   │   ├── request.py            # TaskRequest, EvidenceRef, Context, Constraints, RequestMetadata
│   │   └── response.py           # TaskSuccessResponse, TaskFailureResponse, AssessmentResult, Claim(location 포함), TestPlan, AuditInfo, TokenUsage
│   ├── registry/
│   │   ├── prompt_registry.py    # PromptEntry + PromptRegistry (5개 task type 등록)
│   │   └── model_registry.py     # ModelProfile + ModelProfileRegistry (Settings 기반)
│   ├── validators/
│   │   ├── schema_validator.py   # 필수 필드, confidence 범위, plan 존재 검증
│   │   └── evidence_validator.py # refId whitelist 기반 hallucination 감지
│   ├── pipeline/
│   │   ├── prompt_builder.py     # V1PromptBuilder (3계층 trust 분리, delimiter, threat_context 지원)
│   │   ├── response_parser.py    # V1ResponseParser (JSON + 코드블록 추출, <think> 태그 방어)
│   │   ├── confidence.py         # ConfidenceCalculator (4항목 가중합, S3 자체 산출)
│   │   └── task_pipeline.py      # TaskPipeline 오케스트레이터 (전체 흐름 제어, Semaphore(N) 동시성, RAG 증강)
│   ├── rag/                      # 위협 지식 DB (RAG) 모듈
│   │   ├── threat_search.py      # ThreatSearch — Qdrant 벡터 검색 클라이언트
│   │   └── context_enricher.py   # ContextEnricher — task type별 쿼리 추출 + RAG 컨텍스트 조립
│   ├── mock/
│   │   └── dispatcher.py         # V1MockDispatcher (taskType enum 기반)
│   └── routers/
│       └── tasks.py              # POST /v1/tasks, GET /v1/health, /v1/models, /v1/prompts
├── scripts/
│   └── threat-db/                # 위협 지식 DB ETL 파이프라인 (S4 이식)
│       ├── build.py              # ETL 오케스트레이터 (다운로드 → 파싱 → 교차참조 → Qdrant 적재)
│       ├── schema.py             # UnifiedThreatRecord, CapecBridge
│       ├── taxonomy.py           # 8개 자동차 공격 표면 분류체계
│       ├── download.py           # CWE/NVD/ATT&CK/CAPEC 다운로더
│       ├── parse_cwe.py          # CWE XML 파서 (944건)
│       ├── parse_nvd.py          # NVD JSON 파서 (702건)
│       ├── parse_attack.py       # ATT&CK STIX 파서 (83건)
│       ├── parse_capec.py        # CAPEC XML 브릿지 파서
│       ├── crossref.py           # 3방향 교차 참조 엔진
│       ├── load_qdrant.py        # Qdrant 파일 기반 적재
│       ├── stats.py              # 통계 생성기
│       ├── fmt.py                # 터미널 포매팅 유틸
│       └── requirements.txt      # ETL 전용 의존성
├── data/
│   └── qdrant/                   # Qdrant 파일 기반 벡터 DB (ETL 빌드 산출물, git 추적 제외)
├── tests/                          # 147 tests total
│   ├── conftest.py               # 공통 fixture: TestClient(client_live, client+mock_pipeline), 요청 빌더
│   ├── test_response_parser.py   # 11 tests
│   ├── test_evidence_validator.py # 5 tests
│   ├── test_confidence.py        # 10 tests (RAG 분화 테스트 포함)
│   ├── test_schema_validator.py  # 7 tests
│   ├── test_mock_dispatcher.py   # 10 tests
│   ├── test_prompt_builder.py    # 9 tests
│   ├── test_registry.py          # 12 tests
│   ├── test_threat_search.py     # 6 tests (min_score 필터 포함)
│   ├── test_context_enricher.py  # 11 tests (ruleMatches fallback, min_score 전달 포함)
│   ├── test_pipeline_retry.py   # 11 tests (재시도 성공/소진/HTTP에러/토큰누적)
│   ├── test_contract_endpoints.py      # 11 tests (GET /v1/health, /models, /prompts HTTP 응답 구조)
│   ├── test_contract_task_success.py   # 17 tests (POST /v1/tasks 성공 응답 JSON 계약 검증)
│   ├── test_contract_task_failure.py   # 21 tests (실패 응답 구조, retryable, 500 형식, failureCode×status)
│   └── test_contract_input_validation.py # 6 tests (422 입력 검증: taskType/필드 누락/maxTokens 범위)
```

### 요청 처리 흐름

```
S2 요청 → tasks.py (POST /v1/tasks)
  → PromptRegistry에서 prompt 조회
  → ModelProfileRegistry에서 profile 조회
  → [RAG] ContextEnricher로 위협 지식 DB 검색 + 컨텍스트 조립 (선택적)
  → V1PromptBuilder로 3계층 프롬프트 조립 (trusted/semi-trusted/untrusted + RAG 컨텍스트 분리)
  → [Retry Loop] (최대 1 + SMARTCAR_LLM_MAX_RETRIES 회):
      → LLM 호출 (Semaphore(N)으로 동시성 제어, 기본 4)
          mock: V1MockDispatcher
          real: RealLlmClient (/v1/chat/completions, vLLM 대상, connection pooling)
          → S4 교환 전문을 logs/s4-exchange.jsonl에 기록 (요청 body + 응답 body)
      → V1ResponseParser로 Assessment JSON 파싱
      → SchemaValidator로 구조 검증
      → EvidenceValidator로 refId hallucination 감지
      → 실패 시: INVALID_SCHEMA/INVALID_GROUNDING/EMPTY_RESPONSE → 재시도
      → HTTP 에러 → 즉시 실패 (429/503: LLM_OVERLOADED, 연결 불가: MODEL_UNAVAILABLE)
  → ConfidenceCalculator로 신뢰도 산출 (S3 자체 계산, ragCoverage 반영)
  → TaskSuccessResponse 또는 TaskFailureResponse 반환 (audit.ragHits, retryCount 포함)
```

### Confidence 산출 (S3 자체)

```
confidence = 0.45×grounding + 0.30×deterministicSupport + 0.15×ragCoverage + 0.10×schemaCompliance
```
- ragCoverage = 0.4 + 0.6 × min(rag_hits / top_k, 1.0) — RAG 검색 결과에 따른 분석 배경 충실도
- 0 hits → 0.40, 5 hits → 1.00. 이전 consistency(1.0 고정) 대체

### LLM 모드 2종

| 모드 | 클라이언트 | 엔드포인트 | 용도 |
|------|-----------|-----------|------|
| `mock` | V1MockDispatcher | (내부) | 개발/테스트 |
| `real` | RealLlmClient | `/v1/chat/completions` | **현재 운영 모드** (DGX Spark vLLM) |

### 환경변수 (.env)

`services/llm-gateway/.env` 파일에서 환경변수를 로드한다. pydantic-settings가 자동으로 읽으며, 스크립트(`scripts/start-llm-gateway.sh`, `scripts/start.sh`)도 `.env`를 export한다. `.env`는 `.gitignore`에 의해 Git 추적 제외.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| SMARTCAR_LLM_MODE | `mock` | `mock` / `real` |
| SMARTCAR_LLM_ENDPOINT | `http://10.126.37.19:8000` | S4 주소 (DGX Spark vLLM) |
| SMARTCAR_LLM_MODEL | `Qwen/Qwen3.5-35B-A3B-FP8` | 모델명 (HuggingFace 형식) |
| SMARTCAR_LLM_API_KEY | (빈 문자열) | API 키 (vLLM: 불필요) |
| SMARTCAR_LLM_CONCURRENCY | `4` | 동시 LLM 요청 수 (vLLM continuous batching 활용) |
| SMARTCAR_LLM_MAX_INPUT_CHARS | `800000` | 프롬프트 문자 수 상한 (~200K 토큰). 초과 시 INPUT_TOO_LARGE |
| SMARTCAR_LLM_MAX_RETRIES | `2` | LLM 출력 품질 재시도 횟수 (총 시도 = 1 + max_retries). 0이면 재시도 비활성화 |
| SMARTCAR_RAG_ENABLED | `true` | RAG 위협 지식 DB (`true`/`false`). 데이터 없으면 자동 비활성화 |
| SMARTCAR_QDRANT_PATH | `data/qdrant` | Qdrant 파일 스토리지 경로 |
| SMARTCAR_RAG_TOP_K | `5` | RAG 검색 결과 상위 k건 |
| SMARTCAR_RAG_MIN_SCORE | `0.35` | 이 점수 미만의 RAG 결과 제외. 0이면 필터 비활성화 |
| LOG_DIR | `../../logs` (프로젝트 루트 `logs/`) | JSONL 로그 파일 디렉토리 |

> 모든 서비스가 동일한 패턴(`services/<서비스명>/.env`)을 사용한다. 너의 `.env`는 네가 직접 관리.

### 로그 파일

| 파일 | 내용 | stdout |
|------|------|--------|
| `logs/s3-llm-gateway.jsonl` | 앱 구조화 로그 (JSON, requestId 포함) | O |
| `logs/s4-exchange.jsonl` | S4 요청/응답 JSON 전문 (프롬프트 + LLM 응답 완전 기록) | X |
| `scripts/.logs/llm-gateway.log` | 프로세스 stdout/stderr 캡처 (`start.sh` 기동 시) | — |

- `s4-exchange.jsonl`은 디버깅/프롬프트 분석용. 한 줄 = 한 S4 호출 (request body + response body + latency + status)
- 로그 정리: `scripts/common/clean-s3-logs.sh`

### 동시성 제어

- `asyncio.Semaphore(settings.llm_concurrency)` — 기본 4, 환경변수 `SMARTCAR_LLM_CONCURRENCY`로 조정
- vLLM의 continuous batching + PagedAttention을 활용하여 동시 요청 처리
- `RealLlmClient`가 `httpx.AsyncClient`를 인스턴스 레벨에서 유지 (connection pooling + keep-alive)
- lifespan shutdown 시 `aclose()` 호출

### Backpressure 처리

- vLLM이 429/503 응답 시 `LlmHttpError(retryable=True)` → `FailureCode.LLM_OVERLOADED` (`retryable: true`)
- vLLM 연결 불가 시 `LlmUnavailableError` → `FailureCode.MODEL_UNAVAILABLE` (`retryable: true`)
- 기타 HTTP 에러 → `FailureCode.MODEL_UNAVAILABLE` (`retryable: false`)
- `TaskFailureResponse`에 `retryable: bool` 필드로 S2에 전달
- S2가 자체 재시도 판단 (exponential backoff 권장)

### Thinking 모드 제어

- `RealLlmClient`가 `chat_template_kwargs: {"enable_thinking": false}`로 thinking 비활성화
- `response_format: {"type": "json_object"}`로 JSON 출력 보장 (structured output)
- `V1ResponseParser`에서 `<think>...</think>` 태그 strip (safety net)
- 프롬프트에 `/no_think` 포함 (추가 safety net)

---

## 5. 수정 이력

### 에이전트 통합 로깅 + Neo4j GraphRAG + Phase 1/2 + SCA (2026-03-18, 완료)

오늘 하루 동안 수행한 대규모 작업:

1. **에이전트 통합 로깅** — 14개 파일 수정. Phase/턴/컴포넌트별 구조화 JSON. LLM 전문 덤프(`logs/llm-dumps/`). S4 교환 로그 보강.
2. **Neo4j GraphRAG** — NetworkX 제거 → Neo4j 전환. Qdrant 벡터 + Neo4j 그래프 하이브리드 검색. CWE/CVE/ATT&CK 1857노드 + 코드 그래프 121노드.
3. **하이브리드 검색** — ID exact(score=1.0) + graph neighbor(score=0.8) + vector semantic 3경로 병합. "CWE-78" 검색 정확도 극적 개선.
4. **Phase 1/2 분리** — S4 제안 채택. SAST+코드그래프+SCA를 LLM 없이 자동 실행 → LLM에 결과 주입.
5. **projectPath 코드 그래프** — S4 구현. clang AST + namespace 순회 + CallExpr 추출. 1→98 함수.
6. **SCA 라이브러리 분석** — S4 `/v1/libraries` 통합. 6개 라이브러리 식별, 3개 수정 탐지, CVE 40건.
7. **출력 스키마 명시** — Phase 2 프롬프트에 스키마+evidence refs 추가. confidence 0.15→0.865.
8. **max_tokens 4096** — LLM 응답 잘림 해결.
9. **Qdrant 잠금 해결** — KB 전담, Gateway/Agent RAG 비활성화.
10. **dangerous-callers API** — 코드 그래프에서 위험 함수 호출자 자동 식별 (popen, getenv, readlink).

최종 테스트 결과: RE100 12개 소스 → SAST 16건 + 코드 그래프 98함수 + SCA 6라이브러리 → LLM 8 claims, confidence 0.865, schemaValid=true

### static-explain BuildProfile 컨텍스트 추가 (2026-03-17, 완료, S2 작업요청)

S2가 `context.trusted.buildProfile` (languageStandard, targetArch, compiler)을 optional로 전달하기 시작:
- **프롬프트 반영**: `V1PromptBuilder`에 `_format_build_profile()` 추가, static-explain user template에 `[빌드 환경]` 섹션 신설
- **system 프롬프트**: 분석 원칙에 "빌드 환경이 제공된 경우 아키텍처·컴파일러·언어 표준 특화 분석" 지시 추가
- **API 계약서**: `llm-gateway-api.md`에 `trusted.buildProfile` 필드 + static-explain 예시에 반영
- **테스트**: buildProfile 포함/미포함/부분 전달 3개 추가 → 150개 전부 통과

수정 파일: `app/pipeline/prompt_builder.py`, `app/registry/prompt_registry.py`, `tests/test_prompt_builder.py`, `docs/api/llm-gateway-api.md`, `docs/s3-handoff/README.md`

### API 계약-테스트 매핑 체계 구축 (2026-03-17, 완료, S2 작업요청)

S2가 문서 심층 감사에서 14건의 코드-문서 불일치를 발견한 후, "자동화된 테스트만이 세션 간 안전망"이라는 결론과 함께 S3에도 동일 체계를 요청:
- **HTTP 레벨 계약 테스트 55개 신규 추가**: 기존 92개(단위) + 신규 55개(계약) = 147개 전부 통과
- **conftest.py**: TestClient fixture 2종 (`client_live`=mock 파이프라인 통과, `client`+`mock_pipeline`=pipeline mock 주입) + 요청 빌더 헬퍼
- **test_contract_endpoints.py** (11개): GET /v1/health, /v1/models, /v1/prompts 응답 구조 검증
- **test_contract_task_success.py** (17개): POST /v1/tasks 성공 응답 JSON 필드, audit(inputHash sha256: 접두어+16자 hex, createdAt ISO8601), confidence 가중평균, plan, X-Request-Id 전파, 5개 taskType 순회
- **test_contract_task_failure.py** (21개): 실패 응답 구조, retryable 매핑(TIMEOUT/LLM_OVERLOADED/MODEL_UNAVAILABLE→true), 500 observability 형식, 10개 failureCode×status parametrize
- **test_contract_input_validation.py** (6개): 422 반환 검증(unknown taskType, 필드 누락, 빈 body, invalid JSON, maxTokens 범위 초과)
- **API 계약서 수정**: allowlist 외 taskType 응답 코드 `400` → `422` (Pydantic 검증 실동작 반영)

수정 파일: `tests/conftest.py`, `tests/test_contract_*.py` (4개), `docs/api/llm-gateway-api.md`, `docs/s3-handoff/README.md`

### 문서-코드 정합 (2026-03-17, 완료, 자체 개선)

1. **`LLM_OVERLOADED` failureCode 승격**: `FailureCode` enum에 `LLM_OVERLOADED` 추가. 429/503 과부하와 연결 불가(`MODEL_UNAVAILABLE`)를 구분.
2. **TIMEOUT `retryable: true` 수정**: 파이프라인에서 `_failure()` 호출 시 `retryable=True` 누락 → 추가.
3. **`Semaphore(N)` 명세 반영**: 기능 명세서의 `Semaphore(1)` → `Semaphore(N)` + 환경변수 조정 가능 기술로 수정.

수정 파일: `app/types.py`, `app/pipeline/task_pipeline.py`, `docs/specs/llm-gateway.md`, `docs/api/llm-gateway-api.md`, `docs/s3-handoff/README.md`

### Claim location 필드 + S4 교환 로그 (2026-03-17, 완료, S2 작업요청 + 자체 개선)

1. **Claim.location 필드 추가**: S2 요청에 따라 `claims[].location` 필드를 추가 (`"파일경로:라인번호"` | `null`). 프롬프트 출력 스키마 + 파이프라인 조립 + API 계약서 반영.
2. **S4 교환 전문 로그**: `logs/s4-exchange.jsonl`에 vLLM 요청/응답 JSON 전문을 기록. 에러 시에도 요청 body를 남김. stdout에는 출력하지 않음.

수정 파일: `app/schemas/response.py`, `app/registry/prompt_registry.py`, `app/pipeline/task_pipeline.py`, `app/clients/real.py`, `app/main.py`, `scripts/common/clean-s3-logs.sh`, `docs/api/llm-gateway-api.md`

### LLM 출력 재시도 + Confidence RAG 분화 + RAG min_score 필터 (2026-03-16, 완료, 자체 개선 + S2 작업요청 4건 처리)

2차 정적분석 통합테스트 결과 3/44 실패 (INVALID_GROUNDING 2, INVALID_SCHEMA 1) — 모두 LLM 출력 품질 문제:
- **재시도 로직**: Steps 5-9를 `_attempt_llm_and_validate()`로 추출, retry loop 적용
  - 재시도 대상: INVALID_SCHEMA, INVALID_GROUNDING, EMPTY_RESPONSE
  - HTTP 에러(TIMEOUT, MODEL_UNAVAILABLE, INPUT_TOO_LARGE)는 즉시 실패
  - 토큰 사용량 누적, `audit.retryCount` 반영
  - `SMARTCAR_LLM_MAX_RETRIES=2` (기본, 총 3회 시도)
- **Confidence RAG 분화**: `consistency`(1.0 고정) → `ragCoverage`로 교체
  - `ragCoverage = 0.4 + 0.6 × min(rag_hits / top_k, 1.0)`
  - 분별력 0.09 (0.8650~0.9550) — Quality Gate 판정에 활용 가능
- **RAG min_score 필터**: `SMARTCAR_RAG_MIN_SCORE=0.35` — 관련성 낮은 결과 제외
  - 이전: top_k=5 하드코딩 → 항상 ragHits=5
  - 이후: 관련성 임계값 미만 제외 → ragHits 가변 (0~5)
- **S2 work-request 4건 처리**: confidence 고정, INVALID_GROUNDING, INVALID_SCHEMA, ragHits 고정
- **S2 work-request 발송**: `consistency` → `ragCoverage` 필드명 변경 통보
- 테스트: 89개 전부 통과

### 프롬프트 품질 점검 (2026-03-16, 완료, 자체 개선)

5개 task type 프롬프트 템플릿 점검 및 개선:
- **공통 출력 스키마**: `policyFlags` 필드 + 허용값 6종(ISO21434-noncompliant, MISRA-violation, needs-safety-impact-review, UNECE-R155-relevant, crypto-weakness, hardcoded-secret) 추가. 기존엔 스키마에 없어 LLM이 절대 생성 못했음
- **static-cluster**: 그룹핑 기준 4단계(근본원인→코드경로→수정전략→영향범위), 출력 가이드(그룹별 중복 가능성/대표 severity/독립 finding 표기)
- **report-draft**: 준거 기준(ISO 21434, WP.29, MISRA), 보고서 5단 구조(경영층요약→범위→finding→위험평가→권고), 작성 원칙 6항
- **test-plan-propose**: 안전 제약/중단 조건 구체적 예시, 가설 작성법 가이드

### 프롬프트 길이 사전 검증 (2026-03-16, 완료, S4 작업요청)

S4 통합테스트에서 43MB 프롬프트, 260K 토큰 프롬프트가 vLLM 400 에러 유발:
- **사전 검증**: 프롬프트 조립 후 문자 수 기반 차단 (step 4.5), `SMARTCAR_LLM_MAX_INPUT_CHARS=800000`
- **에러 코드**: `INPUT_TOO_LARGE` (FailureCode) + `budget_exceeded` (TaskStatus)
- **S4 400 에러 처리**: `LlmInputTooLargeError`로 분류하여 의미 있는 메시지 전달
- **S2 협의 요청 발송**: 입력 크기 책임 분담 (방안 C: 양측 모두)

### vLLM 동시성 전환 + RAG 쿼리 보강 (2026-03-16, 완료, S2 검토의견 반영)

S2의 검토의견(`s2-to-s3-vllm-concurrency-review.md`)을 반영:
- **세마포어 설정 기반 전환**: `Semaphore(1)` → `Semaphore(settings.llm_concurrency)`, 기본 4
- **httpx 클라이언트 재사용**: 인스턴스 레벨 `AsyncClient` + connection pooling (매 요청 생성 제거)
- **Backpressure 처리**: 429/503 → `LLM_OVERLOADED`, `retryable: true` 자동 분류
- **TaskFailureResponse 확장**: `retryable: bool = False` 필드 추가
- **RAG 쿼리 3단계 fallback 체인** (정적분석 통합테스트에서 발견):
  1. `trusted.finding` (단일 객체) — API 계약서 명세
  2. `trusted.ruleMatches` (배열) — S2 어댑터 포맷
  3. `untrusted.sourceCode` 보안 키워드 정규식 추출 — 최종 fallback
- **S2 work-request 발송**: 동시성 확정 통보 + trusted.finding 누락 버그 리포트
- 테스트: 74개 통과

### 위협 지식 DB(RAG) 통합 (2026-03-14, 완료, S4 작업요청)

S4가 완성한 자동차 위협 지식 DB를 S3에 정식 통합:
- **ETL 파이프라인 이식**: S4의 `/tmp/threat-db/` 코드를 `scripts/threat-db/`로 이식
  - 4개 소스(CWE 944건 + CVE 702건 + ATT&CK ICS 83건 + CAPEC 브릿지) → 교차참조 5,199건
  - Qdrant 파일 기반 영속 스토리지 (`data/qdrant/`, Docker 불필요)
  - 실행: `python scripts/threat-db/build.py --qdrant-path data/qdrant`
- **RAG 런타임 모듈**: `app/rag/` 패키지
  - `ThreatSearch` — Qdrant 벡터 검색 (paraphrase-multilingual-MiniLM-L12-v2, 384차원)
  - `ContextEnricher` — task type별 쿼리 추출 + 포맷된 컨텍스트 조립
- **파이프라인 통합**: Step 3.5로 RAG 증강 단계 추가
  - `V1PromptBuilder.build()`에 `threat_context` 파라미터 추가
  - 5개 프롬프트 템플릿에 `[위협 지식 DB 참고]` 섹션 추가
  - `AuditInfo.ragHits` 필드로 감사 추적
- **설정**: `SMARTCAR_RAG_ENABLED=true` (기본 활성화. 데이터 있으면 자동으로 쓴다)
  - Qdrant 데이터 없으면 자동 비활성화, RAG 실패 시 graceful fallback
  - 강제 비활성화: `SMARTCAR_RAG_ENABLED=false`
- **health 응답에 `rag` 필드 추가**: `{enabled, qdrantPath, status}`
- **테스트**: 73개 전부 통과 (기존 59 + 신규 14)

### vLLM + Qwen3.5 전환 (2026-03-14, 완료, S4 작업요청)

S4가 **ollama + Qwen3 32B** → **vLLM + Qwen3.5-35B-A3B FP8** 전환 완료:
- **OllamaLlmClient 삭제** — vLLM은 OpenAI-compatible API 제공, `RealLlmClient`로 통합
- **LLM 모드 2종 체계** (mock/real)로 단순화, `config.py`에서 `Literal["mock", "real"]` 타입 제한
- **RealLlmClient 업그레이드** — 토큰 캡처(`usage.prompt_tokens`/`completion_tokens`), thinking 제어(`chat_template_kwargs`), structured output(`response_format: json_object`)
- **Health 엔드포인트 강화** — `real` 모드일 때 vLLM `GET /health` 프로브 추가 (`llmBackend` 필드)
- **환경변수 변경** — 포트 11434→8000, 모델명 `qwen3:32b`→`Qwen/Qwen3.5-35B-A3B-FP8`

**성능 개선**: 처리량 +155% (10.2→26 tok/s), 응답시간 -60% (48→19초)

### 코드 리팩토링: v0 제거 + 구조 플래트닝 (2026-03-13, 완료)

v0 코드 완전 제거 후, `app/v1/` 중간 패키지를 `app/`으로 플래트닝:
- `app/v1/types.py` → `app/types.py`
- `app/v1/schemas/` → `app/schemas/`
- `app/v1/registry/` → `app/registry/`
- `app/v1/validators/` → `app/validators/`
- `app/v1/pipeline/` → `app/pipeline/`
- `app/v1/mock/` → `app/mock/`
- `app/v1/routers/` → `app/routers/`
- `app/services/clients/` → `app/clients/`
- 모든 import를 `app.v1.xxx` → `app.xxx`, `app.services.clients.xxx` → `app.clients.xxx`로 변경
- 테스트 파일명에서 `v1_` prefix 제거
- API 명세서(`llm-gateway-api.md`)에서 v0 섹션 삭제
- 28개 테스트 전부 통과 확인

### Observability 규약 준수 (2026-03-14, 완료, S2 작업요청)

- **X-Request-Id 전파** — `RealLlmClient`에서 S4 호출 시 `X-Request-Id` 헤더 포함
- **에러 응답 형식** — `{success, error, errorDetail: {code, message, requestId, retryable}}` 규약 준수
- **S4 호출 로그** — 시작/완료/실패 각각 requestId, model, latencyMs, tokenUsage, errorCode 기록

### tokenUsage 매핑 + .env 도입 + 실 LLM 연동 (2026-03-13, 완료)

- `TaskPipeline._call_llm()`이 `(content, TokenUsage)` 튜플 반환 → audit에 실제 토큰 사용량 기록
- `config.py`에 `env_file: ".env"` 추가, `.env` 생성
- 프롬프트 개선 — Assessment 출력 스키마에 few-shot 예시 + "JSON만 출력" 규칙 추가
- 빈 content 방어 — 파이프라인에서 파싱 전 빈 응답 조기 차단

### Task API 뼈대 (2026-03-12, 완료)

전체 파이프라인 신규 작성. 상세 구조는 "현재 구현 상태" 섹션 참조.

---

## 6. 구현 로드맵

### 1단계: Task API 뼈대 — ✅ 완료

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry 구조 (5개 task type 등록)
- model profile registry 구조 (Settings 기반 자동 등록)
- schema validation + evidence validation 프레임워크
- confidence calculator (4항목 가중합)
- mock dispatcher

### 2단계: 핵심 Task 구현

- static-explain
- dynamic-annotate
- report-draft

### 3단계: Provenance / Audit / Trust

- provenance metadata 생성
- budget / timeout / cache
- input trust labeling
- confidence 산출

### 4단계: Planner + Safety

- test-plan-propose
- planner output DSL
- static-cluster
- safety / policy integration

### 5단계: Evaluation

- evaluation harness
- golden set 관리
- regression 검증

---

## 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 명세서 (Gateway) | `docs/specs/llm-gateway.md` | LLM Gateway 아키텍처, 원칙 |
| API 명세서 (S2↔S3) | `docs/api/llm-gateway-api.md` | S2 연동 계약서 |
| 이 인수인계서 | `docs/s3-handoff/README.md` | 다음 세션용 (Analysis Agent + KB 포함) |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 방향의 원본 근거 |
| 외부 피드백 (Agentic SAST) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 근거 |

**참조 문서 (S4 소유):**
| 문서 | 경로 | 용도 |
|------|------|------|
| SAST Runner API | `docs/api/sast-runner-api.md` | S3↔S4 계약 (6개 엔드포인트) |
| SAST Runner 명세 | `docs/specs/sast-runner.md` | SAST Runner 내부 아키텍처 |
| LLM Engine API | `docs/api/llm-engine-api.md` | S3↔S4 LLM 계약 |

**중요**: 구현을 바꾸면 관련 명세서와 API 계약서도 반드시 같이 업데이트할 것.

---

## 실행 방법

> **⚠ 서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.
> **⚠ S4 서비스(SAST Runner, LLM Engine)는 S4에게 요청할 것.**

### 사전 조건

- Neo4j: `$NEO4J_HOME/bin/neo4j start` (~/neo4j-community-5.26.3)
- S4 SAST Runner (:9000) 가동 중
- S4 LLM Engine (10.126.37.19:8000) 가동 중

### 3개 서비스 기동

```bash
# 1. Knowledge Base (Qdrant 독점 — 반드시 먼저)
cd services/knowledge-base && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8002

# 2. LLM Gateway
cd services/llm-gateway && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 3. Analysis Agent
cd services/analysis-agent && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 확인

```bash
curl http://localhost:8000/v1/health  # Gateway
curl http://localhost:8001/v1/health  # Agent
curl http://localhost:8002/v1/health  # KB (initialized=true, graph.connected=true)
```

### 통합 테스트

```bash
cd services/analysis-agent
bash scripts/project-scan.sh  # RE100 프로젝트 전반 분석
```

**주의**: WSL2 환경. 각 서비스에 `.venv` + `.env` 구비됨. KB의 Qdrant는 파일 기반이라 동시 접근 불가 — KB가 Qdrant를 독점하므로 Gateway/Agent의 RAG는 비활성화됨 (`SMARTCAR_RAG_ENABLED=false`).

---

## 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| S3 기능 명세 | `docs/specs/llm-gateway.md` | LLM Gateway 아키텍처와 원칙 |
| S2 백엔드 명세 | `docs/specs/backend.md` | S2가 S3를 어떻게 쓰는지 이해 |
| 공유 모델 | `docs/api/shared-models.md` | S2-S3 간 데이터 구조 |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | API 계약서 |
| SAST Runner API | `docs/api/sast-runner-api.md` | S4 소유. 6개 엔드포인트 명세 |
| SAST Runner 명세 | `docs/specs/sast-runner.md` | S4 소유. 내부 아키텍처 |
| S3↔S4 LLM 계약 | `docs/api/llm-engine-api.md` | S4 소유. LLM 호출 계약 |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 비전의 원본 |
| 외부 피드백 (Agentic) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 |
