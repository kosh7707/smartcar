# S2. Core Service 기능 명세

> Express.js + TypeScript 기반 백엔드 서비스
> Service(Orchestrator) 패턴: 각 검증 모듈을 독립 Service로 구현, Core가 조율
> DAO를 통한 DB 접근 캡슐화

---

## 개발 방향

**S2는 플랫폼의 진실원(source of truth)이다.** 분석 파이프라인(정적/동적/테스트)은 구현 완료 상태이며, 이 위에 **Evidence → Findings → Quality Gate → Policy → Approval** 구조를 점진적으로 적층한다. 기존 파이프라인을 재작성하지 않고 정규화 레이어를 추가하는 전략이다.

상세 근거: `docs/외부피드백/S2_backend_adapter_simulator_working_guide.md`

## 구현 현황

| 단계 | 대상 | 상태 |
|------|------|------|
| 기존 파이프라인 | 정적 분석, 동적 분석, 동적 테스트, 프로젝트 CRUD/Overview, 룰/어댑터/설정 | **구현 완료** |
| 1단계 | Run 모델 승격 + 코어 도메인 확정 | **구현 완료** |
| 2단계 | Finding 정규화 + 증적 관리 | **구현 완료** |
| 3단계 | Quality Gate + Approval + Report | **구현 완료** |
| Quick→Deep 파이프라인 | AnalysisOrchestrator + AgentClient + SastClient + ProjectSourceService | **구현 완료** |
| 서브 프로젝트 파이프라인 | PipelineOrchestrator + BuildTarget + BuildAgentClient + KbClient | **구현 완료** |
| S1 요청 API | 벌크 상태, Finding 이력, 활동 타임라인, Approval 카운트, 검색/정렬 확장 | **구현 완료** |
| 코드 고도화 | AppError 타입화(KB/Pipeline), 쿼리 파라미터 검증, silent catch 로깅 | **구현 완료** |
| 테스트 | 단위/통합/계약 테스트 267개 (vitest) | **구현 완료** |
| 4단계 | Adapter capability 고도화 | 미착수 |
| 5단계 | Simulator 고도화 (fault model, replay) | 미착수 |
| 6단계 | WS 이벤트 표준화 | 미착수 |

---

## Observability

### 에러 응답 형식

모든 에러 응답은 하위호환 `error` string + 구조화된 `errorDetail` 객체를 포함한다.

```json
{
  "success": false,
  "error": "Session not found",
  "errorDetail": {
    "code": "NOT_FOUND",
    "message": "Session not found",
    "requestId": "req-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "retryable": false
  }
}
```

### 에러 코드 목록

| 코드 | HTTP | retryable | 용도 |
|------|------|-----------|------|
| `INVALID_INPUT` | 400 | N | 필수 필드 누락, 잘못된 형식 |
| `NOT_FOUND` | 404 | N | 리소스 없음 |
| `CONFLICT` | 409 | N | 동시 실행 등 |
| `ADAPTER_UNAVAILABLE` | 502 | Y | 어댑터 미연결 |
| `LLM_UNAVAILABLE` | 502 | Y | S7 LLM Gateway 네트워크 불가 |
| `LLM_HTTP_ERROR` | 502 | N | S7 LLM Gateway가 4xx/5xx 반환 |
| `LLM_PARSE_ERROR` | 502 | Y | LLM 응답 JSON 파싱 실패 |
| `LLM_TIMEOUT` | 504 | Y | LLM 응답 시간 초과 |
| `LLM_CIRCUIT_OPEN` | 502 | Y | S7 Circuit Breaker OPEN 상태 |
| `AGENT_UNAVAILABLE` | 502 | Y | S3 Agent 네트워크 불가 |
| `AGENT_TIMEOUT` | 504 | Y | S3 Agent 응답 시간 초과 |
| `SAST_UNAVAILABLE` | 502 | Y | S4 SAST Runner 네트워크 불가 |
| `SAST_TIMEOUT` | 504 | Y | S4 SAST Runner 시간 초과 |
| `BUILD_AGENT_UNAVAILABLE` | 502 | Y | S3 Build Agent 네트워크 불가 |
| `BUILD_AGENT_TIMEOUT` | 504 | Y | S3 Build Agent 응답 시간 초과 |
| `KB_UNAVAILABLE` | 502 | Y | S5 Knowledge Base 네트워크 불가 |
| `KB_HTTP_ERROR` | 502 | N | S5 Knowledge Base가 4xx/5xx 반환 |
| `PIPELINE_STEP_FAILED` | 502 | Y | 서브 프로젝트 파이프라인 단계 실패 (빌드/스캔) |
| `DB_ERROR` | 500 | N | SQLite 오류 |
| `INTERNAL_ERROR` | 500 | N | catch-all |

### Request ID

- 모든 응답에 `X-Request-Id` 헤더 포함
- 클라이언트가 `X-Request-Id` 헤더를 보내면 그 값을 사용, 없으면 서버가 생성
- S2 → S3 호출 시 `X-Request-Id` 헤더로 전파

### 로그 포맷

JSON structured logging (stdout, pino). 상세 규약: `docs/specs/observability.md`

---

## 데이터베이스

SQLite(`better-sqlite3`)를 사용하여 별도 DB 서버 없이 파일 단일로 운영한다.

- DB 파일: `services/backend/aegis.db` (환경변수 `DB_PATH`로 변경 가능)
- WAL 모드 활성화 (읽기/쓰기 동시성 향상)
- 테이블 (19개): `projects`, `uploaded_files`, `analysis_results`, `rules`, `adapters`, `project_settings`, `dynamic_analysis_sessions`, `dynamic_analysis_alerts`, `dynamic_analysis_messages`, `dynamic_test_results`, `audit_log`, `runs`, `findings`, `evidence_refs`, `gate_results`, `approvals`, `build_targets`, `target_libraries`, `sdk_registry`
- `analysis_results` 테이블에 `warnings TEXT` 컬럼 추가 (JSON, 기본값 `'[]'`)
- `analysis_results` 테이블에 `analyzed_file_ids TEXT` 컬럼 추가 (JSON, 기본값 `'[]'`) — 분석 대상 파일 ID 목록
- `analysis_results` 테이블에 `file_coverage TEXT` 컬럼 추가 (JSON, 기본값 `'[]'`) — 파일별 분석 커버리지

---

## P0: 정적 분석 (연차보고서 필수) ✅ 구현 완료

### P0-1. 파일 업로드 처리 ✅

