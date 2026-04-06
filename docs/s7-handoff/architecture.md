# S7 LLM Gateway — 아키텍처 상세

> 이 문서는 Gateway 코드의 구조, 요청 처리 흐름, 환경변수, Observability를 상세히 기술한다.

---

## 파일 구조

```
services/llm-gateway/
├── .env                          # 환경변수 (git 추적 제외)
├── .venv/                        # Python 가상환경
├── requirements.txt              # fastapi, uvicorn, pydantic, pydantic-settings, httpx, python-json-logger, prometheus_client
├── README.md                     # 실행법, 환경변수, 내부 구조
├── app/
│   ├── main.py                   # FastAPI 앱 진입점, CORS, JSON 로깅(pino 숫자), LLM 교환 로거, Circuit Breaker/TokenTracker 초기화, 워밍업, dump 자동 정리
│   ├── config.py                 # pydantic-settings 환경변수 -> Settings 객체 (.env 자동 로드)
│   ├── context.py                # contextvars 기반 요청 컨텍스트 (requestId)
│   ├── errors.py                 # GatewayError 계층 (LlmTimeoutError, LlmUnavailableError, LlmHttpError, LlmCircuitOpenError)
│   ├── circuit_breaker.py        # CircuitBreaker (CLOSED->OPEN->HALF_OPEN 상태 전이)
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
│   │   ├── response_parser.py    # V1ResponseParser (JSON/코드블록/commentary-wrapped JSON 추출, <think> 태그 방어)
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
│       └── tasks.py              # POST /v1/tasks, /v1/chat, GET /v1/health, /v1/usage, /v1/models, /v1/prompts, /metrics
├── scripts/
│   └── threat-db/                # 위협 지식 DB ETL 파이프라인 (S4 이식)
│       ├── build.py              # ETL 오케스트레이터 (다운로드 -> 파싱 -> 교차참조 -> Qdrant 적재)
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
├── tests/                        # 185 tests total (2026-04-03 기준)
│   ├── conftest.py               # 공통 fixture: TestClient(client_live, client+mock_pipeline), 요청 빌더
│   ├── test_response_parser.py   # 12 tests
│   ├── test_evidence_validator.py # 5 tests
│   ├── test_confidence.py        # 10 tests (RAG 분화 테스트 포함)
│   ├── test_schema_validator.py  # 7 tests
│   ├── test_mock_dispatcher.py   # 10 tests
│   ├── test_prompt_builder.py    # 12 tests
│   ├── test_registry.py          # 12 tests
│   ├── test_threat_search.py     # 6 tests (min_score 필터 포함)
│   ├── test_context_enricher.py  # 11 tests (ruleMatches fallback, min_score 전달 포함)
│   ├── test_pipeline_retry.py   # 13 tests (재시도 성공/소진/HTTP에러/토큰누적/CB OPEN)
│   ├── test_circuit_breaker.py        # 10 tests (상태 전이, 복구, snapshot)
│   ├── test_token_tracker.py         # 7 tests (누적 집계, endpoint별, taskType별)
│   ├── test_contract_endpoints.py      # 25 tests (GET /v1/health, /models, /prompts, /usage, /metrics, chat proxy)
│   ├── test_contract_task_success.py   # 17 tests (POST /v1/tasks 성공 응답 JSON 계약 검증)
│   ├── test_contract_task_failure.py   # 22 tests (실패 응답 구조, retryable, 500 형식, failureCode*status)
│   └── test_contract_input_validation.py # 6 tests (422 입력 검증: taskType/필드 누락/maxTokens 범위)
```

---

## 요청 처리 흐름 (POST /v1/tasks)

```
S2 요청 -> tasks.py (POST /v1/tasks)
  -> PromptRegistry에서 prompt 조회
  -> ModelProfileRegistry에서 profile 조회
  -> [RAG] ContextEnricher로 위협 지식 DB 검색 + 컨텍스트 조립 (선택적)
  -> V1PromptBuilder로 3계층 프롬프트 조립 (trusted/semi-trusted/untrusted + RAG 컨텍스트 분리)
  -> [Retry Loop] (최대 1 + AEGIS_LLM_MAX_RETRIES 회):
      -> LLM 호출 (Semaphore(N)으로 동시성 제어, 기본 4)
          mock: V1MockDispatcher
          real: RealLlmClient (/v1/chat/completions, vLLM 대상, connection pooling)
          -> LLM 교환 전문을 logs/llm-exchange.jsonl에 기록
      -> V1ResponseParser로 Assessment JSON 파싱
      -> SchemaValidator로 구조 검증
      -> EvidenceValidator로 refId hallucination 감지
      -> 실패 시: INVALID_SCHEMA/INVALID_GROUNDING/EMPTY_RESPONSE -> 재시도
      -> 인프라 에러 -> 즉시 실패:
          - LlmCircuitOpenError -> LLM_CIRCUIT_OPEN (retryable)
          - LlmTimeoutError -> TIMEOUT (retryable)
          - LlmUnavailableError -> MODEL_UNAVAILABLE (retryable)
          - LlmHttpError 429/503 -> LLM_OVERLOADED (retryable)
          - LlmInputTooLargeError -> INPUT_TOO_LARGE (non-retryable)
  -> ConfidenceCalculator로 신뢰도 산출 (자체 계산, ragCoverage 반영)
  -> TaskSuccessResponse 또는 TaskFailureResponse 반환
```

