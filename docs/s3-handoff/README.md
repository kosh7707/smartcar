# S3. LLM Gateway 개발자 인수인계서

> 이 문서는 S3(LLM Gateway) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.

---

## 1. 프로젝트 전체 그림

### 4-서비스 MSA 구조

```
[Electron + React + TS]  <-->  [Express.js + TS]  <-->  [Python FastAPI]  <-->  [vLLM (Qwen3.5-35B-A3B FP8)]
     Frontend (S1)              Backend (S2)             LLM Gateway (S3)        LLM Engine (S4)
     :5173 (dev)                :3000                    :8000                    :8000 (DGX Spark)
```

통신 방향: `S1 → S2 → S3 → S4` (단방향 의존)

### S3의 정체성

> S3는 모델 서버를 감싸는 프록시가 아니라, AI 요청을 표준화하고,
> 입력 신뢰도와 출력 검증을 관리하며, provenance와 audit를 남기는 통제 계층이다.

**S3의 초기 성공 기준 3가지:**
1. 항상 파싱 가능할 것
2. 항상 supplied evidence 안에서만 말할 것
3. 위험한 구체 실행정보를 내놓지 않을 것

---

## 2. 너의 역할과 경계

### 너는

- S3 LLM Gateway 개발자
- `services/llm-gateway/` 하위 코드를 소유
- `docs/api/llm-gateway-api.md` API 명세서를 작성/관리

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**

### 다른 서비스 코드

- S1(프론트), S2(백엔드) 코드는 기본적으로 수정하지 않음
- 사용자가 풀스택 역할을 지정한 경우에만 직접 수정 가능
- 그 외에는 문제점 + 수정방안만 전달

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md` (예: `s2-to-s3-mock-enhancement.md`)
- S1이나 S2에게 요청할 일이 있으면 이 폴더에 문서를 작성한다
- 반대로 S1/S2가 너에게 요청한 문서도 여기에 있다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크한다

---

## 3. API

### 엔드포인트

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | Task 기반 AI 분석 요청 (5개 taskType) |
| GET | `/v1/health` | 서비스 상태 + modelProfiles + activePromptVersions |
| GET | `/v1/models` | 등록된 model profile 목록 |
| GET | `/v1/prompts` | 등록된 prompt template 목록 |

### Task Type Allowlist

| Task Type | 용도 |
|-----------|------|
| `static-explain` | 정적 분석 finding 심층 설명 |
| `static-cluster` | 유사 finding 그룹핑 |
| `dynamic-annotate` | 동적 분석 이벤트 해석 |
| `test-plan-propose` | 테스트 시나리오 제안 |
| `report-draft` | 보고서 초안 생성 |

---

## 4. 현재 구현 상태

### 파일 구조

```
services/llm-gateway/
├── .env                          # 환경변수 (git 추적 제외)
├── .venv/                        # Python 가상환경
├── requirements.txt              # fastapi, uvicorn, pydantic, pydantic-settings, httpx, python-json-logger, qdrant-client, fastembed
├── README.md                     # 실행법, 환경변수, 내부 구조
├── app/
│   ├── main.py                   # FastAPI 앱 진입점, CORS, JSON 로깅, 라우터 등록, RAG lifespan
│   ├── config.py                 # pydantic-settings 환경변수 → Settings 객체 (.env 자동 로드)
│   ├── context.py                # contextvars 기반 요청 컨텍스트 (requestId)
│   ├── errors.py                 # S3Error 계층 (LlmTimeoutError, LlmUnavailableError, LlmHttpError)
│   ├── types.py                  # TaskType, TaskStatus, FailureCode StrEnum
│   ├── clients/
│   │   ├── base.py               # LlmClient ABC
│   │   └── real.py               # RealLlmClient (OpenAI-compatible, vLLM 대상, httpx connection pooling, thinking 제어, 토큰 캡처, structured output)
│   ├── schemas/
│   │   ├── request.py            # TaskRequest, EvidenceRef, Context, Constraints, RequestMetadata
│   │   └── response.py           # TaskSuccessResponse, TaskFailureResponse, AssessmentResult, Claim, TestPlan, AuditInfo, TokenUsage
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
├── tests/
│   ├── test_response_parser.py   # 11 tests
│   ├── test_evidence_validator.py # 5 tests
│   ├── test_confidence.py        # 5 tests
│   ├── test_schema_validator.py  # 7 tests (→ 9 tests)
│   ├── test_mock_dispatcher.py   # 10 tests (→ 13 tests)
│   ├── test_prompt_builder.py    # 9 tests
│   ├── test_registry.py          # 12 tests (→ 13 tests)
│   ├── test_threat_search.py     # 5 tests (신규: RAG 검색)
│   └── test_context_enricher.py  # 10 tests (신규: RAG 컨텍스트 증강, ruleMatches fallback 포함)
```

### 요청 처리 흐름

```
S2 요청 → tasks.py (POST /v1/tasks)
  → PromptRegistry에서 prompt 조회
  → ModelProfileRegistry에서 profile 조회
  → [RAG] ContextEnricher로 위협 지식 DB 검색 + 컨텍스트 조립 (선택적)
  → V1PromptBuilder로 3계층 프롬프트 조립 (trusted/semi-trusted/untrusted + RAG 컨텍스트 분리)
  → LLM 호출 (Semaphore(N)으로 동시성 제어, 기본 4)
      mock: V1MockDispatcher
      real: RealLlmClient (/v1/chat/completions, vLLM 대상, connection pooling)
  → V1ResponseParser로 Assessment JSON 파싱
  → SchemaValidator로 구조 검증
  → EvidenceValidator로 refId hallucination 감지
  → ConfidenceCalculator로 신뢰도 산출 (S3 자체 계산)
  → TaskSuccessResponse 또는 TaskFailureResponse 반환 (audit.ragHits 포함)