```
POST /api/static-analysis/upload
Content-Type: multipart/form-data
Field: files (복수), projectId (string)
```

- 멀티파트 파일 수신 (복수 파일)
- `projectId` 필드로 프로젝트에 파일 연결 (`uploaded_files.project_id`)
- 한글 파일명 인코딩 처리: multer가 latin1로 해석하는 `originalname`을 `Buffer.from(name, "latin1").toString("utf-8")`로 UTF-8 복원
- 지원 확장자 검증 (.c, .cpp, .cc, .cxx, .h, .hpp, .hh, .hxx)
- `detectLanguage()`: `.c` → `"c"`, `.cpp/.cc/.cxx` → `"cpp"`, `.h` → `"c-or-cpp"` (BuildProfile의 headerLanguage로 해석), `.hpp/.hh/.hxx` → `"cpp"`
- SQLite `uploaded_files` 테이블에 저장 (파일 내용 포함)
- 업로드된 파일 목록 반환 (`UploadedFile[]`)

### P0-2. 정적 분석 실행 ✅

```
POST /api/static-analysis/run
Body: { "projectId": string, "files": [{ "id": string }], "analysisId"?: string }
```

분석 전체 흐름을 오케스트레이션한다. `projectId` 필수. `analysisId`는 optional — S1이 WS 프로그레스를 받기 위해 미리 생성하여 전달할 수 있다.

#### 청크 기반 LLM 분석

대량 파일을 한 번에 LLM에 보내면 토큰 한도를 초과한다. 파일을 **청크 단위로 분할**하여 여러 번 LLM에 요청한다.

- 토큰 추정: `chars / 3.5` (코드 기준 경험적 상수)
- 청크 예산: **14,000 토큰** (~49,000 chars) — 프롬프트 오버헤드 + 응답 토큰 감안
- 과대 파일 스킵: **100KB 초과** 파일은 청크에 포함하지 않고 `FILE_TOO_LARGE` warning으로 스킵 (S3 입력 상한 보호)
- Greedy bin-packing: 파일 순서대로 청크에 누적, 초과 시 새 청크
- 단일 파일이 청크 예산 초과(49K~100K chars) 시 단독 청크 + `CHUNK_TOO_LARGE` warning

```
요청 수신 (projectId + fileIds + analysisId?)
  → [1계층] 패턴 매칭 서비스 호출
      RuleEngine에 등록된 룰을 순회하며 매칭
      결과: 확정 취약점 목록
      WS progress: rule_engine (0/1 → 1/1)
  → 파일 청크 분할 (chunker)
  → [2계층] 청크별 LLM 분석 (병렬, concurrency=4)
      각 청크마다:
        해당 청크 파일의 ruleResults만 필터
        LlmV1Adapter.analyze() 호출
        성공 → llmVulns 수집, processedFiles += chunk.files.length
        실패 → warnings에 LLM_CHUNK_FAILED 추가
        WS progress: llm_chunk (i/N)
  → 결과 병합
      mergeAndDedup() — 같은 location의 중복 제거 (룰 결과 우선, undefined/null location 제외), 심각도 정렬
      각 취약점에 source(rule/llm) 표시
      WS progress: merging (0/1 → 1/1)
  → 결과 저장 (AnalysisResultDAO, warnings 포함)
  → WS complete 이벤트
  → StaticAnalysisResponse 반환
```

#### 파일 커버리지 (fileCoverage)

분석 완료 시 `AnalysisResult.fileCoverage` 필드에 파일별 분석 커버리지 정보를 포함한다.

- **analyzed**: 청크에 포함되어 분석된 파일. `findingCount`는 해당 파일 경로가 `vulnerability.location`에 등장하는 횟수
- **skipped**: `FILE_TOO_LARGE` 등으로 스킵된 파일. `findingCount: 0`

Location 형식: 룰 엔진 결과는 `"{filePath}:{lineNumber}"`, LLM 결과는 기본 `null`. 단, 단일 파일 청크의 경우 해당 파일 경로로 fallback한다.

#### Warnings

LLM 분석 중 일부 청크가 실패하더라도 룰 결과는 항상 반환된다. 실패 정보는 `AnalysisResult.warnings` 배열에 포함된다.

| warning code | 의미 |
|---|---|
| `FILE_TOO_LARGE` | 100KB 초과 파일 — 청크에서 제외 (스킵) |
| `CHUNK_TOO_LARGE` | 단일 파일이 청크 예산 초과 (49K~100K chars, 단독 청크로 처리됨) |
| `CHUNK_INPUT_SIZE_EXCEEDED` | S3가 `INPUT_TOO_LARGE` 반환 — 해당 청크 건너뜀 |
| `LLM_CHUNK_FAILED` | 특정 청크의 LLM 호출 실패 (그 외 사유) |
| `LLM_NOTE` | S3 응답의 caveats 첨부 (분석 불확실성 단서) |

#### WebSocket 프로그레스

```
WS: /ws/static-analysis?analysisId=xxx
```

S1이 분석 요청 전 WS를 연결하면 실시간 프로그레스를 수신할 수 있다. WS 미연결 시에도 POST /run은 정상 동작 (하위 호환).

메시지 타입:
- `static-progress`: `{ analysisId, phase, current, total, message, phaseWeights? }`
  - 첫 번째 이벤트(`phase: "queued"`)에만 `phaseWeights: { queued: 5, rule_engine: 5, llm_chunk: 80, merging: 10 }` 포함
  - 이후 이벤트에는 `phaseWeights` 없음
- `static-warning`: `{ analysisId, code, message }`
- `static-complete`: `{ analysisId }`
- `static-error`: `{ analysisId, error }`

### P0-3. 룰 엔진 인터페이스 ✅

패턴 매칭 룰의 추가/제거가 용이하도록 추상화한다.

```typescript
interface AnalysisRule {
  id: string;
  name: string;
  severity: Severity;
  description: string;
  suggestion: string;
  match(sourceCode: string, filename: string): RuleMatch[];
}
```

- 모든 룰은 이 인터페이스를 구현
- RuleEngine이 등록된 룰을 순회하며 실행
- 기본 제공 룰 (22개 — 프로젝트 생성 시 자동 시딩):
  - 위험 함수 (9패턴): gets, strcpy, scanf, sprintf, strcat, system, memcpy, alloca, popen
  - 안전하지 않은 패턴 (8패턴): printf format string, atoi, rand, hardcoded secret/key, fixed srand seed, VLA, deprecated crypto, unauthenticated CAN send
  - 메모리 안전 (5패턴): Use-After-Free hint, unsafe realloc, unchecked malloc/calloc, double-free, integer overflow in allocation size