---

## Confidence 산출

```
confidence = 0.45 * grounding + 0.30 * deterministicSupport + 0.15 * ragCoverage + 0.10 * schemaCompliance
```
- ragCoverage = 0.4 + 0.6 * min(rag_hits / top_k, 1.0)
- 0 hits -> 0.40, 5 hits -> 1.00

---

## LLM 모드 2종

| 모드 | 클라이언트 | 엔드포인트 | 용도 |
|------|-----------|-----------|------|
| `mock` | V1MockDispatcher | (내부) | 개발/테스트 |
| `real` | RealLlmClient | `/v1/chat/completions` | **현재 운영 모드** (DGX Spark vLLM) |

---

## 환경변수 (.env)

`services/llm-gateway/.env` 파일에서 환경변수를 로드한다. pydantic-settings가 자동으로 읽으며, `.env`는 `.gitignore`에 의해 Git 추적 제외.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| AEGIS_LLM_MODE | `mock` | `mock` / `real` |
| AEGIS_LLM_ENDPOINT | `http://10.126.37.19:8000` | LLM Engine 주소 (DGX Spark vLLM) |
| AEGIS_LLM_MODEL | `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4` | 모델명 (HuggingFace 형식) |
| AEGIS_LLM_API_KEY | (빈 문자열) | API 키 (vLLM: 불필요) |
| AEGIS_LLM_CONCURRENCY | `4` | 동시 LLM 요청 수 |
| AEGIS_LLM_CONNECT_TIMEOUT | `10` | LLM Engine 연결 타임아웃 (초) |
| AEGIS_LLM_READ_TIMEOUT | `600` | LLM Engine 응답 대기 타임아웃 (초) |
| AEGIS_LLM_MAX_INPUT_CHARS | `800000` | 프롬프트 문자 수 상한 (~200K 토큰) |
| AEGIS_LLM_MAX_RETRIES | `2` | LLM 출력 품질 재시도 횟수 (총 시도 = 1 + max_retries) |
| AEGIS_CIRCUIT_BREAKER_THRESHOLD | `3` | 연속 실패 횟수 -> Circuit Breaker OPEN |
| AEGIS_CIRCUIT_BREAKER_RECOVERY_SECONDS | `30` | OPEN -> HALF_OPEN 전환 대기 시간(초) |
| AEGIS_RAG_ENABLED | `true` | RAG 위협 지식 DB |
| AEGIS_KB_ENDPOINT | `http://localhost:8002` | S5 Knowledge Base 엔드포인트 |
| AEGIS_RAG_TOP_K | `5` | RAG 검색 결과 상위 k건 |
| AEGIS_RAG_MIN_SCORE | `0.35` | 이 점수 미만의 RAG 결과 제외 |
| AEGIS_CORS_ALLOW_ORIGINS | `http://localhost:5173,http://localhost:3000` | CORS 허용 오리진 |
| AEGIS_CONFIDENCE_W_GROUNDING | `0.45` | Confidence 가중치: evidence grounding |
| AEGIS_CONFIDENCE_W_DETERMINISTIC | `0.30` | Confidence 가중치: deterministic support |
| AEGIS_CONFIDENCE_W_RAG_COVERAGE | `0.15` | Confidence 가중치: RAG coverage |
| AEGIS_CONFIDENCE_W_SCHEMA | `0.10` | Confidence 가중치: schema compliance |
| LOG_DIR | `../../logs` (프로젝트 루트 `logs/`) | JSONL 로그 파일 디렉토리 |

---

## Observability

`docs/specs/observability.md` 준수.
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

- `llm-exchange.jsonl`은 디버깅/프롬프트 분석용. 한 줄 = 한 LLM 호출
- 로그 정리: `scripts/common/reset-logs.sh` (S2 관리)

---

## 동시성 제어

- `asyncio.Semaphore(settings.llm_concurrency)` — 기본 4, 환경변수 `AEGIS_LLM_CONCURRENCY`로 조정
- vLLM의 continuous batching + PagedAttention을 활용하여 동시 요청 처리
- `RealLlmClient`가 `httpx.AsyncClient`를 인스턴스 레벨에서 유지 (connection pooling + keep-alive)
- lifespan shutdown 시 `aclose()` 호출

---

## Backpressure 처리

- vLLM 429/503 응답 시 `LlmHttpError(retryable=True)` -> `FailureCode.LLM_OVERLOADED` (`retryable: true`)
- vLLM 연결 불가 시 `LlmUnavailableError` -> `FailureCode.MODEL_UNAVAILABLE` (`retryable: true`)
- Circuit Breaker OPEN 시 `LlmCircuitOpenError` -> `FailureCode.LLM_CIRCUIT_OPEN` (`retryable: true`)
- 기타 HTTP 에러 -> `FailureCode.MODEL_UNAVAILABLE` (`retryable: false`)
- `TaskFailureResponse`에 `retryable: bool` 필드로 S2에 전달

---

## Thinking 모드 제어

- `RealLlmClient`가 `chat_template_kwargs: {"enable_thinking": false}`로 thinking 비활성화
- `response_format: {"type": "json_object"}`로 JSON 출력 보장 (structured output)
- `V1ResponseParser`에서 `<think>...</think>` 태그 strip (safety net)
- 프롬프트에 `/no_think` 포함 (추가 safety net)
