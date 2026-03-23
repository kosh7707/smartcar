# S7. LLM Gateway + LLM Engine 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S7(LLM Gateway + LLM Engine 관리) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-20**

---

## 1. 프로젝트 전체 그림

### AEGIS 7인 체제에서 S7의 위치

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
           S7 Gateway (:8000)  ← LLM 단일 관문
                │
           LLM Engine
            (DGX Spark)
```

### S7 소유 서비스

| 서비스 | 포트/위치 | 역할 |
|--------|-----------|------|
| **LLM Gateway** | :8000 | 레거시 5개 taskType + `/v1/chat` 프록시 (LLM 단일 관문) |
| **LLM Engine** | 10.126.37.19:8000 (DGX Spark) | Qwen3.5-122B-A10B-GPTQ-Int4 (Qwen 공식), vLLM 서빙 |

### S7의 정체성

> S7은 AEGIS 플랫폼의 **LLM 단일 관문(Gateway)** 이자 **LLM Engine 운영자**다.
> 모든 LLM 호출은 S7(Gateway)을 경유한다. LLM Engine을 직접 호출하지 않는다.

**S7의 성공 기준:**
1. Gateway가 항상 가용할 것 — health 프로브 통과
2. LLM Engine이 안정적으로 서빙할 것 — vLLM 자동 기동/헬스체크
3. 레거시 Task API 계약을 유지할 것 — 5개 taskType 처리
4. `/v1/chat` 프록시가 OpenAI 호환 요청을 LLM Engine에 투명하게 중계할 것
5. 전 구간 requestId로 추적 가능할 것 — 구조화 JSON 로깅

---

## 2. 너의 역할과 경계

### 너는

- **S7 — LLM Gateway + LLM Engine 관리**
- 소유 코드:
  - `services/llm-gateway/` — Gateway 서버 (레거시 Task API + `/v1/chat` 프록시)
- LLM Engine(DGX Spark) 관리
- 관리하는 문서:
  - `docs/s7-handoff/README.md` — 이 인수인계서
  - `docs/specs/llm-gateway.md` — LLM Gateway 기능 명세
  - `docs/specs/llm-engine.md` — LLM Engine 명세
  - `docs/api/llm-gateway-api.md` — S2↔S7, S3↔S7 API 계약서
  - `docs/api/llm-engine-api.md` — S7↔LLM Engine 계약

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**

### 다른 서비스 코드

- S1(프론트), S2(백엔드), S3(Agent), S4(SAST), S5(KB), S6(동적분석) 코드는 기본적으로 수정하지 않으며 **읽는 것도 금지** (API 계약서로만 소통)

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md` (예: `s3-to-s7-chat-proxy.md`)
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크한다

---

## 3. API

### LLM Gateway (:8000)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | Task 기반 AI 분석 요청 (5개 taskType) |
| POST | `/v1/chat` | OpenAI-compatible chat completion 프록시 |
| GET | `/v1/health` | 서비스 상태 (Circuit Breaker 포함) |
| GET | `/v1/usage` | **NEW** — 누적 토큰/요청 통계 |
| GET | `/v1/models` | 등록된 model profile 목록 |
| GET | `/v1/prompts` | 등록된 prompt template 목록 |
| GET | `/metrics` | **NEW** — Prometheus 메트릭 |

### Task Type Allowlist

| Task Type | 용도 |
|-----------|------|
| `static-explain` | 정적 분석 finding 심층 설명 |
| `static-cluster` | 유사 finding 그룹핑 |
| `dynamic-annotate` | 동적 분석 이벤트 해석 |
| `test-plan-propose` | 테스트 시나리오 제안 |
| `report-draft` | 보고서 초안 생성 |

---

## 4. POST /v1/chat 프록시 (NEW)

### 개요

OpenAI-compatible chat completion 프록시. S3 Agent가 멀티턴 LLM 호출 시 이 엔드포인트를 사용한다.

**원칙**: "모든 LLM 호출은 S7(Gateway)을 경유한다" — `docs/AEGIS.md`

### 동작

