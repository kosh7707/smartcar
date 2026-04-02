# Shared (S1-S2) 데이터 구조 명세

> `@aegis/shared` 패키지에 정의되는 Model, DTO
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
| location | string (optional) | 발생 위치. 형식: `"{filePath}:{lineNumber}"` (룰 엔진), `null` (LLM 결과 기본), 또는 `"{filePath}"` (단일 파일 청크 LLM fallback) |
| source | `"rule" \| "llm"` | 탐지 출처 |
| ruleId | string (optional) | 룰 탐지 시 룰 ID |
| suggestion | string (optional) | 수정 방안 |
| fixCode | string (optional) | 수정 코드 예시 |
| detail | string (optional) | 상세 분석 — 공격 경로, 영향 범위, 코드 흐름, 악용 시나리오 |
| cweId | string (optional) | CWE 식별자 (e.g. "CWE-120") |
| cveIds | string[] (optional) | CVE 식별자 목록 (e.g. ["CVE-2025-1234"]) |

### AnalysisResult

하나의 분석 수행 결과를 표현한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| **projectId** | string | 소속 프로젝트 ID |
| module | `"static_analysis" \| "dynamic_analysis" \| "dynamic_testing" \| "deep_analysis"` | 수행 모듈 |
| status | `"pending" \| "running" \| "completed" \| "failed" \| "aborted"` | 분석 상태 |
| vulnerabilities | Vulnerability[] | 발견된 취약점 목록 |
| summary | AnalysisSummary | 요약 통계 |
| warnings | AnalysisWarning[] (optional) | 분석 중 발생한 경고 목록 |
| analyzedFileIds | string[] (optional) | 실제 분석된 파일 ID 목록 |
| fileCoverage | FileCoverageEntry[] (optional) | 파일별 분석 커버리지 (정적 분석만) |
| caveats | string[] (optional) | Agent 분석 한계/불확실성 (deep_analysis만) |
| confidenceScore | number (optional) | Agent 신뢰도 원본 점수 (0.0~1.0) |
| confidenceBreakdown | ConfidenceBreakdown (optional) | Agent 신뢰도 세부 항목 |
| needsHumanReview | boolean (optional) | Agent가 사람 검토 필요 판단 |
| recommendedNextSteps | string[] (optional) | Agent 수정 권고 전체 목록 |
| policyFlags | string[] (optional) | 정책 플래그 (CWE-78, ISO21434 등) |
| scaLibraries | ScaLibrary[] (optional) | SCA 라이브러리 목록 |
| agentAudit | AgentAuditSummary (optional) | 에이전트 감사 요약 |
| createdAt | string (ISO 8601) | 생성 시각 |

### ConfidenceBreakdown

Agent 신뢰도 세부 항목. 각 값은 0.0~1.0.

| 필드 | 타입 | 설명 |
|------|------|------|
| grounding | number | 증적 근거 기반 판정 비율 |
| deterministicSupport | number | 결정론적 도구 뒷받침 비율 |
| ragCoverage | number | KB 위협 지식 커버리지 |
| schemaCompliance | number | 스키마 준수율 |

### ScaLibrary

SCA(Software Composition Analysis)로 탐지된 라이브러리 정보.

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 라이브러리 이름 (e.g. "openssl") |
| version | string (optional) | 버전 |
| path | string | 프로젝트 내 경로 |
| repoUrl | string (optional) | 원본 저장소 URL |

### AgentAuditSummary

에이전트 분석 감사 요약. S1 UI에서 분석 메타데이터 표시용.

| 필드 | 타입 | 설명 |
|------|------|------|
| latencyMs | number | 전체 소요 시간 (밀리초) |
| tokenUsage | `{ prompt: number, completion: number }` | LLM 토큰 사용량 |
| turnCount | number (optional) | 에이전트 루프 턴 수 |
| toolCallCount | number (optional) | 도구 호출 횟수 |
| terminationReason | string (optional) | 종료 사유 (e.g. "content_returned") |
| modelName | string (optional) | S7에서 실제 사용된 LLM 모델 식별자 (S3 Agent가 전달) |
| promptVersion | string (optional) | Agent 시스템 프롬프트 버전 (S3 관리) |

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
| code | string | 경고 코드 (`"LLM_CHUNK_FAILED"` \| `"LLM_UNAVAILABLE"` \| `"CHUNK_TOO_LARGE"` \| `"FILE_TOO_LARGE"` \| `"CHUNK_INPUT_SIZE_EXCEEDED"` \| `"LLM_NOTE"`) |
| message | string | 경고 메시지 |
| details | string (optional) | 상세 정보 |

### FileCoverageEntry

파일별 분석 커버리지 정보. 정적 분석에서만 사용된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| fileId | string | 파일 고유 식별자 |
| filePath | string | 파일 경로 |
| status | `"analyzed" \| "skipped"` | 분석 여부 |
| skipReason | string (optional) | 스킵 사유 (`"FILE_TOO_LARGE"` 등) |
| findingCount | number | 해당 파일의 Finding 수 |

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
| buildProfile | BuildProfile (optional) | 빌드 환경 설정 (SDK, 컴파일러, 타겟 아키텍처 등) |
| gateProfileId | string (optional) | Gate 프로필 ID (default/strict/relaxed). 미설정 시 "default" |
| analysisPolicy | object (optional) | 분석 정책 `{ tools?: string[], rulesets?: string[] }` |

