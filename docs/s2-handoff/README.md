# S2. Core Service (Backend) 개발자 인수인계서

> 이 문서는 S2(Core Service/Backend) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.

---

## 1. 프로젝트 전체 그림

### 과제

"가상환경 기반 자동차 전장부품 사이버보안 수준 검증 기술 및 플랫폼 개발" — 부산대학교가 컨소시엄 참여기관으로, 생성형 AI 기반 지능형 사이버보안 공격/검증 프레임워크를 개발한다.

### 서비스 아키텍처

```
[ECU Simulator] ←—WS—→ [Adapter] ←—WS—→ [Backend (S2)] ←—WS—→ [Frontend (S1)]
  CAN 전용              프로토콜 변환       분석 로직             UI
  :standalone           :4000              :3000               :5173 (dev)
                                               ↓
                                        [LLM Gateway (S3)] ←→ [LLM Engine (S4)]
                                           :8000                DGX Spark
```

- **ECU Simulator** (`services/ecu-simulator/`): CAN 트래픽 생성 + 주입 응답. 독립 프로세스
- **Adapter** (`services/adapter/`): ECU ↔ S2 프레임 중계. 추후 실 ECU 연결 시 이것만 교체
- **S1 (Frontend)**: 사용자 인터페이스. Electron + React + TypeScript
- **S2 (Backend)**: 비즈니스 로직, DB, API. Express.js + TypeScript + SQLite ← **너의 담당 (Backend, Adapter, ECU Simulator, 쉘 스크립트 모두 포함)**
- **S3 (LLM Gateway)**: LLM 호출 전담, 프롬프트 관리. Python + FastAPI
- **S4 (LLM Engine)**: Qwen 14B on DGX Spark. 아직 없음. 추후 연동 예정

통신 방향: `ECU Sim → Adapter → S2 → S3 → S4`, `S2 → S1`

### 2계층 보안 검증 구조

- **1계층**: S2의 룰 엔진이 패턴 매칭으로 빠른 탐지 (정규식 + 함수명 매칭)
- **2계층**: S3가 1계층 결과 + 원본 데이터를 받아 LLM 심층 분석
- 적용 대상: 정적 분석, 동적 분석, 동적 테스트 (퍼징/침투)

### 개발 전략

**"진짜 자동차 보안 검증 플랫폼"**

2026-03 기점으로 연차보고서용 프로토타입에서 실제 제품 개발로 전환했다. 외부 아키텍처 리뷰(`docs/외부피드백/S2_backend_adapter_simulator_working_guide.md`)를 기반으로, 기존 파이프라인 위에 **Evidence → Findings → Quality Gate → Policy → Approval** 구조를 점진적으로 적층한다.

핵심 원칙:
- 재작성이 아닌 **정규화 레이어 적층** — 기존 파이프라인은 유지, canonical control plane을 위에 얹는다
- S2의 최우선 목표는 "분석을 수행하는 것"이 아니라 **결과를 추적 가능하고 관리 가능한 구조로 만드는 것**
- S2 API가 선행되고, S1(프론트)이 따라간다

S4(실 LLM)는 아직 없다. S3가 Mock 응답을 반환하지만, 인터페이스와 파이프라인은 실제와 동일하게 구현한다.

---

## 2. 너의 역할과 경계

### 너는

- S2 Core Service 개발자 + 인프라 스크립트 담당
- `services/backend/` 하위 코드를 소유
- `services/adapter/` Adapter 서비스 코드를 소유
- `services/ecu-simulator/` ECU Simulator 코드를 소유
- `scripts/` 전체 서비스 관리 쉘 스크립트를 소유
- `services/shared/` 공유 타입 패키지를 **단독 소유** (S1은 수정 권한 없음)
- `docs/specs/backend.md`, `docs/specs/adapter.md`, `docs/specs/ecu-simulator.md` 명세서를 작성/관리
- `docs/api/shared-models.md` 공유 모델 명세를 **단독 관리**
- S1(프론트)에게 API를 제공하고, S3(LLM Gateway)를 호출하는 중간 허브

### 다른 서비스 코드