- 모든 룰은 프로젝트 스코프. 빌트인/커스텀 구분 없이 동일하게 CRUD 가능
- 분석 시 해당 프로젝트의 enabled 룰만 사용 (per-analysis RuleEngine 빌드)

```
RuleEngine
  - registerRule(rule: AnalysisRule)
  - removeRule(ruleId: string)
  - runAll(sourceCode: string, filename: string): RuleMatch[]
  - getRules(): AnalysisRule[]
```

### P0-4. LLM 분석 요청 ✅

Core Service → LLM Gateway(S3) v1 Task API 통신.

```
POST http://S3:8000/v1/tasks
```

- `LlmV1Adapter`가 기존 `analyze()` 시그니처를 유지하면서 내부적으로 v1 TaskRequest/TaskResponse 변환
- 모듈 → taskType 매핑: `static_analysis` → `static-explain`, `dynamic_analysis` → `dynamic-annotate`, `dynamic_testing` → `test-plan-propose`
- **태스크별 context 분기** (API 계약서 `docs/api/llm-gateway-api.md` 정합):
  - `static-explain`: `trusted.buildProfile` (optional, languageStandard/targetArch/compiler) + `trusted.finding` (단일 객체, ruleResults 첫 번째) + `trusted.sastFindings` (optional) + `untrusted.sourceSnippet`
  - `dynamic-annotate`: `trusted.ruleMatches` (배열) + `untrusted.rawCanLog`
  - `test-plan-propose`: `trusted.ruleMatches` + `untrusted.testResults`
- S3 응답을 파싱하여 취약점 목록으로 변환
- S3 연결 실패 시 1계층 결과만으로 응답 반환 (graceful degradation)
- S3 URL: 환경변수 `LLM_GATEWAY_URL` (기본값: `http://localhost:8000`)

### P0-5. 분석 결과 조회 ✅

```
GET /api/static-analysis/results?projectId=     프로젝트별 분석 결과 목록
GET /api/static-analysis/results/:analysisId     개별 분석 결과 조회
```

- 목록: 프로젝트별 분석 결과 반환 (`projectId` 필수 쿼리)
- 개별: SQLite에 저장된 분석 결과 반환 (StaticAnalysisResponse)
- 취약점 목록 포함 (심각도, 출처, 위치, 설명, 수정 가이드)

### P0-6. 보고서 데이터 생성 ✅

```
GET /api/static-analysis/report/:analysisId
```

- 분석 결과를 보고서 형식으로 가공하여 반환
- 심각도별 통계, 취약점 전체 목록, 수정 가이드 포함
- Frontend에서 HTML 렌더링에 사용

### P0-7. 헬스체크 ✅

```
GET /health
```

- 서비스 상태 반환 (서비스명, 상태, 버전)
- S3(LLM Gateway) 연결 상태도 함께 확인하여 반환 (`llmGateway` 필드)

---

## P1: 동적 분석 ✅ 구현 완료

### P1-1. CAN 데이터 수신 (WebSocket) ✅

세 개의 WebSocket 엔드포인트:

- **`/ws/dynamic-analysis?sessionId=xxx`** — S2 → S1 실시간 push
  - `{ type: "message", payload: CanMessage }` — CAN 메시지 (flagged 포함)
  - `{ type: "alert", payload: DynamicAlert }` — 이상 탐지 알림
  - `{ type: "status", payload: { messageCount, alertCount } }` — 상태 업데이트 (20건마다)
- **`/ws/static-analysis?analysisId=xxx`** — S2 → S1 정적 분석 프로그레스 push
  - `{ type: "static-progress", payload: { analysisId, phase, current, total, message } }`
  - `{ type: "static-warning", payload: { analysisId, code, message } }`
  - `{ type: "static-complete", payload: { analysisId } }`
- **`/ws/dynamic-test?testId=xxx`** — S2 → S1 동적 테스트 프로그레스 push
  - `{ type: "test-progress", payload: { testId, current, total, crashes, anomalies, message } }`
  - `{ type: "test-finding", payload: { testId, finding: DynamicTestFinding } }`
  - `{ type: "test-complete", payload: { testId } }`

### P1-2. 프로젝트별 어댑터 관리 ✅

어댑터는 프로젝트 단위로 관리된다. 프로젝트 설정에서 어댑터를 등록/연결/해제/삭제한다.

> Adapter 서비스 자체의 프로토콜·메시지 형식은 [Adapter 명세](adapter.md) 참조.
> ECU Simulator의 동작·시나리오는 [ECU Simulator 명세](ecu-simulator.md) 참조.

```
ECU Sim A ←WS→ Adapter A (:4000) ←WS→ S2 (Backend) ←WS→ S1 (Frontend)
ECU Sim B ←WS→ Adapter B (:4001) ←WS→     ↑
```

- **AdapterManager** (`adapter-manager.ts`): 다중 AdapterClient 관리, CRUD + 연결/해제
- **AdapterClient** (`adapter-client.ts`): 개별 Adapter WS 연결, CAN 프레임 수신 + inject 요청-응답
- 자동 재연결 지원 (3초 간격)
- `GET /health` 응답에 `adapters: { total, connected }` 포함
- 세션/테스트 생성 시 `adapterId`가 해당 `projectId` 소속인지 검증
- ECU 메타데이터: ECU Sim이 연결 시 `ecu-info` 메시지로 이름/CAN ID 목록 전송 → Adapter가 릴레이 → Backend가 `Adapter.ecuMeta`에 반영 (런타임 상태)

#### 어댑터 CRUD API (프로젝트 스코프)

```
GET    /api/projects/:pid/adapters                  프로젝트 어댑터 목록
POST   /api/projects/:pid/adapters                  등록  Body: { name, url }
PUT    /api/projects/:pid/adapters/:id              수정  Body: { name?, url? }
DELETE /api/projects/:pid/adapters/:id              삭제 (연결 중이면 먼저 disconnect)
POST   /api/projects/:pid/adapters/:id/connect      연결 시도
POST   /api/projects/:pid/adapters/:id/disconnect   연결 해제
```

- DB 테이블: `adapters (id, name, url, project_id, created_at)`. `connected`/`ecuConnected`/`ecuMeta`는 런타임 상태
- `url`은 `ws://` 또는 `wss://` 필수
- 프로젝트 삭제 시 소속 어댑터 cascade 삭제

