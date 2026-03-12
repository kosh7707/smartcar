# S3. LLM Gateway 개발자 인수인계서

> 이 문서는 S3(LLM Gateway) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.

---

## 1. 프로젝트 전체 그림

### 과제

"가상환경 기반 자동차 전장부품 사이버보안 수준 검증 기술 및 플랫폼 개발" — 부산대학교가 컨소시엄 참여기관으로, 생성형 AI 기반 지능형 사이버보안 공격/검증 프레임워크를 개발한다.

### 4-서비스 MSA 구조

```
[Electron + React + TS]  <-->  [Express.js + TS]  <-->  [Python FastAPI]  <-->  [LLM (Qwen 14B)]
     Frontend (S1)              Backend (S2)             LLM Gateway (S3)        LLM Engine (S4)
     :5173 (dev)                :3000                    :8000                    DGX Spark
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

## 3. 아키텍처 방향

외부 전문가 피드백(`docs/외부피드백/S3_llm_gateway_working_guide.md`)을 기반으로 v0에서 v1으로 전환 중이다.

### v0 (현재 동작 중) → v1 (목표)

| 항목 | v0 | v1 |
|------|----|----|
| API | `POST /api/llm/analyze` (module 기반) | `POST /v1/tasks` (task type 기반) |
| 입력 | sourceCode/canLog/testResults 평문 | context.trusted/semiTrusted/untrusted + evidenceRefs |
| 출력 | VulnerabilityItem[] | Assessment (claims, caveats, confidence, evidenceRefs) |
| 실패 | `{ success: false, error: "문자열" }` | 구조화된 status + failureCode + audit |
| 프롬프트 | 하드코딩 템플릿 | prompt registry + versioning |
| 모델 | 환경변수 4개 | model profile registry |
| 검증 | JSON 파싱 + 필수 필드 체크 | schema validation + semantic guard + evidence ref whitelist |
| 추적 | 로그 출력만 | provenance metadata (inputHash, latency, tokenUsage, promptVersion) |

### Task Type V1 Allowlist

| Task Type | v0 대응 |
|-----------|---------|
| `static-explain` | static_analysis |
| `static-cluster` | (신규) |
| `dynamic-annotate` | dynamic_analysis |
| `test-plan-propose` | dynamic_testing |
| `report-draft` | (신규) |

---

## 4. 현재 구현 상태

### 파일 구조

```
services/llm-gateway/
├── .venv/                        # Python 가상환경
├── requirements.txt              # fastapi, uvicorn, pydantic, pydantic-settings, httpx, python-json-logger
├── README.md                     # 실행법, 환경변수, 내부 구조
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI 앱 진입점, CORS, JSON 로깅, v0+v1 라우터 등록
│   ├── config.py                 # pydantic-settings 환경변수 → Settings 객체
│   ├── context.py                # contextvars 기반 요청 컨텍스트 (requestId)
│   ├── errors.py                 # S3Error 계층 (LlmTimeoutError, LlmUnavailableError, LlmHttpError)
│   ├── models/                   # 도메인 모델 (v0, v1 공유)
│   │   ├── severity.py           # Severity StrEnum (critical/high/medium/low/info)
│   │   ├── vulnerability.py      # VulnerabilityData dataclass
│   │   └── analysis.py           # AnalysisResult dataclass (→ JSON 직렬화)
│   ├── schemas/                  # API DTO (v0 계약, 그대로 유지)
│   │   ├── request.py            # AnalyzeRequest (Field 검증), RuleResult
│   │   └── response.py           # AnalyzeResponse, ErrorDetail, VulnerabilityItem, HealthResponse
│   ├── data/                     # DAO — 템플릿 데이터 저장소 (v0)
│   │   ├── static_templates.py   # DEEP_ANALYSIS_TEMPLATES, COMPOUND_PATTERNS, KEYWORD_SEARCH
│   │   ├── dynamic_templates.py  # CAN 분석 상수 (KNOWN_CAN_RANGES, DIAG_ID 등)
│   │   └── testing_templates.py  # TESTING_ANALYSIS_TEMPLATES (crash/anomaly/timeout)
│   ├── routers/                  # v0 라우터
│   │   ├── analyze.py            # POST /api/llm/analyze (v0)
│   │   └── health.py             # GET /health (v0)
│   ├── services/                 # v0 파이프라인
│   │   ├── clients/
│   │   │   ├── base.py           # LlmClient ABC (v1 Real 모드에서도 재사용)
│   │   │   ├── real.py           # RealLlmClient (httpx → S4, 예외 분류)
│   │   │   ├── factory.py        # create_llm_client() 팩토리
│   │   │   └── mock/
│   │   │       ├── __init__.py   # MockLlmClient — generate() 키워드 디스패치
│   │   │       ├── static_analyzer.py
│   │   │       ├── dynamic_analyzer.py
│   │   │       └── testing_analyzer.py
│   │   ├── prompt_builder.py     # 모듈별 프롬프트 조립
│   │   └── response_parser.py    # LLM 응답 JSON → VulnerabilityItem 변환
│   ├── templates/                # v0 프롬프트 (v1에서 미수정)
│   │   ├── static_analysis.py
│   │   ├── dynamic_analysis.py
│   │   └── dynamic_testing.py
│   └── v1/                       # ★ v1 Task API (Phase 1, 2026-03-12 신규)
│       ├── types.py              # TaskType, TaskStatus, FailureCode StrEnum
│       ├── schemas/
│       │   ├── request.py        # TaskRequest, EvidenceRef, Context, Constraints, RequestMetadata
│       │   └── response.py       # TaskSuccessResponse, TaskFailureResponse, AssessmentResult, Claim, TestPlan, AuditInfo 등
│       ├── registry/
│       │   ├── prompt_registry.py  # PromptEntry + PromptRegistry (5개 task type 등록)
│       │   └── model_registry.py   # ModelProfile + ModelProfileRegistry (Settings 기반)
│       ├── validators/
│       │   ├── schema_validator.py   # 필수 필드, confidence 범위, plan 존재 검증
│       │   └── evidence_validator.py # refId whitelist 기반 hallucination 감지
│       ├── pipeline/
│       │   ├── prompt_builder.py   # V1PromptBuilder (3계층 trust 분리, delimiter)
│       │   ├── response_parser.py  # V1ResponseParser (JSON + 코드블록 추출)
│       │   ├── confidence.py       # ConfidenceCalculator (4항목 가중합, S3 자체 산출)
│       │   └── task_pipeline.py    # TaskPipeline 오케스트레이터 (전체 흐름 제어)
│       ├── mock/
│       │   └── dispatcher.py       # V1MockDispatcher (taskType enum 기반, v0 독립)
│       └── routers/
│           └── tasks.py            # POST /v1/tasks, GET /v1/health, /v1/models, /v1/prompts
```

### v0 핵심 설계: 교체 가능한 LlmClient

```
                          ┌─ MockLlmClient (키워드 매칭, 고정 JSON)