- S1(프론트), S3(LLM Gateway) 코드는 기본적으로 수정하지 않음
- 사용자가 풀스택 역할을 지정한 경우에만 직접 수정 가능
- 그 외에는 문제점 + 수정방안만 전달
- `services/shared/` 디렉토리는 **S2가 단독 관리**. S1에게 변경 사항을 work-request로 통보

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md` (예: `s1-to-s2-settings-ui.md`)
- S1이나 S3에게 요청할 일이 있으면 이 폴더에 문서를 작성한다
- 반대로 S1/S3가 너에게 요청한 문서도 여기에 있다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크한다

---

## 3. 구현 현황

### 파일 구조

```
services/backend/
├── package.json                    # @smartcar/backend, Express 5, better-sqlite3, multer, ws, pino
├── tsconfig.json
├── smartcar.db                     # SQLite DB 파일 (자동 생성)
└── src/
    ├── index.ts                    # 앱 진입점 (Express 초기화, DI, 미들웨어, 라우터 마운트, WS attach)
    ├── db.ts                       # SQLite 초기화, 테이블 14개 생성, 마이그레이션
    ├── lib/
    │   ├── logger.ts              # pino 루트 로거 + createLogger(component)
    │   ├── errors.ts              # AppError 계층 (10개 에러 클래스)
    │   ├── vulnerability-utils.ts # SEVERITY_ORDER, computeSummary, sortBySeverity (3개 서비스 공용)
    │   └── index.ts               # barrel export
    ├── middleware/
    │   ├── async-handler.ts            # asyncHandler — async 핸들러 에러를 next()로 전파
    │   ├── request-id.middleware.ts     # X-Request-Id 생성/전파
    │   ├── request-logger.middleware.ts # 요청 시작/완료 로깅
    │   └── error-handler.middleware.ts  # 글로벌 에러 핸들러 (AppError → statusCode/code)
    ├── types/
    │   └── express.d.ts           # Express Request에 requestId 타입 확장
    ├── controllers/
    │   ├── health.controller.ts    # GET /health (어댑터 연결 현황 포함)
    │   ├── static-analysis.controller.ts  # 파일 업로드 + 분석 실행/조회/목록/삭제/보고서
    │   ├── dynamic-analysis.controller.ts # 동적 분석 REST API 9개 (세션 5 + 주입 4)
    │   ├── project.controller.ts   # 프로젝트 CRUD + Overview
    │   ├── file.controller.ts      # 프로젝트 파일 목록/다운로드/삭제/내용 조회
    │   ├── project-rules.controller.ts    # 프로젝트 스코프 룰 CRUD (/api/projects/:pid/rules)
    │   ├── project-adapters.controller.ts # 프로젝트 스코프 어댑터 CRUD+연결 (/api/projects/:pid/adapters)
    │   ├── project-settings.controller.ts # 프로젝트 설정 GET/PUT (/api/projects/:pid/settings)
    │   ├── dynamic-test.controller.ts # 동적 테스트 API 4개 (run, results, detail, delete)
    │   ├── run.controller.ts        # Run 목록/상세 API
    │   └── finding.controller.ts    # Finding 목록/상세/상태변경/집계 API
    ├── services/
    │   ├── static-analysis.service.ts  # 정적 분석 오케스트레이션 (청크→룰→LLM→병합 + WS 프로그레스)
    │   ├── chunker.ts              # 파일 청크 분할 (토큰 추정, greedy bin-packing)
    │   ├── attack-scenarios.ts          # 사전정의 공격 시나리오 6개 (CAN 주입용)
    │   ├── dynamic-analysis.service.ts # 동적 분석 오케스트레이터 (세션+메시지+룰+LLM+CAN 주입)
    │   ├── ws-manager.ts           # WebSocket 서버 3개 관리 (dynamic-analysis + static-analysis + dynamic-test)
    │   ├── adapter-client.ts      # Adapter WS 클라이언트 (IEcuAdapter 구현 + CAN 프레임 수신)
    │   ├── adapter-manager.ts     # 프로젝트별 어댑터 관리 (CRUD + 연결/해제 + CAN 프레임 라우팅 + 소속 검증)
    │   ├── dynamic-test.service.ts # 동적 테스트 오케스트레이터 (입력생성→Adapter→평가→LLM→결과저장)
    │   ├── mock-ecu.ts             # Mock ECU (IEcuAdapter 인터페이스, fallback + 단위 테스트용)
    │   ├── input-generator.ts      # 3전략 입력 생성기 (random/boundary/scenario)
    │   ├── project.service.ts      # 프로젝트 CRUD + Overview 집계 + cascade 삭제 (룰/어댑터/설정)
    │   ├── project-settings.service.ts # 프로젝트 설정 KV (typed, defaults fallback)
    │   ├── rule.service.ts         # 프로젝트별 룰 CRUD, 기본 룰 시딩, per-analysis RuleEngine 빌드
    │   ├── llm-client.ts          # S3 LLM Gateway HTTP 클라이언트 (per-project baseUrl 지원)
    │   ├── result-normalizer.ts   # AnalysisResult → Run+Finding+EvidenceRef 정규화 (멱등, 원자적)
    │   ├── finding.service.ts     # Finding CRUD + 7-state 라이프사이클 + audit trail
    │   └── run.service.ts         # Run 읽기 전용 서비스
    ├── dao/
    │   ├── file-store.ts          # uploaded_files 테이블
    │   ├── analysis-result.dao.ts # analysis_results 테이블
    │   ├── project.dao.ts         # projects 테이블
    │   ├── rule.dao.ts            # rules 테이블
    │   ├── adapter.dao.ts         # adapters 테이블 (멀티 어댑터 CRUD)
    │   ├── dynamic-session.dao.ts # dynamic_analysis_sessions 테이블
    │   ├── dynamic-alert.dao.ts   # dynamic_analysis_alerts 테이블
    │   ├── dynamic-message.dao.ts # dynamic_analysis_messages 테이블
    │   ├── dynamic-test-result.dao.ts # dynamic_test_results 테이블
    │   ├── project-settings.dao.ts  # project_settings KV 테이블
    │   ├── run.dao.ts              # runs 테이블
    │   ├── finding.dao.ts          # findings 테이블 (필터, 집계)
    │   ├── evidence-ref.dao.ts     # evidence_refs 테이블
    │   └── audit-log.dao.ts        # audit_log 테이블
    ├── rules/                      # 정적 분석 룰
    │   ├── types.ts               # AnalysisRule 인터페이스, RuleMatch 타입
    │   ├── rule-engine.ts         # 룰 등록/실행 엔진 (per-analysis 빌드)
    │   ├── custom-rule.ts         # 정규식 기반 룰 클래스 (모든 룰이 이것 사용)
    │   └── default-rule-templates.ts   # 기본 제공 룰 22개 템플릿 데이터 (프로젝트 생성 시 시딩용)
    └── can-rules/                  # 동적 분석 CAN 룰
        ├── types.ts               # CanAnalysisRule, CanRuleMatch 인터페이스
        ├── can-rule-engine.ts     # CAN 룰 등록/실행 엔진
        ├── frequency-rule.ts      # 슬라이딩 윈도우 빈도 탐지
        ├── unauthorized-id-rule.ts # 허용 목록 외 CAN ID 탐지
        └── attack-signature-rule.ts # 공격 시그니처 (진단 DoS, 리플레이, Bus-Off)
```

### 내부 아키텍처

```
Controller → Service → DAO → SQLite
                ↘ RuleService.buildRuleEngine(projectId) → RuleEngine (1계층: 정적 분석, per-analysis)
                ↘ Chunker (정적 분석 파일 청크 분할)
                ↘ CanRuleEngine (1계층: 동적 분석)
                ↘ LlmClient → S3 (2계층)
                ↘ WsManager (WebSocket push: 동적 분석 + 정적 분석 + 동적 테스트 프로그레스)
                ↘ AdapterManager → AdapterClient(N개) → Adapter(N대) (CAN 프레임 수신 + 주입 요청-응답)
                ↘ InputGenerator (동적 테스트 입력 생성)
                ↘ ProjectSettingsService (프로젝트별 설정 KV — llmUrl 등)
