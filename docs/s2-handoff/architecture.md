# S2 아키텍처 상세

> 구현 현황, DB 스키마, 핵심 로직, 의존성, 실행 방법, Observability
> 진입점: `README.md` → 필요 시 이 문서 참조

---

## 3. 구현 현황

### 파일 구조

```
services/backend/
├── package.json                    # @aegis/backend, Express 5, better-sqlite3, multer, ws, pino
├── tsconfig.json
├── aegis.db                     # SQLite DB 파일 (자동 생성)
├── .env.example                   # 환경변수 문서화 (모든 인식 변수 + 기본값)
└── src/
    ├── index.ts                    # 앱 진입점 (~55줄, 슬림 composition root)
    ├── config.ts                   # 환경변수 중앙 집중 (AppConfig 인터페이스)
    ├── composition.ts              # DI 컨테이너 (createAppContext → AppContext)
    ├── router-setup.ts             # 라우터 마운트 (mountRouters)
    ├── bootstrap.ts                # 기동 시 초기화 (룰 시딩 등)
    ├── db.ts                       # SQLite 초기화, 테이블 16개 생성, 마이그레이션
    ├── lib/
    │   ├── logger.ts              # pino 루트 로거 + createLogger(component)
    │   ├── errors.ts              # AppError 계층 (17개 에러 클래스 — Agent/SAST/KB/Pipeline 포함)
    │   ├── vulnerability-utils.ts # SEVERITY_ORDER, computeSummary, sortBySeverity, mergeAndDedup (3개 서비스 공용)
    │   ├── __tests__/             # lib 단위 테스트
    │   └── index.ts               # barrel export
    ├── middleware/
    │   ├── async-handler.ts            # asyncHandler — async 핸들러 에러를 next()로 전파
    │   ├── request-id.middleware.ts     # X-Request-Id 생성/전파
    │   ├── request-logger.middleware.ts # 요청 시작/완료 로깅
    │   └── error-handler.middleware.ts  # 글로벌 에러 핸들러 (AppError → statusCode/code)
    ├── types/
    │   └── express.d.ts           # Express Request에 requestId 타입 확장
    ├── controllers/
    │   ├── health.controller.ts    # GET /health (S7 + S3 + S4 + 어댑터 현황)
    │   ├── analysis.controller.ts        # Quick→Deep 분석 + PoC 생성 API (/api/analysis/*)
    │   ├── project-source.controller.ts  # 소스 업로드 API (/api/projects/:pid/source/*)
    │   ├── build-target.controller.ts    # 빌드 타겟 CRUD + 탐색 (/api/projects/:pid/targets/*)
    │   ├── static-analysis.controller.ts  # [Transient] 기존 파일 업로드 + 분석
    │   ├── dynamic-analysis.controller.ts # 동적 분석 REST API 9개 (세션 5 + 주입 4)
    │   ├── project.controller.ts   # 프로젝트 CRUD + Overview
    │   ├── file.controller.ts      # 프로젝트 파일 목록/다운로드/삭제/내용 조회
    │   ├── project-rules.controller.ts    # 프로젝트 스코프 룰 CRUD (/api/projects/:pid/rules)
    │   ├── project-adapters.controller.ts # 프로젝트 스코프 어댑터 CRUD+연결 (/api/projects/:pid/adapters)
    │   ├── project-settings.controller.ts # 프로젝트 설정 GET/PUT (/api/projects/:pid/settings)
    │   ├── sdk-profile.controller.ts      # SDK 프로파일 목록/조회 (/api/sdk-profiles)
    │   ├── dynamic-test.controller.ts # 동적 테스트 API 4개 (run, results, detail, delete)
    │   ├── run.controller.ts        # Run 목록/상세 API
    │   ├── finding.controller.ts    # Finding 목록/상세/상태변경/집계 API
    │   ├── quality-gate.controller.ts # Quality Gate 목록/상세 API
    │   ├── approval.controller.ts   # Approval 목록/상세 API
    │   ├── pipeline.controller.ts        # 서브 프로젝트 파이프라인 API (/api/projects/:pid/pipeline/*)
    │   └── report.controller.ts     # Report 생성 API
    ├── services/
    │   ├── analysis-orchestrator.ts    # Quick→Deep 2단계 오케스트레이션 (타겟별 루프)
    │   ├── agent-client.ts            # S3 Agent HTTP 클라이언트 (POST :8001/v1/tasks)
    │   ├── sast-client.ts             # S4 SAST Runner HTTP 클라이언트 (POST :9000/v1/scan, /v1/discover-targets)
    │   ├── kb-client.ts                  # S5 Knowledge Base HTTP 클라이언트 (POST :8002/v1/code-graph)
    │   ├── pipeline-orchestrator.ts      # 서브 프로젝트 빌드→스캔→코드그래프 파이프라인
    │   ├── project-source.service.ts  # ZIP/Git 소스 관리 (uploads/{projectId}/)
    │   ├── build-target.service.ts    # 빌드 타겟 CRUD + S4 탐색 결과 일괄 등록
    │   ├── result-normalizer.ts   # AnalysisResult + Agent claims 정규화 (normalizeAgentResult 추가)
    │   ├── finding.service.ts     # Finding CRUD + 7-state 라이프사이클 + audit trail
    │   ├── run.service.ts         # Run 읽기 전용 서비스
    │   ├── quality-gate.service.ts # Quality Gate 평가 서비스
    │   ├── approval.service.ts    # Approval 워크플로우 서비스
    │   ├── report.service.ts      # Report 생성 서비스
    │   ├── analysis-tracker.ts    # 비동기 분석 진행률 추적 (phase, abort 지원)
    │   ├── project.service.ts      # 프로젝트 CRUD + Overview 집계
    │   ├── project-settings.service.ts # 프로젝트 설정 KV + buildProfile
    │   ├── sdk-profiles.ts         # 12개 사전정의 SDK 프로파일
    │   ├── ws-broadcaster.ts       # 제너릭 WsBroadcaster<T> (4개 인스턴스: static/dynamic/test/analysis)
    │   ├── static-analysis.service.ts  # [Transient] 기존 정적 분석 파이프라인
    │   ├── chunker.ts              # [Transient]
    │   ├── llm-task-client.ts     # [Transient] S7 v1 Task API 클라이언트
    │   ├── llm-v1-adapter.ts     # [Transient]
    │   ├── rule.service.ts         # [Transient]
    │   ├── dynamic-analysis.service.ts # 동적 분석 (UI 숨김, API 유지)
    │   ├── dynamic-test.service.ts # 동적 테스트 (UI 숨김, API 유지)
    │   ├── adapter-client.ts      # Adapter WS 클라이언트
    │   ├── adapter-manager.ts     # 어댑터 관리
    │   ├── attack-scenarios.ts    # CAN 공격 시나리오
    │   ├── input-generator.ts     # 동적 테스트 입력 생성
    │   └── mock-ecu.ts            # Mock ECU
    ├── dao/
    │   ├── file-store.ts          # uploaded_files 테이블
    │   ├── analysis-result.dao.ts # analysis_results 테이블
    │   ├── project.dao.ts         # projects 테이블
    │   ├── rule.dao.ts            # rules 테이블 [Transient — 룰 엔진 제거 시 삭제]
    │   ├── adapter.dao.ts         # adapters 테이블 (멀티 어댑터 CRUD)
    │   ├── dynamic-session.dao.ts # dynamic_analysis_sessions 테이블
    │   ├── dynamic-alert.dao.ts   # dynamic_analysis_alerts 테이블
    │   ├── dynamic-message.dao.ts # dynamic_analysis_messages 테이블
    │   ├── dynamic-test-result.dao.ts # dynamic_test_results 테이블
    │   ├── project-settings.dao.ts  # project_settings KV 테이블
    │   ├── build-target.dao.ts     # build_targets 테이블
    │   ├── run.dao.ts              # runs 테이블
    │   ├── finding.dao.ts          # findings 테이블 (필터, 집계)
    │   ├── evidence-ref.dao.ts     # evidence_refs 테이블
    │   ├── audit-log.dao.ts        # audit_log 테이블
    │   └── gate-result.dao.ts     # gate_results 테이블
    ├── rules/                      # 정적 분석 룰 [Transient — 전체 제거 예정]
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
index.ts (진입점 ~55줄)
  → config.ts           (환경변수 중앙 집중, AppConfig)
  → composition.ts      (createAppContext: DAO 17개 + 서비스 19+ + WS 6개 + 클라이언트 4개)
  → router-setup.ts     (mountRouters: 라우터 17개 마운트)
  → bootstrap.ts        (runStartupTasks: 룰 시딩)

Controller → Service → DAO → SQLite
                ↘ RuleService.buildRuleEngine(projectId) → RuleEngine (1계층: 정적 분석, per-analysis) [Transient]
                ↘ Chunker (정적 분석 파일 청크 분할) [Transient]
                ↘ CanRuleEngine (1계층: 동적 분석)
                ↘ LlmV1Adapter → LlmTaskClient → S3 v1 Task API (2계층) [Transient]
                ↘ WsBroadcaster<T> (제너릭 WebSocket broadcaster — 모듈별 독립 인스턴스)
                ↘ AdapterManager → AdapterClient(N개) → Adapter(N대) (CAN 프레임 수신 + 주입 요청-응답)
                ↘ InputGenerator (동적 테스트 입력 생성)
                ↘ ProjectSettingsService (프로젝트별 설정 KV — llmUrl, buildProfile 등)
                ↘ SDK_PROFILES (12개 사전정의 SDK 프로파일)
```

