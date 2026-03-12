# Shared (S1-S2) 데이터 구조 명세

> `@smartcar/shared` 패키지에 정의되는 Model, DTO
> S1(Frontend)과 S2(Backend) 양쪽에서 직접 import하여 사용
> **이 문서는 S2가 단독 관리한다.** 변경 시 S1에게 work-request로 통보

---

## Model

비즈니스 도메인의 핵심 데이터 구조. DB 스키마나 API 형식에 의존하지 않는다.

### Project

분석 대상 프로젝트. 모든 분석 결과는 프로젝트에 종속된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| name | string | 프로젝트명 |
| description | string | 설명 |
| createdAt | string (ISO 8601) | 생성 시각 |
| updatedAt | string (ISO 8601) | 수정 시각 |

### Vulnerability

취약점 하나를 표현한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| severity | `"critical" \| "high" \| "medium" \| "low" \| "info"` | 심각도 |
| title | string | 취약점 제목 |
| description | string | 상세 설명 |
| location | string (optional) | 발생 위치 (파일:라인) |
| source | `"rule" \| "llm"` | 탐지 출처 |
| ruleId | string (optional) | 룰 탐지 시 룰 ID |
| suggestion | string (optional) | 수정 방안 |
| fixCode | string (optional) | 수정 코드 예시 |

### AnalysisResult

하나의 분석 수행 결과를 표현한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| **projectId** | string | 소속 프로젝트 ID |
| module | `"static_analysis" \| "dynamic_analysis" \| "dynamic_testing"` | 수행 모듈 |
| status | `"pending" \| "running" \| "completed" \| "failed"` | 분석 상태 |
| vulnerabilities | Vulnerability[] | 발견된 취약점 목록 |
| summary | AnalysisSummary | 요약 통계 |
| warnings | AnalysisWarning[] (optional) | 분석 중 발생한 경고 목록 |
| analyzedFileIds | string[] (optional) | 실제 분석된 파일 ID 목록 |
| createdAt | string (ISO 8601) | 생성 시각 |

### AnalysisSummary

분석 결과 요약 통계.

| 필드 | 타입 | 설명 |
|------|------|------|
| total | number | 총 취약점 수 |
| critical | number | Critical 건수 |
| high | number | High 건수 |
| medium | number | Medium 건수 |
| low | number | Low 건수 |
| info | number | Info 건수 |

### AnalysisWarning

분석 중 발생한 비치명적 경고 (일부 청크 실패, LLM 불가 등).

| 필드 | 타입 | 설명 |
|------|------|------|
| code | string | 경고 코드 (`"LLM_CHUNK_FAILED"` \| `"LLM_UNAVAILABLE"` \| `"CHUNK_TOO_LARGE"`) |
| message | string | 경고 메시지 |
| details | string (optional) | 상세 정보 |

### Rule

패턴 매칭 룰 정보. 프로젝트에 종속되며, 프로젝트 생성 시 22개 기본 룰이 시딩된다 (모두 수정·삭제 가능).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| name | string | 룰 이름 |
| severity | Severity | 심각도 |
| description | string | 룰 설명 |
| suggestion | string | 수정 제안 |
| pattern | string | 정규식 패턴 |
| fixCode | string (optional) | 수정 코드 예시 |
| enabled | boolean | 활성화 여부 |
| projectId | string | 소속 프로젝트 ID |
| createdAt | string (ISO 8601) | 생성 시각 |

### EcuMeta

ECU 메타데이터. 어댑터 연결 시 ECU 시뮬레이터가 전송한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | ECU 식별자 (예: "Engine_ECU") |
| canIds | string[] | 이 ECU가 사용하는 CAN ID 목록 (예: ["0x100", "0x200"]) |

### Adapter

ECU 어댑터 정보. 프로젝트에 종속된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| name | string | 어댑터 이름 |
| url | string | WebSocket 접속 URL |
| connected | boolean | 서버-어댑터 연결 상태 |
| ecuConnected | boolean | 어댑터-ECU 연결 상태 |
| ecuMeta | EcuMeta[] (optional) | 연결된 ECU 메타데이터 (현재 1:1, 배열로 1:N 확장 가능) |
| projectId | string | 소속 프로젝트 ID |
| createdAt | string (ISO 8601) | 생성 시각 |

### ProjectSettings

프로젝트별 설정.

| 필드 | 타입 | 설명 |
|------|------|------|
| llmUrl | string | LLM Gateway URL (프로젝트별 오버라이드) |

### UploadedFile