1. 클라이언트(S3 Agent 등)가 OpenAI 포맷 요청을 `POST /v1/chat`으로 전송
2. Gateway가 **요청 body의 `model` 필드를 실제 운영 모델로 오버라이드** (호출자가 모델명을 몰라도 동작)
3. Gateway가 요청을 LLM Engine(`POST /v1/chat/completions`)에 전달
4. LLM Engine 응답을 클라이언트에 그대로 반환

### 요청 형식

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "temperature": 0.3,
  "max_tokens": 4096,
  "response_format": {"type": "json_object"},
  "chat_template_kwargs": {"enable_thinking": false}
}
```

### 응답 형식

LLM Engine(vLLM)의 OpenAI-compatible 응답을 그대로 반환한다.

### 설계 참고

- S3 Agent의 `LlmCaller`가 이 엔드포인트를 호출하여 모든 LLM 접근을 Gateway 경유로 전환
- X-Request-Id 헤더 전파 필수
- 에러 발생 시 observability 규약 준수 (`{ success, error, errorDetail }`)

---

## 5. LLM Gateway 아키텍처

### 파일 구조

```
services/llm-gateway/
├── .env                          # 환경변수 (git 추적 제외)
├── .venv/                        # Python 가상환경
├── requirements.txt              # fastapi, uvicorn, pydantic, pydantic-settings, httpx, python-json-logger, qdrant-client, fastembed
├── README.md                     # 실행법, 환경변수, 내부 구조
├── app/
│   ├── main.py                   # FastAPI 앱 진입점, CORS, JSON 로깅, LLM 교환 로거, 라우터 등록, RAG lifespan
│   ├── config.py                 # pydantic-settings 환경변수 → Settings 객체 (.env 자동 로드)
│   ├── context.py                # contextvars 기반 요청 컨텍스트 (requestId)
│   ├── errors.py                 # S3Error 계층 (LlmTimeoutError, LlmUnavailableError, LlmHttpError, LlmCircuitOpenError)
│   ├── circuit_breaker.py        # CircuitBreaker (CLOSED→OPEN→HALF_OPEN 상태 전이)
│   ├── types.py                  # TaskType, TaskStatus, FailureCode StrEnum
│   ├── clients/
│   │   ├── base.py               # LlmClient ABC
│   │   └── real.py               # RealLlmClient (OpenAI-compatible, vLLM 대상, httpx connection pooling, thinking 제어, 토큰 캡처, structured output, LLM 교환 전문 로깅)
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
│   │   ├── threat_search.py      # ThreatSearch — S5 KB REST API 호출
│   │   └── context_enricher.py   # ContextEnricher — task type별 쿼리 추출 + RAG 컨텍스트 조립
│   ├── metrics/
│   │   ├── prom.py               # Prometheus 메트릭 정의 (Counter, Histogram, Gauge)
│   │   └── token_tracker.py      # TokenTracker — 누적 토큰/요청 통계
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
├── tests/                        # 176 tests total
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

### 요청 처리 흐름 (POST /v1/tasks)

```
S2 요청 → tasks.py (POST /v1/tasks)
  → PromptRegistry에서 prompt 조회
  → ModelProfileRegistry에서 profile 조회
  → [RAG] ContextEnricher로 위협 지식 DB 검색 + 컨텍스트 조립 (선택적)
  → V1PromptBuilder로 3계층 프롬프트 조립 (trusted/semi-trusted/untrusted + RAG 컨텍스트 분리)
  → [Retry Loop] (최대 1 + AEGIS_LLM_MAX_RETRIES 회):
      → LLM 호출 (Semaphore(N)으로 동시성 제어, 기본 4)
          mock: V1MockDispatcher
          real: RealLlmClient (/v1/chat/completions, vLLM 대상, connection pooling)
          → S4 교환 전문을 logs/llm-exchange.jsonl에 기록 (요청 body + 응답 body)
      → V1ResponseParser로 Assessment JSON 파싱
      → SchemaValidator로 구조 검증
      → EvidenceValidator로 refId hallucination 감지
      → 실패 시: INVALID_SCHEMA/INVALID_GROUNDING/EMPTY_RESPONSE → 재시도
      → HTTP 에러 → 즉시 실패 (429/503: LLM_OVERLOADED, 연결 불가: MODEL_UNAVAILABLE)
  → ConfidenceCalculator로 신뢰도 산출 (자체 계산, ragCoverage 반영)
  → TaskSuccessResponse 또는 TaskFailureResponse 반환 (audit.ragHits, retryCount 포함)
```