- **Controller**: 요청 수신, 입력 검증, 응답 반환. async 핸들러는 `asyncHandler()` 래퍼로 에러를 글로벌 핸들러에 전파
- **Service**: 비즈니스 로직, 오케스트레이션
- **DAO**: DB 접근 캡슐화 (better-sqlite3 prepared statements)
- **RuleService**: 프로젝트별 룰 CRUD + 기본 룰 시딩 + `buildRuleEngine(projectId)`로 per-analysis 엔진 빌드 [Transient]
- **RuleEngine**: 정적 분석 패턴 매칭 룰 실행. 글로벌 싱글톤이 아닌 분석 시마다 `RuleService.buildRuleEngine()`으로 생성 [Transient]
- **CanRuleEngine**: 동적 분석 CAN 룰 (빈도, 비인가 ID, 공격 시그니처)
- **WsBroadcaster\<T\>**: 제너릭 WebSocket broadcaster. 모듈별 독립 인스턴스 (dynamicAnalysisWs, staticAnalysisWs, dynamicTestWs). `attachWsServers()`로 HTTP server에 일괄 연결
- **AdapterManager**: 프로젝트별 어댑터 관리. CRUD + 연결/해제. CAN 프레임 수신 시 `adapterId`를 포함하여 세션에 라우팅. 소속 검증(projectId) 지원. ECU 메타데이터(`ecuMeta`) 런타임 노출
- **AdapterClient**: 개별 Adapter WS 클라이언트. `IEcuAdapter` 인터페이스 구현. `ecu-info` 메시지 수신 시 ECU 메타(name, canIds) 저장. AdapterManager가 내부적으로 관리
- **LlmTaskClient**: S3 v1 Task API 직접 호출 (`POST /v1/tasks`, `GET /v1/health`)
- **LlmV1Adapter**: 기존 서비스가 사용하던 v0 `analyze()` 시그니처를 유지하면서 내부적으로 v1 TaskRequest/TaskResponse 변환. concurrency queue 내장. 실패 시 graceful degradation (1계층 결과만 반환) [Transient]
- **ProjectSettingsService**: 프로젝트별 설정 KV. `buildProfile`을 JSON 직렬화하여 KV에 저장. `resolveBuildProfile()`로 SDK defaults + 사용자 override 병합
- **SDK_PROFILES**: 12개 사전정의 SDK 프로파일 (`sdk-profiles.ts`). TI AM335x, TI TDA4VM, NXP S32K3, NXP S32G2, Infineon AURIX TC3xx, Infineon AURIX TC4xx, Renesas RH850, Renesas R-Car, ST Stellar SR6, Linux x86_64 (C), Linux x86_64 (C++), Custom

