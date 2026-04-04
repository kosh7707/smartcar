# Build Agent API 명세 (v1.0.0)

> **소유자**: S3 (Analysis Agent 겸 Build Agent)
> **포트**: 8003
> **호출자**: S2 (Backend)
> **최종 업데이트**: 2026-04-04

S2(AEGIS Core)가 S3(Build Agent)를 호출할 때 참조하는 API 계약서.
Build Agent는 AEGIS의 **compile-first control plane** 이며, 업로드된 프로젝트 안에서 **명시적으로 지정된 서브프로젝트**를 **명시적으로 선언된 빌드 모드**로 빌드한다. `compile_commands.json` 추출은 계속 S4의 영역이다.

---

## Base URL

```text
http://localhost:8003
```

## 공통 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| `X-Request-Id` | 요청/응답 | 분산 추적용 요청 ID. S2가 전달하면 S3가 로그에 기록하고 S4/S7에도 전파한다. 응답에도 포함된다. |

---

## 엔드포인트 요약

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `build-resolve` — strict compile-first 빌드 계약 실행 |
| POST | `/v1/tasks` | `sdk-analyze` — SDK 디렉토리 분석 + `sdkProfile` 추출 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 |

---

## POST /v1/tasks

### Task Type

| Task Type | 용도 |
|-----------|------|
| `build-resolve` | 명시적으로 선언된 서브프로젝트/모드/산출물 조건으로 빌드를 수행한다. |
| `sdk-analyze` | SDK/툴체인 디렉토리를 분석하여 `sdkProfile`을 추출한다. |

---

## `build-resolve` — strict compile-first 계약

### 핵심 의미

`build-resolve`는 더 이상 “가능하면 빌드해보는” 느슨한 자동화가 아니다. 호출자는 아래 네 가지를 반드시 명시해야 한다.

1. **어느 서브프로젝트를 빌드할지** (`subprojectPath`, `subprojectName`)
2. **어떤 빌드 모드로 빌드할지** (`build.mode`) — `native` 또는 `sdk`
3. **SDK를 쓸 경우 어떤 SDK인지** (`build.sdkId` 등)
4. **무엇이 성공 산출물인지** (`expectedArtifacts`)

### 계약 버전 / 마이그레이션

- `contractVersion: "build-resolve-v1"` + `strictMode: true` 조합이 **compile-first v1 정식 계약**이다.
- `strictMode`가 `false` 이거나 누락되면 레거시 호환 경로로 간주할 수 있으나, 이는 **deprecated** 이며 strict 의미를 보장하지 않는다.
- 새 호출자는 반드시 strict v1 필드를 모두 채워야 한다.
- 레거시 `targetPath`, `targetName`, flat `buildMode`/`sdkId`, `contractVersion: "compile-first-v1"` 는 migration alias일 뿐이며 **strict v1의 canonical surface는 아니다**.

### 요청 예시

```json
{
  "taskType": "build-resolve",
  "taskId": "build-001",
  "contractVersion": "build-resolve-v1",
  "strictMode": true,
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/AEGIS/uploads/re100-gateway",
      "subprojectPath": "gateway-webserver",
      "subprojectName": "gateway-webserver",
      "build": {
        "mode": "sdk",
        "sdkId": "ti-am335x-sdk",
        "setupScript": "/opt/sdk/environment-setup-armv7at2hf-neon-linux-gnueabi"
      },
      "expectedArtifacts": [
        {
          "kind": "executable",
          "path": "gateway-webserver",
          "required": true
        }
      ],
      "targets": [
        {
          "path": "gateway-webserver",
          "name": "gateway-webserver"
        }
      ]
    }
  },
  "constraints": {
    "maxTokens": 8192,
    "timeoutMs": 600000
  }
}
```

### 최상위 요청 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `taskType` | string | O | `build-resolve` 또는 `sdk-analyze` |
| `taskId` | string | O | 호출자 추적용 ID |
| `contractVersion` | string | O (`build-resolve` strict) | 현재 값: `build-resolve-v1` |
| `strictMode` | bool | O (`build-resolve` strict) | `true`여야 strict compile-first 의미가 활성화된다. |
| `context` | object | O | trusted 입력 컨텍스트 |
| `constraints` | object | X | 토큰/시간 제한 |