### Confidence 산출

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

`services/llm-gateway/.env` 파일에서 환경변수를 로드한다. pydantic-settings가 자동으로 읽으며, `.env`는 `.gitignore`에 의해 Git 추적 제외.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| AEGIS_LLM_MODE | `mock` | `mock` / `real` |
| AEGIS_LLM_ENDPOINT | `http://10.126.37.19:8000` | LLM Engine 주소 (DGX Spark vLLM) |
| AEGIS_LLM_MODEL | `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4` | 모델명 (HuggingFace 형식) |
| AEGIS_LLM_API_KEY | (빈 문자열) | API 키 (vLLM: 불필요) |
| AEGIS_LLM_CONCURRENCY | `4` | 동시 LLM 요청 수 (vLLM continuous batching 활용) |
| AEGIS_LLM_CONNECT_TIMEOUT | `10` | LLM Engine 연결 타임아웃 (초). 장애 빠른 감지용 |
| AEGIS_LLM_READ_TIMEOUT | `600` | LLM Engine 응답 대기 타임아웃 (초). 대형 생성(8K+ 토큰) 대비 |
| AEGIS_LLM_MAX_INPUT_CHARS | `800000` | 프롬프트 문자 수 상한 (~200K 토큰). 초과 시 INPUT_TOO_LARGE |
| AEGIS_LLM_MAX_RETRIES | `2` | LLM 출력 품질 재시도 횟수 (총 시도 = 1 + max_retries). 0이면 재시도 비활성화 |
| AEGIS_CIRCUIT_BREAKER_THRESHOLD | `3` | 연속 실패 횟수 → Circuit Breaker OPEN |
| AEGIS_CIRCUIT_BREAKER_RECOVERY_SECONDS | `30` | OPEN → HALF_OPEN 전환 대기 시간(초) |
| AEGIS_RAG_ENABLED | `true` | RAG 위협 지식 DB (`true`/`false`). 데이터 없으면 자동 비활성화 |
| AEGIS_KB_ENDPOINT | `http://localhost:8002` | S5 Knowledge Base 엔드포인트 |
| AEGIS_RAG_TOP_K | `5` | RAG 검색 결과 상위 k건 |
| AEGIS_RAG_MIN_SCORE | `0.35` | 이 점수 미만의 RAG 결과 제외. 0이면 필터 비활성화 |
| LOG_DIR | `../../logs` (프로젝트 루트 `logs/`) | JSONL 로그 파일 디렉토리 |

### Observability

`docs/specs/observability.md` 준수. 로그 레벨 숫자 표준, 서비스 식별자, X-Request-Id 전파 규칙은 해당 문서 참조.
- service 식별자: `s7-gateway`
- 로그 파일: `logs/aegis-llm-gateway.jsonl`
- X-Request-Id: 수신 시 전파, 미전달 시 `gw-` 접두사로 자동 생성, 모든 응답에 포함
- `/v1/chat`: `X-Timeout-Seconds` 헤더로 호출자 주도 타임아웃 지원

### 로그 파일

| 파일 | 내용 | stdout |
|------|------|--------|
| `logs/aegis-llm-gateway.jsonl` | 앱 구조화 로그 (JSON, requestId 포함) | O |
| `logs/llm-exchange.jsonl` | LLM Engine 요청/응답 JSON 전문 (프롬프트 + LLM 응답 완전 기록) | X |
| `scripts/.logs/llm-gateway.log` | 프로세스 stdout/stderr 캡처 (`start.sh` 기동 시) | -- |

- `llm-exchange.jsonl`은 디버깅/프롬프트 분석용. 한 줄 = 한 LLM 호출 (request body + response body + latency + status)
- 로그 정리: `scripts/common/reset-logs.sh` (S2 관리, 전체 `logs/*.jsonl` 초기화)

### 동시성 제어

- `asyncio.Semaphore(settings.llm_concurrency)` — 기본 4, 환경변수 `AEGIS_LLM_CONCURRENCY`로 조정
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

## 6. LLM Engine 운영 정보