---

## 4. 데이터베이스

SQLite(`better-sqlite3`), WAL 모드. DB 파일: `services/backend/aegis.db` (환경변수 `DB_PATH`로 변경 가능).

### 테이블 17개

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|----------|
| `projects` | 프로젝트 관리 | id, name, description, created_at, updated_at |
| `uploaded_files` | 업로드된 소스코드 | id, project_id, name, size, language, content |
| `analysis_results` | 분석 결과 | id, project_id, module, status, vulnerabilities(JSON), summary(JSON), warnings(JSON), analyzed_file_ids(JSON), file_coverage(JSON) |
| `rules` | 패턴 매칭 룰 | id, name, severity, pattern, enabled, project_id |
| `adapters` | 어댑터 등록 정보 | id, name, url, project_id, created_at |
| `project_settings` | 프로젝트 설정 KV | project_id, key, value, updated_at (PK: project_id+key) |
| `dynamic_analysis_sessions` | 동적 분석 세션 | id, project_id, status, source(JSON), message_count, alert_count, started_at, ended_at |
| `dynamic_analysis_alerts` | 이상 탐지 알림 | id, session_id, severity, title, description, llm_analysis, related_messages(JSON) |
| `dynamic_analysis_messages` | CAN 메시지 로그 | id(auto), session_id, timestamp, can_id, dlc, data, flagged, injected |
| `dynamic_test_results` | 동적 테스트 결과 | id, project_id, config(JSON), status, total_runs, crashes, anomalies, findings(JSON), created_at |
| `audit_log` | 감사 로그 | id, timestamp, actor, action, resource, resource_id, detail(JSON), request_id |
| `runs` | 코어 도메인 — Run | id, project_id, module, status, analysis_result_id, finding_count, started_at, ended_at |
| `findings` | 코어 도메인 — Finding | id, run_id, project_id, module, status, severity, confidence, source_type, title, description, location, suggestion, detail, rule_id |
| `build_targets` | 서브 프로젝트(빌드 타겟) | id, project_id, name, relative_path, build_profile(JSON), build_system, status, included_paths(JSON), source_path, compile_commands_path, build_log, sast_scan_id, sca_libraries(JSON), code_graph_status, code_graph_node_count, last_built_at, created_at, updated_at |
| `evidence_refs` | 코어 도메인 — EvidenceRef | id, finding_id, artifact_id, artifact_type, locator_type, locator(JSON) |