LlmClient (ABC) ─────────┤
                          └─ RealLlmClient (httpx → POST /v1/chat/completions → S4)
```

- `create_llm_client()` 팩토리가 `SMARTCAR_LLM_MODE` 환경변수를 보고 분기
- PromptBuilder → LlmClient → ResponseParser 파이프라인은 Mock/Real 동일
- 이 패턴은 v1에서도 유지한다

### v0 요청 처리 흐름

```
S2 요청 → analyze.py
  → PromptBuilder.build(request)        # 모듈별 프롬프트 조립
  → LlmClient.generate(messages)        # Mock: 키워드 매칭 / Real: S4 호출
  → ResponseParser.parse(raw_response)  # JSON → VulnerabilityItem[]
  → AnalyzeResponse 반환
```

### v0 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| SMARTCAR_LLM_MODE | `mock` | `mock` / `real` |
| SMARTCAR_LLM_ENDPOINT | `http://localhost:8080` | S4 주소 |
| SMARTCAR_LLM_MODEL | `qwen-14b` | 모델명 |
| SMARTCAR_LLM_API_KEY | (빈 문자열) | API 키 |
| LOG_DIR | `../../logs` (프로젝트 루트 `logs/`) | JSONL 로그 파일 디렉토리 |

### v0 Mock 동작