### DGX Spark 접속

| 항목 | 값 |
|------|------|
| IP | `10.126.37.19` |
| 사용자 | `accslab` |
| 호스트명 | `spark-be83` |
| 아키텍처 | aarch64 (ARM64) |
| OS | NVIDIA DGX Spark Version 7.4.0 (GNU/Linux 6.14.0) |

```bash
# 단발 명령
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 "명령어"

# SSH 키 재설정 (키가 없을 때 — 사용자가 직접 실행)
ssh-keygen -t ed25519 -f ~/.ssh/dgx_spark -N ""
ssh-copy-id -i ~/.ssh/dgx_spark.pub accslab@10.126.37.19
```

### 하드웨어 사양

| 항목 | 사양 |
|------|------|
| GPU | NVIDIA GB10 (Blackwell), CC 12.1 |
| 드라이버 | 580.126.09, CUDA 13.0 |
| 메모리 | 128GB LPDDR5x unified (가용 ~119.7GB) |
| 대역폭 | 273 GB/s |
| 디스크 | 3.7TB NVMe |
| Docker | 29.1.3 + NVIDIA Container Runtime 1.18.2 |

모델 메모리: Qwen3.5-122B-A10B-GPTQ-Int4 ~67GiB, vLLM 총 GPU 사용 ~91GiB, 여유 ~28GiB

### vLLM 기동/중지

```bash
# 원격 기동 (WSL2에서)
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 \
  "source \$HOME/.local/bin/env && cd ~/spark-vllm-docker && \
   nohup ./run-recipe.sh qwen3.5-122b-gptq-int4 --solo --tensor-parallel 1 --port 8000 \
   > /tmp/vllm-launch.log 2>&1 &"

# 중지
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker stop vllm_node && docker rm vllm_node'

# 동작 확인
curl http://10.126.37.19:8000/health
curl http://10.126.37.19:8000/v1/models
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'nvidia-smi'
```

**주의**: `source $HOME/.local/bin/env`가 필요 (uvx 경로 설정).

### 기동 시간

| 단계 | 소요 시간 |
|------|-----------|
| 컨테이너 시작 | ~10초 |
| 모델 로딩 | ~95초 (67GiB) |
| torch.compile (캐시 있을 때) | ~2분 |
| torch.compile (첫 실행) | ~5분 |
| **총 (캐시 있을 때)** | **~4분** |
| 첫 요청 워밍업 | ~48초 (이후 ~13초) |

### 성능 실측 (122B-GPTQ-Int4, 2026-03-20)

| 항목 | 실측값 | 비고 |
|------|--------|------|
| 처리량 (non-thinking) | **~13 tok/s** | 단일 요청, 워밍업 후 |
| 보안분석 응답 시간 (짧은 입력) | **~17초** | CWE 1건 설명 |
| 보안분석 응답 시간 (통합 테스트) | **21초 (Turn 1), 73초 (Turn 2)** | 12K 토큰 프롬프트, 도구 호출 포함 |
| JSON 유효율 | 100% | `enable_thinking: false` |
| vLLM 컨텍스트 한도 | 262,144 토큰 | 초과 시 400 에러 |

### 트러블슈팅

| 증상 | 원인 | 조치 |
|------|------|------|
| `LLM_UNAVAILABLE` | 컨테이너 미기동 / 포트 불일치 | `curl health` + `docker ps \| grep vllm_node`. connect 타임아웃 10초에 감지 |
| `LLM_TIMEOUT` | 첫 요청 torch.compile 워밍업 ~19초 | connect 10초 / read 600초 분리 |
| `LLM_PARSE_ERROR` | JSON 대신 자연어 반환 | `enable_thinking: false` 확인, temperature 0.1~0.3 |
| 첫 실행 OOM | torch.compile 메모리 과다 | 재실행 시 캐시로 해결 |
| 컨테이너 재시작 필요 | 상태 이상 | `docker stop && rm` 후 재기동 |

### 로그 확인

```bash
# vLLM 서버 로그
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'tail -20 /tmp/vllm-launch.log'

# Docker 컨테이너 로그
ssh -i ~/.ssh/dgx_spark accslab@10.126.37.19 'docker logs vllm_node --tail 20'
```