### P1-3. 룰 기반 실시간 탐지 (1계층) ✅

CAN 전용 룰 엔진 (`CanRuleEngine`)으로 수신 메시지를 실시간 평가:

| 룰 | 탐지 대상 | 심각도 |
|----|----------|--------|
| `FrequencyRule` | 슬라이딩 윈도우(500ms) 내 같은 CAN ID 10건 초과 | high |
| `UnauthorizedIdRule` | 허용 목록(0x000~0x7FF 표준 범위 중 등록된 ID) 외 CAN ID | medium |
| `AttackSignatureRule` | 진단 DoS(0x7DF 폭풍), 리플레이(동일 id+data 3회+), Bus-Off(0xFF 페이로드) | critical/high |

이상 탐지 시 즉시 DynamicAlert 생성 + WS push.

### P1-4. LLM 심층 분석 (2계층) ✅

혼합 문턱값 방식. 관련 상수 (`dynamic-analysis.service.ts`):

| 상수 | 값 | 설명 |
|------|---|------|
| `ALERT_LLM_THRESHOLD` | 3 | alert 누적 N건 시 컨텍스트 LLM 호출 |
| `CONTEXT_WINDOW` | 20 | 컨텍스트 호출 시 전후 메시지 수 (실제 전송: x2 = 40건) |
| `RECENT_BUFFER_SIZE` | 100 | 인메모리 circular buffer (룰 컨텍스트 + LLM 컨텍스트) |

- **트리거 A (alert 누적)**: `alertsSinceLastLlm >= 3` 도달 시, 최근 40건 메시지 + 최근 3건 alert를 S3에 전달 → `alert.llmAnalysis` 업데이트 → WS push. 호출 후 카운터 리셋.
- **트리거 B (세션 종료)**: DB에서 전체 메시지 + 전체 alerts 조회 → S3에 전달 → `analysis_results` 테이블에 `module="dynamic_analysis"`로 저장 → Overview 자동 집계 호환

`LlmV1Adapter`를 통해 v1 Task API 호출. `canLog` 필드로 CAN 로그 문자열 전송 (타임스탬프 CAN_ID [DLC] 데이터 형식, 줄 단위).

### P1-5. 동적 분석 세션 관리 ✅

```
POST   /api/dynamic-analysis/sessions              세션 생성 Body: { projectId, adapterId }
GET    /api/dynamic-analysis/sessions               세션 목록 (?projectId=)
GET    /api/dynamic-analysis/sessions/:id           세션 상세 (session + alerts + recentMessages)
POST   /api/dynamic-analysis/sessions/:id/start     모니터링 시작
DELETE /api/dynamic-analysis/sessions/:id           세션 종료 + LLM 종합 분석
```

- `adapterId` 필수: 해당 프로젝트 소속이 아닌 어댑터 지정 시 에러 반환
- 미연결 어댑터 지정 시 에러 반환

세션 생명주기: `connected` → `monitoring` → `stopped`

### P1-5b. CAN 메시지 주입 ✅

분석가가 모니터링 세션에서 CAN 메시지를 직접 주입하고 ECU 응답을 확인할 수 있다.

```
GET    /api/dynamic-analysis/scenarios                     사전정의 공격 시나리오 목록 (6개)
POST   /api/dynamic-analysis/sessions/:id/inject           CAN 메시지 단일 주입
POST   /api/dynamic-analysis/sessions/:id/inject-scenario  사전정의 시나리오 실행
GET    /api/dynamic-analysis/sessions/:id/injections       주입 이력 조회
```

- 세션이 `monitoring` 상태가 아니면 400 반환
- 주입 메시지는 CAN 스트림에 `injected: true`로 투입 → 룰 엔진 평가 + WS push
- ECU 응답 분류: `normal` / `crash` / `anomaly` / `timeout`
- WS `injection-result` 이벤트로 주입 결과 실시간 push

#### 사전정의 공격 시나리오 (6개)

| ID | 이름 | 설명 | 심각도 |
|----|------|------|--------|
| `dos-burst` | DoS Burst | 동일 메시지 10회 고속 반복 | high |
| `diagnostic-abuse` | 진단 서비스 남용 | 0x7DF 진단 ID 비인가 명령 3종 | critical |
| `replay-attack` | 리플레이 공격 | 동일 페이로드 5회 반복 | high |
| `bus-off` | Bus-Off 유도 | 0xFF 페이로드 Bus-Off | critical |
| `unauthorized-id` | 비인가 CAN ID | 허용 외 CAN ID 3종 | medium |
| `boundary-probe` | 경계값 탐색 | 0x00/0xFF/0x7F/0x80 | medium |

### P1-6. 분석 결과 삭제 ✅

```
DELETE /api/static-analysis/results/:analysisId
```

- 분석 결과 삭제 (프론트 요청으로 추가)

### 동적 분석 DB 테이블 (3개)

| 테이블 | 용도 |
|--------|------|
| `dynamic_analysis_sessions` | 세션 관리 (id, project_id, status, source, counts, timestamps) |
| `dynamic_analysis_alerts` | 이상 탐지 알림 (severity, title, description, llm_analysis, related_messages) |
| `dynamic_analysis_messages` | CAN 메시지 로그 (session_id, timestamp, can_id, dlc, data, flagged, injected) |

---

## P1: 동적 테스트 (퍼징/침투) ✅ 구현 완료

동적 분석이 ECU에 수동적으로 붙어 CAN 트래픽을 관찰하는 것이라면, 동적 테스트는 **ECU에 능동적으로 패킷을 주입하고 반응을 관찰**하는 것이다.

### P1-5. 퍼징/침투 테스트 실행 ✅

```
POST /api/dynamic-test/run
Body: { "projectId": string, "config": DynamicTestConfig, "adapterId": string, "testId"?: string }
```

- `adapterId` 필수: 해당 프로젝트 소속이 아닌 어댑터 또는 미연결 어댑터 지정 시 에러 반환
- `testId`는 optional — S1이 WS 프로그레스를 받기 위해 미리 생성하여 전달할 수 있다.
- `config.testType`: `"fuzzing"` | `"pentest"`
- `config.strategy`: `"random"` | `"boundary"` | `"scenario"`
- `config.count`: optional. random 전략에서만 필수 (1~1000, 기본값 10). boundary/scenario는 고정 입력셋이므로 무시됨
- 동일 프로젝트 동시 실행 방지 (409 Conflict)