```

- **Controller**: 요청 수신, 입력 검증, 응답 반환. async 핸들러는 `asyncHandler()` 래퍼로 에러를 글로벌 핸들러에 전파
- **Service**: 비즈니스 로직, 오케스트레이션
- **DAO**: DB 접근 캡슐화 (better-sqlite3 prepared statements)
- **RuleService**: 프로젝트별 룰 CRUD + 기본 룰 시딩 + `buildRuleEngine(projectId)`로 per-analysis 엔진 빌드
- **RuleEngine**: 정적 분석 패턴 매칭 룰 실행. 글로벌 싱글톤이 아닌 분석 시마다 `RuleService.buildRuleEngine()`으로 생성
- **CanRuleEngine**: 동적 분석 CAN 룰 (빈도, 비인가 ID, 공격 시그니처)
- **WsManager**: WebSocket 서버 3개 관리 (dynamic-analysis push + static-analysis progress + dynamic-test progress)
- **AdapterManager**: 프로젝트별 어댑터 관리. CRUD + 연결/해제. CAN 프레임 수신 시 `adapterId`를 포함하여 세션에 라우팅. 소속 검증(projectId) 지원. ECU 메타데이터(`ecuMeta`) 런타임 노출
- **AdapterClient**: 개별 Adapter WS 클라이언트. `IEcuAdapter` 인터페이스 구현. `ecu-info` 메시지 수신 시 ECU 메타(name, canIds) 저장. AdapterManager가 내부적으로 관리
- **LlmClient**: S3 호출, 실패 시 graceful degradation (1계층 결과만 반환)

---

## 4. 데이터베이스

SQLite(`better-sqlite3`), WAL 모드. DB 파일: `services/backend/smartcar.db` (환경변수 `DB_PATH`로 변경 가능).

### 테이블 14개

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|----------|
| `projects` | 프로젝트 관리 | id, name, description, created_at, updated_at |
| `uploaded_files` | 업로드된 소스코드 | id, project_id, name, size, language, content |
| `analysis_results` | 분석 결과 | id, project_id, module, status, vulnerabilities(JSON), summary(JSON), warnings(JSON), analyzed_file_ids(JSON) |
| `rules` | 패턴 매칭 룰 | id, name, severity, pattern, enabled, project_id |
| `adapters` | 어댑터 등록 정보 | id, name, url, project_id, created_at |
| `project_settings` | 프로젝트 설정 KV | project_id, key, value, updated_at (PK: project_id+key) |
| `dynamic_analysis_sessions` | 동적 분석 세션 | id, project_id, status, source(JSON), message_count, alert_count, started_at, ended_at |
| `dynamic_analysis_alerts` | 이상 탐지 알림 | id, session_id, severity, title, description, llm_analysis, related_messages(JSON) |
| `dynamic_analysis_messages` | CAN 메시지 로그 | id(auto), session_id, timestamp, can_id, dlc, data, flagged, injected |
| `dynamic_test_results` | 동적 테스트 결과 | id, project_id, config(JSON), status, total_runs, crashes, anomalies, findings(JSON), created_at |
| `audit_log` | 감사 로그 | id, timestamp, actor, action, resource, resource_id, detail(JSON), request_id |
| `runs` | 코어 도메인 — Run | id, project_id, module, status, analysis_result_id, finding_count, started_at, ended_at |
| `findings` | 코어 도메인 — Finding | id, run_id, project_id, module, status, severity, confidence, source_type, title, description, location, suggestion, rule_id |
| `evidence_refs` | 코어 도메인 — EvidenceRef | id, finding_id, artifact_id, artifact_type, locator_type, locator(JSON) |

### 마이그레이션 주의사항

`db.ts`에서 `CREATE TABLE IF NOT EXISTS` → `ALTER TABLE ADD COLUMN` → `CREATE INDEX` 순서가 중요하다. 기존 DB에 컬럼이 없을 때 ALTER가 먼저 실행되어야 인덱스 생성이 성공한다. ALTER는 try/catch로 감싸서 이미 존재하면 무시.

### DB 클린 방법

서버를 **완전히 종료**한 뒤 `rm smartcar.db` → 서버 재시작. hot-reload 중에 DB 파일만 삭제하면 0바이트 파일이 되어 테이블이 생성되지 않는다 (메모리 내 기존 연결이 남아있기 때문).

---

## 5. API 엔드포인트 전체 목록

### 완료

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 (S3 연결 + 어댑터 현황) |
| POST | `/api/static-analysis/upload` | 파일 업로드 (multipart, projectId) |
| POST | `/api/static-analysis/run` | 정적 분석 실행 (projectId + fileIds) |
| GET | `/api/static-analysis/results?projectId=` | 프로젝트별 분석 결과 목록 |
| GET | `/api/static-analysis/results/:id` | 분석 결과 조회 |
| DELETE | `/api/static-analysis/results/:id` | 분석 결과 삭제 |
| GET | `/api/static-analysis/report/:id` | 보고서 데이터 |
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects` | 프로젝트 목록 |
| GET | `/api/projects/:id` | 프로젝트 상세 |
| PUT | `/api/projects/:id` | 프로젝트 수정 |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 |
| GET | `/api/projects/:id/overview` | Overview (모듈별 최신 1건 집계, fileCount) |
| GET | `/api/projects/:projectId/files` | 프로젝트 파일 목록 |
| GET | `/api/files/:fileId/content` | 파일 내용 조회 (JSON) |
| GET | `/api/files/:fileId/download` | 파일 다운로드 (text/plain) |
| DELETE | `/api/projects/:projectId/files/:fileId` | 파일 삭제 |
| GET | `/api/projects/:pid/rules` | 프로젝트 룰 목록 |
| POST | `/api/projects/:pid/rules` | 룰 생성 (name + pattern 필수) |
| PUT | `/api/projects/:pid/rules/:id` | 룰 수정 (소속 검증) |
| DELETE | `/api/projects/:pid/rules/:id` | 룰 삭제 (소속 검증) |
| GET | `/api/projects/:pid/adapters` | 프로젝트 어댑터 목록 (연결 상태 포함) |
| POST | `/api/projects/:pid/adapters` | 어댑터 등록 (name + url) |
| PUT | `/api/projects/:pid/adapters/:id` | 어댑터 수정 (소속 검증) |
| DELETE | `/api/projects/:pid/adapters/:id` | 어댑터 삭제 (소속 검증) |
| POST | `/api/projects/:pid/adapters/:id/connect` | 어댑터 연결 (소속 검증) |
| POST | `/api/projects/:pid/adapters/:id/disconnect` | 어댑터 해제 (소속 검증) |
| POST | `/api/dynamic-analysis/sessions` | 동적 분석 세션 생성 (projectId + adapterId 필수) |
| GET | `/api/dynamic-analysis/sessions` | 동적 분석 세션 목록 (?projectId=) |
| GET | `/api/dynamic-analysis/sessions/:id` | 세션 상세 (alerts + recentMessages) |
| POST | `/api/dynamic-analysis/sessions/:id/start` | 모니터링 시작 |
| DELETE | `/api/dynamic-analysis/sessions/:id` | 세션 종료 + LLM 종합 분석 |
| GET | `/api/dynamic-analysis/scenarios` | 사전정의 공격 시나리오 목록 (6개) |
| POST | `/api/dynamic-analysis/sessions/:id/inject` | CAN 메시지 단일 주입 |
| POST | `/api/dynamic-analysis/sessions/:id/inject-scenario` | 사전정의 시나리오 실행 |
| GET | `/api/dynamic-analysis/sessions/:id/injections` | 주입 이력 조회 |
| WebSocket | `/ws/dynamic-analysis?sessionId=` | S1 실시간 push (메시지/알림/상태/주입결과) |
| WebSocket | `/ws/static-analysis?analysisId=` | 정적 분석 프로그레스 push (progress/warning/complete) |
| POST | `/api/dynamic-test/run` | 동적 테스트 실행 (projectId + config + adapterId 필수) |
| GET | `/api/dynamic-test/results?projectId=` | 프로젝트별 테스트 결과 목록 |
| GET | `/api/dynamic-test/results/:testId` | 테스트 결과 상세 조회 |
| DELETE | `/api/dynamic-test/results/:testId` | 테스트 결과 삭제 |
| WebSocket | `/ws/dynamic-test?testId=` | 동적 테스트 프로그레스 push (progress/finding/complete) |
| GET | `/api/projects/:pid/settings` | 프로젝트 설정 조회 (defaults fallback) |
| PUT | `/api/projects/:pid/settings` | 프로젝트 설정 수정 (partial update) |
| GET | `/api/projects/:pid/runs` | 프로젝트 Run 목록 |
| GET | `/api/runs/:id` | Run 상세 (findings 포함) |
| GET | `/api/projects/:pid/findings` | Finding 목록 (?status=&severity=&module=) |
| GET | `/api/projects/:pid/findings/summary` | Finding 집계 (byStatus, bySeverity, total) |
| GET | `/api/findings/:id` | Finding 상세 (evidenceRefs + auditLog) |
| PATCH | `/api/findings/:id/status` | Finding 상태 변경 ({ status, reason, actor? }) |