### SdkProfileId

SDK 프로파일 식별자 타입. 사전 정의 SDK 또는 `"custom"`.

```typescript
type SdkProfileId = string;
```

### BuildProfile

프로젝트의 빌드 환경 설정. SDK 프로파일을 선택하면 나머지 필드가 자동 추론된다.

| 필드 | 타입 | 설명 |
|------|------|------|
| sdkId | SdkProfileId | SDK 프로파일 ID — 해석 체인: `"none"` → 하드코딩 SDK → 등록 SDK(`sdk-*`) → `"custom"` 폴백. `"none"`은 SDK 미사용(최소 프로파일). |
| compiler | string | 컴파일러 (SDK에서 추론 또는 사용자 지정) |
| compilerVersion | string (optional) | 컴파일러 버전 |
| targetArch | string | 타겟 아키텍처 (SDK에서 추론) |
| languageStandard | string | 언어 표준 (SDK에서 추론 또는 사용자 지정) |
| headerLanguage | `"c" \| "cpp" \| "auto"` | `.h` 파일 처리 방식 (SDK에서 추론 또는 사용자 지정) |
| includePaths | string[] (optional) | 추가 인클루드 경로 |
| defines | Record<string, string> (optional) | 추가 전처리기 매크로 |
| flags | string[] (optional) | 추가 컴파일 플래그 |

### SdkProfile

사전 정의 SDK 프로파일. SDK를 선택하면 BuildProfile의 기본값이 자동으로 채워진다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | SdkProfileId | SDK 프로파일 고유 식별자 |
| name | string | SDK 이름 (예: "STM32CubeIDE") |
| vendor | string | 제조사 (예: "STMicroelectronics") |
| description | string | SDK 설명 |
| defaults | Omit<BuildProfile, "sdkId"> | 이 SDK 선택 시 BuildProfile에 적용되는 기본값 |

### BuildTargetStatus

빌드 타겟(서브 프로젝트) 상태머신. 16가지 상태를 가진다.

```typescript
type BuildTargetStatus =
  | "discovered"        // S4 탐색으로 발견
  | "resolving"         // S3 Build Agent가 빌드 명령어 탐색 중
  | "configured"        // 빌드 설정 완료 (자동 또는 수동)
  | "resolve_failed"    // 빌드 탐색 실패 (비치명적: 기존 profile 있으면 계속)
  | "building"          // S4 빌드 실행 중 (compile_commands.json 생성)
  | "built"             // 빌드 완료
  | "scanning"          // S4 SAST 스캔 실행 중
  | "scanned"           // 스캔 완료
  | "graphing"          // S5 코드그래프 생성 중
  | "graphed"           // 코드그래프 적재 완료
  | "ready"             // 파이프라인 완료 (빌드+스캔+그래프 모두 완료)
  | "build_failed"      // 빌드 실패
  | "scan_failed"       // 스캔 실패
  | "graph_failed";     // 코드그래프 실패
```

### BuildTarget

프로젝트 내 독립 빌드 단위(서브 프로젝트). MSA 구조 프로젝트에서 각 서비스를 별도 타겟으로 관리한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 (`target-{uuid}`) |
| projectId | string | 소속 프로젝트 ID |
| name | string | 타겟 이름 (e.g. "gateway", "body-control") |
| relativePath | string | 프로젝트 루트 기준 상대 경로 (e.g. "gateway/") |
| buildProfile | BuildProfile | 타겟별 독립 빌드 설정 |
| buildSystem | "cmake" \| "make" \| "custom" (optional) | 빌드 시스템 (S4 탐색 결과) |
| buildCommand | string (optional) | S3 Build Agent가 결정한 빌드 명령어 |
| status | BuildTargetStatus | 파이프라인 상태 (기본: "discovered") |
| includedPaths | string[] (optional) | 물리적으로 복사할 소스 경로 목록 (JSON) |
| sourcePath | string (optional) | 복사된 소스의 실제 경로 |
| compileCommandsPath | string (optional) | S4 빌드 결과 compile_commands.json 경로 |
| buildLog | string (optional) | 빌드 로그 |
| sastScanId | string (optional) | S4 SAST 스캔 결과 ID |
| scaLibraries | ScaLibrary[] (optional) | SCA 라이브러리 목록 (JSON) |
| codeGraphStatus | string (optional) | S5 코드그래프 상태 |
| codeGraphNodeCount | number (optional) | 코드그래프 노드 수 |
| lastBuiltAt | string (optional, ISO 8601) | 마지막 빌드 시각 |
| createdAt | string (ISO 8601) | 생성 시각 |
| updatedAt | string (ISO 8601) | 수정 시각 |

### TargetLibrary

서브 프로젝트 내 서드파티 라이브러리. S4가 식별하고, 사용자가 스캔 포함/제외를 선택한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 (`lib-{uuid}`) |
| targetId | string | 소속 빌드 타겟 ID |
| projectId | string | 소속 프로젝트 ID |
| name | string | 라이브러리명 (e.g. "civetweb") |
| version | string (optional) | 버전 |
| path | string | 서브프로젝트 내 상대 경로 (e.g. "lib/civetweb/") |
| included | boolean | 스캔 포함 여부 (기본: false) |
| modifiedFiles | string[] | upstream 대비 수정된 파일 목록 |
| createdAt | string (ISO 8601) | 생성 시각 |
| updatedAt | string (ISO 8601) | 수정 시각 |