### ollama 잔존 정리 (미완료)

- ollama systemd 서비스가 비활성화 상태로 남아있음
- vLLM과 동시 실행 시 GPU 메모리 충돌 위험
- `systemctl --user disable ollama.service`로 영구 비활성화 필요
- `~/.ollama/models/` 정리 권장

### 기술 전환 이력

| 시기 | 변경 | 이유 |
|------|------|------|
| Phase 1 초기 | vLLM 시도 → 실패 | PyTorch cu130이 CC 12.1 미지원 |
| Phase 1 | ollama + Qwen3 32B | llama.cpp 기반, CC 12.1 네이티브 지원 |
| Phase 2 | ollama `/api/chat` 전환 | OpenAI 호환 레이어에서 thinking 제어 불가 |
| Phase 3 | vLLM + Qwen3.5-35B-A3B FP8 | CC 12.1 사전 컴파일 휠로 해결, MoE +155% |
| **현재** | **vLLM + Qwen3.5-122B-A10B-GPTQ-Int4** | Qwen 공식 GPTQ, 122B MoE, Expert=INT4/Attention=BF16 |

### 미완료 항목

현재 없음.

### 고도화 (2026-03-20)

| 기능 | 설명 |
|------|------|
| **Circuit Breaker** | Engine 장애 시 빠른 실패 (CLOSED→OPEN→HALF_OPEN), `/v1/health`에 상태 노출 |
| **TokenTracker** | 누적 토큰/요청 통계 (`/v1/usage`), endpoint별·taskType별 세분화 |
| **Prometheus 메트릭** | `/metrics` 엔드포인트 — requests, tokens, duration, errors, circuit breaker |
| **vLLM 헬스 모니터링** | `scripts/llm-engine-health.sh` — 상태 변경 시에만 로그 |

### 완료된 항목 (2026-03-20)

| 항목 | 결과 |
|------|------|
| ~~모델 업그레이드 평가~~ | **완료** — 6종 벤치마크 후 122B-GPTQ-Int4 선정 |
| ~~Tool calling 실 연동 테스트~~ | **완료** — 통합 테스트에서 4건 tool calling 성공 (knowledge.search ×3 + code_graph ×1) |
| ~~DGX Spark 모델 캐시 정리~~ | **완료** — ~2.1TB 확보 (74G 운영 모델만 유지) |
| ~~ollama 리소스 정리~~ | **완료** — systemd 서비스 `disabled`, `~/.ollama/models/` 43GB 삭제 |
| ~~vLLM 자동 재시작~~ | **완료** — `launch-cluster.sh` 패치 (`--rm` → `--restart unless-stopped`). 다음 컨테이너 재기동 시 적용 |
| ~~Gateway 워밍업 자동화~~ | **완료** — lifespan에서 더미 LLM 요청 전송. 실패해도 Gateway 기동 차단 안 함 |

---

## 7. 수정 이력

### Gateway 고도화 — Circuit Breaker + 메트릭 (2026-03-20)

- **Circuit Breaker**: `app/circuit_breaker.py` — 연속 실패 시 OPEN, recovery 후 HALF_OPEN 탐침, 성공 시 CLOSED
- **TokenTracker**: `app/metrics/token_tracker.py` — 누적 토큰/요청 통계, endpoint별·taskType별 세분화
- **Prometheus 메트릭**: `app/metrics/prom.py` — `prometheus_client` 기반, `/metrics` 엔드포인트
- **`/v1/usage` 엔드포인트**: 누적 사용량 JSON 반환
- **`/v1/health`**: circuitBreaker 상태 필드 추가
- **vLLM 헬스 모니터링**: `scripts/llm-engine-health.sh` — 상태 변경 감지 로깅
- 환경변수 2건 추가: `AEGIS_CIRCUIT_BREAKER_THRESHOLD`, `AEGIS_CIRCUIT_BREAKER_RECOVERY_SECONDS`
- 의존성 추가: `prometheus_client==0.21.1`
- 176 tests 통과 (기존 154 + 신규 22)

### 운영 정비 (2026-03-20)