### 마이그레이션 주의사항

`db.ts`에서 `CREATE TABLE IF NOT EXISTS` -> `ALTER TABLE ADD COLUMN` -> `CREATE INDEX` 순서가 중요하다. 기존 DB에 컬럼이 없을 때 ALTER가 먼저 실행되어야 인덱스 생성이 성공한다. ALTER는 try/catch로 감싸서 이미 존재하면 무시.

### DB 클린 방법

서버를 **완전히 종료**한 뒤 `rm aegis.db` -> 서버 재시작. hot-reload 중에 DB 파일만 삭제하면 0바이트 파일이 되어 테이블이 생성되지 않는다 (메모리 내 기존 연결이 남아있기 때문).

---

## 6. 핵심 로직 상세

### 정적 분석 파이프라인 (`StaticAnalysisService.runAnalysis`) [Transient -- SAST Runner 전환 후 대폭 변경 예정]

```
요청 (projectId + fileIds + analysisId?)
  → fileStore에서 파일 내용 조회
  → [1계층] RuleService.buildRuleEngine(projectId) → ruleEngine.runAll() — 프로젝트 enabled 룰만 실행, RuleMatch[] 반환  [Transient]
  → 파일 청크 분할 (chunker.ts) — 14000토큰 예산, greedy bin-packing  [Transient]
  → [2계층] 청크별 LLM 분석 (병렬, concurrency=4)
      각 청크마다 LlmV1Adapter.analyze() 호출 (내부에서 v1 TaskRequest로 변환)
      trusted.buildProfile 포함 (languageStandard, targetArch, compiler) — static-explain 태스크
      성공 → llmVulns 수집, processedFiles += chunk.files.length
      실패 → warnings에 LLM_CHUNK_FAILED 추가
      WS progress push (phase: llm_chunk, i/N)
  → mergeAndSort() → mergeAndDedup() — 같은 location 중복 제거 (룰 우선, undefined location 제외), 심각도순 정렬  [Transient]
  → computeSummary() — 심각도별 카운트
  → fileCoverage 빌드 (analyzed/skipped 파일 목록 + 파일별 findingCount)
  → AnalysisResultDAO.save() — DB 저장 (warnings + fileCoverage 포함)
  → WS complete 이벤트
  → AnalysisResult 반환 (warnings 포함)
```

**허용 확장자 (C/C++ only)**: `ALLOWED_EXTENSIONS = [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx"]`
- 기존 `.py`, `.java`, `.js`, `.ts`는 제거됨 (2026-03-17)
- `detectLanguage()`: `.h` -> `"c-or-cpp"` (기존: `"c"`), `.cc`/`.cxx` -> `"cpp"`, `.hh`/`.hxx` -> `"cpp"`

**청크 분할 (`chunker.ts`)** [Transient]: 토큰 추정 `chars / 3.5`, 청크 예산 14000토큰(~49000chars). 100KB 초과 파일은 `FILE_TOO_LARGE` warning으로 스킵(S3 입력 상한 보호). 49K~100K chars 파일은 단독 청크 + `CHUNK_TOO_LARGE` warning.

**WS 프로그레스**: `/ws/static-analysis?analysisId=xxx` 경로로 연결.
- 첫 번째 `static-progress` 이벤트에 `phaseWeights` 포함: `{ queued: 5, rule_engine: 5, llm_chunk: 80, merging: 10 }`
- S1은 이 가중치를 사용하여 전체 진행률을 계산한다