#### 라이브러리 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/targets/:tid/libraries` | 타겟의 서드파티 라이브러리 목록 |
| PATCH | `/api/projects/:pid/targets/:tid/libraries` | 라이브러리 포함/제외 설정 `{ libraries: [{ id, included }] }` |

### SdkRegistryStatus

```typescript
type SdkRegistryStatus =
  | "uploading"       // 유저가 SDK 파일 업로드 중
  | "extracting"      // 압축 해제 중
  | "analyzing"       // S3 Build Agent가 프로파일 자동 분석 중
  | "verifying"       // S4가 경로/컴파일러 검증 중
  | "ready"           // 사용 가능
  | "verify_failed";  // S4 검증 실패
```

### SdkAnalyzedProfile

S3 Build Agent가 SDK 경로를 분석하여 자동 채운 프로파일.

| 필드 | 타입 | 설명 |
|------|------|------|
| compiler | string (optional) | 컴파일러 전체 이름 (e.g. `arm-none-linux-gnueabihf-gcc`) |
| compilerPrefix | string (optional) | 크로스 컴파일러 prefix (e.g. `arm-none-linux-gnueabihf`) |
| gccVersion | string (optional) | GCC 버전 (e.g. `9.2.1`) |
| targetArch | string (optional) | 타겟 아키텍처 (e.g. `armv7-a`) |
| languageStandard | string (optional) | 언어 표준 (e.g. `c11`) |
| sysroot | string (optional) | Sysroot 상대 경로 |
| environmentSetup | string (optional) | 환경 설정 스크립트 상대 경로 |
| includePaths | string[] (optional) | 추가 인클루드 경로 |
| defines | Record<string, string> (optional) | 전처리기 매크로 |

### RegisteredSdk

유저 등록 SDK (DB 저장, 상태머신 보유).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 (`sdk-{uuid}`) |
| projectId | string | 소속 프로젝트 ID |
| name | string | SDK 이름 |
| description | string (optional) | 설명 |
| path | string | SDK 경로 (`/uploads/{pid}/sdk/{id}/` 또는 로컬 경로) |
| profile | SdkAnalyzedProfile (optional) | S3 Build Agent가 분석한 프로파일 |
| status | SdkRegistryStatus | 상태: `uploading → extracting → analyzing → verifying → ready \| verify_failed` |
| verifyError | string (optional) | S4 검증 실패 사유 |
| verified | boolean | S4 검증 통과 여부 |
| createdAt | string (ISO 8601) | 생성 시각 |
| updatedAt | string (ISO 8601) | 수정 시각 |

#### SDK API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/sdk` | 내장 + 등록 SDK 합산 목록 |
| GET | `/api/projects/:pid/sdk/:id` | 등록 SDK 상세 |
| POST | `/api/projects/:pid/sdk` | SDK 등록 (multipart file 또는 `{ name, localPath }`) → 202 |
| DELETE | `/api/projects/:pid/sdk/:id` | SDK 삭제 |

**GET /api/projects/:pid/sdk 응답 형식**:
```json
{
  "success": true,
  "data": {
    "builtIn": [ SdkProfile, ... ],
    "registered": [ RegisteredSdk, ... ]
  }
}
```

**POST /api/projects/:pid/sdk 요청 (JSON 모드)**:
```json
{ "name": "TI AM335x 08.02", "description": "...", "localPath": "/home/kosh/sdks/ti-am335x" }
```

**POST /api/projects/:pid/sdk 요청 (multipart 모드)**:
- `file`: SDK 압축 파일 (tar.gz / zip)
- `name`: SDK 이름 (필수)
- `description`: 설명 (선택)

#### WS `/ws/sdk?projectId=`

| 이벤트 | payload |
|--------|---------|
| `sdk-progress` | `{ sdkId, phase, message }` |
| `sdk-complete` | `{ sdkId, profile }` |
| `sdk-error` | `{ sdkId, error }` |

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

### InjectionClassification

ECU 주입 응답 분류 타입.

```typescript
type InjectionClassification = "normal" | "crash" | "anomaly" | "timeout";
```

### CanInjectionResponse

CAN 메시지 주입 결과.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 주입 결과 고유 식별자 |
| request | CanInjectionRequest | 원본 요청 |
| ecuResponse | object | ECU 응답 (`{ success, data?, error?, delayMs? }`) |
| classification | InjectionClassification | 응답 분류 |
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

### SastFinding (후속 과제 — SAST 도구 통합)

외부 SAST 도구(Semgrep, CodeQL 등)의 분석 결과를 표현한다. S2가 SAST 도구를 실행하여 수집하고, S3에 `context.trusted.sastFindings`로 전달한다.

#### SastFindingLocation

| 필드 | 타입 | 설명 |
|------|------|------|
| file | string | 소스 파일 경로 |
| line | number | 시작 줄 번호 |
| column | number (optional) | 시작 컬럼 |
| endLine | number (optional) | 종료 줄 번호 |
| endColumn | number (optional) | 종료 컬럼 |

#### SastDataFlowStep

| 필드 | 타입 | 설명 |
|------|------|------|
| file | string | 파일 경로 |
| line | number | 줄 번호 |
| content | string (optional) | 해당 줄 코드 스니펫 |

#### SastFinding

