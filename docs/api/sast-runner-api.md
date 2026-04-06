# SAST Runner API 명세 (v0.11.0)

> **AEGIS — Automotive Embedded Governance & Inspection System**
>
> S2(AEGIS Core) 또는 S3(Analysis Agent)가 SAST Runner를 호출할 때 참조하는 API 계약서.
> SAST Runner는 AEGIS의 **결정론적 전처리 엔진**으로, 6개 SAST 도구 + SCA + 코드 구조 + 빌드 자동화를 제공한다.

---

## Base URL

```
http://localhost:9000
```

---

## 공통 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| `X-Request-Id` | 요청/응답 | 요청 추적 ID. 없으면 S4가 자동 생성. 응답에도 포함 |
| `X-Timeout-Ms` | 요청 | **도구당 타임아웃 (밀리초)**. 최우선 적용. 미지정 시 `options.timeoutSeconds` → 기본 600초 |

---

## 엔드포인트 요약

| 메서드 | 경로 | MCP Tool | 용도 |
|--------|------|----------|------|
| POST | `/v1/scan` | `sast.scan` | 6개 SAST 도구 병렬 + SDK 해석 + 노이즈 필터링 + 실행 보고서 |
| POST | `/v1/functions` | `code.functions` | clang AST → 함수+호출 관계 (namespace, projectPath) |
| POST | `/v1/includes` | `code.includes` | gcc -E -M → 인클루드 트리 |
| POST | `/v1/metadata` | `build.metadata` | gcc -E -dM → 타겟 매크로/아키텍처 |
| POST | `/v1/libraries` | `sca.libraries` | 라이브러리 식별 + upstream diff (CVE는 S5로 이관) |
| POST | `/v1/build` | — | caller가 완전히 materialize한 build command/environment를 그대로 실행 |
| POST | `/v1/build-and-analyze` | — | explicit build command/environment로 빌드 후 나머지 분석 수행 |
| POST | `/v1/discover-targets` | — | 프로젝트 내 빌드 타겟 자동 탐색 |
| GET | `/v1/health` | — | 6개 도구 상태 |

---

## 도구 목록 (6개)

| 도구 | 역할 | BuildProfile 활용 |
|------|------|-------------------|
| **Semgrep** | 패턴 매칭 + taint mode (C++에서는 `.c`/`.h`만 **확장자 필터**) | 룰셋 C/C++ 자동 선택 + `--include` 필터 |
| **Cppcheck** | 코드 품질 + 교차 번역 단위(CTU) 분석 | `--std`, `-I`, `-D` |
| **clang-tidy** | CERT 코딩 표준 기반 보안 + 버그 탐지 | `-std`, `-I`, `-D` |
| **Flawfinder** | 위험 함수 빠른 스캔 (CWE 매핑 포함) | (없음) |
| **scan-build** | Clang Static Analyzer 경로 민감 분석 | `-std`, `-I`, `-D` |
| **gcc -fanalyzer** | GCC 내장 정적 분석 (SDK 크로스 컴파일러 사용 가능) | `-std`, `-I`, `-D`, SDK 크로스 컴파일러 |

### 도구 자동 선택

BuildProfile이 있으면 SAST Runner가 **도구를 자동 선택/스킵**한다:

| 조건 | 동작 |
|------|------|
| `languageStandard`가 `c++*` | Semgrep **확장자 필터**: `--include *.c --include *.h`로 C 파일만 스캔 (스킵하지 않음) |
| 호스트 gcc 미지원 + SDK에 GCC 10+ | gcc-fanalyzer **SDK 컴파일러로 재확인** -> 사용 가능하면 활성화 |
| SDK 크로스 컴파일러 없음 | gcc-fanalyzer는 호스트 gcc로 폴백 |
| clang 미설치 | scan-build, clang-tidy 스킵 |
| 항상 실행 | Cppcheck, Flawfinder |

스킵 사유는 응답의 `execution.toolResults`에 기록된다.

---

## NDJSON 스트리밍 모드 (하트비트 프로토콜)

`POST /v1/scan`은 **NDJSON 스트리밍 모드**를 지원한다. 대형 프로젝트(수만 줄 파일)에서 고정 타임아웃이 불가능한 문제를 해결하기 위해, 도구 실행 중 주기적으로 진행 이벤트를 보낸다.

### 활성화

요청에 `Accept: application/x-ndjson` 헤더를 추가한다. 헤더가 없으면 기존 동기 JSON 응답 (변경 없음).

### 응답 형식

`Content-Type: application/x-ndjson` — 각 줄이 하나의 JSON 객체 (`\n` 구분).

### 이벤트 타입

**progress** — 도구 완료/실패 시 (6개 도구별 1회):
```json
{"type":"progress","tool":"cppcheck","status":"completed","findingsCount":25,"elapsedMs":4500,"timestamp":1711900000000}
{"type":"progress","tool":"gcc-fanalyzer","status":"failed","findingsCount":0,"elapsedMs":120000,"timestamp":1711900120000}
```