**AI Finding location fallback (개선됨)**:
- 단일 파일 청크: 해당 파일 경로로 fallback (기존 동작)
- **멀티 파일 청크**: LLM finding의 title/description에서 파일명을 추출하여 청크 내 파일과 매칭 시도. 매칭 실패 시 청크의 첫 번째 파일로 fallback. 더 이상 `null` location이 발생하지 않음

**LLM context에 buildProfile 포함**: `static-explain` 태스크의 `trusted.buildProfile`에 `languageStandard`, `targetArch`, `compiler`를 전달. LLM이 타겟 환경을 고려한 분석을 수행할 수 있게 함.

**Warnings**: `AnalysisResult.warnings?: AnalysisWarning[]` -- LLM 실패 시에도 룰 결과는 항상 반환.

**fileCoverage**: `AnalysisResult.fileCoverage?: FileCoverageEntry[]` -- 파일별 분석 커버리지. analyzed/skipped 상태 + findingCount 포함. S1이 커버리지율/스킵 파일 표시에 활용.

**Location 형식**: 룰 엔진 결과는 `"{filePath}:{lineNumber}"` (file.path || file.name 사용), LLM 결과는 filename fallback 적용 후 `"{filePath}"` 또는 `"{filePath}:{line}"`.

### 룰 엔진 구조 [Transient -- SAST Runner 안정화 후 전체 제거]

**프로젝트 스코프 룰 시스템** -- 빌트인/커스텀 구분 없이 모든 룰이 프로젝트에 소속된다.

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

**제거 시 영향 범위** (SAST Runner 안정화 후):
- `rules/` 디렉토리 전체
- `RuleService`, `rule.dao.ts`
- `project-rules.controller.ts`
- DB `rules` 테이블
- `ProjectService.seedDefaultRules()`
- `result-normalizer.ts` (룰 Finding 생성 로직)
- `mergeAndDedup()` (vulnerability-utils.ts)
- S1 룰 CRUD UI (S1에게 work-request 필요)
- 관련 테스트

### BuildProfile / SDK 프로파일

**공유 타입** (`services/shared/src/models.ts`):
- `BuildProfile`: sdkId, compiler, compilerVersion, targetArch, languageStandard, headerLanguage, includePaths, defines, flags
- `SdkProfile`: id, name, vendor, description, defaults (BuildProfile 부분집합)
- `ProjectSettings`에 `buildProfile?: BuildProfile` 추가

**SDK 프로파일 12개** (`sdk-profiles.ts`):
| sdkId | 설명 |
|-------|------|
| `ti-am335x` | TI Sitara AM335x (ARM Cortex-A8) |
| `ti-tda4vm` | TI Jacinto 7 TDA4VM (ARM Cortex-A72 + R5F, ADAS) |
| `nxp-s32k3` | NXP S32K3 (ARM Cortex-M7, 차체 제어) |
| `nxp-s32g2` | NXP S32G2 (ARM Cortex-A53/M7, 게이트웨이) |
| `infineon-aurix-tc3xx` | Infineon AURIX TC3xx (TriCore 1.6.2, ASIL-D) |
| `infineon-aurix-tc4xx` | Infineon AURIX TC4xx (TriCore 1.8, 차세대 ASIL-D) |
| `renesas-rh850` | Renesas RH850 (V850E2M, 차체/섀시) |
| `renesas-rcar` | Renesas R-Car H3/M3 (ARM Cortex-A57/A53, IVI/ADAS) |
| `st-stellar-sr6` | ST Stellar SR6 (ARM Cortex-R52+, 차세대 ZCU) |
| `linux-x86_64-c` | Linux x86_64 (C, gcc/clang) |
| `linux-x86_64-cpp` | Linux x86_64 (C++, g++/clang++) |
| `custom` | 사용자 정의 |

**`resolveBuildProfile()`**: SDK 선택 시 defaults 자동 채움 -> 사용자가 개별 필드 override -> 병합 결과 반환.

**ProjectSettingsService**: `buildProfile`을 JSON 직렬화하여 KV store의 `buildProfile` 키에 저장. `get()` 시 JSON 파싱하여 반환.

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
    → [2계층] alert 3건 누적 시 LlmV1Adapter.analyze() — 컨텍스트 분석
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
- **트리거 A (alert 누적)**: `alertsSinceLastLlm >= 3` 도달 시 -> 최근 40건 메시지 + 최근 3건 alert를 S3에 전달 -> `alert.llmAnalysis` 업데이트 + WS push. 호출 후 카운터 리셋.
- **트리거 B (세션 종료)**: DB에서 전체 메시지 + 전체 alerts 조회 -> S3에 전달 -> `analysis_results` 테이블에 저장 (module="dynamic_analysis")