### 미구현

| 메서드 | 경로 | 우선순위 |
|--------|------|---------|
| POST | `/api/auth/*` | P2 |

---

## 6. 핵심 로직 상세

### 정적 분석 파이프라인 (`StaticAnalysisService.runAnalysis`)

```
요청 (projectId + fileIds + analysisId?)
  → fileStore에서 파일 내용 조회
  → [1계층] RuleService.buildRuleEngine(projectId) → ruleEngine.runAll() — 프로젝트 enabled 룰만 실행, RuleMatch[] 반환
  → 파일 청크 분할 (chunker.ts) — 6000토큰 예산, greedy bin-packing
  → [2계층] 청크별 LLM 분석 (순차)
      각 청크마다 LlmClient.analyze() 호출
      성공 → llmVulns 수집
      실패 → warnings에 LLM_CHUNK_FAILED 추가
      WS progress push (phase: llm_chunk, i/N)
  → mergeAndSort() — 같은 location 중복 제거 (룰 우선), 심각도순 정렬
  → computeSummary() — 심각도별 카운트
  → AnalysisResultDAO.save() — DB 저장 (warnings 포함)
  → WS complete 이벤트
  → AnalysisResult 반환 (warnings 포함)
```

**청크 분할 (`chunker.ts`)**: 토큰 추정 `chars / 3.5`, 청크 예산 6000토큰(~21000chars), 단독 초과 파일은 `CHUNK_TOO_LARGE` warning.

**WS 프로그레스**: `/ws/static-analysis?analysisId=xxx` 경로로 연결. 동적 분석과 동일한 패턴 (session→analysisId). WS 미연결 시 기존과 동일하게 동작.

**Warnings**: `AnalysisResult.warnings?: AnalysisWarning[]` — LLM 실패 시에도 룰 결과는 항상 반환.

### 룰 엔진 구조

**프로젝트 스코프 룰 시스템** — 빌트인/커스텀 구분 없이 모든 룰이 프로젝트에 소속된다.

```
RuleService
  ├── seedDefaultRules(projectId)       # 프로젝트 생성 시 22개 기본 룰 시딩 (결정적 ID, 중복 방지)
  ├── buildRuleEngine(projectId)        # 프로젝트의 enabled 룰로 RuleEngine 빌드 (per-analysis)
  ├── findByProjectId(projectId)        # 프로젝트 룰 목록
  ├── create(projectId, fields)         # 룰 생성
  ├── update(id, fields)               # 룰 수정 (모든 필드)
  ├── delete(id)                        # 룰 삭제 (모든 룰 삭제 가능)
  └── deleteByProjectId(projectId)      # cascade 삭제

RuleEngine (per-analysis 인스턴스)
  ├── registerRule(rule: AnalysisRule)
  └── runAll(source, filename)          # 모든 활성 룰 실행 → RuleMatch[]
```