업로드된 파일 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| name | string | 파일명 |
| size | number | 파일 크기 (bytes) |
| language | string (optional) | 감지된 언어 (c, cpp, python 등) |
| projectId | string (optional) | 소속 프로젝트 ID |
| path | string (optional) | 서버 내 파일 경로 |
| createdAt | string (optional, ISO 8601) | 업로드 시각 |

### DynamicSource

동적 분석/테스트의 데이터 소스 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| type | `"adapter"` | 소스 유형 |
| adapterId | string | 어댑터 ID |
| adapterName | string | 어댑터 이름 |

### DynamicAnalysisSession

동적 분석 세션 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| **projectId** | string | 소속 프로젝트 ID |
| status | `"connected" \| "monitoring" \| "stopped"` | 세션 상태 |
| source | DynamicSource | 데이터 소스 (어댑터) 정보 |
| messageCount | number | 수신 메시지 수 |
| alertCount | number | 탐지 알림 수 |
| startedAt | string (ISO 8601) | 시작 시각 |
| endedAt | string (optional, ISO 8601) | 종료 시각 |

### CanMessage

CAN 메시지 하나를 표현한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| timestamp | string (ISO 8601) | 수신 시각 |
| id | string | CAN ID (hex) |
| dlc | number | 데이터 길이 |
| data | string | 페이로드 (hex) |
| flagged | boolean | 이상 탐지 여부 |
| injected | boolean (optional) | 분석가가 주입한 메시지 여부 |

### DynamicAlert

동적 분석에서 발생한 이상 탐지 알림.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| severity | `"critical" \| "high" \| "medium" \| "low" \| "info"` | 심각도 |
| title | string | 알림 제목 |
| description | string | 룰 기반 탐지 설명 |
| llmAnalysis | string (optional) | LLM 심층 분석 결과 |
| relatedMessages | CanMessage[] | 관련 CAN 메시지 |
| detectedAt | string (ISO 8601) | 탐지 시각 |

### CanInjectionRequest

CAN 메시지 주입 요청.

| 필드 | 타입 | 설명 |
|------|------|------|
| canId | string | CAN ID (예: "0x7DF") |
| dlc | number | 데이터 길이 (0-8) |
| data | string | 페이로드 (hex, 예: "FF FF FF FF FF FF FF FF") |
| label | string (optional) | 사람이 읽을 수 있는 라벨 |

### CanInjectionResponse

CAN 메시지 주입 결과.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 주입 결과 고유 식별자 |
| request | CanInjectionRequest | 원본 요청 |
| ecuResponse | object | ECU 응답 (`{ success, data?, error?, delayMs? }`) |
| classification | `"normal" \| "crash" \| "anomaly" \| "timeout"` | 응답 분류 |
| injectedAt | string (ISO 8601) | 주입 시각 |

### AttackScenario

사전정의 공격 시나리오.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | AttackScenarioId | 시나리오 식별자 |
| name | string | 시나리오 이름 |
| description | string | 설명 |
| severity | Severity | 예상 심각도 |
| steps | CanInjectionRequest[] | 주입할 메시지 목록 |

> `AttackScenarioId`: `"dos-burst" \| "diagnostic-abuse" \| "replay-attack" \| "bus-off" \| "unauthorized-id" \| "boundary-probe"`

### Run

하나의 분석 수행을 나타내는 코어 도메인 엔티티. AnalysisResult가 저장된 후 ResultNormalizer가 생성한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | `"run-{uuid}"` |
| projectId | string | 소속 프로젝트 ID |
| module | `"static_analysis" \| "dynamic_analysis" \| "dynamic_testing"` | 분석 모듈 |
| status | `"pending" \| "running" \| "completed" \| "failed"` | Run 상태 |
| analysisResultId | string | 원본 AnalysisResult ID (역참조) |
| findingCount | number | 정규화된 Finding 수 |
| startedAt | string (optional, ISO 8601) | 시작 시각 |
| endedAt | string (optional, ISO 8601) | 종료 시각 |
| createdAt | string (ISO 8601) | 생성 시각 |

### Finding

정규화된 보안 발견 사항. 7-state 라이프사이클을 가진다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | `"finding-{uuid}"` |
| runId | string | 소속 Run ID |
| projectId | string | 소속 프로젝트 ID |
| module | AnalysisModule | 분석 모듈 |
| status | FindingStatus | 라이프사이클 상태 |
| severity | Severity | 심각도 |
| confidence | `"high" \| "medium" \| "low"` | 신뢰도 |
| sourceType | `"rule-engine" \| "llm-assist" \| "both"` | 탐지 출처 |
| title | string | 제목 |
| description | string | 상세 설명 |
| location | string (optional) | 발생 위치 |
| suggestion | string (optional) | 수정 방안 |
| ruleId | string (optional) | 룰 ID |
| createdAt | string (ISO 8601) | 생성 시각 |
| updatedAt | string (ISO 8601) | 수정 시각 |