**CAN 주입 (분석가 주도)**:
- `injectMessage(sessionId, req)`: monitoring 상태 검증 -> AdapterClient.sendAndReceive() -> ECU 응답 수신 -> 주입 메시지를 handleCanMessage()에 `injected: true`로 투입 (룰 엔진 평가 + WS push) -> 응답 분류(classifyResponse) -> WS injection-result -> 이력 기록
- `injectScenario(sessionId, scenarioId)`: 사전정의 시나리오(6개)의 steps를 순차 injectMessage() 호출
- 주입 이력은 ActiveSession.injectionHistory에 인메모리 보관 (세션 종료 시 소멸)
- 세션 종료 시 LLM 분석 canLog에 주입 메시지 `[INJ]` 접두사로 포함

**주의사항**:
- CAN 메시지는 circular buffer(100건)로 인메모리 유지 (룰 컨텍스트), 전체는 DB에 저장
- alert 누적 LLM 호출은 비동기 (`.catch(() => {})` -- 실패해도 세션 계속)
- CAN 데이터는 AdapterManager -> AdapterClient를 통해 수신. ECU Simulator -> Adapter -> AdapterClient -> AdapterManager -> 세션
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
  → [2계층] findings가 있으면 LlmV1Adapter.analyze() — module: "dynamic_testing"
      LLM 결과를 각 finding.llmAnalysis에 매핑
  → DynamicTestResult DB 저장 + AnalysisResult 이중 저장 (Overview 호환)
  → WS test-complete
```

**Mock ECU 시나리오**: 0xFF->crash, 0x7DF->reset, 0x00->malformed, 반복3회->anomaly, 경계값->timeout(2000ms), 그 외->정상. 기본 지연 10~50ms.

**동시 실행 방지**: `runningTests: Set<string>` -- 같은 projectId로 동시 실행 불가 (409 Conflict).

**Overview 호환**: 테스트 결과를 `analysis_results` 테이블에 `module="dynamic_testing"`으로도 저장. `ProjectService.getOverview()`에서 자동 집계.

### S3 통신 (`LlmV1Adapter` -> `LlmTaskClient`) [Transient]

v0 엔드포인트(`POST /api/llm/analyze`, `GET /health`)는 S3에서 완전 폐기됨. v1 Task API로 전환 완료 (2026-03-13).

```typescript
POST http://localhost:8000/v1/tasks
Body: TaskRequest { taskType, taskId, context: { trusted, untrusted }, evidenceRefs, constraints? }
Response: TaskResponse { status: "completed", result: { claims, caveats, suggestedSeverity, ... } }
                       | { status: "validation_failed"|..., failureCode, failureDetail }

GET http://localhost:8000/v1/health
```

**어댑터 패턴**: `LlmV1Adapter`가 기존 서비스의 `analyze(request, baseUrl?, requestId?, signal?)` 시그니처를 유지하면서 내부적으로 v0->v1 변환 수행. 3개 서비스(정적/동적/동적테스트)는 import + 타입 교체만으로 전환 완료. **태스크별 context 분기**: `static-explain`은 `trusted.finding`(단일 객체) + `trusted.buildProfile`(languageStandard, targetArch, compiler) + `untrusted.sourceSnippet`, `dynamic-annotate`는 `trusted.ruleMatches`(배열) + `untrusted.rawCanLog` (API 계약서 정합).

**모듈 -> taskType 매핑**:
- `static_analysis` -> `static-explain`
- `dynamic_analysis` -> `dynamic-annotate`
- `dynamic_testing` -> `test-plan-propose`

- S7 URL: 프로젝트 설정 `llmUrl` 우선, 없으면 환경변수 `LLM_GATEWAY_URL` (기본값: `http://localhost:8000`)
- S7 연결 실패 시 `{ success: false, vulnerabilities: [] }` 반환 -> 1계층 결과만으로 응답 (graceful degradation)
- concurrency queue (기본 4, 환경변수 `LLM_CONCURRENCY`)
- S3 응답의 `confidenceBreakdown` 필드: `consistency` -> `ragCoverage`로 변경됨 (S3 측 2026-03-16 반영)