- **기본 제공 룰** (22개): 프로젝트 생성 시 `DEFAULT_RULE_TEMPLATES`에서 시딩. DB에 저장되며 사용자가 수정/삭제 가능.
  - 위험 함수 (9개): gets, strcpy, strcat, sprintf, scanf, system, memcpy, alloca, popen
  - 정규식 패턴 (8개): printf format string, atoi, rand, 하드코딩 시크릿, 고정 srand, VLA, deprecated 암호, 인증 없는 CAN 전송
  - 메모리 안전 (5개): UAF 힌트, 안전하지 않은 realloc, 미검사 malloc/calloc, double-free 힌트, 정수 오버플로우
- **모든 룰**은 `CustomRule` 클래스로 실행 (라인별 정규식 매칭). 패턴은 `RegExp.source` 형태로 DB에 저장.
- **per-analysis 빌드**: 분석 실행 시 `RuleService.buildRuleEngine(projectId)`로 해당 프로젝트의 enabled 룰만 포함한 RuleEngine을 생성. 글로벌 싱글톤 RuleEngine은 더 이상 없음.

### Overview 집계 로직 (`ProjectService.getOverview`)

- 모듈별(static_analysis, dynamic_analysis, dynamic_testing) **최신 완료 분석 1건**만 사용
- 재분석해도 이전 결과와 합산되지 않음 (중복 방지)
- `fileCount`: 프로젝트에 업로드된 파일 수
- `recentAnalyses`: 최근 10건

### 동적 분석 파이프라인 (`DynamicAnalysisService`)

```
세션 생성 (POST /sessions, body: { projectId, adapterId })
  → status: "connected", source: { type: "adapter", adapterId, adapterName }
  → 모니터링 시작 (POST /sessions/:id/start) → status: "monitoring"
    → AdapterManager.setCanFrameHandler()로 CAN 프레임 수신 (adapterId 태깅)
    → ECU Simulator → Adapter → AdapterClient → AdapterManager → 해당 어댑터의 세션에만 라우팅
  → CAN 메시지 수신
    → [1계층] CanRuleEngine.evaluateMessage() — 3개 CAN 룰 실시간 평가
    → DB 저장 (messages + alerts)
    → WS push → S1 (메시지 + 알림 + 상태)
    → [2계층] alert 3건 누적 시 LlmClient.analyze() — 컨텍스트 분석
  → 세션 종료 (DELETE /sessions/:id) → status: "stopped"
    → 전체 로그 LLM 종합 분석 → analysis_results 저장
    → Overview 자동 집계 호환 (module="dynamic_analysis")
```

**LLM 호출 문턱값** (`dynamic-analysis.service.ts` 상수):

| 상수 | 값 | 설명 |
|------|---|------|
| `RECENT_BUFFER_SIZE` | 100 | 인메모리 circular buffer 크기 (룰 컨텍스트용) |
| `ALERT_LLM_THRESHOLD` | 3 | alert N건 누적 시 컨텍스트 LLM 호출 트리거 |
| `CONTEXT_WINDOW` | 20 | 컨텍스트 LLM 호출 시 전후 메시지 수 (실제 전송: CONTEXT_WINDOW * 2 = 40건) |

**LLM 호출 시점 2가지**:
- **트리거 A (alert 누적)**: `alertsSinceLastLlm >= 3` 도달 시 → 최근 40건 메시지 + 최근 3건 alert를 S3에 전달 → `alert.llmAnalysis` 업데이트 + WS push. 호출 후 카운터 리셋.
- **트리거 B (세션 종료)**: DB에서 전체 메시지 + 전체 alerts 조회 → S3에 전달 → `analysis_results` 테이블에 저장 (module="dynamic_analysis")

**CAN 주입 (분석가 주도)**:
- `injectMessage(sessionId, req)`: monitoring 상태 검증 → AdapterClient.sendAndReceive() → ECU 응답 수신 → 주입 메시지를 handleCanMessage()에 `injected: true`로 투입 (룰 엔진 평가 + WS push) → 응답 분류(classifyResponse) → WS injection-result → 이력 기록
- `injectScenario(sessionId, scenarioId)`: 사전정의 시나리오(6개)의 steps를 순차 injectMessage() 호출
- 주입 이력은 ActiveSession.injectionHistory에 인메모리 보관 (세션 종료 시 소멸)
- 세션 종료 시 LLM 분석 canLog에 주입 메시지 `[INJ]` 접두사로 포함

**주의사항**:
- CAN 메시지는 circular buffer(100건)로 인메모리 유지 (룰 컨텍스트), 전체는 DB에 저장
- alert 누적 LLM 호출은 비동기 (`.catch(() => {})` — 실패해도 세션 계속)
- CAN 데이터는 AdapterManager → AdapterClient를 통해 수신. ECU Simulator → Adapter → AdapterClient → AdapterManager → 세션
- 각 AdapterClient는 자동 재연결 지원 (3초 간격)
- 프로젝트별 어댑터: 어댑터는 프로젝트에 소속. 세션 생성 시 `adapterId`의 `projectId` 소속 검증 (불일치 시 400 에러)
- 어댑터 미연결 시 세션 생성 불가 (400 에러)

### 동적 테스트 파이프라인 (`DynamicTestService`)

동적 분석(수동 관찰)과 달리 ECU에 **능동적으로 패킷을 주입**하고 반응을 관찰한다.