### `context.trusted` 필드 (`build-resolve`)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `projectPath` | string | O | 업로드된 프로젝트 절대 경로 |
| `subprojectPath` | string | O | `projectPath` 기준 상대 경로. 빌드 루트가 된다. |
| `subprojectName` | string | O | 사람이 읽는 서브프로젝트 식별자 |
| `build` | object | O | 선언적 빌드 모드 / SDK 정보 |
| `expectedArtifacts` | array | O | 성공 판정에 필요한 산출물 목록 |
| `targets` | array | X | S4 `discover-targets` 결과를 전달할 수 있다. |

### `build` 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `mode` | string | O | `native` 또는 `sdk` |
| `sdkId` | string | O (`mode == "sdk"`) | 호출자가 선택한 SDK 식별자 |
| `setupScript` | string | X | 호출자가 알고 있는 SDK environment setup 경로 |
| `toolchainTriplet` | string | X | 예: `arm-linux-gnueabihf` |

### `expectedArtifacts[]` 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `kind` | string | O | `executable`, `shared-library`, `static-library`, `directory`, `file-set` |
| `path` | string | O | `subprojectPath` 기준 기대 산출물 경로 또는 이름 |
| `required` | bool | X | 기본값 `true` |
| `notes` | string | X | 사람이 읽는 보조 설명 |

### strict 계약 불변조건

1. **명시적 서브프로젝트 필수** — `subprojectPath` 누락 시 요청은 유효하지 않다.
2. **명시적 모드 필수** — Build Agent가 `native` 와 `sdk` 사이를 추측하지 않는다.
3. **native도 선언된 모드** — “SDK가 안 되면 native로 fallback”은 허용되지 않는다.
4. **`expectedArtifacts` 기반 성공 판정** — 빌드 exit code만으로 성공 처리하지 않는다.
5. **compile database-only 성공 금지** — `compile_commands.json` 또는 부분 `userEntries`는 성공으로 간주하지 않는다.
6. **silent third-party exclusion 금지** — 의존성 문제를 숨기기 위해 기능/라이브러리를 조용히 끄고 성공 처리하지 않는다.
7. **shell + gcc 경로 우선 지원** — `scripts/cross_build.sh`, hand-written gcc shell 빌드도 1급 경로로 다룬다.

### 사전 검증 (Preflight)

LLM 루프 전에 아래를 결정론적으로 검증한다.

- strict 필수 필드 존재 여부
- `build.mode` 값 유효성
- `sdk` 모드일 때 `sdkId` 존재 여부
- `expectedArtifacts` 구조 유효성
- `subprojectPath`가 `projectPath` 하위인지 여부

Preflight가 실패하면 LLM 루프를 시작하지 않고 `validation_failed`를 반환한다.

---

## 에이전트 도구

Build Agent가 LLM repair 루프 안에서 사용하는 도구:

| 도구 | 비용 등급 | 설명 |
|------|-----------|------|
| `list_files` | CHEAP | 서브프로젝트 기준 디렉토리 구조를 트리 형태로 반환 |
| `read_file` | CHEAP | 프로젝트 내 파일 읽기 (읽기 전용, 8KB 제한) |
| `write_file` | CHEAP | request-scoped `build-aegis-<requestIdPrefix>/` 안에 파일 생성 |
| `edit_file` | CHEAP | request-scoped `build-aegis-<requestIdPrefix>/` 내 에이전트 생성 파일 수정 |
| `delete_file` | CHEAP | request-scoped `build-aegis-<requestIdPrefix>/` 내 에이전트 생성 파일 삭제 |
| `try_build` | EXPENSIVE | S4에 빌드 명령을 전송하여 실제 빌드 수행 |

`try_build`는 호출자가 선언한 `build.mode`를 따른다. SDK가 선언되지 않았으면 SDK source를 추론해서 붙이지 않으며, `sdk` 모드에서는 선언된 SDK 정보 없이는 성공을 반환하지 않는다.