> **FindingStatus** (7-state): `"open" \| "needs_review" \| "accepted_risk" \| "false_positive" \| "fixed" \| "needs_revalidation" \| "sandbox"`
>
> 상태 전이: `open → needs_review`, `sandbox → needs_review`, `needs_review → accepted_risk|false_positive|fixed|open`, `accepted_risk|false_positive → needs_review`, `fixed → needs_revalidation`, `needs_revalidation → open|fixed`

### EvidenceRef

Finding과 증적(artifact) 간의 참조 연결.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | `"evr-{uuid}"` |
| findingId | string | 소속 Finding ID |
| artifactId | string | 증적 ID (AnalysisResult, 파일, 세션 등) |
| artifactType | `"analysis-result" \| "uploaded-file" \| "dynamic-session" \| "test-result"` | 증적 유형 |
| locatorType | `"line-range" \| "packet-range" \| "timestamp-window" \| "request-response-pair"` | 위치 지시자 유형 |
| locator | object | 위치 상세 (예: `{ file, startLine, endLine }`) |
| createdAt | string (ISO 8601) | 생성 시각 |

### AuditLogEntry

감사 로그 엔트리. Finding 상태 변경 등 추적 가능한 액션을 기록한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| timestamp | string (ISO 8601) | 발생 시각 |
| actor | string | 수행자 |
| action | string | 액션 (예: `"finding.status_change"`) |
| resource | string | 리소스 유형 (예: `"finding"`) |
| resourceId | string (optional) | 리소스 ID |
| detail | object | 상세 정보 (예: `{ from, to, reason }`) |
| requestId | string (optional) | 요청 추적 ID |

### DynamicTestConfig

동적 테스트 설정.

| 필드 | 타입 | 설명 |
|------|------|------|
| testType | `"fuzzing" \| "pentest"` | 테스트 유형 |
| targetEcu | string | 대상 ECU |
| protocol | string | 프로토콜 (CAN 등) |
| targetId | string | 대상 메시지 ID |
| count | number (optional) | 테스트 횟수. `random` 전략 전용 (기본 10). `boundary`/`scenario`는 고정 입력셋 사용 |
| strategy | `"random" \| "boundary" \| "scenario"` | 입력 생성 전략 |

### DynamicTestResult

동적 테스트 실행 결과.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| **projectId** | string | 소속 프로젝트 ID |
| config | DynamicTestConfig | 테스트 설정 |
| status | `"pending" \| "running" \| "completed" \| "failed"` | 상태 |
| totalRuns | number | 총 실행 횟수 |
| crashes | number | 크래시 건수 |
| anomalies | number | 이상 응답 건수 |
| findings | DynamicTestFinding[] | 발견 사항 목록 |
| createdAt | string (ISO 8601) | 생성 시각 |

### DynamicTestFinding

동적 테스트에서 발견된 개별 사항.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| severity | `"critical" \| "high" \| "medium" \| "low" \| "info"` | 심각도 |
| type | `"crash" \| "anomaly" \| "timeout"` | 발견 유형 |
| input | string | 전송한 입력 (hex) |
| response | string (optional) | ECU 응답 (hex) |
| description | string | 설명 |
| llmAnalysis | string (optional) | LLM 해석 |

---

## DTO

서비스 경계(S1 ↔ S2)를 넘는 데이터 전송 객체.

### 프로젝트

#### ProjectCreateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 프로젝트명 |
| description | string (optional) | 설명 |

#### ProjectUpdateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string (optional) | 프로젝트명 |
| description | string (optional) | 설명 |

#### ProjectResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Project (optional) | 프로젝트 정보 |
| error | string (optional) | 에러 메시지 |

#### ProjectListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Project[] | 프로젝트 목록 |

### 프로젝트 Overview

#### ProjectOverviewResponse

선택된 프로젝트의 분석 결과 요약. 기존 DashboardStatsResponse를 대체한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| project | Project | 프로젝트 정보 |
| fileCount | number | 프로젝트에 업로드된 파일 수 |
| summary.totalVulnerabilities | number | 총 취약점 수 (모듈별 최신 분석 기준) |
| summary.bySeverity | AnalysisSummary | 심각도별 건수 |
| summary.byModule | `{ static, dynamic, test }` | 모듈별 건수 |
| recentAnalyses | AnalysisResult[] | 최근 분석 이력 |

