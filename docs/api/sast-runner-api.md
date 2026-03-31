# SAST Runner API 명세 (v0.7.0)

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
| POST | `/v1/build` | — | 빌드만 수행 (bear → compile_commands.json). 파이프라인 단계별 제어용 |
| POST | `/v1/build-and-analyze` | — | bear 빌드 자동 실행 → 위 전부 한 번에 |
| POST | `/v1/discover-targets` | — | 프로젝트 내 빌드 타겟 자동 탐색 |
| GET | `/v1/sdk-registry` | — | 등록된 SDK 목록 (빌드 Agent 매칭용) |
| POST | `/v1/sdk-registry` | — | SDK 등록 (경로 검증 + sdk-registry.json 저장) |
| DELETE | `/v1/sdk-registry/:sdkId` | — | SDK 등록 해제 |
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

## POST /v1/scan

6개 SAST 도구를 병렬 실행하고 합산된 SastFinding[]을 반환한다.

### 요청

```json
{
  "scanId": "scan-uuid",
  "projectId": "proj-xxx",
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
  "version": "0.7.0",
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

**빌드만 수행** — bear → compile_commands.json 생성. 스캔/SCA/코드그래프는 별도 호출.
서브 프로젝트 파이프라인의 빌드 단계용.

### 요청

```json
{
  "projectPath": "/uploads/re100/gateway-webserver",
  "buildCommand": "make",
  "buildProfile": {
    "sdkId": "ti-am335x",
    "includePaths": ["../gateway/libraries/include"]
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 서브 프로젝트 절대 경로 |
| buildCommand | string | X | 미지정 시 자동 감지 (빌드 스크립트 우선 → CMake → Make → configure). **크로스컴파일(SDK) 프로젝트에서는 명시 권장** |
| buildProfile | BuildProfile | X | SDK 환경 설정. `sdkId`가 있으면 environment-setup 자동 source |
| wrapWithBear | bool | X | 기본 `true`. `false`면 bear 없이 순수 빌드 실행 (bear가 빌드를 방해하는 edge case 대비) |

### 응답 (200, 성공)

```json
{
  "success": true,
  "compileCommandsPath": "/uploads/re100/gateway-webserver/compile_commands.json",
  "entries": 7,
  "userEntries": 7,
  "exitCode": 0,
  "buildOutput": "...",
  "elapsedMs": 4885
}
```

### 응답 (200, 빌드 실패 — 부분 compile_commands 존재)

```json
{
  "success": false,
  "error": "build exited with code 1 — compile_commands.json contains only CMake temporary entries",
  "compileCommandsPath": "/uploads/re100/gateway-webserver/compile_commands.json",
  "entries": 3,
  "userEntries": 0,
  "exitCode": 1,
  "buildOutput": "...(stderr 내용)...",
  "elapsedMs": 1234
}
```

**success 판정 기준**: `exitCode == 0`이어야 `success: true`. `exitCode != 0`이면 항상 `success: false`.

`userEntries > 0`이면 빌드는 실패했지만 **부분 compile_commands가 활용 가능**하다는 뜻이다. 이 경우 `warning` 필드가 추가된다. S3/S2는 `warning` + `userEntries > 0`을 보고 부분 데이터 활용 여부를 결정할 수 있다.

| 필드 | 타입 | 조건 | 설명 |
|------|------|------|------|
| success | boolean | 항상 | `exitCode == 0`이어야 true |
| error | string | 실패 시 | 실패 사유 |
| warning | string | 부분 실패 시 | `exitCode != 0` + `userEntries > 0`: 부분 compile_commands 활용 가능 |
| compileCommandsPath | string | cc.json 존재 시 | 생성된 compile_commands.json 경로 (실패 시에도 포함 가능) |
| entries | number | cc.json 존재 시 | compile_commands.json 전체 항목 수 (CMake 임시 포함) |
| userEntries | number | cc.json 존재 시 | CMakeFiles/ 임시 항목을 제외한 실제 사용자 코드 항목 수 |
| exitCode | number | 항상 | 빌드 프로세스 종료 코드 |
| buildOutput | string | 항상 | stdout+stderr (최대 500~1000자) |
| elapsedMs | number | 항상 | 빌드 소요 시간 (ms) |

### S2 파이프라인 사용 예시

```
S2 → S4: POST /v1/build { projectPath, buildProfile }
         → compileCommandsPath 저장, target.status = "built"

S2 → S4: POST /v1/scan { projectPath, compileCommands: compileCommandsPath }
         → findings + codeGraph + sca 저장, target.status = "scanned"
```

---

## POST /v1/build-and-analyze

빌드 자동 실행 + 전체 분석 파이프라인 한 번에.

### 요청

```json
{
  "projectPath": "/path/to/project",
  "buildCommand": "./scripts/cross_build.sh",
  "projectId": "re100-webserver",
  "buildProfile": {
    "sdkId": "ti-am335x"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 프로젝트 디렉토리 절대 경로 |
| buildCommand | string | X | 빌드 명령어 (bear로 감쌈). 미지정 시 자동 감지 (CMakeLists.txt→Makefile→configure) |
| projectId | string | X | 프로젝트 ID (기본: "auto") |
| buildProfile | BuildProfile | X | SDK 환경 설정. `sdkId`가 있으면 environment-setup 자동 source |

### 응답

```json
{
  "build": {
    "success": true,
    "compileCommandsPath": "/path/to/compile_commands.json",
    "entries": 7,
    "elapsedMs": 4885
  },
  "scan": {
    "findings": [...],
    "findingsCount": 3554,
    "execution": { ... }
  },
  "codeGraph": {
    "functions": [...]
  },
  "libraries": [...],
  "metadata": { ... },
  "elapsedMs": 236316
}
```

### 동작

1. `bear -- buildCommand` → `compile_commands.json` 자동 생성
2. `/v1/scan` (compile_commands 사용)
3. `/v1/functions` (projectPath)
4. `/v1/libraries` (SCA — CVE 없음, S5에서 별도 조회)
5. `/v1/metadata`
6. 전부 합쳐서 반환

### 주의

- 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함
- `bear` 필요 (`apt install bear`)
- 빌드 타임아웃: `X-Timeout-Ms` 헤더 → 기본 600초

---

## POST /v1/discover-targets

프로젝트 내 **빌드 타겟(독립 빌드 단위)**을 자동 탐색한다. 빌드 실행 없이 파일시스템 스캔만 수행.

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
      "buildFile": "gateway-webserver/CMakeLists.txt",
      "detectedBuildCommand": "./scripts/cross_build.sh"
    },
    {
      "name": "certificate-maker",
      "relativePath": "certificate-maker/",
      "buildSystem": "make",
      "buildFile": "certificate-maker/Makefile",
      "detectedBuildCommand": "make"
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
| detectedBuildCommand | string? | 자동 감지된 빌드 명령어 (빌드 스크립트 우선, 없으면 표준 명령어) |

### 탐색 로직

1. `projectPath` 하위 재귀 탐색
2. `CMakeLists.txt`, `Makefile`, `meson.build`, `configure` 감지
3. 각 빌드 파일의 디렉토리를 하나의 타겟으로 반환
4. 중첩된 빌드 파일은 상위 타겟에 포함되어 제외
5. `.git`, `build`, `node_modules`, `test` 등 제외
6. 각 타겟 디렉토리에서 빌드 스크립트 탐색 (`scripts/cross_build.sh`, `build.sh` 등)

### 크로스컴파일 주의

자동 감지된 `detectedBuildCommand`는 **참고용**. 크로스컴파일(SDK) 프로젝트에서는 사용자가 UI에서 정확한 빌드 명령어를 직접 지정해야 합니다. 빌드 스크립트(`cross_build.sh` 등)가 감지되면 우선 제안하지만, 없으면 네이티브 빌드 명령어(`cmake .. && make`)를 제안하므로 SDK 프로젝트에서는 부정확할 수 있습니다.

---

## GET /v1/sdk-registry

등록된 **SDK 목록**을 반환한다. S3 빌드 Agent가 프로젝트의 CMakeLists.txt와 대조하여 sdkId를 결정하는 데 사용.

### 응답

```json
{
  "sdks": [
    {
      "sdkId": "ti-am335x",
      "compiler": "arm-none-linux-gnueabihf-gcc",
      "compilerVersion": "9.2.1",
      "compilerPath": "/home/kosh/sdks/ti-am335x/.../arm-none-linux-gnueabihf-gcc",
      "targetArch": "arm",
      "sysroot": "/home/kosh/sdks/ti-am335x/.../x86_64-arago-linux",
      "setupScript": "/home/kosh/sdks/ti-am335x/.../environment-setup-armv7at2hf-...",
      "installed": true
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| sdkId | string | SDK 식별자 (= 폴더명) |
| compiler | string | 크로스 컴파일러 이름 |
| compilerVersion | string? | GCC 버전 |
| compilerPath | string? | 컴파일러 절대 경로 (설치 시) |
| targetArch | string | 타겟 아키텍처 (`arm`, `aarch64`, `x86_64`) |
| sysroot | string? | sysroot 절대 경로 |
| setupScript | string? | environment-setup 스크립트 절대 경로 |
| installed | boolean | SDK가 실제 설치되어 있는지 |

---

## POST /v1/sdk-registry

SDK를 검증하고 등록한다. S3이 분석한 메타데이터를 S2가 전달.

### 요청

```json
{
  "sdkId": "sdk-a1b2c3d4",
  "description": "TI AM335x 08.02",
  "path": "/home/kosh/AEGIS/uploads/proj-1/sdk/sdk-a1b2c3d4",
  "sysroot": "linux-devkit/sysroots/armv7at2hf-neon-linux-gnueabi",
  "compilerPrefix": "arm-none-linux-gnueabihf",
  "gccVersion": "9.2.1",
  "environmentSetup": "linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| sdkId | string | O | SDK 식별자 |
| path | string | O | SDK 설치 절대 경로 |
| description | string | X | 설명 |
| sysroot | string | X | path 기준 상대 경로 |
| compilerPrefix | string | X | 크로스 컴파일러 prefix |
| gccVersion | string | X | GCC 버전 |
| environmentSetup | string | X | environment-setup 스크립트 (path 기준 상대) |

### 응답 (200, 성공)

```json
{ "success": true }
```

### 응답 (400, 검증 실패)

```json
{
  "success": false,
  "errors": [
    "Sysroot not found: /home/.../sysroots/armv7at2hf-neon-linux-gnueabi",
    "Compiler not found: /home/.../usr/bin/arm-none-linux-gnueabihf-gcc"
  ]
}
```

### 검증 항목

1. `path` 디렉토리 존재
2. `{path}/{sysroot}` 디렉토리 존재 (sysroot 지정 시)
3. `{path}/{environmentSetup}` 파일 존재 (environmentSetup 지정 시)
4. `{path}/{sysroot}/usr/bin/{compilerPrefix}-gcc` 실행 파일 존재 (compilerPrefix + sysroot 지정 시)

---

## DELETE /v1/sdk-registry/:sdkId

등록된 SDK를 삭제한다.

### 응답 (200)

```json
{ "success": true }
```

### 응답 (404)

```json
{ "success": false, "error": "SDK not found: nonexistent-id" }
```

---

## 관련 문서

- [SastFinding 타입 정의](shared-models.md)
- [SAST Runner 명세](../specs/sast-runner.md)
- [S4 인수인계서](../s4-handoff/README.md)