```
요청 수신 (projectId + config + testId?)
  → DB 초기 레코드 저장 (status: "running")
  → InputGenerator.generate(config) — 3전략 입력 생성
      random: count개 무작위 CAN 프레임 (count 필수, 1~1000)
      boundary: 경계값 고정 12개 (count 무시)
      scenario: 공격 시나리오 고정 20개 (count 무시)
  → AdapterManager.getClient(adapterId) → AdapterClient (IEcuAdapter)
  → 각 입력 순차 실행:
      ecuAdapter.sendAndReceive(input) → Adapter → ECU Sim → inject-response
      응답 분류 (crash / anomaly / timeout / normal)
      Finding 생성 시 → WS test-finding push
      WS test-progress push (current/total/crashes/anomalies)
  → findings가 있으면 S3 LLM 분석 호출
      testResults 텍스트 포맷 변환
      llmClient.analyze({ module: "dynamic_testing", testResults })
      LLM 결과를 각 finding.llmAnalysis에 매핑
  → DynamicTestResult DB 업데이트 (status: "completed")
  → AnalysisResult로도 저장 (module: "dynamic_testing", Overview 호환)
  → WS test-complete
  → DynamicTestResult 반환
```

**LLM 실패 시**: 1계층 결과(findings)만으로 완전한 결과 반환 (graceful degradation)

#### ECU 주입 응답

S2는 `AdapterClient` (IEcuAdapter 구현)를 통해 Adapter → ECU Simulator에 주입 요청을 보내고 응답을 받는다.
MockEcu는 fallback/단위 테스트용으로 유지하며, 동일한 응답 규칙을 따른다.