| 필드 | 타입 | 설명 |
|------|------|------|
| toolId | string | 도구 식별자 (`"semgrep"`, `"codeql"` 등) |
| ruleId | string | 도구의 룰 ID (예: `"semgrep:c.lang.security.insecure-use-gets-fn"`) |
| severity | string | 도구가 판정한 심각도 (S2가 Severity로 정규화) |
| message | string | 도구가 생성한 설명 |
| location | SastFindingLocation | 소스 위치 |
| dataFlow | SastDataFlowStep[] (optional) | taint tracking 결과 |
| metadata | object (optional) | 도구별 추가 정보 |

> **S3 전달 방식**: `TaskRequest.context.trusted.sastFindings: SastFinding[]`
>
> **Evidence**: SAST finding은 `evidenceRefs`에 `artifactType: "sast-finding"`, `locatorType: "lineRange"`로 등록. S3 Evidence Validator가 refId를 검증할 수 있다.

### Run

하나의 분석 수행을 나타내는 코어 도메인 엔티티. AnalysisResult가 저장된 후 ResultNormalizer가 생성한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | `"run-{uuid}"` |
| projectId | string | 소속 프로젝트 ID |
| module | `"static_analysis" \| "dynamic_analysis" \| "dynamic_testing" \| "deep_analysis"` | 분석 모듈 |
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
| sourceType | `"rule-engine" \| "llm-assist" \| "both" \| "agent" \| "sast-tool"` | 탐지 출처 |
| title | string | 제목 |
| description | string | 상세 설명 |
| location | string (optional) | 발생 위치 |
| suggestion | string (optional) | 수정 방안 |
| detail | string (optional) | 상세 분석 — 공격 경로, 영향 범위, 코드 흐름, 악용 시나리오 (Agent claim.detail) |
| ruleId | string (optional) | 룰 ID |
| fingerprint | string (optional) | 동일성 지문 — 재분석 시 같은 취약점 식별. `sha256(projectId+location+identifier+sourceType)` 앞 16자 |
| cweId | string (optional) | CWE 식별자 (e.g. "CWE-120") |
| cveIds | string[] (optional) | CVE 식별자 목록 |
| confidenceScore | number (optional) | 수치 확신도 (0.0~1.0). 기존 confidence 텍스트와 병존 |
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
| artifactType | `"analysis-result" \| "uploaded-file" \| "dynamic-session" \| "test-result" \| "sast-finding" \| "agent-assessment"` | 증적 유형 |
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

### ReportMeta

보고서 메타데이터.

| 필드 | 타입 | 설명 |
|------|------|------|
| generatedAt | string (ISO 8601) | 보고서 생성 시각 |
| projectId | string | 프로젝트 ID |
| projectName | string | 프로젝트명 |
| module | AnalysisModule | 분석 모듈 |

### ReportSummary

보고서 집계 요약.

| 필드 | 타입 | 설명 |
|------|------|------|
| totalFindings | number | 총 Finding 수 |
| bySeverity | Record<string, number> | 심각도별 건수 |
| byStatus | Record<string, number> | 상태별 건수 |
| bySource | Record<string, number> | 출처별 건수 |

### RunReportEntry

보고서 내 Run 항목.

| 필드 | 타입 | 설명 |
|------|------|------|
| run | Run | Run 정보 |
| gate | GateResult (optional) | Quality Gate 결과 |

### FindingReportEntry

보고서 내 Finding 항목.

| 필드 | 타입 | 설명 |
|------|------|------|
| finding | Finding | Finding 정보 |
| evidenceRefs | EvidenceRef[] | 증적 목록 |

### ModuleReport

모듈별 보고서. (구현 완료)

| 필드 | 타입 | 설명 |
|------|------|------|
| meta | ReportMeta | 보고서 메타데이터 |
| summary | ReportSummary | 집계 요약 |
| runs | RunReportEntry[] | Run 목록 |
| findings | FindingReportEntry[] | Finding 목록 |
| gateResults | GateResult[] | Quality Gate 결과 목록 |

### ProjectReport

프로젝트 전체 보고서. (구현 완료)

| 필드 | 타입 | 설명 |
|------|------|------|
| generatedAt | string (ISO 8601) | 생성 시각 |
| projectId | string | 프로젝트 ID |
| projectName | string | 프로젝트명 |
| modules | `{ static?: ModuleReport; dynamic?: ModuleReport; test?: ModuleReport; deep?: ModuleReport }` | 모듈별 보고서 |
| totalSummary | ReportSummary | 전체 집계 |
| approvals | ApprovalRequest[] | 승인 요청 목록 |
| auditTrail | AuditLogEntry[] | 감사 로그 |
| customization | object (optional) | 보고서 커스터마이징 `{ executiveSummary?, companyName?, logoUrl?, language?, reportTitle? }` |

### GateStatus

Quality Gate 상태 타입. (구현 완료)

```typescript
type GateStatus = "pass" | "fail" | "warning";
```

### GateRuleId

Quality Gate 규칙 식별자. (구현 완료)

```typescript
type GateRuleId = "no-critical" | "high-threshold" | "evidence-coverage" | "sandbox-unreviewed";
```

### GateRuleResult

Quality Gate 개별 규칙 평가 결과. (구현 완료)

| 필드 | 타입 | 설명 |
|------|------|------|
| ruleId | GateRuleId | 규칙 식별자 |
| result | `"passed" \| "failed" \| "warning"` | 평가 결과 |
| message | string | 설명 메시지 |
| linkedFindingIds | string[] | 관련 Finding ID 목록 |

