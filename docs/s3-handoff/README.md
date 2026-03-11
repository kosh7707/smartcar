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

## 4. 현재 구현 상태 (v0)

### 파일 구조

```
services/llm-gateway/
├── .venv/                        # Python 가상환경
├── requirements.txt              # fastapi, uvicorn, pydantic, pydantic-settings, httpx
├── README.md                     # 실행법, 환경변수, 내부 구조
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI 앱 진입점, CORS, lifespan 로깅
│   ├── config.py                 # pydantic-settings 환경변수 → Settings 객체
│   ├── models/                   # 도메인 모델
│   │   ├── __init__.py
│   │   ├── severity.py           # Severity StrEnum (critical/high/medium/low/info)
│   │   ├── vulnerability.py      # VulnerabilityData dataclass
│   │   └── analysis.py           # AnalysisResult dataclass (→ JSON 직렬화)
│   ├── schemas/                  # API DTO (v0 계약 유지)
│   │   ├── __init__.py
│   │   ├── request.py            # AnalyzeRequest, RuleResult (v0)
│   │   └── response.py           # AnalyzeResponse, VulnerabilityItem, HealthResponse (v0)
│   ├── data/                     # DAO — 템플릿 데이터 저장소
│   │   ├── __init__.py
│   │   ├── static_templates.py   # DEEP_ANALYSIS_TEMPLATES, COMPOUND_PATTERNS, KEYWORD_SEARCH
│   │   ├── dynamic_templates.py  # CAN 분석 상수 (KNOWN_CAN_RANGES, DIAG_ID 등)
│   │   └── testing_templates.py  # TESTING_ANALYSIS_TEMPLATES (crash/anomaly/timeout)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── analyze.py            # POST /api/llm/analyze (v0)
│   │   └── health.py             # GET /health (v0)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── clients/              # LLM 클라이언트 패키지
│   │   │   ├── __init__.py       # re-export: LlmClient, create_llm_client
│   │   │   ├── base.py           # LlmClient ABC
│   │   │   ├── real.py           # RealLlmClient (httpx → S4)
│   │   │   ├── factory.py        # create_llm_client() 팩토리
│   │   │   └── mock/
│   │   │       ├── __init__.py   # MockLlmClient — generate() 디스패치
│   │   │       ├── static_analyzer.py   # analyze_static() + 헬퍼
│   │   │       ├── dynamic_analyzer.py  # analyze_dynamic() + 헬퍼
│   │   │       └── testing_analyzer.py  # analyze_testing() + 헬퍼
│   │   ├── prompt_builder.py     # 모듈별 프롬프트 조립
│   │   └── response_parser.py    # LLM 응답 JSON → VulnerabilityItem 변환
│   └── templates/
│       ├── __init__.py
│       ├── static_analysis.py    # 정적 분석 프롬프트 (CWE/CERT C/MISRA C/AUTOSAR/ISO 21434)
│       ├── dynamic_analysis.py   # 동적 분석 프롬프트 (ISO 11898/14229/SecOC)
│       └── dynamic_testing.py    # 동적 테스트 프롬프트 (ISO 14229 NRC/15765/WP.29)
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

---

## 6. 구현 로드맵 (v1)

### 1단계: Task API 뼈대

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry 구조
- model profile registry 구조
- schema validation 프레임워크

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
| 외부 피드백 | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 방향의 원본 근거 |

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
| 외부 피드백 | `docs/외부피드백/S3_llm_gateway_working_guide.md` | 아키텍처 비전의 원본 |