> 응답 규칙 상세 (6가지 시나리오별 응답)는 [ECU Simulator 명세 — 주입 응답 규칙](ecu-simulator.md#주입-응답-규칙-ecuengine) 참조.

#### WebSocket 프로그레스

```
WS: /ws/dynamic-test?testId=xxx
```

메시지 타입:
- `test-progress`: `{ testId, current, total, crashes, anomalies, message }`
- `test-finding`: `{ testId, finding: DynamicTestFinding }` — 비정상 발견 시 실시간 push
- `test-complete`: `{ testId }`
- `test-error`: `{ testId, error }`

### P1-6. 동적 테스트 결과 조회/삭제 ✅

```
GET    /api/dynamic-test/results?projectId=   프로젝트별 테스트 결과 목록
GET    /api/dynamic-test/results/:testId      결과 상세 조회
DELETE /api/dynamic-test/results/:testId      결과 삭제
```

- 테스트 실행 결과 반환 (DynamicTestResult)
- crashes/anomalies 카운트 + findings 배열 + LLM 해석 포함

### 동적 테스트 DB 테이블

| 테이블 | 용도 |
|--------|------|
| `dynamic_test_results` | 테스트 결과 (id, project_id, config(JSON), status, total_runs, crashes, anomalies, findings(JSON), created_at) |

---

## P1: 프로젝트 관리 ✅ 구현 완료

### P1-8. 프로젝트 CRUD ✅

```
POST   /api/projects              프로젝트 생성  Body: { name, description? }
GET    /api/projects              프로젝트 목록
GET    /api/projects/:id          프로젝트 상세
PUT    /api/projects/:id          프로젝트 수정  Body: { name?, description? }
DELETE /api/projects/:id          프로젝트 삭제
```

- 모든 분석 결과는 프로젝트에 종속 (projectId)
- SQLite `projects` 테이블에 저장
- 응답 형식: `ProjectResponse` / `ProjectListResponse`

### P1-9. 프로젝트 Overview API ✅

```
GET /api/projects/:id/overview
```

- 해당 프로젝트의 분석 결과 종합 (`ProjectOverviewResponse`)
- `fileCount`: 프로젝트에 업로드된 파일 수
- 취약점 집계: **모듈별 최신 완료 분석 1건**의 summary만 합산 (재분석 시 중복 방지)
- 최근 분석 이력 (최대 10건)

### P1-10. 프로젝트 파일 관리 API ✅

```
GET    /api/projects/:projectId/files              프로젝트 파일 목록
GET    /api/files/:fileId/download                  파일 내용 다운로드 (text/plain)
DELETE /api/projects/:projectId/files/:fileId        프로젝트에서 파일 삭제
```

- `uploaded_files` 테이블에 `project_id` 컬럼 + 인덱스 추가 완료
- `GET files`: 해당 프로젝트의 `UploadedFile[]` 반환 (`ProjectFilesResponse`)
- `GET download`: 파일 content를 `text/plain`으로 반환, `Content-Disposition` 헤더 포함
- `DELETE`: 프로젝트+파일 ID 일치 시 삭제

---

## 프로젝트별 룰 관리 API ✅ 구현 완료

룰은 프로젝트 단위로 관리된다. 프로젝트 생성 시 22개 기본 룰이 자동 시딩되며, 사용자가 자유롭게 추가/수정/삭제할 수 있다. 빌트인/커스텀 구분 없이 모든 룰이 동일하게 CRUD 가능하다.

```
GET    /api/projects/:pid/rules              프로젝트 룰 목록
POST   /api/projects/:pid/rules              룰 생성  Body: { name, pattern, severity?, description?, suggestion?, fixCode? }
PUT    /api/projects/:pid/rules/:id          룰 수정  Body: { name?, pattern?, severity?, enabled?, ... }
DELETE /api/projects/:pid/rules/:id          룰 삭제
```

- `pattern`은 JavaScript 정규식 문자열 (유효하지 않으면 400)
- 정적 분석 실행 시 해당 프로젝트의 enabled 룰만 사용 (per-analysis RuleEngine 빌드)
- DB `rules` 테이블: `id, name, severity, description, suggestion, pattern, fix_code, enabled, project_id, created_at`
- 프로젝트 삭제 시 소속 룰 cascade 삭제

---

## 프로젝트 설정 API ✅ 구현 완료

프로젝트별 설정을 KV 테이블(`project_settings`)로 관리한다. 미설정 키는 서버 기본값으로 fallback.

```
GET /api/projects/:pid/settings           프로젝트 설정 조회 (모든 키, 기본값 포함)
PUT /api/projects/:pid/settings           설정 수정 (부분 업데이트)  Body: { llmUrl?: string }
```

- 빈 문자열(`""`) PUT 시 해당 키 삭제 → 기본값 복원
- 프로젝트 삭제 시 설정 cascade 삭제
- 분석 서비스(정적/동적/테스트)는 `ProjectSettingsService.get(projectId, "llmUrl")`로 프로젝트별 LLM URL 해석

| 키 | 타입 | 기본값 | 설명 |
|----|------|--------|------|
| `llmUrl` | string | `LLM_GATEWAY_URL` 환경변수 (기본 `http://localhost:8000`) | 프로젝트가 사용할 LLM Gateway 주소 |
| `buildProfile` | BuildProfile (optional) | — | 빌드 환경 설정 (SDK, 컴파일러, 타겟 아키텍처 등). JSON으로 저장 |

---

## SDK 프로파일 API ✅ 구현 완료

사전 정의 SDK 프로파일 조회. BuildProfile 설정 시 SDK를 선택하면 컴파일러, 타겟 아키텍처, 언어 표준 등이 자동 추론된다.

```
GET /api/sdk-profiles              사전 정의 SDK 프로파일 목록
GET /api/sdk-profiles/:id          특정 SDK 프로파일 상세 (defaults 포함)
```

- 목록: 모든 사전 정의 SDK 프로파일 반환 (`SdkProfile[]`)
- 상세: `defaults` 필드에 BuildProfile 기본값 포함 (compiler, targetArch, languageStandard, headerLanguage 등)
- 존재하지 않는 ID 요청 시 404

---

## 코어 도메인: Run + Finding + EvidenceRef ✅ 구현 완료

기존 파이프라인의 결과물(Vulnerability, DynamicAlert, DynamicTestFinding)을 정규화된 도메인 모델로 변환하는 레이어. 기존 파이프라인은 수정 없이 유지되며, `AnalysisResult` 저장 직후 `ResultNormalizer`가 Run → Finding → EvidenceRef를 원자적으로 생성한다.

### ResultNormalizer

- **멱등성**: 동일 AnalysisResult에 대해 중복 Run 미생성
- **원자성**: `db.transaction()`으로 Run + Findings + EvidenceRefs 일괄 저장
- **안전성**: 정규화 실패해도 기존 파이프라인 반환을 막지 않음

| 파이프라인 | source=rule | source=llm | EvidenceRef |
|-----------|-------------|------------|-------------|
| 정적 분석 | status: open, confidence: high | status: sandbox, confidence: medium | analysis-result + uploaded-file (line-range) |
| 동적 분석 | status: open, confidence: high | status: sandbox, confidence: medium | dynamic-session (timestamp-window) |
| 동적 테스트 | status: open, confidence: severity 기반 | sourceType: both, status: needs_review | test-result (request-response-pair) |

### Finding 라이프사이클 (7-state)

```
open             → needs_review
sandbox          → needs_review
needs_review     → accepted_risk | false_positive | fixed | open
accepted_risk    → needs_review
false_positive   → needs_review
fixed            → needs_revalidation
needs_revalidation → open | fixed
```

상태 변경 시 `audit_log` 테이블에 변경 이력 기록 (actor, from, to, reason).

### Run API

```
GET /api/projects/:pid/runs              프로젝트 Run 목록
GET /api/runs/:id                        Run 상세 (findings 포함)
```

### Finding API

```
GET   /api/projects/:pid/findings            Finding 목록 (?status=&severity=&module=&sourceType=&q=&sort=&order=)
GET   /api/projects/:pid/findings/summary    집계 (byStatus, bySeverity, total)
GET   /api/findings/:id                      Finding 상세 (evidenceRefs + auditLog 포함)
PATCH /api/findings/:id/status               상태 변경 Body: { status, reason, actor? }
PATCH /api/findings/bulk-status              벌크 상태 변경 Body: { findingIds[], status, reason, actor? }
GET   /api/findings/:id/history              Finding 이력 (동일 fingerprint의 전체 이력)
```

- **벌크 상태 변경**: findingIds 최대 100개, 유효 전이만 반영, 결과: `{ updated, skipped, errors }`
- **Finding 이력**: fingerprint 기반으로 재분석 간 동일 취약점의 상태 변경 이력 추적
- **검색/정렬 확장**: `q` (full-text 제목/설명 검색), `sort` (severity/createdAt/location), `order` (asc/desc)
- **쿼리 파라미터 검증**: status, severity, sort, order에 유효하지 않은 값이 들어오면 400 반환

### 코어 도메인 DB 테이블 (3개)

| 테이블 | 용도 |
|--------|------|
| `runs` | Run (id, project_id, module, status, analysis_result_id, finding_count, started_at, ended_at) |
| `findings` | Finding (id, run_id, project_id, module, status, severity, confidence, source_type, title, description, location, suggestion, rule_id) |
| `evidence_refs` | EvidenceRef (id, finding_id, artifact_id, artifact_type, locator_type, locator(JSON)) |

---

## Quality Gate ✅ 구현 완료

Run 완료 시 `ResultNormalizer`가 `QualityGateService.evaluateRun()`을 자동 호출하여 gate 평가.

### 평가 규칙

| 조건 | 결과 |
|------|------|
| critical 또는 high severity finding이 open 상태 | **fail** |
| sandbox 상태 finding이 미검토 | **warning** (sandbox-unreviewed) |
| evidence 미연결 finding | **warning** (no-evidence) |
| 위 조건 모두 해당 없음 | **pass** |

### Gate API

```
GET /api/projects/:pid/gates      프로젝트 Gate 목록
GET /api/gates/:id                Gate 상세 (rules 배열 포함)
```

### Gate Override

Approval 승인 시 해당 gate에 override가 적용된다 (`override: { overriddenBy, reason }`).

## Approval ✅ 구현 완료

인증 없이 local confirmation 방식. 고위험 액션(gate override 등) 시 pending 상태로 대기, 승인/거부로 결정.

### Approval API

```
GET  /api/projects/:pid/approvals        프로젝트 Approval 목록
GET  /api/projects/:pid/approvals/count  Approval 카운트 (pending/total)
POST /api/approvals/:id/decide           승인/거부  Body: { decision: "approved"|"rejected", actor, comment }
```

- `decision: "approved"` + `actionType: "gate.override"` → 대상 gate에 override 자동 적용
- audit_log에 결정 이력 기록

## Report ✅ 구현 완료

프로젝트 전체 또는 모듈별 보고서 생성. findings + runs + gates + approvals + audit trail 포함.

### Report API

```
GET /api/projects/:pid/report          프로젝트 전체 보고서
GET /api/projects/:pid/report/static   정적 분석 모듈 보고서
GET /api/projects/:pid/report/dynamic  동적 분석 모듈 보고서
GET /api/projects/:pid/report/test     동적 테스트 모듈 보고서
```

- 필터 쿼리: `?severity=high,critical&status=open&runId=xxx&from=2026-01-01&to=2026-03-17`
- 프로젝트 미존재 시 404, findings 없어도 빈 보고서 200 반환

### SAST 도구 통합

외부 SAST 도구(Semgrep)를 정적 분석 파이프라인에 통합한다. S2가 코드 → SAST 실행 → `SastFinding[]` 수집 → S3에 `context.trusted.sastFindings`로 전달. LLM 역할이 "탐지자"에서 "해석자/검증자"로 전환된다.

- 타입 정의 완료 (`SastFinding`, `SastFindingLocation`, `SastDataFlowStep`)
- API 계약 확장 완료 (`LlmAnalyzeRequest.sastFindings`, `evidenceRefs` artifactType `"sast-finding"`)
- 미구현: Semgrep 실행 인프라, 결과 파서, 파이프라인 통합

### 사용자 인증 (후순위)

```
POST /api/auth/register           회원가입
POST /api/auth/login              로그인 (JWT 발급)
POST /api/auth/logout             로그아웃
GET  /api/auth/me                 현재 사용자 정보
```

- JWT 기반 인증. Approval 고도화 시 필요

---

## 내부 아키텍처

```
[Express.js Router]
    │
    ├── AnalysisController (Quick→Deep 통합 파이프라인)
    │       → AnalysisOrchestrator
    │             → SastClient → S4 (Quick SAST 스캔)
    │             → AgentClient → S3 (Deep 에이전트 분석)
    │             → AnalysisTracker (비동기 진행 추적, abort 지원)
    │             → ResultNormalizer → RunDAO, FindingDAO, EvidenceRefDAO
    │             → WsBroadcaster (analysisWs, 프로그레스 push)
    │
    ├── PipelineController (서브 프로젝트 파이프라인)
    │       → PipelineOrchestrator
    │             → BuildAgentClient → S3 Build Agent (build-resolve)
    │             → SastClient → S4 (빌드 + 스캔)
    │             → KbClient → S5 (코드그래프 적재)
    │             → WsBroadcaster (pipelineWs, 타겟별 상태 push)
    │
    ├── ProjectSourceController (소스코드 업로드)
    │       → ProjectSourceService (ZIP 해제 → uploads/{pid}/)
    │             → WsBroadcaster (uploadWs, 업로드 진행률)
    │
    ├── BuildTargetController (서브 프로젝트 관리)
    │       → BuildTargetService
    │             → BuildTargetDAO
    │
    ├── TargetLibraryController (서드파티 라이브러리)
    │       → TargetLibraryDAO
    │
    ├── SdkController (SDK 등록/관리)
    │       → SdkService
    │             → SdkRegistryDAO, ProjectSettingsService
    │             → WsBroadcaster (sdkWs)
    │
    ├── ActivityController (프로젝트 활동 타임라인)
    │       → ActivityService
    │             → AuditLogDAO, RunDAO, BuildTargetDAO
    │
    ├── StaticAnalysisController (레거시 — Transient)
    │       → StaticAnalysisService
    │             → LlmV1Adapter → LlmTaskClient (레거시 2계층)
    │
    ├── DynamicAnalysisController
    │       → DynamicAnalysisService
    │             → WsBroadcaster, CanRuleEngine
    │             → LlmV1Adapter → LlmTaskClient (레거시 2계층)
    │
    ├── DynamicTestController
    │       → DynamicTestService
    │             → InputGenerator, AdapterClient
    │             → LlmV1Adapter → LlmTaskClient (레거시 2계층)
    │
    ├── ProjectController (CRUD + Overview + targetSummary)
    │       → ProjectService → ProjectDAO, BuildTargetDAO
    │
    ├── FindingController (목록/상세/상태/벌크/이력)
    │       → FindingService → FindingDAO, EvidenceRefDAO, AuditLogDAO
    │
    ├── QualityGateController / ApprovalController / ReportController / RunController
    │
    ├── ProjectAdaptersController → AdapterManager
    ├── ProjectSettingsController → ProjectSettingsService
    ├── FileController → FileStore
    └── HealthController (S4, S3, S5, S7, Build Agent, Adapter 상태 확인)
```

- Controller: 요청 수신, 입력 검증, 응답 반환
- Service: 비즈니스 로직, 오케스트레이션
- DAO: DB 접근 캡슐화 (SQLite via `better-sqlite3`, 인터페이스: `dao/interfaces.ts`)
- 외부 클라이언트 5개: `SastClient(S4)`, `AgentClient(S3)`, `BuildAgentClient(S3:8003)`, `KbClient(S5)`, `AdapterClient(S6)`
- Transient(레거시): `LlmV1Adapter`, `LlmTaskClient` — 동적분석/테스트가 아직 사용 중. 리팩토링 후 제거 예정

---

## 소스 디렉토리 구조

```
services/backend/src/
├── index.ts                          앱 진입점 (Express 초기화, DI, 라우터 마운트, WS attach)
├── bootstrap.ts                      서버 기동 시 기존 실행 분석 상태 복구
├── composition.ts                    Composition Root (DI — DAO + 서비스 + WS 와이어링)
├── router-setup.ts                   라우터 마운트 설정
├── config.ts                         AppConfig (환경변수 → 타입 안전 설정)
├── db.ts                             SQLite 초기화, 테이블 19개 생성, 마이그레이션
├── controllers/
│   ├── health.controller.ts          GET /health (S4,S3,S5,S7,BuildAgent 상태 확인)
│   ├── analysis.controller.ts        Quick→Deep 분석 통합 API (POST run, GET status, DELETE abort)
│   ├── pipeline.controller.ts        서브 프로젝트 파이프라인 실행 API
│   ├── project-source.controller.ts  소스코드 업로드 (ZIP/Git) API
│   ├── build-target.controller.ts    BuildTarget CRUD API
│   ├── target-library.controller.ts  서드파티 라이브러리 API
│   ├── sdk.controller.ts             SDK 등록/관리 API
│   ├── activity.controller.ts        프로젝트 활동 타임라인 API
│   ├── project.controller.ts         CRUD + Overview (targetSummary 포함)
│   ├── finding.controller.ts         Finding 목록/상세/상태/벌크/이력 + 쿼리 검증
│   ├── approval.controller.ts        Approval 목록/카운트/승인/거부 API
│   ├── run.controller.ts             Run 목록/상세 API
│   ├── quality-gate.controller.ts    Quality Gate 목록/상세 API
│   ├── report.controller.ts          프로젝트/모듈별 보고서 생성 API
│   ├── file.controller.ts            프로젝트 파일 목록/다운로드/삭제
│   ├── project-adapters.controller.ts 프로젝트 스코프 어댑터 CRUD+연결
│   ├── project-settings.controller.ts 프로젝트 설정 GET/PUT + SDK 프로파일
│   ├── dynamic-analysis.controller.ts 동적 분석 REST API
│   └── dynamic-test.controller.ts     동적 테스트 API
├── services/
│   ├── analysis-orchestrator.ts       Quick→Deep 분석 오케스트레이터 (SastClient+AgentClient)
│   ├── pipeline-orchestrator.ts       서브 프로젝트 파이프라인 (빌드→스캔→코드그래프)
│   ├── sast-client.ts                S4 SAST Runner HTTP 클라이언트
│   ├── agent-client.ts               S3 Analysis Agent HTTP 클라이언트
│   ├── build-agent-client.ts          S3 Build Agent HTTP 클라이언트 (build-resolve)
│   ├── kb-client.ts                   S5 Knowledge Base HTTP 클라이언트 (코드그래프 적재)
│   ├── project-source.service.ts      소스코드 관리 (ZIP 해제, 파일 트리, 물리적 복사)
│   ├── build-target.service.ts        BuildTarget CRUD
│   ├── sdk.service.ts                 SDK 등록/분석/검증 워크플로우
│   ├── activity.service.ts            활동 타임라인 집계 (Run, AuditLog, BuildTarget)
│   ├── result-normalizer.ts           AnalysisResult → Run+Finding+EvidenceRef 정규화
│   ├── finding.service.ts             Finding CRUD + 7-state FSM + 벌크 상태 + 이력 + audit trail
│   ├── run.service.ts                 Run 읽기 전용 서비스
│   ├── analysis-tracker.ts            비동기 분석 진행 추적 (phase, abort 지원)
│   ├── quality-gate.service.ts        Quality Gate 자동 평가
│   ├── approval.service.ts            Approval 워크플로우 + 카운트
│   ├── report.service.ts              프로젝트/모듈별 보고서 생성
│   ├── project.service.ts             프로젝트 CRUD + Overview + targetSummary
│   ├── project-settings.service.ts    프로젝트 설정 (KV, 기본값 fallback, JSON 파싱 로깅)
│   ├── sdk-profiles.ts                사전 정의 SDK 프로파일 데이터
│   ├── ws-broadcaster.ts              제너릭 WebSocket broadcaster (7개 채널)
│   ├── adapter-manager.ts             프로젝트별 어댑터 관리
│   ├── adapter-client.ts              Adapter WS 클라이언트
│   ├── dynamic-analysis.service.ts    동적 분석 (Transient — LlmV1Adapter 사용)
│   ├── dynamic-test.service.ts        동적 테스트 (Transient — LlmV1Adapter 사용)
│   ├── llm-v1-adapter.ts              Transient: v0→v1 변환 어댑터 (동적분석 전용)
│   ├── llm-task-client.ts             Transient: S7 v1 Task API 클라이언트 (동적분석 전용)
│   ├── mock-ecu.ts                    Mock ECU (테스트용)
│   ├── input-generator.ts             3전략 입력 생성기
│   └── attack-scenarios.ts            사전정의 공격 시나리오 6개
├── dao/
│   ├── interfaces.ts                  DAO 인터페이스 정의 (8개 핵심 DAO)
│   ├── finding.dao.ts                 findings 테이블 DAO (필터링, 집계, 벌크, fingerprint)
│   ├── run.dao.ts                     runs 테이블 DAO (trendByModule 포함)
│   ├── evidence-ref.dao.ts            evidence_refs 테이블 DAO
│   ├── audit-log.dao.ts              audit_log DAO (statusChanges, approvalDecisions)
│   ├── gate-result.dao.ts            gate_results DAO (statsByProject)
│   ├── approval.dao.ts               approvals DAO (findPending)
│   ├── build-target.dao.ts           build_targets DAO (updatePipelineState)
│   ├── target-library.dao.ts         target_libraries DAO
│   ├── sdk-registry.dao.ts           sdk_registry DAO
│   ├── project.dao.ts                projects 테이블 DAO
│   ├── analysis-result.dao.ts        analysis_results 테이블 DAO
│   ├── file-store.ts                  uploaded_files 테이블 DAO
│   ├── adapter.dao.ts                adapters 테이블 DAO
│   ├── project-settings.dao.ts       project_settings KV DAO
│   ├── dynamic-session.dao.ts        dynamic_analysis_sessions DAO
│   ├── dynamic-alert.dao.ts          dynamic_analysis_alerts DAO
│   ├── dynamic-message.dao.ts        dynamic_analysis_messages DAO
│   └── dynamic-test-result.dao.ts    dynamic_test_results DAO
├── lib/
│   ├── index.ts                       lib re-export
│   ├── errors.ts                      AppError 계층 (21개 에러 코드)
│   ├── logger.ts                      pino 기반 구조화 로거 (stdout + JSONL)
│   └── vulnerability-utils.ts         mergeAndDedup, computeSummary, sortBySeverity
├── middleware/
│   ├── async-handler.ts               Express async 핸들러 래퍼
│   ├── error-handler.middleware.ts    에러 → 구조화 응답 변환
│   ├── request-id.middleware.ts       X-Request-Id 생성/전파
│   └── request-logger.middleware.ts   요청/응답 로깅
├── rules/                             정적 분석 룰 (Transient)
│   ├── types.ts, rule-engine.ts, custom-rule.ts, default-rule-templates.ts
└── can-rules/                         동적 분석 CAN 룰
    ├── types.ts, can-rule-engine.ts
    ├── frequency-rule.ts, unauthorized-id-rule.ts, attack-signature-rule.ts
```

---

## 관련 문서

- [전체 개요](technical-overview.md)
- [S1. UI Service](frontend.md)
- [Adapter 명세](adapter.md) — ECU↔Backend 릴레이, WS 프로토콜, 메시지 형식
- [ECU Simulator 명세](ecu-simulator.md) — CAN 트래픽 생성, 주입 응답 규칙, 시나리오