### GateResult

Quality Gate 평가 결과. (구현 완료)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| runId | string | 소속 Run ID |
| projectId | string | 프로젝트 ID |
| status | GateStatus | 게이트 상태 |
| rules | GateRuleResult[] | 규칙별 평가 결과 |
| evaluatedAt | string (ISO 8601) | 평가 시각 |
| override | object (optional) | 오버라이드 정보 (`{ overriddenBy, reason, approvalId, overriddenAt }`) |
| createdAt | string (ISO 8601) | 생성 시각 |

### ApprovalStatus

승인 상태 타입. (구현 완료)

```typescript
type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
```

### ApprovalActionType

승인 대상 액션 타입. (구현 완료)

```typescript
type ApprovalActionType = "gate.override" | "finding.accepted_risk";
```

### ApprovalRequest

승인 요청. (구현 완료)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 |
| actionType | ApprovalActionType | 액션 유형 |
| requestedBy | string | 요청자 |
| targetId | string | 대상 리소스 ID |
| projectId | string | 프로젝트 ID |
| reason | string | 요청 사유 |
| status | ApprovalStatus | 승인 상태 |
| decision | object (optional) | 결정 정보 (`{ decidedBy, decidedAt, comment? }`) |
| expiresAt | string (ISO 8601) | 만료 시각 |
| createdAt | string (ISO 8601) | 생성 시각 |

### GateProfileRule

Gate 프로필 규칙 항목.

| 필드 | 타입 | 설명 |
|------|------|------|
| ruleId | GateRuleId | 규칙 식별자 |
| enabled | boolean | 활성화 여부 |
| params | Record<string, unknown> (optional) | 규칙 파라미터 (e.g. `{ threshold: 5 }`) |

### GateProfile

Gate 프로필. 프로젝트별로 선택하여 Quality Gate 평가 규칙을 조정한다. 3개 프리셋 제공.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 프로필 식별자 (default, strict, relaxed) |
| name | string | 프로필 이름 |
| description | string | 설명 |
| rules | GateProfileRule[] | 규칙 목록 |

### NotificationType

```typescript
type NotificationType = "analysis_complete" | "critical_finding" | "approval_pending" | "gate_failed";
```

### Notification

프로젝트 스코프 알림.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 (`notif-{uuid}`) |
| projectId | string | 소속 프로젝트 ID |
| type | NotificationType | 알림 유형 |
| title | string | 제목 |
| body | string | 본문 |
| severity | Severity (optional) | 심각도 |
| resourceId | string (optional) | 관련 리소스 ID |
| read | boolean | 읽음 여부 |
| createdAt | string (ISO 8601) | 생성 시각 |

### UserRole

```typescript
type UserRole = "viewer" | "analyst" | "admin";
```

### User

사용자 정보. DB의 password_hash는 API에 노출되지 않는다.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 식별자 (`user-{short-uuid}`) |
| username | string | 로그인 아이디 (unique) |
| displayName | string | 표시 이름 |
| role | UserRole | 역할 |
| createdAt | string (ISO 8601) | 생성 시각 |
| updatedAt | string (ISO 8601) | 수정 시각 |

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
| data | ProjectListItem[] | 프로젝트 목록 (보안 요약 포함) |

#### ProjectListItem

프로젝트 목록 응답의 개별 항목. Project를 확장한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| (Project 전체 필드) | | |
| lastAnalysisAt | string (optional, ISO 8601) | 최근 분석 시각 |
| severitySummary | object (optional) | 미해결 심각도별 건수 `{ critical, high, medium, low }` |
| gateStatus | GateStatus (optional) | 최근 Gate 상태 |
| unresolvedDelta | number (optional) | 미해결 변화량 (이전 Run 대비) |

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
| targetSummary | object (optional) | 서브프로젝트 상태 집계. 타겟이 없으면 생략 |
| targetSummary.total | number | 전체 타겟 수 |
| targetSummary.ready | number | 완료(ready) 타겟 수 |
| targetSummary.failed | number | 실패(build_failed/scan_failed/graph_failed/resolve_failed) 타겟 수 |
| targetSummary.running | number | 진행 중 타겟 수 |
| targetSummary.discovered | number | 탐색만 완료된 타겟 수 |
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

#### WebSocket 메시지 — 정적 분석 (S2 → S1, `/ws/static-analysis?analysisId=`)

| type | payload | 설명 |
|------|---------|------|
| `"static-progress"` | `{ analysisId, phase, currentChunk?, totalChunks?, totalFiles?, processedFiles?, message?, phaseWeights? }` | 진행률 |
| `"static-warning"` | `{ analysisId, code, message }` | 경고 (LLM 실패 등) |
| `"static-complete"` | `{ analysisId, resultId, findingCount, summary }` | 완료 |
| `"static-error"` | `{ analysisId, error }` | 에러 |

`phase`: `"queued" | "rule_engine" | "llm_chunk" | "merging" | "complete"`
`phaseWeights`: 첫 번째 progress 이벤트에 포함 `{ queued: 2.5, rule_engine: 7.5, llm_chunk: 80, merging: 10 }`

#### WebSocket 메시지 — 동적 테스트 (S2 → S1, `/ws/dynamic-test?testId=`)