- **DGX Spark 캐시 정리**: ~2.0TB 확보 (벤치마크 모델 15건 삭제, 운영 모델 74G만 유지)
- **ollama 정리**: systemd 서비스 `disabled`, 모델 43GB 삭제
- **vLLM restart policy**: `launch-cluster.sh` 패치 — `--rm` → `--restart unless-stopped` (다음 재기동 시 적용)
- **Gateway 워밍업**: lifespan에서 더미 LLM 요청으로 torch.compile 사전 워밍업 (`main.py`)
- 176 tests 통과

### 122B 모델 전환 + 문서 전면 갱신 (2026-03-20)

- **모델 전환**: `Qwen/Qwen3.5-35B-A3B-FP8` → `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4` (Qwen 공식)
- **벤치마크**: 6모델(35B-FP8, 35B-BF16, 35B-INT4, 122B-AutoRound, 122B-GPTQ, 122B-MXFP4) × 5테스트 × 10회 = 300회 정량 벤치 수행
- **모델 오버라이드**: `/v1/chat` 프록시에서 호출자 모델명을 Gateway 운영 모델로 자동 교체 (S3 코드 변경 불필요)
- **로그 리네이밍**: `s3-llm-gateway.jsonl` → `aegis-llm-gateway.jsonl`, `s4-exchange.jsonl` → `llm-exchange.jsonl`
- **config.py 기본값**: `qwen-14b` → `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4`
- **문서 갱신**: S7 소유 5개 문서 + 코드의 구 모델 참조 48건 전체 갱신
- **통합 테스트 성공**: S3 Agent 2턴 멀티턴 분석, tool calling 4건, 49개 SAST findings → 3개 핵심 취약점 정제
- **DGX Spark 레시피**: `qwen3.5-122b-gptq-int4.yaml` 영구 저장
- **S3→S7 소유권 이전 반영**: 전 문서에서 S3 → S7 참조 갱신 (7인 체제)
- 176 tests 통과

### S7 신설 (2026-03-19, S3에서 분리)

S3(Analysis Agent + LLM Gateway)에서 LLM Gateway + LLM Engine 관리를 S7으로 분리:
- **배경**: S3의 관심사가 "보안 분석 에이전트"와 "LLM 서빙 인프라"로 이질적 → 단일 책임 원칙에 따라 분리
- **S7 소유**: `services/llm-gateway/` 코드, LLM Engine(DGX Spark) 운영, 관련 문서 5건
- **`/v1/chat` 프록시 구현 완료**: S3 Agent가 Gateway 경유 LLM 호출. 세마포어 동시성 제어, 교환 로그, ConnectError→503, Timeout→504 매핑. 테스트 4건 추가 (154 passed)
- **S2 승인**: `docs/AEGIS.md` 7인 체제 반영 완료

### 이전 수정 이력 (Gateway 관련, S3 시절)

#### AEGIS 리네이밍 + RAG→S5 API 전환 (2026-03-18)

- 환경변수 prefix: `SMARTCAR_` → `AEGIS_`
- 서비스명: `smartcar-llm-gateway` → `aegis-llm-gateway`
- RAG Qdrant 직접 접근 → S5 REST API(`POST /v1/search`) 전환
- Gateway 150 tests 통과

#### static-explain BuildProfile 컨텍스트 추가 (2026-03-17)

- `V1PromptBuilder`에 `_format_build_profile()` 추가
- API 계약서에 `trusted.buildProfile` 필드 반영

#### API 계약-테스트 매핑 체계 구축 (2026-03-17)

- HTTP 레벨 계약 테스트 55개 신규 추가 (총 147개)

#### 문서-코드 정합 (2026-03-17)

- `LLM_OVERLOADED` failureCode 승격
- `Semaphore(N)` 명세 반영

#### Claim location 필드 + S4 교환 로그 (2026-03-17)

- `claims[].location` 필드 추가
- `logs/llm-exchange.jsonl` 전문 로그

#### LLM 출력 재시도 + Confidence RAG 분화 + RAG min_score 필터 (2026-03-16)

- 재시도 로직 (INVALID_SCHEMA, INVALID_GROUNDING, EMPTY_RESPONSE)
- `consistency` → `ragCoverage` 교체
- `AEGIS_RAG_MIN_SCORE=0.35`