```
테스트 요청 (POST /api/dynamic-test/run, body: { projectId, config, adapterId })
  → InputGenerator.generate(config) — 3전략 입력 생성
      random: count개 무작위 CAN 프레임 (count 필수, 1~1000)
      boundary: 경계값 고정 12개 (count 무시)
      scenario: 공격 시나리오 고정 20개 (count 무시)
  → AdapterManager.getClient(adapterId) → AdapterClient (IEcuAdapter) — inject-request → Adapter → ECU Sim → inject-response
  → 각 입력 순차 실행:
      ecuAdapter.sendAndReceive(input) → 응답 분류
      Finding 생성 시 → WS test-finding push
      WS test-progress push (current/total/crashes/anomalies)
  → [2계층] findings가 있으면 LlmClient.analyze() — module: "dynamic_testing"
      LLM 결과를 각 finding.llmAnalysis에 매핑
  → DynamicTestResult DB 저장 + AnalysisResult 이중 저장 (Overview 호환)
  → WS test-complete
```

**Mock ECU 시나리오**: 0xFF→crash, 0x7DF→reset, 0x00→malformed, 반복3회→anomaly, 경계값→timeout(2000ms), 그 외→정상. 기본 지연 10~50ms.

**동시 실행 방지**: `runningTests: Set<string>` — 같은 projectId로 동시 실행 불가 (409 Conflict).

**Overview 호환**: 테스트 결과를 `analysis_results` 테이블에 `module="dynamic_testing"`으로도 저장. `ProjectService.getOverview()`에서 자동 집계.

### S3 통신 (`LlmClient`)

```typescript
POST http://localhost:8000/api/llm/analyze
Body: {
  module: "static_analysis",
  sourceCode: "// === filename.c ===\n...",
  ruleResults: [{ ruleId, title, severity, location }]
}
Response: { success, vulnerabilities: [{ severity, title, description, location, suggestion, fixCode }] }
```

- S3 URL: 프로젝트 설정 `llmUrl` 우선, 없으면 환경변수 `LLM_GATEWAY_URL` (기본값: `http://localhost:8000`)
- S3 연결 실패 시 `{ success: false, vulnerabilities: [] }` 반환 → 1계층 결과만으로 응답 (graceful degradation)
- **필드명은 camelCase** (`sourceCode`, `ruleResults` 등)

### 한글 파일명 처리

multer가 multipart 헤더의 filename을 latin1(ISO-8859-1)로 해석한다. `static-analysis.controller.ts`에서 `Buffer.from(file.originalname, "latin1").toString("utf-8")`로 UTF-8 복원 후 사용.

---

## 7. 의존성

```json
{
  "@smartcar/shared": "*",         // 공유 Model/DTO 타입 (monorepo workspace)
  "better-sqlite3": "^12.6.2",    // SQLite 드라이버
  "express": "^5.2.1",            // HTTP 프레임워크 (v5)
  "cors": "^2.8.6",               // CORS 미들웨어
  "multer": "^2.1.1",             // multipart 파일 업로드
  "ws": "^8.x",                   // WebSocket 서버 (동적 분석 실시간 통신)
  "tsx": "^4.21.0"                // TypeScript 실행/hot-reload (dev)
}
```

**주의**: Express 5를 사용 중이다 (v4가 아님).

---

## 8. 실행 방법

> **⚠ 서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

```bash
# 전체 기동 (권장)
./scripts/start.sh

# 또는 개별 실행:
# 1. Adapter (포트 4000)
cd services/adapter && npx tsx watch src/index.ts --port=4000

# 2. ECU Simulator (Adapter에 연결)
cd services/ecu-simulator && npx tsx watch src/index.ts \
  --adapter=ws://localhost:4000/ws/ecu --scenario=mixed --loop

# 3. S2 Backend
cd services/backend && npx tsx watch src/index.ts

# 4. S1 Frontend
cd services/frontend && npm run dev

# 전체 종료
./scripts/stop.sh
```

**프로젝트별 어댑터 운영**: 어댑터는 프로젝트에 소속된다. S1 UI 또는 REST API(`POST /api/projects/:pid/adapters`)로 등록/연결한다.

확인:
```bash
curl http://localhost:3000/health
# {"service":"smartcar-core-service","status":"ok","version":"0.1.0","llmGateway":{...},"adapters":{"total":1,"connected":1}}

# 프로젝트 생성 → 기본 룰 22개 자동 시딩
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" -d '{"name":"Test"}'
# → { success: true, data: { id: "proj-xxx", ... } }

# 프로젝트 룰 확인
curl http://localhost:3000/api/projects/proj-xxx/rules
# → 22개 기본 룰

# 어댑터 등록 + 연결
curl -X POST http://localhost:3000/api/projects/proj-xxx/adapters \
  -H "Content-Type: application/json" \
  -d '{"name":"Local Adapter","url":"ws://localhost:4000"}'
# → { success: true, data: { id: "adp-xxx", ..., projectId: "proj-xxx", connected: false } }

curl -X POST http://localhost:3000/api/projects/proj-xxx/adapters/adp-xxx/connect
# → { success: true, data: { ..., connected: true, ecuConnected: true } }
```

**환경변수**:
- `LLM_GATEWAY_URL`: S3 주소 (기본값: `http://localhost:8000`)
- `PORT`: S2 포트 (기본값: `3000`)

**유틸 스크립트** (`scripts/backend/`):
- `reset-db.sh` — DB 삭제 (확인 프롬프트). 서버 정지 후 사용
- `db-stats.sh` — 테이블별 건수 + DB 크기 조회
- `backup-db.sh [이름]` — sqlite3 `.backup`으로 스냅샷 저장 (`scripts/backend/.backups/`)

**서비스 관리 스크립트** (`scripts/`) — **너의 담당**:
- `start.sh` — 전체 서비스 기동
  - 포트 헬스체크 (LISTEN 상태까지 최대 10초 대기, 프로세스 즉시 종료 감지)
  - 기동 실패 시 이미 띄운 서비스 자동 롤백 (역순 종료)
  - 색상 출력 + 소요시간 표시 + 서머리 (`기동 완료 (5건 시작)`)
  - 옵션: `--no-ecu`, `--no-frontend`, `--scenario=NAME`, `--speed=N`
  - 모든 커맨드에 `exec` 사용 (PID 파일 = 실제 프로세스 PID)