**heartbeat** — 25초 간격 keepalive + 진행 상태:

세마포어 대기 중 (`queued`):
```json
{"type":"heartbeat","timestamp":1711900030000,"status":"queued"}
```

분석 실행 중 (`running` — `progress` 필드 포함):
```json
{"type":"heartbeat","timestamp":1711900030000,"status":"running","progress":{"activeTools":["gcc-fanalyzer","cppcheck"],"completedTools":["semgrep","flawfinder"],"findingsCount":26,"filesCompleted":12,"filesTotal":50,"currentFile":"src/http_client.cpp","degraded":true,"degradeReasons":["timeout-floor","timed-out-files"],"toolStates":{"gcc-fanalyzer":{"filesAttempted":50,"filesCompleted":12,"timedOutFiles":2,"failedFiles":0,"batchCount":7,"timeoutBudgetSeconds":60,"perFileTimeoutSeconds":10,"budgetWarning":true,"degraded":true,"degradeReasons":["timeout-floor","timed-out-files"]}}}}
```

| progress 필드 | 타입 | 설명 |
|---------------|------|------|
| activeTools | string[] | 현재 subprocess가 실행 중인 도구 목록 |
| completedTools | string[] | 완료된 도구 목록 |
| findingsCount | int | 현재까지 발견된 누적 findings 수 |
| filesCompleted | int | per-file 도구(gcc-fanalyzer, scan-build) 완료 파일 합산 |
| filesTotal | int | per-file 도구 전체 파일 합산 |
| currentFile | string? | 가장 최근 완료된 파일명 |
| degraded | bool | 현재 스캔이 degraded long-run 상태인지 여부 |
| degradeReasons | string[] | `timeout-floor`, `timed-out-files`, `failed-files` 등 degradation 이유 |
| toolStates | object | heavy analyzer별 상세 진행/예산/timeout 상태 |

**status 필드 (`queued` / `running`)**:
- `queued`: 동시 스캔 세마포어(`SAST_MAX_CONCURRENT_SCANS`, 기본 2) 대기 중. `progress` 없음
- `running`: 분석 실행 중. `progress` 포함

**result** — 최종 스캔 결과 (마지막 줄, 동기 모드 ScanResponse와 동일 스키마):
```json
{"type":"result","data":{"success":true,"scanId":"...","findings":[...],"stats":{...},"execution":{...}}}
```

**error** — 중간 실패 시 (result 대신 마지막 줄):
```json
{"type":"error","code":"SCAN_TIMEOUT","message":"...","retryable":true,"requestId":"req-xxx","timestamp":1711900060000}
```

### S3 클라이언트 구현 가이드

1. 각 줄을 JSON 파싱하여 `type` 필드로 분기
2. **progress/heartbeat** 수신 시 → 타임아웃 카운터 리셋
3. **heartbeat `status: "queued"`** → stall 감지 비활성화 (대기는 정상)
4. **heartbeat `status: "running"`** → `progress.filesCompleted`가 3회 연속 동일이면 stall 판정 가능
5. **result** 수신 시 → `data` 필드를 기존 ScanResponse로 파싱 (동기 모드와 동일)
6. **error** 수신 시 → 에러 처리
7. **60초간 이벤트 없음** → S4 hang 판정, 연결 종료
8. `X-Request-Id`는 응답 헤더에 포함됨

### 타임아웃 의미 전환

| 모드 | 타임아웃 의미 |
|------|-------------|
| 동기 (`Accept: application/json`) | `X-Timeout-Ms` = 총 소요 시간 한도 |
| 스트리밍 (`Accept: application/x-ndjson`) | 클라이언트가 inactivity timeout 관리. `X-Timeout-Ms`는 S4 내부 도구별 예산으로만 사용 |

---

## POST /v1/scan

6개 SAST 도구를 병렬 실행하고 합산된 SastFinding[]을 반환한다.

### 요청