### 3차 통합 테스트 결과 (2026-03-16)

21개 청크, 100% 성공 (INVALID 0건). S3의 RAG/프롬프트 고도화 이후 confidence가 4단계로 분화:
- 0.8650 / 0.8900 / 0.9300 / 0.9550 (이전: 0.955 고정)
- `ragCoverage` 반영으로 Quality Gate 판정에 충분한 분별력 확보

### 한글 파일명 처리

multer가 multipart 헤더의 filename을 latin1(ISO-8859-1)로 해석한다. `static-analysis.controller.ts`에서 `Buffer.from(file.originalname, "latin1").toString("utf-8")`로 UTF-8 복원 후 사용.

---

## 7. 의존성

```json
{
  "@aegis/shared": "*",         // 공유 Model/DTO 타입 (monorepo workspace)
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

> **서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

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

# 5. SAST Runner (S4 소유, 포트 9000)
# S4가 관리. start.sh에서 자동 기동

# 전체 종료
./scripts/stop.sh
```

**프로젝트별 어댑터 운영**: 어댑터는 프로젝트에 소속된다. S1 UI 또는 REST API(`POST /api/projects/:pid/adapters`)로 등록/연결한다.

확인:
```bash
curl http://localhost:3000/health
# {"service":"aegis-core-service","status":"ok","version":"0.1.0","llmGateway":{...},"adapters":{"total":1,"connected":1}}

# 프로젝트 생성 → 기본 룰 22개 자동 시딩
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" -d '{"name":"Test"}'
# → { success: true, data: { id: "proj-xxx", ... } }

# SDK 프로파일 목록
curl http://localhost:3000/api/sdk-profiles
# → { success: true, data: [ { id: "ti-am335x", ... }, ... ] }

# 프로젝트 설정에 buildProfile 저장
curl -X PUT http://localhost:3000/api/projects/proj-xxx/settings \
  -H "Content-Type: application/json" \
  -d '{"buildProfile":{"sdkId":"ti-am335x","languageStandard":"c99"}}'

# 어댑터 등록 + 연결
curl -X POST http://localhost:3000/api/projects/proj-xxx/adapters \
  -H "Content-Type: application/json" \
  -d '{"name":"Local Adapter","url":"ws://localhost:4000"}'
# → { success: true, data: { id: "adp-xxx", ..., projectId: "proj-xxx", connected: false } }

curl -X POST http://localhost:3000/api/projects/proj-xxx/adapters/adp-xxx/connect
# → { success: true, data: { ..., connected: true, ecuConnected: true } }
```

**환경변수 (.env)**:

각 서비스는 `services/<서비스명>/.env` 파일에서 환경변수를 로드한다. 개별 스크립트(`scripts/start-*.sh`)와 통합 기동(`scripts/start.sh`) 모두 `.env`를 자동 로드한다. `.env`는 `.gitignore`에 의해 Git 추적 제외.

| 서비스 | .env 위치 | 주요 변수 |
|--------|----------|----------|
| backend | `services/backend/.env` | `PORT`, `LLM_GATEWAY_URL`, `ANALYSIS_AGENT_URL`, `SAST_RUNNER_URL`, `UPLOADS_DIR`, `DB_PATH`, `LOG_DIR`, `LOG_LEVEL` |
| adapter | `services/adapter/.env` | `PORT`, `LOG_DIR`, `LOG_LEVEL` |
| ecu-simulator | `services/ecu-simulator/.env` | `ADAPTER_URL`, `SCENARIO`, `SPEED`, `LOG_DIR`, `LOG_LEVEL` |
| frontend | `services/frontend/.env` | `VITE_BACKEND_URL` |
| llm-gateway | `services/llm-gateway/.env` | `SMARTCAR_LLM_MODE`, `SMARTCAR_LLM_ENDPOINT`, `SMARTCAR_LLM_MODEL`, `SMARTCAR_LLM_API_KEY`, `LOG_DIR` |
| sast-runner | `services/sast-runner/.env` | `PORT` (기본 9000). S4 관리 |

> 우선순위: `.env` 기본값 -> CLI 인수 오버라이드 (해당 시). DB 유틸 스크립트(`scripts/backend/`)도 backend `.env`에서 `DB_PATH`를 읽는다.

**유틸 스크립트** (`scripts/backend/`):
- `reset-db.sh` -- DB 삭제 (확인 프롬프트). 서버 정지 후 사용
- `db-stats.sh` -- 테이블별 건수 + DB 크기 조회
- `backup-db.sh [이름]` -- sqlite3 `.backup`으로 스냅샷 저장 (`scripts/backend/.backups/`)