- `stop.sh` — 전체 서비스 종료
  - 5개 서비스 모두 상태 표시 (OK/NOT RUNNING/KILLED/FAILED)
  - PID 파일 1순위 + 포트 탐색 2순위 (프로세스 트리 kill)
  - 종료 후 포트 잔류 점검 (3000, 4000, 5173, 8000) + 좀비 프로세스 강제 정리
  - 서머리 (`전체 종료 완료 (4건 종료, 1건 미실행)`)

**주의**: WSL2 환경이다. monorepo 루트에서 `npm install` 완료 상태여야 `@smartcar/shared` 심볼릭 링크가 동작한다.

---

## 9. Observability (에러 핸들링 + 구조화 로깅 + Request ID)

### 규약 문서

`docs/specs/observability.md` — MSA 전체 공통 규약 (에러 응답 형식, 에러 코드, 로그 포맷, Request ID, 로그 레벨 기준)

### 에러 클래스 계층 (`src/lib/errors.ts`)

```
AppError (code, statusCode, message, retryable, cause?)
  ├── NotFoundError         (404)
  ├── InvalidInputError     (400)
  ├── ConflictError         (409)
  ├── AdapterUnavailableError (502, retryable)
  ├── LlmUnavailableError   (502, retryable)
  ├── LlmHttpError          (502)
  ├── LlmParseError         (502, retryable)
  ├── LlmTimeoutError       (504, retryable)
  └── DbError               (500)
```

서비스에서 `throw new NotFoundError("...")` 하면 글로벌 에러 핸들러가 적절한 HTTP 상태코드 + `errorDetail` 객체로 응답한다.

### 로거 (`src/lib/logger.ts`)

pino 기반 JSON structured logging. `createLogger("component")` → child logger.

```typescript
import { createLogger } from "../lib/logger";
const logger = createLogger("my-service");
logger.info({ projectId }, "Analysis started");
logger.warn({ err, sessionId }, "LLM call failed");
```

### 로그 저장

pino transport로 **stdout + JSONL 파일** 동시 출력. 서비스가 어떻게 실행되든(start.sh, 직접 실행) 항상 파일에 기록됨.

```
logs/                       # 프로젝트 루트 (git-ignored, 자동 생성)
├── s2-backend.jsonl        # S2 백엔드
├── adapter.jsonl           # Adapter
└── ecu-simulator.jsonl     # ECU Simulator
```

- 환경변수 `LOG_DIR`로 경로 변경 가능 (기본값: 프로젝트 루트 `logs/`)
- append 모드 — 재시작해도 이전 로그 유지
- 관리자 도구에서 `logs/*.jsonl`을 줄 단위 `JSON.parse()`로 파싱하여 시각화 예정

### 미들웨어 스택 (`src/middleware/`)

```
express.json()
  → requestIdMiddleware    — X-Request-Id 생성/전파, req.requestId에 저장
  → requestLoggerMiddleware — 요청 시작/완료 로그 (/health은 debug)
  → [라우터들]
  → errorHandlerMiddleware — AppError → statusCode/code, 그 외 → 500/INTERNAL_ERROR
```

### Request ID (Correlation ID) 흐름

`requestId`는 HTTP 요청뿐 아니라 모든 추적 가능한 작업 단위에 부여된다. `generateRequestId(prefix)` 유틸리티로 생성.

| 접두사 | 생성 위치 | 용도 |
|--------|-----------|------|
| `req-` | HTTP 미들웨어 | HTTP 요청 |
| `can-` | `DynamicAnalysisService.handleAlert()` | CAN alert → LLM 분석 체인 |
| `reconn-` | `AdapterClient` auto-reconnect | 어댑터 자동 재연결 시도 |
| `sys-` | `index.ts` 기동 로직 | 룰 시딩, 마이그레이션 등 |

```
HTTP:  S1 → [X-Request-Id] → S2 미들웨어 → req.requestId → 서비스 → LlmClient → S3
CAN:   alert 누적 → generateRequestId("can") → LLM 분석 → 로그
기동:  generateRequestId("sys") → 룰 시딩 → 로그
재연결: generateRequestId("reconn") → 어댑터 연결 → 로그
```

### 프로세스 레벨 핸들러

- `uncaughtException` → fatal 로그 + process.exit(1)
- `unhandledRejection` → error 로그