---

## request-scoped 산출물 경로

빌드 스크립트는 항상 서브프로젝트 루트 아래 **request-scoped 워크스페이스**에 생성된다.

```text
{projectPath}/{subprojectPath}/build-aegis-{requestIdPrefix}/aegis-build.sh
```

정확한 경로는 응답의 `buildResult.buildScript` / `buildResult.buildDir`를 기준으로 소비해야 한다. S4는 이후 해당 request-scoped 스크립트를 사용해 `compile_commands.json`을 추출한다.

---

## 성공 응답

HTTP `200` + `status: "completed"`

```json
{
  "taskId": "build-001",
  "taskType": "build-resolve",
  "contractVersion": "build-resolve-v1",
  "strictMode": true,
  "status": "completed",
  "modelProfile": "agent-loop",
  "promptVersion": "build-v3",
  "schemaVersion": "agent-v1",
  "validation": {
    "valid": true,
    "errors": []
  },
  "result": {
    "summary": "gateway-webserver를 선언된 sdk 모드로 빌드했고 required artifact를 검증했다.",
    "claims": [
      {
        "statement": "shell 기반 cross build가 선언된 SDK 조건에서 성공했다.",
        "supportingEvidenceRefs": [],
        "location": "scripts/cross_build.sh"
      }
    ],
    "caveats": [],
    "usedEvidenceRefs": [],
    "confidence": 0.88,
    "needsHumanReview": false,
    "buildResult": {
      "success": true,
      "declaredMode": "sdk",
      "sdkId": "ti-am335x-sdk",
      "buildCommand": "bash build-aegis-req1234/aegis-build.sh",
      "buildScript": "build-aegis-req1234/aegis-build.sh",
      "buildDir": "build-aegis-req1234",
      "producedArtifacts": [
        {
          "kind": "executable",
          "path": "gateway-webserver",
          "exists": true
        }
      ],
      "artifactVerification": {
        "matched": true,
        "missing": []
      },
      "errorLog": null
    }
  },
  "audit": {
    "inputHash": "sha256:b2c3d4e5f6a7",
    "latencyMs": 45000,
    "tokenUsage": {"prompt": 2100, "completion": 980},
    "retryCount": 0,
    "createdAt": "2026-04-04T05:00:00Z",
    "agentAudit": {
      "turn_count": 4,
      "tool_call_count": 5,
      "termination_reason": "content_returned",
      "trace": []
    }
  }
}
```

### `buildResult` 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `success` | bool | O | 빌드 성공 여부 |
| `declaredMode` | string | O | 호출자가 선언한 `native` 또는 `sdk` |
| `sdkId` | string | X | `sdk` 모드일 때 사용된 SDK 식별자 |
| `buildCommand` | string | O | 실제 재사용 가능한 빌드 명령 |
| `buildScript` | string | O | 생성된 request-scoped 스크립트 경로 (`build-aegis-<requestIdPrefix>/aegis-build.sh`) |
| `buildDir` | string | O | request-scoped 빌드 출력 디렉토리 (`build-aegis-<requestIdPrefix>`) |
| `producedArtifacts` | array | O | 실제 확인된 산출물 목록 |
| `artifactVerification` | object | O | 선언된 산출물 충족 여부 |
| `errorLog` | string | X | 실패 시 에러 로그 |

성공 응답은 **declared mode + reusable build command + required artifact 존재**를 모두 증명해야 한다.

---

## 실패 응답

HTTP `200` + `status: "{failure_status}"`

실패도 유저에게 의미 있는 진단 결과를 반환해야 한다. 특히 strict v1에서는 “partial success” 대신 **왜 멈췄는지**를 구체적으로 설명해야 한다.

```json
{
  "taskId": "build-001",
  "taskType": "build-resolve",
  "contractVersion": "build-resolve-v1",
  "strictMode": true,
  "status": "validation_failed",
  "failureCode": "EXPECTED_ARTIFACTS_MISMATCH",
  "failureDetail": "빌드는 종료되었지만 required artifact 'gateway-webserver'가 생성되지 않았다.",
  "retryable": false,
  "audit": {"...": "..."}
}
```