| type | payload | 설명 |
|------|---------|------|
| `"test-progress"` | `{ testId, current, total, crashes, anomalies }` | 진행률 |
| `"test-finding"` | `{ testId, finding }` | 개별 Finding 발견 |
| `"test-complete"` | `{ testId, resultId, findings }` | 완료 |
| `"test-error"` | `{ testId, error }` | 에러 |

#### WebSocket 메시지 — Quick→Deep 분석 (S2 → S1, `/ws/analysis?analysisId=`)

| type | payload | 설명 |
|------|---------|------|
| `"analysis-progress"` | `{ analysisId, phase, message, targetName?, targetProgress? }` | 진행률 |
| `"analysis-quick-complete"` | `{ analysisId, findingCount }` | Quick 완료 |
| `"analysis-deep-complete"` | `{ analysisId, findingCount }` | Deep 완료 |
| `"analysis-error"` | `{ analysisId, phase, error, retryable }` | 에러 |

`phase`: `"quick_sast" | "quick_complete" | "deep_submitting" | "deep_analyzing" | "deep_complete"`
`targetProgress`: `{ current: number, total: number }` (타겟별 분석 시)

#### Analysis 진행 추적 DTO

`POST /api/analysis/run` 요청 body:

| 필드 | 타입 | 설명 |
|------|------|------|
| projectId | string (필수) | 프로젝트 ID |
| targetIds | string[] (optional) | 분석할 서브프로젝트 타겟 ID 목록 |
| mode | `"full" \| "subproject"` (optional) | 분석 모드. `"subproject"`: targetIds 필수. `"full"`: targetIds 비허용. 생략 시 targetIds 유무로 추론 (하위 호환) |

`POST /api/analysis/run` → `202 Accepted`:

| 필드 | 타입 | 설명 |
|------|------|------|
| analysisId | string | 분석 추적 ID |
| status | `"running"` | 초기 상태 |

`GET /api/analysis/status/:id`:

| 필드 | 타입 | 설명 |
|------|------|------|
| analysisId | string | 분석 추적 ID |
| projectId | string | 프로젝트 ID |
| status | `"running" \| "completed" \| "failed" \| "aborted"` | 현재 상태 |
| error | string (optional) | 실패 시 에러 메시지 |

#### PocResponse (`POST /api/analysis/poc`)

요청: `{ projectId: string, findingId: string }`
응답: `{ success: true, data: PocResponse }`

| 필드 | 타입 | 설명 |
|------|------|------|
| findingId | string | 대상 Finding ID |
| poc.statement | string | PoC 제목/요약 |
| poc.detail | string | PoC 상세 (마크다운 — 코드 블록, 실행 방법, 예상 결과) |
| audit.latencyMs | number | S3 Agent 소요 시간 (ms) |
| audit.tokenUsage | `{ prompt: number, completion: number }` | LLM 토큰 사용량 |

> PoC 결과는 DB에 저장되지 않음 (on-demand, 매번 재생성). S1에서 세션 내 캐싱 가능.

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
| buildProfile | BuildProfile (optional) | 빌드 환경 설정 |

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
| data.run | Run | Run 정보 |
| data.gate | GateResult (optional) | Quality Gate 결과 (구현 완료) |
| data.findings | Array<{ finding: Finding; evidenceRefs: EvidenceRef[] }> | Finding + 증적 목록 |
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

#### FindingBulkStatusRequest (`PATCH /api/findings/bulk-status`)

여러 Finding의 상태를 한 번에 변경한다. 트랜잭션으로 처리.

| 필드 | 타입 | 설명 |
|------|------|------|
| findingIds | string[] | 대상 Finding ID 목록 (최소 1, 최대 100) |
| status | FindingStatus | 변경할 상태 |
| reason | string | 변경 사유 |
| actor | string (optional) | 수행자 (기본: "system") |

**응답**: `{ success: true, data: { updated: number, failed: number } }`

- `updated`: 실제 상태 변경 성공 건수
- `failed`: 미존재 또는 유효하지 않은 전이로 실패한 건수

#### FindingHistoryEntry (`GET /api/findings/:id/history`)

같은 fingerprint를 가진 이전 Finding 목록. 동일 취약점의 검출 이력 추적용.

| 필드 | 타입 | 설명 |
|------|------|------|
| findingId | string | Finding ID |
| runId | string | 해당 Finding이 속한 Run ID |
| status | FindingStatus | 당시 상태 |
| createdAt | string | 생성 시점 (ISO 8601) |

**응답**: `{ success: true, data: FindingHistoryEntry[] }`

- Finding이 존재하지 않으면 404
- fingerprint가 없으면 빈 배열

#### Finding 목록 확장 쿼리 파라미터 (`GET /api/projects/:pid/findings`)

기존 `status`, `severity`, `module` 외 추가된 쿼리 파라미터:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| q | string | title, description, location 텍스트 검색 (LIKE %q%) |
| sourceType | string | sourceType 필터 (`"agent"`, `"sast-tool"`, `"rule-engine"`, `"llm-assist"` 등) |
| sort | `"severity" \| "createdAt" \| "location"` | 정렬 기준 (기본: createdAt DESC) |
| order | `"asc" \| "desc"` | 정렬 방향 (기본: desc) |

### Activity Timeline

#### ActivityEntry (`GET /api/projects/:pid/activity?limit=10`)