| 모듈 | 전략 | 구현 위치 |
|------|------|----------|
| static_analysis | ruleResults 기반 심층 분석 (14개 키워드 템플릿) + 복합 취약점 탐지. fallback: 소스코드 키워드 스캔 | `services/clients/mock/static_analyzer.py` |
| dynamic_analysis | CAN 로그 파싱 기반 패턴 매칭 (DoS, 비인가 ID, 리플레이, Bus-Off) | `services/clients/mock/dynamic_analyzer.py` |
| dynamic_testing | ruleResults 기반 심층 분석 (crash/anomaly/timeout 분류별 템플릿) | `services/clients/mock/testing_analyzer.py` |

---

## 5. 수정 이력

### v0 리팩토링: 807줄 llm_client.py 분리 (2026-03-10, 완료)

모놀리식 `llm_client.py` (807줄, 전체 코드의 69%)를 14개 파일로 분리:
- `app/models/` — 도메인 모델 (Severity StrEnum, VulnerabilityData, AnalysisResult)
- `app/data/` — DAO 역할의 템플릿 데이터 저장소 (static/dynamic/testing)
- `app/services/clients/` — LlmClient ABC, RealLlmClient, Factory
- `app/services/clients/mock/` — 3개 분석기를 모듈 함수로 분리 + MockLlmClient 디스패치
- v0 API 계약(POST /api/llm/analyze, GET /health) 완전 보존, 신규 의존성 없음

### INFO 심각도 추가 (2026-03-10, 완료, S2 작업요청)

프롬프트는 `severity: info`를 허용하지만, `Severity` enum에 INFO가 없어 `response_parser.py`가 `"medium"`으로 강등시키던 버그 수정.
- `severity.py`에 `INFO = "info"` 추가
- `VALID_SEVERITIES = set(Severity)`이므로 자동 반영

### 정적 분석 프롬프트: 개별 파일 분석 지시 추가 (2026-03-10, 완료, S2 작업요청)

S2 chunker가 여러 파일을 `// === filename.c ===` 구분자로 묶어 전송하므로, LLM이 파일별로 개별 분석하도록 프롬프트 강화.
- `templates/static_analysis.py` 분석 원칙 4번 항목 추가
- 출력 형식의 location 설명에 파일명 명시 필수 강조

### Mock 키워드 검색 범위 + 룰 중복 탐지 (수정 완료)

- `_extract_source_section()` — 프롬프트에서 `[분석 대상]`~`[출력 형식]` 구간만 추출
- `_extract_detected_keywords()` — 룰 결과에서 이미 탐지된 키워드 수집, 중복 skip
- `_find_line_in_source()` — 소스코드 영역에서만 검색 + 파일명:라인 형식 반환

### 프롬프트 고도화 (완료)

3개 모듈 시스템 프롬프트를 역할 정의 + 전문 분야 + 준거 기준 + 분석 원칙 + 출력 규칙으로 확장.

**주의**: Mock의 `generate()` 분기 조건이 시스템 프롬프트 키워드에 의존 (`services/clients/mock/__init__.py`):
- `"소스코드"` → `analyze_static()` / `"CAN"` → `analyze_dynamic()` / `"침투"` → `analyze_testing()`
- 시스템 프롬프트 수정 시 이 키워드를 반드시 유지할 것

### Observability 규약 적용 (2026-03-12, 완료, S2 작업요청)

MSA 공통 규약(`docs/specs/observability.md`)에 따라 에러 핸들링 + 로깅 전면 개편:

**에러 핸들링 — HTTP 200 일원화 문제 해결:**
- `app/errors.py` 신규: `S3Error` 계층 (`LlmTimeoutError`, `LlmUnavailableError`, `LlmHttpError`)
- `real.py`: httpx 예외를 S3 커스텀 예외로 분류 (timeout/connect/http/parse)
- `analyze.py`: 예외 유형별 HTTP 상태코드 반환 (400/500/502/504)
- `response.py`: `ErrorDetail` 모델 추가 (code, message, requestId, retryable)
- 내부 오류 시 `str(e)` 대신 고정 메시지 반환 (정보 노출 차단)

**에러 코드 매핑:**
| 상황 | HTTP | errorDetail.code | retryable |
|------|------|-----------------|-----------|
| 입력 오류 | 400 | INVALID_INPUT | N |
| LLM 타임아웃 | 504 | LLM_TIMEOUT | Y |
| LLM 연결 불가 | 502 | LLM_UNAVAILABLE | Y |
| LLM HTTP 오류 | 502 | LLM_HTTP_ERROR | N |
| LLM 응답 파싱 실패 | 502 | LLM_PARSE_ERROR | Y |
| S3 내부 오류 | 500 | INTERNAL_ERROR | N |

