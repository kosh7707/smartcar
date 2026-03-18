# SAST Runner API 명세 (v0.4.0)

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

## 엔드포인트 요약

| 메서드 | 경로 | MCP Tool | 용도 |
|--------|------|----------|------|
| POST | `/v1/scan` | `sast.scan` | 6개 SAST 도구 병렬 + SDK 해석 + 노이즈 필터링 + 실행 보고서 |
| POST | `/v1/functions` | `code.functions` | clang AST → 함수+호출 관계 (namespace, projectPath) |
| POST | `/v1/includes` | `code.includes` | gcc -E -M → 인클루드 트리 |
| POST | `/v1/metadata` | `build.metadata` | gcc -E -dM → 타겟 매크로/아키텍처 |
| POST | `/v1/libraries` | `sca.libraries` | 라이브러리 식별 + upstream diff + CVE (NVD/OSV) |
| POST | `/v1/build-and-analyze` | — | bear 빌드 자동 실행 → 위 전부 한 번에 |
| GET | `/v1/health` | — | 6개 도구 상태 |

---

## 도구 목록 (6개)

| 도구 | 역할 | BuildProfile 활용 |
|------|------|-------------------|
| **Semgrep** | 패턴 매칭 (순수 C에서 강함, C++에서는 **자동 스킵**) | 룰셋 C/C++ 자동 선택 |
| **Cppcheck** | 코드 품질 + 교차 번역 단위(CTU) 분석 | `--std`, `-I`, `-D` |
| **clang-tidy** | CERT 코딩 표준 기반 보안 + 버그 탐지 | `-std`, `-I`, `-D` |
| **Flawfinder** | 위험 함수 빠른 스캔 (CWE 매핑 포함) | (없음) |
| **scan-build** | Clang Static Analyzer 경로 민감 분석 | `-std`, `-I`, `-D` |
| **gcc -fanalyzer** | GCC 내장 정적 분석 (SDK 크로스 컴파일러 사용 가능) | `-std`, `-I`, `-D`, SDK 크로스 컴파일러 |

### 도구 자동 선택

BuildProfile이 있으면 SAST Runner가 **도구를 자동 선택/스킵**한다:

| 조건 | 동작 |
|------|------|
| `languageStandard`가 `c++*` | Semgrep 자동 스킵 (현대 C++에서 비효과적) |
| SDK 크로스 컴파일러 없음 | gcc -fanalyzer는 호스트 gcc로 폴백 |
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
    "maxFindingsPerRule": 50
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| scanId | string | O | 스캔 식별자 |
| projectId | string | O | 프로젝트 ID (로깅/추적용) |
| files | FileEntry[] | O | 분석 대상 소스 파일 |
| buildProfile | BuildProfile | X | 빌드 환경 설정. 있으면 도구 자동 선택 + SDK 해석 |
| rulesets | string[] | X | Semgrep 룰셋. 명시하면 자동 선택보다 우선 |
| options.timeoutSeconds | int | X | 도구당 타임아웃 (기본: 120초) |
| options.maxFindingsPerRule | int | X | 규칙당 최대 findings (기본: 50) |

#### FileEntry

| 필드 | 타입 | 설명 |
|------|------|------|
| path | string | 상대 파일 경로 (절대 경로, `..` 금지) |
| content | string | 파일 내용 |

#### BuildProfile (`shared-models.md` 참조)

| 필드 | 타입 | 설명 | 도구 활용 |
|------|------|------|----------|
| sdkId | string | SDK 프로파일 ID | SDK 헤더 자동 `-I` (Cppcheck, clang-tidy, scan-build) |
| compiler | string | 컴파일러 | gcc -fanalyzer에서 SDK 크로스 컴파일러 선택 |
| compilerVersion | string? | 컴파일러 버전 | 로깅 |
| targetArch | string | 타겟 아키텍처 | 로깅, 향후 `--platform` |
| languageStandard | string | 언어 표준 | `--std` (Cppcheck, clang-tidy, scan-build, gcc-fanalyzer), Semgrep 룰셋/스킵 결정 |
| headerLanguage | `"c"` \| `"cpp"` \| `"auto"` | `.h` 파일 처리 | 룰셋 선택 시 참고 |
| includePaths | string[]? | 추가 인클루드 경로 | `-I` (Cppcheck, clang-tidy, scan-build, gcc-fanalyzer). **상대 경로는 scan_dir 기준으로 자동 변환** |
| defines | Record<string,string>? | 전처리기 매크로 | `-D` (Cppcheck, clang-tidy, scan-build, gcc-fanalyzer) |
| flags | string[]? | 추가 컴파일 플래그 | 향후 활용 |

#### SDK 자동 해석

`buildProfile.sdkId`가 SAST Runner에 등록된 SDK와 매칭되면, 해당 SDK의 **크로스 컴파일러 경로 + 헤더 경로(C++ 표준 라이브러리, GCC 내장, libc)를 자동 해석**하여 도구의 `-I` 옵션에 추가한다.

등록된 SDK:

| sdkId | SDK | 크로스 컴파일러 | 자동 추가 헤더 경로 수 |
|-------|-----|----------------|---------------------|
| `ti-am335x` | TI Processor SDK Linux AM335x 08.02.00.24 | `arm-none-linux-gnueabihf-gcc 9.2.1` | 7개 |