**로그 관리 스크립트** (`scripts/common/`):
- `reset-logs.sh` -- 전체 서비스 로그 초기화 (`logs/*.jsonl` 일괄 truncate)

**서비스 관리 스크립트** (`scripts/`) -- **너의 담당**:
- `start.sh` -- 전체 서비스 기동
  - 기동 순서: Adapter -> ECU Simulator -> Backend -> LLM Gateway -> **SAST Runner (포트 9000)** -> Frontend
  - 각 서비스의 `.env`를 서브쉘에 주입 (`load_env()` 헬퍼)
  - 포트 헬스체크 (LISTEN 상태까지 최대 10초 대기, 프로세스 즉시 종료 감지)
  - 기동 실패 시 이미 띄운 서비스 자동 롤백 (역순 종료)
  - 색상 출력 + 소요시간 표시 + 서머리 (`기동 완료 (6건 시작)`)
  - 옵션: `--no-ecu`, `--no-frontend`, `--scenario=NAME`, `--speed=N`
  - 모든 커맨드에 `exec` 사용 (PID 파일 = 실제 프로세스 PID)
- `stop.sh` -- 전체 서비스 종료
  - 6개 서비스 모두 상태 표시 (OK/NOT RUNNING/KILLED/FAILED)
  - SERVICE_PORTS에 sast-runner (9000) 포함
  - PID 파일 1순위 + 포트 탐색 2순위 (프로세스 트리 kill)
  - 종료 후 포트 잔류 점검 (3000, 4000, 5173, 8000, 9000) + 좀비 프로세스 강제 정리
  - 서머리 (`전체 종료 완료 (5건 종료, 1건 미실행)`)

**주의**: WSL2 환경이다. monorepo 루트에서 `npm install` 완료 상태여야 `@aegis/shared` 심볼릭 링크가 동작한다.

---

## 9. Observability (에러 핸들링 + 구조화 로깅 + Request ID)

### 규약 문서

`docs/specs/observability.md` -- MSA 전체 공통 규약 (에러 응답 형식, 에러 코드, 로그 포맷, Request ID, 로그 레벨 기준)

### 에러 클래스 계층 (`src/lib/errors.ts`)

```
AppError (code, statusCode, message, retryable, cause?)
  ├── NotFoundError              (404)
  ├── InvalidInputError          (400)
  ├── ConflictError              (409)
  ├── AdapterUnavailableError    (502, retryable)
  ├── LlmUnavailableError        (502, retryable)
  ├── LlmHttpError               (502)
  ├── LlmParseError              (502, retryable)
  ├── LlmTimeoutError            (504, retryable)
  ├── LlmCircuitOpenError        (502, retryable)
  ├── AgentUnavailableError      (502, retryable)
  ├── AgentTimeoutError          (504, retryable)
  ├── SastUnavailableError       (502, retryable)
  ├── SastTimeoutError           (504, retryable)
  ├── BuildAgentUnavailableError (502, retryable)
  ├── BuildAgentTimeoutError     (504, retryable)
  ├── KbUnavailableError         (502, retryable)
  ├── KbHttpError                (502)
  ├── PipelineStepError          (502, retryable)
  └── DbError                    (500)
```

서비스에서 `throw new NotFoundError("...")` 하면 글로벌 에러 핸들러가 적절한 HTTP 상태코드 + `errorDetail` 객체로 응답한다.

### 로거 (`src/lib/logger.ts`)

pino 기반 JSON structured logging. `createLogger("component")` -> child logger.

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
- append 모드 -- 재시작해도 이전 로그 유지
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
| `can-` | `DynamicAnalysisService.handleAlert()` | CAN alert -> LLM 분석 체인 |
| `reconn-` | `AdapterClient` auto-reconnect | 어댑터 자동 재연결 시도 |
| `sys-` | `index.ts` 기동 로직 | 룰 시딩, 마이그레이션 등 |

```
HTTP:  S1 → [X-Request-Id] → S2 미들웨어 → req.requestId → 서비스 → LlmV1Adapter → LlmTaskClient → S3
CAN:   alert 누적 → generateRequestId("can") → LLM 분석 → 로그
기동:  generateRequestId("sys") → 룰 시딩 → 로그
재연결: generateRequestId("reconn") → 어댑터 연결 → 로그
```

### 프로세스 레벨 핸들러

- `uncaughtException` -> fatal 로그 + process.exit(1)
- `unhandledRejection` -> error 로그

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