프로젝트 내 최근 활동을 타임라인으로 반환. 4개 소스(Run, Finding 상태 변경, Approval 결정, 파이프라인 완료)를 병합하여 timestamp DESC 정렬.

| 필드 | 타입 | 설명 |
|------|------|------|
| type | ActivityType | 활동 유형 |
| timestamp | string | 발생 시점 (ISO 8601) |
| summary | string | 한 줄 요약 (한국어) |
| metadata | Record<string, unknown> | 상세 메타데이터 (type별 상이) |

**ActivityType**: `"run_completed" | "finding_status_changed" | "approval_decided" | "pipeline_completed"`

**쿼리 파라미터**: `limit` (1~50, 기본 10)

**응답**: `{ success: true, data: ActivityEntry[] }`

### Approval Count

#### ApprovalCountResponse (`GET /api/projects/:pid/approvals/count`)

프로젝트의 Approval 카운트. 사이드바 뱃지 표시용.

| 필드 | 타입 | 설명 |
|------|------|------|
| pending | number | 대기 중 Approval 수 |
| total | number | 전체 Approval 수 |

**응답**: `{ success: true, data: { pending, total } }`

### Quality Gate (구현 완료)

#### GateResultResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | GateResult (optional) | Quality Gate 결과 |
| error | string (optional) | 에러 메시지 |

#### GateResultListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | GateResult[] | Quality Gate 결과 목록 |

#### GateOverrideRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| reason | string | 오버라이드 사유 |
| actor | string (optional) | 수행자 |

### Approval (구현 완료)

#### ApprovalListResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | ApprovalRequest[] | 승인 요청 목록 |

#### ApprovalDetailResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | ApprovalRequest (optional) | 승인 요청 상세 |
| error | string (optional) | 에러 메시지 |

#### ApprovalDecisionRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| decision | `"approved" \| "rejected"` | 결정 |
| comment | string (optional) | 코멘트 |
| actor | string (optional) | 수행자 |

### Report (구현 완료)

#### ModuleReportResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | ModuleReport (optional) | 모듈별 보고서 |
| error | string (optional) | 에러 메시지 |

#### ProjectReportResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | ProjectReport (optional) | 프로젝트 보고서 |
| error | string (optional) | 에러 메시지 |

### 정적 분석 대시보드

#### StaticAnalysisDashboardSummary

정적 분석 대시보드 집계 데이터.

| 필드 | 타입 | 설명 |
|------|------|------|
| bySeverity | Record<string, number> | 심각도별 Finding 수 |
| byStatus | Record<string, number> | 상태별 Finding 수 |
| bySource | Record<string, number> | 출처별 Finding 수 |
| topFiles | Array<{ filePath, findingCount, topSeverity }> | 상위 파일 목록 |
| topRules | Array<{ ruleId, hitCount }> | 상위 룰 목록 |
| trend | Array<{ date, runCount, findingCount, gatePassCount }> | 일별 트렌드 |
| gateStats | `{ total, passed, failed, rate }` | Quality Gate 통계 |
| unresolvedCount | `{ open, needsReview, needsRevalidation, sandbox }` | 미해결 Finding 카운트 |

#### StaticDashboardResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | StaticAnalysisDashboardSummary (optional) | 대시보드 집계 |
| error | string (optional) | 에러 메시지 |

### 공통

#### HealthResponse (`GET /health`)

| 필드 | 타입 | 설명 |
|------|------|------|
| service | string | `"aegis-core-service"` |
| status | `"ok" \| "degraded" \| "unhealthy"` | 종합 상태. `unhealthy`: 핵심 서비스(SAST+Agent) 모두 불능. `degraded`: 일부 불능. `ok`: 전부 정상 |
| version | string | 버전 (e.g. `"0.2.0"`) |
| detail | `{ version: string, uptime: number }` | 상세 정보 (uptime: 초) |
| llmGateway | object \| null | S7(LLM Gateway) 상태. S1은 무시 가능 |
| analysisAgent | object \| null | S3(Analysis Agent) 상태. S1은 무시 가능 |
| sastRunner | object \| null | S4(SAST Runner) 상태. S1은 무시 가능 |
| knowledgeBase | object \| null | S5(Knowledge Base) 상태. S1은 무시 가능 |
| buildAgent | object \| null | S3(Build Agent) 상태. S1은 무시 가능 |
| adapters | `{ total: number, connected: number }` | 어댑터 연결 현황. S1은 무시 가능 |

> S1은 `status` 필드만 사용하면 충분. 개별 서비스 필드는 진단 목적으로 유지.

### 분석 진행률

#### AnalysisProgress

비동기 정적 분석의 진행 상태. `GET /api/static-analysis/status/:id`로 폴링.

| 필드 | 타입 | 설명 |
|------|------|------|
| analysisId | string | 분석 ID |
| projectId | string | 프로젝트 ID |
| status | `"running" \| "completed" \| "failed" \| "aborted"` | 진행 상태 |
| phase | `"queued" \| "rule_engine" \| "llm_chunk" \| "merging" \| "complete"` | 현재 단계 |
| currentChunk | number | 현재 청크 번호 |
| totalChunks | number | 전체 청크 수 |
| totalFiles | number (optional) | 분석 대상 전체 파일 수 |
| processedFiles | number (optional) | 현재까지 처리 완료된 파일 수. 청크 완료 시 해당 청크의 파일 수만큼 증가 |
| message | string | 진행 메시지 |
| startedAt | string (ISO 8601) | 시작 시각 |
| updatedAt | string (ISO 8601) | 마지막 갱신 시각 |
| endedAt | string (optional, ISO 8601) | 종료 시각 |
| error | string (optional) | 에러 메시지 |