### audit_log 테이블

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  request_id TEXT
);
```

스키마만 생성. 실제 기록은 Finding/Approval 구현 시.

---

## 10. 알려진 이슈 / 주의사항

### 대기 중인 작업 요청 (2026-03-12 기준)

`docs/work-requests/`:
- `s2-to-s3-log-file-storage.md` — S3에게 JSONL 로그 파일 저장 요청 (대기 중)

### DB hot-reload 함정

서버가 `tsx watch`로 실행 중일 때 `smartcar.db`를 삭제하면 0바이트 파일이 되고 테이블이 생성되지 않는다. 반드시 서버 프로세스를 종료 → DB 삭제 → 서버 재시작 순서로 진행할 것.

### shared 타입 변경 시

`@smartcar/shared`는 S2가 단독 소유한다. 변경 시 `docs/api/shared-models.md`를 같이 업데이트하고, S1에게 work-request로 통보한다. DB 컬럼명(snake_case)과 TypeScript 필드명(camelCase) 변환은 DAO의 `rowTo*()` 함수에서 수동으로 한다.

### 마이그레이션 순서

`db.ts`에서 인덱스 생성은 반드시 ALTER TABLE 마이그레이션 **이후**에 해야 한다. 이 순서를 어기면 기존 DB에서 "no such column" 에러로 서버가 크래시 루프에 빠진다.

---

## 10. 개발 로드맵

### 기존 파이프라인: 구현 완료 ✅

정적 분석, 동적 분석, 동적 테스트(퍼징/침투), 프로젝트 CRUD/Overview, 프로젝트 스코프 어댑터/룰/설정 CRUD 모두 완료. 이 파이프라인은 유지하면서 위에 canonical control plane을 적층한다.

### 1단계: 코어 도메인 확정 ✅ 구현 완료

- [x] `Run` 모델 정의 + DB 테이블 + DAO + API
- [x] `Finding` 모델 정의 (7-state 라이프사이클) + DB 테이블 + DAO + API
- [x] `EvidenceRef` 모델 정의 + DB 테이블 + DAO
- [x] `AuditLogEntry` 모델 + DAO (Finding 상태 변경 감사로그)
- [x] 공통 타입: `FindingStatus`, `FindingSourceType`, `RunStatus`, `LocatorType`, `Confidence`, `ArtifactType`
- [x] `services/shared/src/models.ts` + `docs/api/shared-models.md` 동시 업데이트

### 2단계: Finding 정규화 + 증적 관리 ✅ 구현 완료

- [x] **ResultNormalizer** — AnalysisResult 저장 직후 Run+Finding+EvidenceRef 원자적 생성 (멱등)
- [x] 3개 파이프라인 통합: 정적/동적/동적테스트 각각 normalizer 호출 1~2줄 추가
- [x] Finding 라이프사이클: open → needs_review → accepted_risk/false_positive/fixed → needs_revalidation
- [x] LLM 결과: `status: "sandbox"` (즉시 확정 금지), rule 결과: `status: "open"`
- [x] EvidenceRef: 모듈별 artifact 유형 + locator 유형 매핑
- [x] Finding 상태 변경 감사로그 (actor, from, to, reason, requestId)
- [x] Run API: `GET /api/projects/:pid/runs`, `GET /api/runs/:id`
- [x] Finding API: 목록, 집계, 상세(evidenceRefs+auditLog), 상태변경(PATCH)

### 3단계: Quality Gate + Approval

- [ ] GateEvaluationService — run 완료 시 자동 평가 (동기식으로 시작)
- [ ] Gate 규칙: critical finding → fail, evidence missing → warning, LLM-only → gate 미반영
- [ ] Approval — 인증 없이 **local confirmation**으로 시작 (스키마는 확장 가능하게)
- [ ] 고위험 액션(실 ECU 퍼징, fault injection 등) 승인 필요 상태로 대기
- [ ] Quality Gates API, Approvals API

### 4단계: Adapter 고도화

- [ ] **capability discovery** 도입 — 지원하는 것만 `supported=true`, 나머지 `not_supported`
- [ ] canonical error / canonical status 정규화
- [ ] 안전 제어: dry-run mode, session timeout, max request rate
- [ ] Adapter 계약 테스트

### 5단계: Simulator 고도화

- [ ] fault model simulator — timeout, delayed response, malformed frame, negative response burst, security access failure, ECU reset, session lockout
- [ ] replay bench — 저장된 capture 재생, deterministic seed 지원
- [ ] 상태 공개 API (current profile, fault mode, session state, reset count)
- [ ] 회귀 테스트 환경

### 6단계: WS 이벤트 표준화 + 테스트

- [ ] 이벤트 envelope 표준화 (eventId, runId, sequence, timestamp, source, type, payload)
- [ ] sequence gap detection, backpressure metric, drop count event
- [ ] 단위 테스트 / 계약 테스트 / 통합 테스트

### 후순위

- 사용자 인증 (JWT 기반) — Approval 고도화 시 필요
- 어댑터 DB 영속화 연결 상태 복원

---

## 11. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 기능 명세서 | `docs/specs/backend.md` | S2의 모든 API + 아키텍처 상세. 프론트 친구가 참조하는 계약서 |
| Adapter 명세 | `docs/specs/adapter.md` | ECU↔Backend 릴레이, WS 프로토콜, 메시지 형식 |
| ECU Simulator 명세 | `docs/specs/ecu-simulator.md` | CAN 트래픽 생성, 주입 응답 규칙, 시나리오 |
| 공유 모델 명세 | `docs/api/shared-models.md` | S1-S2 공유 타입 계약서. **S2 단독 관리** — `models.ts` 변경 시 반드시 같이 업데이트 |
| 외부 피드백 (S2) | `docs/외부피드백/S2_backend_adapter_simulator_working_guide.md` | 아키텍처 고도화 방향 — 로드맵의 근거 문서 |
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 전체 시스템 구조. 다른 서비스 개발자와 공동 관리 |
| 서비스 관리 스크립트 | `scripts/start.sh`, `scripts/stop.sh` | 전체 서비스 기동/종료 |
| DB 유틸 스크립트 | `scripts/backend/` | DB 초기화, 통계, 백업 |
| 이 인수인계서 | `docs/s2-handoff/README.md` | 다음 세션용 |

**중요**: 구현을 바꾸면 `docs/specs/backend.md`와 `docs/api/shared-models.md`도 반드시 같이 업데이트할 것. 프론트 친구가 이 문서들만 보고 연동한다. shared 변경 시 S1에게 work-request로 통보.

---

## 12. 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| S2 기능 명세 | `docs/specs/backend.md` | 네가 관리하는 계약서 — 현황 파악 필수 |
| S1 프론트 명세 | `docs/specs/frontend.md` | 프론트가 S2를 어떻게 쓰는지 이해 |
| S3 API 명세 | `docs/api/llm-gateway-api.md` | S3 호출 스펙 (LlmClient가 참조) |
| 공유 모델 | `docs/api/shared-models.md` | S1-S2 간 데이터 구조 |
| S3 인수인계서 | `docs/s3-handoff/README.md` | S3 개발자의 현황 (참고용) |
| 외부 피드백 (S2) | `docs/외부피드백/S2_backend_adapter_simulator_working_guide.md` | 아키텍처 고도화 근거. **필독** |
| 외부 피드백 README | `docs/외부피드백/README_ecu_platform_docs.md` | 공통 합의 포인트 + shared 변경 문서 템플릿 |