```

### Confidence 산출 (S3 자체)

```
confidence = 0.45×grounding + 0.30×deterministicSupport + 0.15×consistency + 0.10×schemaCompliance
```
- consistency는 현재 1.0 고정 (dual-run 미구현)

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
| SMARTCAR_RAG_ENABLED | `true` | RAG 위협 지식 DB (`true`/`false`). 데이터 없으면 자동 비활성화 |
| SMARTCAR_QDRANT_PATH | `data/qdrant` | Qdrant 파일 스토리지 경로 |
| SMARTCAR_RAG_TOP_K | `5` | RAG 검색 결과 상위 k건 |
| LOG_DIR | `../../logs` (프로젝트 루트 `logs/`) | JSONL 로그 파일 디렉토리 |

> 모든 서비스가 동일한 패턴(`services/<서비스명>/.env`)을 사용한다. 너의 `.env`는 네가 직접 관리.

### 동시성 제어

- `asyncio.Semaphore(settings.llm_concurrency)` — 기본 4, 환경변수 `SMARTCAR_LLM_CONCURRENCY`로 조정
- vLLM의 continuous batching + PagedAttention을 활용하여 동시 요청 처리
- `RealLlmClient`가 `httpx.AsyncClient`를 인스턴스 레벨에서 유지 (connection pooling + keep-alive)
- lifespan shutdown 시 `aclose()` 호출

### Backpressure 처리

- vLLM이 429/503 응답 시 `LlmHttpError(retryable=True, code="LLM_OVERLOADED")` 발생
- `TaskFailureResponse`에 `retryable: bool` 필드로 S2에 전달
- S2가 자체 재시도 판단 (exponential backoff 권장)

### Thinking 모드 제어

- `RealLlmClient`가 `chat_template_kwargs: {"enable_thinking": false}`로 thinking 비활성화
- `response_format: {"type": "json_object"}`로 JSON 출력 보장 (structured output)
- `V1ResponseParser`에서 `<think>...</think>` 태그 strip (safety net)
- 프롬프트에 `/no_think` 포함 (추가 safety net)

---

## 5. 수정 이력

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

## 7. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 명세서 | `docs/specs/llm-gateway.md` | S3의 아키텍처, 원칙, 전체 요구사항 |
| API 명세서 | `docs/api/llm-gateway-api.md` | S2 연동 계약서 |
| README | `services/llm-gateway/README.md` | 실행법, 환경변수, 내부 구조도 |
| 이 인수인계서 | `docs/s3-handoff/README.md` | 다음 세션용 |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 방향의 원본 근거 |
| 외부 피드백 (Agentic SAST) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 근거 |

**중요**: 구현을 바꾸면 `docs/specs/llm-gateway.md`와 `docs/api/llm-gateway-api.md`도 반드시 같이 업데이트할 것.

---

## 8. 실행 방법

> **⚠ 서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

```bash
cd services/llm-gateway
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

확인:
```bash
curl http://localhost:8000/v1/health
```

**주의**: WSL2 환경이다. `.venv`가 이미 만들어져 있고 의존성도 설치되어 있다. 환경변수는 `services/llm-gateway/.env`에서 자동 로드된다 (위 "환경변수 (.env)" 섹션 참조).

---

## 9. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| S3 기능 명세 | `docs/specs/llm-gateway.md` | S3의 아키텍처와 원칙 (필독) |
| S2 백엔드 명세 | `docs/specs/backend.md` | S2가 S3를 어떻게 쓰는지 이해 |
| 공유 모델 | `docs/api/shared-models.md` | S2-S3 간 데이터 구조 |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | API 계약서 |
| S3↔S4 API 계약 | `docs/api/llm-engine-api.md` | S4 소유. S3가 caller로서 참조 |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 비전의 원본 |
| 외부 피드백 (Agentic) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 |