```json
{
  "scanId": "scan-uuid",
  "projectId": "proj-xxx",
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  },
  "files": [
    {
      "path": "src/main.c",
      "content": "#include <stdio.h>\nint main() { char buf[10]; gets(buf); return 0; }"
    }
  ],
  "buildProfile": {
    "sdkId": "ti-am335x",
    "compiler": "arm-none-linux-gnueabihf-gcc",
    "compilerVersion": "9.2.1",
    "targetArch": "arm-cortex-a8",
    "languageStandard": "c99",
    "headerLanguage": "c",
    "includePaths": ["include", "libraries/rapidjson/include"],
    "defines": {"__ARM_ARCH": "7"},
    "flags": ["-mthumb"]
  },
  "rulesets": ["p/c", "p/security-audit"],
  "options": {
    "timeoutSeconds": 120,
    "tools": ["flawfinder", "cppcheck"]
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| scanId | string | O | 스캔 식별자 |
| projectId | string | O | 프로젝트 ID (로깅/추적용) |
| provenance | object | X | Build Snapshot provenance (`buildSnapshotId`, `buildUnitId`, `snapshotSchemaVersion`) |
| files | FileEntry[] | 조건부 | 분석 대상 소스 파일. `projectPath` 없을 때 필수 |
| projectPath | string | 조건부 | 프로젝트 디렉토리 절대 경로. `files` 없을 때 필수. C/C++ 소스 자동 탐색 |
| compileCommands | string | X | `compile_commands.json` 경로. 있으면 Cppcheck `--project=`, clang-tidy `-p`에 사용 |
| buildProfile | BuildProfile | X | 빌드 환경 설정. 있으면 도구 자동 선택 + SDK 해석 |
| rulesets | string[] | X | Semgrep 룰셋. 명시하면 자동 선택보다 우선 |
| thirdPartyPaths | string[] | X | vendored 서드파티 라이브러리 경로 (상대 경로). 지정 시 **(1) scope-early: heavy analyzer (gcc-fanalyzer, scan-build, clang-tidy) 실행 전 해당 경로 파일 제외 + (2) 나머지 도구 findings에서 해당 경로 제거** (cross-boundary는 유지). 미지정 시 기존 동작 |
| options.timeoutSeconds | int | X | 도구당 타임아웃. **`X-Timeout-Ms` 헤더 우선.** 둘 다 없으면 기본 600초 |
| options.tools | string[] | X | 실행할 도구 서브셋. `["semgrep", "cppcheck", "flawfinder", "clang-tidy", "scan-build", "gcc-fanalyzer"]` 중 선택. 미지정 시 전부 실행 (자동 선택 적용) |

#### FileEntry

| 필드 | 타입 | 설명 |
|------|------|------|
| path | string | 상대 파일 경로 (절대 경로, `..` 금지) |
| content | string | 파일 내용 |

#### BuildProfile (`shared-models.md` 참조)

**모든 필드 optional.** `sdkId`만 보내면 S4가 sdk-registry에서 나머지를 자동 해석.

| 필드 | 타입 | 설명 | 도구 활용 |
|------|------|------|----------|
| sdkId | string? | SDK 프로파일 ID | SDK 헤더 자동 `-I`, env-setup 자동 source |
| compiler | string? | 컴파일러 | gcc -fanalyzer에서 SDK 크로스 컴파일러 선택. 미지정 시 sdkId로 해석 |
| compilerVersion | string? | 컴파일러 버전 | 로깅 |
| targetArch | string? | 타겟 아키텍처 | 로깅, 향후 `--platform` |
| languageStandard | string? | 언어 표준 | `--std` 플래그. 미지정 시 컴파일러 기본값 사용 |
| headerLanguage | `"c"` \| `"cpp"` \| `"auto"` | `.h` 파일 처리 | 기본 `"auto"`. 룰셋 선택 시 참고 |
| includePaths | string[]? | 추가 인클루드 경로 | `-I`. **상대 경로는 scan_dir 기준으로 자동 변환** |
| defines | Record<string,string>? | 전처리기 매크로 | `-D` |
| flags | string[]? | 추가 컴파일 플래그 | 향후 활용 |

#### SDK 자동 해석

`buildProfile.sdkId`가 SAST Runner에 등록된 SDK와 매칭되면, 해당 SDK의 **크로스 컴파일러 경로 + 헤더 경로(C++ 표준 라이브러리, GCC 내장, libc)를 자동 해석**하여 도구의 `-I` 옵션에 추가한다.

S2/S3는 SDK 설치 경로를 몰라도 되고, `sdkId`만 지정하면 된다.

#### SDK 레지스트리

**경로 규칙**: `$SAST_SDK_ROOT/{sdkId}/` — `sdkId`가 곧 폴더명.

| 설정 | 값 | 비고 |
|------|------|------|
| 환경변수 | `SAST_SDK_ROOT` | `.env`에 설정. 미설정 시 `~/sdks` 폴백 |
| 폴더 규칙 | `$SAST_SDK_ROOT/{sdkId}/` | sdkId = 폴더명 |

**등록된 SDK:**

| sdkId | SDK | 크로스 컴파일러 | 헤더 경로 수 | environment-setup |
|-------|-----|----------------|:-----------:|:-:|
| `ti-am335x` | TI Processor SDK Linux AM335x 08.02.00.24 | `arm-none-linux-gnueabihf-gcc 9.2.1` | 7 | O |

**새 SDK 추가 방법:**
1. `$SAST_SDK_ROOT/{sdkId}/` 에 SDK 설치 (또는 심링크)
2. `$SAST_SDK_ROOT/sdk-registry.json`에 항목 추가 (코드 수정 불필요)
3. 이 테이블 갱신

#### Findings 필터링 (2단계)

**1단계 — scope-early (도구 실행 전):** `thirdPartyPaths`가 지정되면, heavy analyzer (gcc-fanalyzer, scan-build, clang-tidy)의 **분석 대상에서 해당 경로 파일을 제외**한다. 이는 OOM 방지를 위한 리소스 제어. 제외된 파일 수는 `filtering.filesScopedOut`에 보고.

**2단계 — findings 필터링 (도구 실행 후):**
- `location.file`이 절대 경로(`/`로 시작) → SDK/시스템 헤더 finding → `filtering.sdkNoiseRemoved`
- `location.file`이 `thirdPartyPaths`에 해당 → 서드파티 finding → `filtering.thirdPartyRemoved`
- 단, `dataFlow`에 사용자 코드가 포함되면 **cross-boundary**로 유지 (`origin: "cross-boundary"`)

실측: RE100 + TI AM335x SDK → 필터링 전 254건, 필터링 후 28건 (SDK 200건 + 서드파티 26건 제거, cross-boundary 5건 유지).

### 응답 (200, 성공)

```json
{
  "success": true,
  "scanId": "scan-uuid",
  "status": "completed",
  "findings": [ ... ],
  "stats": {
    "filesScanned": 2,
    "rulesRun": 5,
    "findingsTotal": 28,
    "elapsedMs": 113000
  },
  "execution": {
    "toolsRun": ["cppcheck", "clang-tidy", "flawfinder", "scan-build"],
    "toolResults": {
      "cppcheck": { "findingsCount": 4, "elapsedMs": 110000, "status": "ok", "version": "2.17.1" },
      "clang-tidy": { "findingsCount": 10, "elapsedMs": 5100, "status": "ok", "version": "18.1.3" },
      "flawfinder": { "findingsCount": 14, "elapsedMs": 20, "status": "ok", "version": "2.0.19" },
      "scan-build": { "findingsCount": 0, "elapsedMs": 3000, "status": "ok", "version": "18.1.3" },
      "semgrep": { "findingsCount": 3, "elapsedMs": 800, "status": "ok", "skipReason": null, "version": "1.155.0" },
      "gcc-fanalyzer": { "findingsCount": 0, "elapsedMs": 8000, "status": "ok", "version": "13.3.0" }
    },
    "sdk": {
      "resolved": true,
      "sdkId": "ti-am335x",
      "includePathsAdded": 7
    },
    "filtering": {
      "beforeFilter": 254,
      "afterFilter": 28,
      "sdkNoiseRemoved": 200,
      "thirdPartyRemoved": 26,
      "crossBoundaryKept": 5,
      "filesScopedOut": 480
    }
  },
  "codeGraph": {
    "functions": [ ... ],
    "callEdges": [ ... ]
  },
  "sca": {
    "libraries": [
      { "name": "rapidjson", "version": "1.1.0", "path": "libraries/rapidjson", "repoUrl": "https://..." }
    ]
  }
}
```

#### codeGraph / sca (optional, projectPath 모드에서만)

| 필드 | 타입 | 조건 | 설명 |
|------|------|------|------|
| codeGraph | object? | projectPath 제공 시 | 함수 목록 + 호출 관계 (`/v1/functions`와 동일 형식) |
| sca | object? | projectPath 제공 시 | 라이브러리 식별 결과. **CVE는 미포함** — S5 `POST /v1/cve/batch-lookup`으로 별도 조회 필요 |

`files[]` 모드에서는 두 필드 모두 `null`. 하위 호환 보장.

#### SastFinding (shared-models.md 준수)

| 필드 | 타입 | 설명 |
|------|------|------|
| toolId | string | `"semgrep"`, `"cppcheck"`, `"flawfinder"`, `"clang-tidy"`, `"scan-build"`, `"gcc-fanalyzer"` 중 하나 |
| ruleId | string | `"{toolId}:{원본 rule ID}"` 형식 |
| severity | string | 도구별 심각도 |
| message | string | 도구가 생성한 설명 |
| location | SastFindingLocation | 소스 위치 |
| dataFlow | SastDataFlowStep[]? | taint/data flow 경로 (있을 때만). gcc-fanalyzer는 note 라인에서 추출 |
| origin | string? | `"cross-boundary"`: SDK/라이브러리 경로 finding이지만 dataFlow가 사용자 코드를 포함. 경계면 취약점 |
| metadata | object? | 아래 참조 |

**metadata 주요 필드:**

| 필드 | 타입 | 설명 | 제공 도구 |
|------|------|------|----------|
| cweId | string? | 대표 CWE ID (예: `"CWE-476"`). cwe 배열의 첫 번째 원소 | 전 도구 (v0.9.0+) |
| cwe | string[]? | CWE ID 목록 (예: `["CWE-476"]`) | 전 도구 (v0.4.0+) |
| references | string[]? | 참고 URL | Semgrep |
| semgrepRuleId | string? | Semgrep 원본 rule ID | Semgrep |
| cppcheckId | string? | Cppcheck error ID | Cppcheck |
| clangTidyCheck | string? | clang-tidy 체크 이름 | clang-tidy |
| gccFlag | string? | gcc -Wanalyzer 플래그 | gcc-fanalyzer |
| checkName | string? | scan-build 체크 이름 | scan-build |
| category | string? | 카테고리 | scan-build |
| flawfinderLevel | int? | 위험 레벨 (1-5) | Flawfinder |

#### execution 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| toolsRun | string[] | 실제 실행된 도구 목록 |
| toolResults | dict | 도구별 {findingsCount, elapsedMs, status, skipReason?, **version?**, **timedOutFiles?**} |
| sdk | object | {resolved, sdkId?, includePathsAdded} |
| filtering | object | {beforeFilter, afterFilter, sdkNoiseRemoved, **thirdPartyRemoved**, **crossBoundaryKept**, **filesScopedOut**} |

`toolResults[*].status` 값: `"ok"`, `"partial"`, `"skipped"`, `"failed"`. `"partial"`은 일부 파일이 timeout되었으나 나머지는 정상 완료된 경우

`toolResults[*].version`: 해당 도구의 설치 버전 (예: `"2.17.1"`). 스캔 재현성 추적용.

`toolResults[*].timedOutFiles`: `"partial"` 상태일 때, timeout된 파일 수. gcc-fanalyzer/scan-build 전용.

#### Findings 필터링 기준

| 분류 | location 경로 | dataFlow | 결과 |
|------|---------------|----------|------|
| 사용자 코드 | 상대 경로 | — | **유지** |
| 경계면 (cross-boundary) | 절대 경로 (SDK/lib) | 사용자 코드 step 포함 | **유지** + `origin: "cross-boundary"` |
| 순수 SDK/라이브러리 내부 | 절대 경로 | 없거나 전부 외부 | **제거** |

### 응답 (에러)

```json
{
  "success": false,
  "scanId": "scan-uuid",
  "status": "failed",
  "error": "에러 메시지",
  "errorDetail": {
    "code": "SCAN_TIMEOUT",
    "message": "Semgrep scan exceeded 120s timeout",
    "requestId": "req-xxx",
    "retryable": true
  }
}
```

| 코드 | HTTP | retryable | 설명 |
|------|------|-----------|------|
| `NO_FILES_PROVIDED` | 400 | N | `files`와 `projectPath` 모두 미제공, 또는 경로 검증 실패 |
| `SCAN_TIMEOUT` | 504 | Y | 도구 타임아웃 초과 |
| `SARIF_PARSE_ERROR` | 502 | N | 출력 파싱 실패 |
| `INTERNAL_ERROR` | 500 | N | 예상치 못한 에러 |

---

## POST /v1/functions

소스 파일들에서 **함수 목록 + 호출 관계**를 추출한다. clang AST 기반.

### 요청

`POST /v1/scan`과 동일한 형식 (scanId, projectId, files, buildProfile).

### 응답

```json
{
  "functions": [
    {
      "name": "postJson",
      "file": "src/http_client.cpp",
      "line": 8,
      "calls": ["access", "fgets", "fprintf", "getenv", "pclose", "popen", "readlink", "strcmp"]
    },
    {
      "name": "curl_exec",
      "file": "libraries/libcurl/curl_exec.c",
      "line": 42,
      "calls": ["curl_multi_perform", "curl_easy_setopt"],
      "origin": "modified-third-party",
      "originalLib": "libcurl",
      "originalVersion": "7.68.0"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 함수 이름 |
| file | string | 정의된 파일 (상대 경로) |
| line | int | 정의 시작 줄 |
| calls | string[] | 이 함수 내에서 호출하는 함수 이름 목록 |
| origin | string? | `"third-party"` (원본) 또는 `"modified-third-party"` (수정됨). 프로젝트 코드면 필드 없음. **projectPath 모드에서만** |
| originalLib | string? | 원본 라이브러리명. origin이 있을 때 |
| originalVersion | string? | 원본 라이브러리 버전. 버전 식별 성공 시 |

**필터링** (3단계):
1. `loc.file`이 소스 파일과 다르면 제거 (헤더에서 온 함수)
2. `line`이 소스 파일 줄 수를 초과하면 제거 (전처리 전개로 인한 가상 위치)
3. 함수 본문(`CompoundStmt`)이 없으면 제거 (`extern` 선언만 있는 헤더 함수)
4. `__` 접두사, `operator`, `isImplicit` 함수 제거

**호출 관계 추출**: 함수 본문 내의 `CallExpr`에서 callee를 추출. `ImplicitCastExpr → DeclRefExpr` 구조와 `MemberExpr`을 모두 처리.

---

## POST /v1/includes

파일별 **인클루드 의존성 트리**를 추출한다. `gcc -E -M` 기반.

### 요청

`POST /v1/scan`과 동일한 형식. `files[]` 또는 `projectPath` 중 하나 필수.

### 응답

```json
{
  "includes": {
    "src/http_client.cpp": [
      "include/http_client.hpp",
      "/usr/include/stdio.h"
    ]
  }
}
```

BuildProfile에 SDK가 지정되면 **SDK 크로스 컴파일러**로 인클루드 해석. SDK가 없으면 호스트 gcc 사용.

---

## POST /v1/metadata

타겟 **빌드 환경 매크로**를 추출한다. `gcc -E -dM` 기반.

### 요청

`POST /v1/scan`과 동일한 형식. `files`는 비어있어도 됨 (컴파일러 기본 매크로만 추출).

### 응답

```json
{
  "compiler": "arm-none-linux-gnueabihf-gcc 9.2.1",
  "macros": {
    "__ARM_ARCH": "7",
    "__SIZEOF_POINTER__": "4",
    "__SIZEOF_LONG__": "4",
    "__cplusplus": "201402L",
    "__BYTE_ORDER__": "__ORDER_LITTLE_ENDIAN__"
  },
  "targetInfo": {
    "arch": "arm",
    "pointerSize": 4,
    "longSize": 4,
    "endianness": "little",
    "cppStandard": "201402L"
  }
}
```

호스트 gcc (x86_64) vs SDK 크로스 컴파일러 (ARM32)의 차이를 에이전트가 확인할 수 있다.

---

## GET /v1/health

서비스 상태 및 6개 도구 가용성 확인.

```json
{
  "service": "s4-sast",
  "status": "ok",
  "version": "0.11.0",
  "tools": {
    "semgrep": { "available": true, "version": "1.155.0" },
    "cppcheck": { "available": true, "version": "2.17.1" },
    "flawfinder": { "available": true, "version": "2.0.19" },
    "clang-tidy": { "available": true, "version": "18.1.3" },
    "scan-build": { "available": true, "version": "scan-build" },
    "gcc-fanalyzer": { "available": true, "version": "13.3.0" }
  },
  "defaultRulesets": ["p/c", "p/security-audit"]
}
```

---

## 헤더 규약

| 헤더 | 방향 | 설명 |
|------|------|------|
| `X-Request-Id` | 요청 | correlation ID. 없으면 SAST Runner가 `req-{uuid}` 자동 생성 |
| `X-Request-Id` | 응답 | 동일 ID 반환 |

`X-Request-Id`는 SAST Runner 내부의 **모든 로그**에 `requestId` 필드로 전파된다 (contextvars 기반). `grep '{request-id}' logs/s4-sast-runner.jsonl`로 특정 요청의 전 구간 추적 가능.

---

## 로깅

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/s4-sast-runner.jsonl` |
| 형식 | JSON structured (observability.md 준수) |
| 필수 필드 | `level`, `time` (epoch ms), `service` ("s4-sast"), `msg` |
| 요청 추적 | `requestId` — 라우터 ~ 오케스트레이터 ~ 개별 러너까지 전 레이어 전파 |

---

## POST /v1/libraries

프로젝트 내 vendored 라이브러리를 자동 식별하고 upstream과 비교한다. `projectPath` 필수.

> **CVE 조회는 S5(KB) `POST /v1/cve/batch-lookup`으로 이관됨 (2026-03-19).**
> S3 Agent가 이 응답의 `name`, `version`, `repoUrl`을 S5에 전달하여 CVE를 조회한다.

### 요청

```json
{
  "scanId": "...",
  "projectId": "re100",
  "projectPath": "/path/to/project"
}
```

### 응답

```json
{
  "libraries": [
    {
      "name": "mosquitto",
      "version": "2.0.22",
      "commit": "28f914788f6a...",
      "branch": "master",
      "path": "gateway/libraries/mosquitto",
      "source": "git",
      "repoUrl": "https://github.com/eclipse/mosquitto.git",
      "diff": {
        "matchedVersion": "28f914788f6a...",
        "matchRatio": 0.988,
        "identicalFiles": 168,
        "modifiedFiles": 2,
        "modifications": [
          { "file": "lib/net_mosq.c", "insertions": 76, "deletions": 0 }
        ]
      }
    }
  ],
  "elapsedMs": 21000
}
```

### 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 라이브러리 이름 (git repo명 또는 디렉토리명) |
| version | string? | 버전 (태그, CMake, configure.ac 등에서 추출) |
| commit | string? | git 커밋 해시 |
| branch | string? | git 브랜치 |
| path | string | 프로젝트 내 상대 경로 |
| source | string | 식별 방법 (`"git"`, `"CMakeLists.txt:project()"` 등) |
| repoUrl | string? | upstream git URL — **S5 CVE 조회 시 vendor 추론에 사용** |
| diff | object? | upstream과의 비교 결과 (통일 shape: 성공/에러 모두 동일 필드, nullable) |
| diff.matchedVersion | string? | 매칭된 upstream 버전/태그/커밋 (`null` = 에러) |
| diff.repoUrl | string | upstream URL |
| diff.matchRatio | float? | 동일 파일 비율 (1.0 = 원본, `null` = 에러) |
| diff.identicalFiles | int | 동일 파일 수 |
| diff.modifiedFiles | int | 수정된 파일 수 |
| diff.addedFiles | int | 추가된 파일 수 |
| diff.deletedFiles | int | 삭제된 파일 수 |
| diff.modifications | array | 수정된 파일 상세 `[{file, insertions, deletions}]` |
| diff.error | string? | 에러 메시지 (`null` = 성공) |

### 식별 방법 (우선순위순)

1. `.git` → 커밋 해시 + 리모트 URL + `git describe --tags`
2. CMakeLists.txt → `project(name VERSION x.y.z)`
3. configure.ac → `AC_INIT([name], [version])`
4. version.h / README
5. 디렉토리 이름 → 알려진 repo 매핑

### diff 방법

- `.git`이 있으면 커밋 해시로 정확한 upstream checkout
- SHA256 파일 해시 비교 (패키징/줄 끝 차이에 면역)
- 소스 코드만 (.c/.h/.cpp/.hpp), test/example/doc 제외
- `matchRatio` = 동일 파일 / (동일 + 수정) -- 100%면 원본
- **CloneCache**: 동일 repo에 대한 반복 clone을 TTL 기반 캐시로 최적화 (기본 1시간)
- **통일 응답**: 성공/에러 모두 동일한 JSON shape. 에러 시 `matchedVersion=null`, `matchRatio=null`, `error="메시지"`

---

## POST /v1/build

**빌드만 수행** — caller가 제공한 명령과 환경을 그대로 실행하여 `compile_commands.json`을 생성한다.
S4는 build path에서 더 이상 SDK/toolchain/build-command intent를 해석하지 않는다.

### 요청

```json
{
  "projectPath": "/uploads/re100/gateway-webserver",
  "buildCommand": "/uploads/re100/gateway-webserver/scripts/generated-build.sh",
  "buildEnvironment": {
    "CC": "/uploads/toolchains/arm/bin/arm-linux-gnueabihf-gcc",
    "SYSROOT": "/uploads/toolchains/arm/sysroot"
  },
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  },
  "wrapWithBear": true
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 서브 프로젝트 절대 경로 |
| buildCommand | string | O | caller가 완전히 materialize한 빌드 명령어 |
| buildEnvironment | Record<string,string> | X | caller가 제공하는 명시적 환경변수 주입 |
| provenance | object | X | Build Snapshot provenance (`buildSnapshotId`, `buildUnitId`, `snapshotSchemaVersion`) |
| wrapWithBear | bool | X | 기본 `true`. `false`면 bear 없이 순수 빌드 실행 |

### 응답 (200, 성공)

```json
{
  "success": true,
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  },
  "buildEvidence": {
    "requestedBuildCommand": "/uploads/re100/gateway-webserver/scripts/generated-build.sh",
    "effectiveBuildCommand": "/uploads/re100/gateway-webserver/scripts/generated-build.sh",
    "buildDir": "/uploads/re100/gateway-webserver",
    "compileCommandsPath": "/uploads/re100/gateway-webserver/compile_commands.json",
    "entries": 7,
    "userEntries": 7,
    "exitCode": 0,
    "buildOutput": "...",
    "wrapWithBear": true,
    "timeoutSeconds": 600,
    "environmentKeys": ["CC", "SYSROOT"],
    "elapsedMs": 4885
  }
}
```

### 응답 (200, 실패)

```json
{
  "success": false,
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  },
  "buildEvidence": {
    "requestedBuildCommand": "/uploads/re100/gateway-webserver/scripts/generated-build.sh",
    "effectiveBuildCommand": "/uploads/re100/gateway-webserver/scripts/generated-build.sh",
    "buildDir": "/uploads/re100/gateway-webserver",
    "compileCommandsPath": "/uploads/re100/gateway-webserver/compile_commands.json",
    "entries": 3,
    "userEntries": 1,
    "exitCode": 127,
    "buildOutput": "...",
    "wrapWithBear": true,
    "timeoutSeconds": 600,
    "environmentKeys": ["CC", "SYSROOT"],
    "elapsedMs": 1234
  },
  "failureDetail": {
    "category": "command-not-found",
    "summary": "The supplied build command referenced an unavailable executable or script (exit code 127).",
    "matchedExcerpt": "bash: ... command not found",
    "hint": "Caller must provide a valid build command and executable paths.",
    "retryable": false
  }
}
```

### 중요한 의미

- S4는 `buildCommand`를 **자동 감지하지 않는다**.
- S4는 `sdkId`를 **받지도 해석하지도 않는다**.
- caller가 잘못된 build material을 보내면 **실패가 정답**이다.

### `failureDetail.category`

- `timeout`
- `compile-commands-missing`
- `compile-commands-empty`
- `shared-library-load`
- `command-not-found`
- `build-process`

---

## POST /v1/build-and-analyze

빌드 실행 + 전체 분석 파이프라인 한 번에.

> **위치:** `/v1/build-and-analyze`는 snapshot-first orchestration에서
> **convenience / transitional surface** 로만 취급한다.
> canonical path는 `POST /v1/build` → upstream snapshot persist → `POST /v1/scan`/기타 개별 호출이다.

### 요청

```json
{
  "projectPath": "/path/to/project",
  "buildCommand": "/uploads/project/generated-build.sh",
  "buildEnvironment": {
    "CC": "/uploads/toolchains/arm/bin/arm-linux-gnueabihf-gcc"
  },
  "projectId": "re100-webserver",
  "scanProfile": {
    "compiler": "arm-linux-gnueabihf-gcc",
    "targetArch": "arm-cortex-a8",
    "languageStandard": "c99",
    "includePaths": ["include"]
  },
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 프로젝트 디렉토리 절대 경로 |
| buildCommand | string | O | caller가 완전히 materialize한 빌드 명령어 |
| buildEnvironment | Record<string,string> | X | caller가 제공하는 명시적 build 환경 |
| projectId | string | X | 프로젝트 ID (기본: `"auto"`) |
| scanProfile | BuildProfile | X | build 후 scan 단계에서만 사용하는 analysis profile |
| provenance | object | X | Build Snapshot provenance |
| thirdPartyPaths | string[] | X | 내부 `/v1/scan` 호출에 전달 |
| options.timeoutSeconds | int | X | 내부 `/v1/scan` timeout |

### 응답

```json
{
  "success": true,
  "provenance": {
    "buildSnapshotId": "bsnap-123",
    "buildUnitId": "bunit-456",
    "snapshotSchemaVersion": "build-snapshot-v1"
  },
  "build": {
    "success": true,
    "provenance": {
      "buildSnapshotId": "bsnap-123",
      "buildUnitId": "bunit-456",
      "snapshotSchemaVersion": "build-snapshot-v1"
    },
    "buildEvidence": {
      "compileCommandsPath": "/path/to/compile_commands.json",
      "entries": 7,
      "elapsedMs": 4885
    }
  },
  "scan": {
    "success": true,
    "scanId": "build-analyze-req-123",
    "provenance": {
      "buildSnapshotId": "bsnap-123",
      "buildUnitId": "bunit-456",
      "snapshotSchemaVersion": "build-snapshot-v1"
    },
    "findings": [...],
    "execution": { "degraded": false, "degradeReasons": [] }
  },
  "codeGraph": {"functions": [...]},
  "libraries": [...],
  "metadata": { ... },
  "elapsedMs": 236316
}
```

### 동작

1. caller가 제공한 `buildCommand` + `buildEnvironment` 그대로 실행
2. 생성된 `compile_commands.json`으로 `/v1/scan`
3. `/v1/functions`
4. `/v1/libraries`
5. `/v1/metadata`

---

## POST /v1/discover-targets

프로젝트 내 **빌드 타겟(독립 빌드 단위)**을 자동 탐색한다. 빌드 실행 없이 파일시스템 스캔만 수행한다.

### 요청

```json
{
  "projectPath": "/uploads/proj-xxx"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 프로젝트 디렉토리 절대 경로 |

### 응답

```json
{
  "targets": [
    {
      "name": "gateway-webserver",
      "relativePath": "gateway-webserver/",
      "buildSystem": "cmake",
      "buildFile": "gateway-webserver/CMakeLists.txt"
    },
    {
      "name": "certificate-maker",
      "relativePath": "certificate-maker/",
      "buildSystem": "make",
      "buildFile": "certificate-maker/Makefile"
    }
  ],
  "elapsedMs": 2
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| name | string | 타겟 이름 (디렉토리명) |
| relativePath | string | projectPath 기준 상대 경로 (루트면 `""`) |
| buildSystem | string | `cmake`, `make`, `meson`, `autotools` |
| buildFile | string | 빌드 파일의 상대 경로 |

### 의미
- `discover-targets`는 **identity hint surface** 다.
- 더 이상 `detectedBuildCommand`를 추천하지 않는다.

---

## Build Snapshot consumer seam

S4는 `/v1/build`, `/v1/scan`, `/v1/build-and-analyze`에서
**nested `provenance` object** 를 입력으로 받고 그대로 echo한다.

### build path와 analysis path의 차이
- **build path**: intent/materialization을 하지 않는다. caller가 fully materialized inputs를 준다.
- **analysis path**: 이번 배치에서 철학을 바꾸지 않는다. `BuildProfile` 기반 해석은 그대로 남아 있다.

### build path 원칙
- S4는 snapshot persistence owner가 아니다.
- S4는 build path에서 `sdkId`를 해석하지 않는다.
- build path는 caller가 제공한 concrete execution evidence만 실행한다.

### analysis path 원칙
- `/v1/scan` 등 analysis surface는 이번 범위에서 unchanged.
- 따라서 analysis path에서는 `BuildProfile` 해석이 계속 존재할 수 있다.

---

## SDK registry ownership 변경

`/v1/sdk-registry` public API는 제거되었다.

이유:
- SDK registry ownership은 S4 build path가 아니라 upstream(S3 via S2) concern이다.
- S4 build path는 더 이상 `sdkId`를 받아 실행하지 않는다.

S3가 필요한 SDK metadata는 **S2로부터** 받아야 한다.

---

## 관련 문서

- [SastFinding 타입 정의](shared-models.md)
- [SAST Runner 명세](../specs/sast-runner.md)
- [S4 인수인계서](../s4-handoff/README.md)