### FailureCode x status 매핑

| failureCode | status | retryable | 설명 |
|-------------|--------|-----------|------|
| `INVALID_SCHEMA` | `validation_failed` | `false` | `contractVersion`, `strictMode`, `subprojectPath`, `build.mode`, `expectedArtifacts` 등 strict 필수 입력 누락/오류 |
| `SDK_MISMATCH` | `validation_failed` 또는 `failed` | `false` 또는 `true` | strict preflight의 sdk-registry 검증 실패 또는 실행 단계의 SDK/툴체인 불일치 |
| `MISSING_BUILD_MATERIALS` | `validation_failed` 또는 `failed` | `false` | 필요한 소스/스크립트/헤더/라이브러리 등 입력 재료 부족 |
| `BUILD_SCRIPT_SYNTHESIS_FAILED` | `validation_failed` 또는 `failed` | `false` | 재사용 가능한 build script / command를 만들지 못함 |
| `COMPILE_FAILED` | `validation_failed` 또는 `failed` | `false` 또는 `true` | 선언된 조건으로 빌드가 실제 실패 |
| `EXPECTED_ARTIFACTS_MISMATCH` | `validation_failed` 또는 `failed` | `false` | required artifact가 생성되지 않음 |
| `TIMEOUT` | `timeout` | `true` | 전체 타임아웃 |
| `MODEL_UNAVAILABLE` | `model_error` | `true` | S7 Gateway 또는 LLM Engine 연결 불가 |
| `TOKEN_BUDGET_EXCEEDED` | `budget_exceeded` | `false` | 토큰 예산 소진 |
| `MAX_STEPS_EXCEEDED` | `budget_exceeded` | `false` | 스텝/턴 한도 도달 |
| `INSUFFICIENT_EVIDENCE` | `budget_exceeded` | `false` | 연속 무증거 턴 초과 |
| `ALL_TOOLS_EXHAUSTED` | `budget_exceeded` | `false` | 모든 도구 티어 예산 소진 |

---

## `sdk-analyze`

`sdk-analyze`는 SDK 또는 툴체인 디렉토리를 읽고 `sdkProfile`을 반환하는 보조 taskType이다. 소스 코드를 수정하지 않으며, `read_file` + 제한적 `try_build(--version)`만 사용한다.

```json
{
  "taskType": "sdk-analyze",
  "taskId": "sdk-001",
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/sdks/ti-am335x"
    }
  }
}
```

성공 시 `result.sdkProfile`에는 `compiler`, `compilerPrefix`, `gccVersion`, `targetArch`, `languageStandard`, `sysroot`, `environmentSetup`, `includePaths`, `defines`가 채워진다.

---

## GET /v1/health

```json
{
  "service": "s3-build",
  "status": "ok",
  "version": "1.0.0",
  "llmMode": "real",
  "agentConfig": {
    "maxSteps": 10,
    "maxCompletionTokens": 20000,
    "toolBudget": {"cheap": 20, "expensive": 5}
  }
}
```

---

## S2 연동 플로우

```text
1. S2 → S4: POST /v1/discover-targets → 서브프로젝트 목록 확보
2. S2 → S3(Build Agent :8003): POST /v1/tasks
     { taskType: "build-resolve", contractVersion: "build-resolve-v1", strictMode: true,
       subprojectPath, build.mode, expectedArtifacts, ... }
3. S3: preflight 검증 → Phase 0 → repair loop → artifact validation
4. S3 → S2: result.buildResult = { declaredMode, buildCommand, buildScript, producedArtifacts }
5. S2 → S4: POST /v1/build { buildCommand } → S4가 bear로 compile_commands.json 생성
6. S2: compile_commands.json 경로 저장 → 이후 SAST/deep-analyze 분석에 사용
```

S2는 strict v1 호출에서 Build Agent의 모드 선택을 추측하게 해서는 안 된다.