#### 위협 지식 DB(RAG) 통합 (2026-03-14)

- ETL 파이프라인 이식 (CWE 944건 + CVE 702건 + ATT&CK ICS 83건)
- `app/rag/` 패키지, `AuditInfo.ragHits`

#### vLLM + Qwen3.5 전환 (2026-03-14)

- ollama → vLLM 전환, LLM 모드 2종 체계 (mock/real)
- 처리량 +155% (10.2→26 tok/s)

#### vLLM 동시성 전환 + RAG 쿼리 보강 (2026-03-16)

- `Semaphore(1)` → `Semaphore(N)`, httpx connection pooling
- Backpressure 처리 (429/503 → `LLM_OVERLOADED`)

#### 코드 리팩토링: v0 제거 + 구조 플래트닝 (2026-03-13)

- `app/v1/` → `app/` 플래트닝, 모든 import 변경

#### 프롬프트 품질 점검 (2026-03-16)

- 5개 task type 프롬프트 템플릿 개선
- `policyFlags` 필드 + 허용값 6종 추가

#### 프롬프트 길이 사전 검증 (2026-03-16)

- `AEGIS_LLM_MAX_INPUT_CHARS=800000`, `INPUT_TOO_LARGE` 에러 코드

#### Observability 규약 준수 (2026-03-14)

- X-Request-Id 전파, 에러 응답 형식 규약 준수

#### tokenUsage 매핑 + .env 도입 + 실 LLM 연동 (2026-03-13)

- 실제 토큰 사용량 기록, `.env` 도입

#### Task API 뼈대 (2026-03-12)

- 전체 파이프라인 신규 작성

---

## 8. 실행 방법

> **서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

### 사전 조건

- LLM Engine (10.126.37.19:8000) 가동 중 (real 모드 시)
- S5 Knowledge Base (:8002) 가동 중 (RAG 활성화 시)

### Gateway 기동

```bash
cd services/llm-gateway && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 확인

```bash
curl http://localhost:8000/v1/health  # Gateway
curl http://10.126.37.19:8000/health  # LLM Engine (vLLM)
```

### 테스트

```bash
cd services/llm-gateway && source .venv/bin/activate
pytest tests/ -v  # 176 tests
```

**주의**: WSL2 환경. `.venv` + `.env` 구비됨. RAG는 S5 KB REST API(`POST /v1/search`)를 통해 호출.

---

## 9. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 이 인수인계서 | `docs/s7-handoff/README.md` | 다음 세션용 |
| 기능 명세서 (Gateway) | `docs/specs/llm-gateway.md` | LLM Gateway 아키텍처, 원칙 |
| LLM Engine 명세 | `docs/specs/llm-engine.md` | LLM Engine 운영 |
| API 계약서 (S2↔S7, S3↔S7) | `docs/api/llm-gateway-api.md` | 연동 계약서 |
| LLM Engine API | `docs/api/llm-engine-api.md` | S7↔LLM Engine 계약 |

**참조 문서 (타 서비스 소유):**

| 문서 | 경로 | 소유 | 용도 |
|------|------|------|------|
| S5 KB API | `docs/api/knowledge-base-api.md` | S5 | RAG 검색 (Gateway가 S5 호출) |
| 공유 모델 | `docs/api/shared-models.md` | S2 | 전 서비스 공유 타입 |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | (읽기전용) | 아키텍처 방향의 원본 근거 |

**중요**: 구현을 바꾸면 관련 명세서와 API 계약서도 반드시 같이 업데이트할 것.

---

## 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| AEGIS 공통 규약 | `docs/AEGIS.md` | 역할, 소유권, 소통 규칙 |
| S7 기능 명세 | `docs/specs/llm-gateway.md` | LLM Gateway 아키텍처와 원칙 |
| S2 백엔드 명세 | `docs/specs/backend.md` | S2가 S7을 어떻게 쓰는지 이해 |
| 공유 모델 | `docs/api/shared-models.md` | S2-S7 간 데이터 구조 |
| S7 API 계약서 | `docs/api/llm-gateway-api.md` | API 계약서 |
| LLM Engine API | `docs/api/llm-engine-api.md` | S7↔LLM Engine 계약 |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 비전의 원본 |