S2/S3는 SDK 설치 경로를 몰라도 되고, `sdkId`만 지정하면 된다.

#### Findings 필터링

SDK 헤더를 `-I`로 추가하면 SDK 내부 코드에서도 findings가 나올 수 있다. SAST Runner는 반환 전에 **사용자가 업로드한 파일에 해당하는 findings만 남기고, SDK/표준 라이브러리 내부 findings는 자동 제거**한다.

필터링 기준: `location.file`이 절대 경로(`/`로 시작)이면 외부 파일로 판단하여 제거.

실측: RE100 + TI AM335x SDK → 필터링 전 254건, 필터링 후 28건 (SDK 노이즈 226건 제거).

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
      "cppcheck": { "findingsCount": 4, "elapsedMs": 110000, "status": "ok" },
      "clang-tidy": { "findingsCount": 10, "elapsedMs": 5100, "status": "ok" },
      "flawfinder": { "findingsCount": 14, "elapsedMs": 20, "status": "ok" },
      "scan-build": { "findingsCount": 0, "elapsedMs": 3000, "status": "ok" },
      "semgrep": { "findingsCount": 0, "elapsedMs": 0, "status": "skipped", "skipReason": "C++ project — Semgrep pattern rules ineffective" },
      "gcc-fanalyzer": { "findingsCount": 0, "elapsedMs": 8000, "status": "ok" }
    },
    "sdk": {
      "resolved": true,
      "sdkId": "ti-am335x",
      "includePathsAdded": 7
    },
    "filtering": {
      "beforeFilter": 254,
      "afterFilter": 28,
      "sdkNoiseRemoved": 226
    }
  }
}
```

#### SastFinding (shared-models.md 준수)

| 필드 | 타입 | 설명 |
|------|------|------|
| toolId | string | `"semgrep"`, `"cppcheck"`, `"flawfinder"`, `"clang-tidy"`, `"scan-build"`, `"gcc-fanalyzer"` 중 하나 |
| ruleId | string | `"{toolId}:{원본 rule ID}"` 형식 |
| severity | string | 도구별 심각도 |
| message | string | 도구가 생성한 설명 |
| location | SastFindingLocation | 소스 위치 |
| dataFlow | SastDataFlowStep[]? | taint/data flow 경로 (있을 때만) |
| metadata | object? | CWE, references, 원본 rule ID 등 |

#### execution 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| toolsRun | string[] | 실제 실행된 도구 목록 |
| toolResults | dict | 도구별 {findingsCount, elapsedMs, status, skipReason?} |
| sdk | object | {resolved, sdkId?, includePathsAdded} |
| filtering | object | {beforeFilter, afterFilter, sdkNoiseRemoved} |

`toolResults[*].status` 값: `"ok"`, `"skipped"`, `"failed"`, `"unavailable"`

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
| `NO_FILES_PROVIDED` | 400 | N | files 배열 비어있음 |
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

`POST /v1/scan`과 동일한 형식.

### 응답

```json
{
  "includes": {
    "src/http_client.cpp": [
      "include/http_client.hpp",
      "/usr/include/stdio.h",
      "/home/kosh/ti-sdk/.../cstdlib"
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
  "service": "s4-sast-runner",
  "status": "ok",
  "version": "0.3.0",
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
| 필수 필드 | `level`, `time` (epoch ms), `service` ("s4-sast-runner"), `msg` |
| 요청 추적 | `requestId` — 라우터 ~ 오케스트레이터 ~ 개별 러너까지 전 레이어 전파 |

---

## POST /v1/libraries

프로젝트 내 vendored 라이브러리를 자동 식별하고 upstream과 비교한다. `projectPath` 필수.

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
      },
      "cves": [
        {
          "id": "CVE-2024-3935",
          "severity": "HIGH",
          "summary": "...",
          "fixedIn": "2.0.19",
          "source": "nvd",
          "url": "https://nvd.nist.gov/vuln/detail/CVE-2024-3935"
        }
      ],
      "cveCount": 20
    }
  ],
  "elapsedMs": 21000
}
```

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
- `matchRatio` = 동일 파일 / (동일 + 수정) — 100%면 원본

### CVE 조회

- OSV.dev API + NVD API 실시간
- 노이즈 포함 (키워드 검색) → S3 reranking + LLM 최종 판정에 의존

---

## POST /v1/build-and-analyze

빌드 자동 실행 + 전체 분석 파이프라인 한 번에.

### 요청

```json
{
  "projectPath": "/path/to/project",
  "buildCommand": "./scripts/cross_build.sh",
  "projectId": "re100-webserver"
}
```

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
4. `/v1/libraries` (SCA + CVE)
5. `/v1/metadata`
6. 전부 합쳐서 반환

### 주의

- 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함
- `bear` 필요 (`apt install bear`)
- 빌드 타임아웃 기본 300초

---

## 관련 문서

- [SastFinding 타입 정의](shared-models.md)
- [SAST Runner 명세](../specs/sast-runner.md)
- [LLM Engine API](llm-engine-api.md)
- [S4 인수인계서](../s4-handoff/README.md)