**JSON structured logging:**
- `python-json-logger` 도입, stdout + JSONL 파일 dual output
- 포맷: `{ level, time, service, requestId, msg }`
- `app/context.py` 신규: contextvars 기반 requestId 전파
- 프롬프트/LLM 응답 전문: INFO → DEBUG로 변경 (운영 로그 경량화)

**X-Request-Id 전파:**
- S2 요청 헤더에서 `X-Request-Id` 수신 → 로그 포함 → 응답 헤더 에코

### 입력 검증 강화 (2026-03-12, 완료)

- `maxTokens`: `Field(2048, ge=1, le=8192)` — 음수/과대값 차단
- `temperature`: `Field(0.7, ge=0.0, le=2.0)` — 범위 제한

### v1 Phase 1: Task API 뼈대 (2026-03-12, 완료)

v0 코드를 일절 수정하지 않고 `app/v1/` 패키지를 병렬로 추가. `main.py`에 v1 라우터 등록만 추가 (2줄).

**v1 엔드포인트:**
- `POST /v1/tasks` — Task 기반 AI 분석 요청 (5개 taskType)
- `GET /v1/health` — 서비스 상태 + modelProfiles + activePromptVersions
- `GET /v1/models` — 등록된 model profile 목록
- `GET /v1/prompts` — 등록된 prompt template 목록

**v1 파이프라인 흐름:**
```
TaskRequest 수신 → PromptRegistry에서 prompt 조회
→ ModelProfileRegistry에서 profile 조회
→ V1PromptBuilder로 3계층 프롬프트 조립 (trusted/semi-trusted/untrusted 분리)
→ LLM 호출 (mock: V1MockDispatcher / real: RealLlmClient 재사용)
→ V1ResponseParser로 Assessment JSON 파싱
→ SchemaValidator로 구조 검증
→ EvidenceValidator로 refId hallucination 감지
→ ConfidenceCalculator로 신뢰도 산출 (S3 자체 계산, LLM self-score 미사용)
→ TaskSuccessResponse 또는 TaskFailureResponse 반환
```

**Confidence 산출 (S3 자체):**
```
confidence = 0.45×grounding + 0.30×deterministicSupport + 0.15×consistency + 0.10×schemaCompliance
```
- consistency는 Phase 1에서 1.0 고정 (dual-run 미구현)

**v1 Mock 전략:**
- `V1MockDispatcher`가 taskType enum으로 분기 (v0의 한국어 키워드 디스패치와 독립)
- 각 task type별 Assessment JSON 직접 생성

**v0/v1 공존:**
- v0 (`POST /api/llm/analyze`, `GET /health`)와 v1 엔드포인트가 동일 FastAPI 앱에서 병렬 운영
- v0 코드 일절 미수정 — S2 마이그레이션 완료까지 유지

---

## 6. 구현 로드맵 (v1)

### 1단계: Task API 뼈대 — ✅ 완료

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry 구조 (5개 task type 등록)
- model profile registry 구조 (Settings 기반 자동 등록)
- schema validation + evidence validation 프레임워크
- confidence calculator (4항목 가중합)
- v1 전용 mock dispatcher

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
| API 명세서 | `docs/api/llm-gateway-api.md` | S2 연동 계약서 (v0 + v1 스키마) |
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
curl http://localhost:8000/health
# {"service":"smartcar-llm-gateway","status":"ok","version":"0.1.0","llmStatus":"mock"}
```

**주의**: WSL2 환경이다. `.venv`가 이미 만들어져 있고 의존성도 설치되어 있다.

---

## 9. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| S3 기능 명세 | `docs/specs/llm-gateway.md` | S3의 아키텍처와 원칙 (필독) |
| S2 백엔드 명세 | `docs/specs/backend.md` | S2가 S3를 어떻게 쓰는지 이해 |
| 공유 모델 | `docs/api/shared-models.md` | S2-S3 간 데이터 구조 |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | v0/v1 API 계약서 |
| 외부 피드백 (일반) | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 비전의 원본 |
| 외부 피드백 (Agentic) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 |