### SourceFileEntry

소스 파일 목록 응답의 개별 항목. `GET /api/projects/:pid/source/files`에서 반환.

| 필드 | 타입 | 설명 |
|------|------|------|
| path | string | 프로젝트 루트 기준 상대 경로 |
| size | number | 파일 크기 (bytes) |
| language | string (optional) | 감지된 언어 (c, cpp, python 등 30+) |
| fileType | SourceFileType | 파일 유형 분류 |
| previewable | boolean | 텍스트 미리보기 가능 여부 |
| lineCount | number (optional) | 텍스트 파일의 줄 수 |

> **SourceFileType** (12종): `"source" | "header" | "build" | "config" | "doc" | "data" | "binary" | "object" | "library" | "script" | "test" | "other"`

### WebSocket 메시지 — 파이프라인 (S2 → S1, `/ws/pipeline?projectId=`)

| type | payload | 설명 |
|------|---------|------|
| `"pipeline-target-status"` | `{ projectId, targetId, targetName, status: BuildTargetStatus, phase: PipelinePhase, message? }` | 개별 서브 프로젝트 상태 변경 |
| `"pipeline-complete"` | `{ projectId, completedCount, failedCount }` | 전체 파이프라인 완료 |
| `"pipeline-error"` | `{ projectId, targetId?, error }` | 파이프라인 에러 |

> **PipelinePhase**: `"setup" | "build" | "ready"` — discovered/resolving/configured/resolve_failed → setup, building~graph_failed → build, ready → ready

### WebSocket 메시지 — 업로드 (S2 → S1, `/ws/upload?uploadId=`)

| type | payload | 설명 |
|------|---------|------|
| `"upload-progress"` | `{ uploadId, phase: UploadPhase, message?, fileCount?, totalSize? }` | 업로드 진행률 |
| `"upload-complete"` | `{ uploadId, projectId, fileCount, composition }` | 업로드 완료 |
| `"upload-error"` | `{ uploadId, error }` | 업로드 에러 |

> **UploadPhase**: `"received" | "extracting" | "indexing" | "complete"`

### 서브 프로젝트 파이프라인 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/projects/:pid/pipeline/run` | 전체 빌드&스캔 파이프라인 실행 (202) `{ targetIds? }` |
| POST | `/api/projects/:pid/pipeline/run/:targetId` | 개별 서브 프로젝트 재실행 |
| GET | `/api/projects/:pid/pipeline/status` | 전체 서브 프로젝트 상태 |

### 업로드 API (비동기 전환)

`POST /api/projects/:pid/source/upload`는 `202 Accepted`를 반환하며, 실제 처리는 비동기로 진행된다.

응답 (202):

| 필드 | 타입 | 설명 |
|------|------|------|
| uploadId | string | 업로드 추적 ID |
| status | `"received"` | 초기 상태 |

진행률은 WebSocket `/ws/upload?uploadId=`로 push된다. 상태머신: `received → extracting → indexing → complete`.

### Gate Profile API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/gate-profiles` | Gate 프로필 목록 (3개: default, strict, relaxed) |
| GET | `/api/gate-profiles/:id` | Gate 프로필 상세. 미존재 시 404 |

### Notification API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/notifications` | 알림 목록 (`?unread=true` 필터) |
| GET | `/api/projects/:pid/notifications/count` | 미읽음 카운트 → `{ unread: number }` |
| PATCH | `/api/projects/:pid/notifications/read-all` | 전체 읽음 처리 |
| PATCH | `/api/notifications/:id/read` | 개별 읽음 처리 |

#### WebSocket 메시지 — 알림 (S2 → S1, `/ws/notifications?projectId=`)

| type | payload | 설명 |
|------|---------|------|
| `"notification"` | Notification | 신규 알림 |

### Auth API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 `{ username, password }` → `{ token, user }` |
| POST | `/api/auth/logout` | 로그아웃 (Authorization: Bearer 헤더) |
| GET | `/api/auth/me` | 현재 사용자 정보 |
| GET | `/api/auth/users` | 사용자 목록 |

#### LoginRequest

| 필드 | 타입 | 설명 |
|------|------|------|
| username | string | 로그인 아이디 |
| password | string | 비밀번호 |

#### LoginResponse

| 필드 | 타입 | 설명 |
|------|------|------|
| success | boolean | 성공 여부 |
| data | `{ token: string, user: User }` (optional) | 인증 정보 |
| error | string (optional) | 에러 메시지 |

### Finding Groups API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/findings/groups` | Finding 그루핑 (`?groupBy=ruleId\|location`) |

응답: `{ success: true, data: Array<{ key, count, topSeverity, findingIds }> }`

### Custom Report API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/projects/:pid/report/custom` | 커스터마이징 보고서 |

Body: `{ filters?, findingIds?, includeSections?, customization? }`

### Build Log API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:pid/targets/:id/build-log` | 빌드 로그 조회 → `{ buildLog, status, updatedAt }` |

---

## 관련 문서

- [전체 개요](../specs/technical-overview.md)
- [S1. UI Service](../specs/frontend.md)
- [S2. Core Service](../specs/backend.md)