> **취약점 집계 방식**: 모듈별 가장 최근 완료된 분석 1건의 summary만 합산한다.
> 이전 분석 이력을 전부 합산하면 같은 파일 재분석 시 중복 카운트되므로 최신 분석 기준으로 변경.

#### ProjectFilesResponse

프로젝트에 업로드된 파일 목록.

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | UploadedFile[] | 파일 목록 |

### 정적 분석

#### StaticAnalysisRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| **projectId** | string | 대상 프로젝트 ID |
| files | UploadedFile[] | 분석 대상 파일 목록 |
| options | object (optional) | 분석 옵션 |

#### StaticAnalysisResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | AnalysisResult (optional) | 분석 결과 |
| error | string (optional) | 에러 메시지 |

### 동적 분석

#### DynamicAnalysisSessionRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| **projectId** | string | 대상 프로젝트 ID |
| **adapterId** | string | 사용할 어댑터 ID |

#### DynamicAnalysisSessionResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | DynamicAnalysisSession (optional) | 세션 정보 |
| error | string (optional) | 에러 메시지 |

#### WebSocket 메시지 (S2 → S1 push)

| type | payload | 설명 |
|------|---------|------|
| `"message"` | CanMessage | 실시간 CAN 메시지 (`injected` 필드로 주입 구분) |
| `"alert"` | DynamicAlert | 이상 탐지 알림 |
| `"status"` | `{ messageCount, alertCount }` | 세션 상태 업데이트 |
| `"injection-result"` | CanInjectionResponse | CAN 주입 결과 |
| `"injection-error"` | `{ error: string }` | CAN 주입 실패 |

### 동적 테스트

#### DynamicTestRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| **projectId** | string | 대상 프로젝트 ID |
| **adapterId** | string | 사용할 어댑터 ID |
| config | DynamicTestConfig | 테스트 설정 |

#### DynamicTestResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | DynamicTestResult (optional) | 테스트 결과 |
| error | string (optional) | 에러 메시지 |

### 어댑터

#### AdapterCreateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 어댑터 이름 |
| url | string | WebSocket URL (`ws://` 또는 `wss://`) |

#### AdapterUpdateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string (optional) | 어댑터 이름 |
| url | string (optional) | WebSocket URL |

#### AdapterResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Adapter (optional) | 어댑터 정보 |
| error | string (optional) | 에러 메시지 |

#### AdapterListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Adapter[] | 어댑터 목록 |

### 프로젝트 설정

#### ProjectSettingsResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | ProjectSettings | 설정 정보 |

#### ProjectSettingsUpdateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| llmUrl | string (optional) | LLM Gateway URL |

### 룰

#### RuleCreateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 룰 이름 |
| pattern | string | 정규식 패턴 |
| severity | string (optional) | 심각도 (기본: medium) |
| description | string (optional) | 설명 |
| suggestion | string (optional) | 수정 제안 |
| fixCode | string (optional) | 수정 코드 예시 |

#### RuleUpdateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string (optional) | 룰 이름 |
| pattern | string (optional) | 정규식 패턴 |
| severity | string (optional) | 심각도 |
| description | string (optional) | 설명 |
| suggestion | string (optional) | 수정 제안 |
| fixCode | string (optional) | 수정 코드 예시 |
| enabled | boolean (optional) | 활성화 여부 |

#### RuleResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Rule (optional) | 룰 정보 |
| error | string (optional) | 에러 메시지 |

#### RuleListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Rule[] | 룰 목록 |

### Run

#### RunListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Run[] | Run 목록 |

#### RunDetailResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Run & { findings: Finding[] } (optional) | Run + Finding 목록 |
| error | string (optional) | 에러 메시지 |

### Finding

#### FindingListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Finding[] | Finding 목록 |

#### FindingDetailResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | Finding & { evidenceRefs: EvidenceRef[], auditLog: AuditLogEntry[] } (optional) | Finding + 증적 + 감사 로그 |
| error | string (optional) | 에러 메시지 |

#### FindingStatusUpdateRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| status | FindingStatus | 변경할 상태 |
| reason | string | 변경 사유 |
| actor | string (optional) | 수행자 (기본: "system") |

#### FindingSummaryResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data.byStatus | Record<string, number> | 상태별 카운트 |
| data.bySeverity | Record<string, number> | 심각도별 카운트 |
| data.total | number | 전체 Finding 수 |

### 공통

#### HealthResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| service | string | 서비스명 |
| status | `"ok" \| "error"` | 상태 |
| version | string | 버전 |

---

## 관련 문서

- [전체 개요](../specs/technical-overview.md)
- [S1. UI Service](../specs/frontend.md)
- [S2. Core Service](../specs/backend.md)
