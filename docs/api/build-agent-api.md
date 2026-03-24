# Build Agent API 명세

> **소유자**: S3 (Analysis Agent 겸 Build Agent)
> **포트**: 8003
> **호출자**: S2 (Backend)
> **최종 업데이트**: 2026-03-24

S2(AEGIS Core)가 S3(Build Agent)를 호출할 때 참조하는 API 계약서.
Build Agent는 AEGIS의 **LLM 기반 빌드 자동화 에이전트**로, 프로젝트 빌드 파일(CMakeLists.txt, Makefile, 빌드 스크립트)을 분석하여 정확한 빌드 명령어 + buildProfile + compile_commands.json을 자동 생성한다.

---

## Base URL

```
http://localhost:8003
```

## 공통 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| `X-Request-Id` | 요청/응답 | 분산 추적용 요청 ID. S2가 전달하면 S3가 로그에 기록하고 S7에도 전파. 응답에도 포함. |

---

## 엔드포인트 요약

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `build-resolve` — 프로젝트 빌드 명령어/프로필 자동 탐색 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 + S7 Gateway 연결 상태 |

---

## POST /v1/tasks

프로젝트 빌드 자동 해석. S2가 프로젝트 경로와 타겟 정보를 전달하면 Build Agent가 빌드 파일을 읽고(`read_file`), 빌드를 시도(`try_build`)하여 성공적인 빌드 명령어와 buildProfile을 반환한다.

### Task Type

| Task Type | 용도 |
|-----------|------|
| `build-resolve` | 빌드 명령어 + buildProfile + compile_commands.json 자동 탐색 |

### 요청

```json
{
  "taskType": "build-resolve",
  "taskId": "build-001",
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/AEGIS/uploads/re100-gateway",
      "targetPath": "gateway/",
      "targetName": "gateway-webserver",
      "targets": [
        {
          "name": "gateway-webserver",
          "path": "gateway/",
          "buildSystem": "cmake",
          "buildFiles": ["gateway/CMakeLists.txt"]
        }
      ]
    }
  },
  "constraints": {"maxTokens": 8192, "timeoutMs": 600000}
}
```

#### TaskRequest 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| taskType | string | O | `"build-resolve"` 고정 |
| taskId | string | O | 요청 고유 ID |
| context | object | O | 빌드 컨텍스트 (trusted) |
| constraints | object | X | 빌드 제약 조건 |
| metadata | object | X | 추적용 메타데이터 |

#### context.trusted 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 프로젝트 절대 경로 |
| targetPath | string | X | `projectPath` 기준 상대 경로 (예: `"gateway/"`). 지정 시 `${projectPath}/${targetPath}`를 빌드 루트로 사용 |
| targetName | string | X | 빌드 타겟 이름 (사람이 읽기 쉬운 식별자) |
| targets | array | X | S4 `discover-targets` 결과. 서브 프로젝트 목록 `[{name, path, buildSystem, buildFiles}]` |

#### Constraints 스키마

| 필드 | 타입 | 기본값 | 범위 | 설명 |
|------|------|--------|------|------|
| maxTokens | int | 8192 | 1~16384 | LLM 최대 생성 토큰 |
| timeoutMs | int | 600000 | 1000~900000 | 전체 빌드 해석 타임아웃 (ms) |

---

### 에이전트 도구

Build Agent가 LLM 루프 안에서 사용하는 도구:

| 도구 | 비용 등급 | 설명 |
|------|-----------|------|
| `read_file` | CHEAP | 빌드 파일 읽기 (CMakeLists.txt, Makefile, configure.ac 등) |
| `write_file` | CHEAP | `build-aegis/` 격리 폴더 안에 빌드 스크립트/설정 생성 |
| `try_build` | EXPENSIVE | 빌드 명령어 실행 시도. 성공 시 compile_commands.json 수집 |

### 안전성 제약

| 규칙 | 설명 |
|------|------|
| **폴더 격리** | `write_file`은 `${projectPath}/build-aegis/` 하위에만 쓸 수 있다 |
| **소스 수정 금지** | 에이전트는 프로젝트 원본 소스 파일을 수정할 수 없다 |
| **금지 명령어** | `rm -rf`, `sudo`, 네트워크 접근 명령어 등 위험 명령어 차단 |

---

### 성공 응답

HTTP `200` + `status: "completed"`

```json
{
  "taskId": "build-001",
  "taskType": "build-resolve",
  "status": "completed",
  "modelProfile": "build-v1",
  "promptVersion": "build-resolve-v1",
  "schemaVersion": "agent-v1",
  "validation": {
    "valid": true,
    "errors": []
  },
  "result": {
    "summary": "gateway-webserver CMake 빌드 성공. compile_commands.json 생성 완료.",
    "claims": [
      {
        "statement": "CMake 기반 빌드 시스템 확인, arm-none-linux-gnueabihf-gcc 크로스 컴파일 설정 탐지",
        "supportingEvidenceRefs": [],
        "location": "gateway/CMakeLists.txt"
      }
    ],
    "caveats": ["크로스 컴파일 SDK가 설치되지 않아 네이티브 빌드로 대체됨"],
    "usedEvidenceRefs": [],
    "confidence": 0.92,
    "confidenceBreakdown": {
      "grounding": 0.95,
      "deterministicSupport": 1.0,
      "ragCoverage": 0.4,
      "schemaCompliance": 1.0
    },
    "needsHumanReview": false,
    "buildResult": {
      "buildCommand": "cmake -S gateway/ -B build-aegis/gateway -DCMAKE_EXPORT_COMPILE_COMMANDS=ON && cmake --build build-aegis/gateway",
      "buildProfile": {
        "compiler": "arm-none-linux-gnueabihf-gcc",
        "targetArch": "arm-cortex-a8",
        "languageStandard": "c++17",
        "includePaths": ["/opt/ti-sdk/include"],
        "defines": ["PLATFORM_AM335X"]
      },
      "compileCommandsPath": "build-aegis/gateway/compile_commands.json"
    }
  },
  "audit": {
    "inputHash": "sha256:b2c3d4e5f6a7",
    "latencyMs": 45000,
    "tokenUsage": {"prompt": 2100, "completion": 980},
    "retryCount": 0,
    "createdAt": "2026-03-24T10:00:00Z",
    "agentAudit": {
      "turn_count": 4,
      "tool_call_count": 7,
      "termination_reason": "build_success",
      "trace": [
        {
          "step_id": 1,
          "tool": "read_file",
          "cost_tier": "cheap",
          "duration_ms": 12,
          "success": true
        },
        {
          "step_id": 2,
          "tool": "try_build",
          "cost_tier": "expensive",
          "duration_ms": 18000,
          "success": true
        }
      ]
    }
  }
}
```

#### buildResult 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| buildCommand | string | O | 성공한 빌드 명령어 전체 |
| buildProfile | object | O | 빌드 환경 프로필 (compiler, targetArch, languageStandard, includePaths, defines 등) |
| compileCommandsPath | string | X | `compile_commands.json` 상대 경로. 빌드 시스템이 지원하면 생성 |

#### AssessmentResult 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| summary | string | O | 빌드 결과 요약 (1~3문장) |
| claims | array | O | 빌드 과정에서 발견한 사항 목록 |
| caveats | array | O | 빌드의 한계, 불확실성 |
| usedEvidenceRefs | array | O | 분석에 사용된 전체 refId 목록 |
| confidence | float | O | 빌드 결과 신뢰도 (0.0~1.0) |
| confidenceBreakdown | object | O | 4항목 가중합 상세 |
| needsHumanReview | bool | O | 사람 검토 필요 여부 |
| buildResult | object | O | **빌드 결과** — buildCommand, buildProfile, compileCommandsPath |

#### AuditInfo 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| inputHash | string | 요청 해시 (`sha256:` 접두어 + 16자 hex) |
| latencyMs | int | 전체 처리 시간 (ms) |
| tokenUsage | object | `{prompt, completion}` — LLM 토큰 사용량 |
| retryCount | int | LLM 출력 품질 재시도 횟수 (0이면 첫 시도 성공) |
| createdAt | string | ISO 8601 UTC |
| agentAudit | object | 에이전트 루프 상세 (`turn_count`, `tool_call_count`, `termination_reason`, `trace`) |

---

### 실패 응답

HTTP `200` + `status: "{failure_status}"`

```json
{
  "taskId": "build-001",
  "taskType": "build-resolve",
  "status": "timeout",
  "failureCode": "TIMEOUT",
  "failureDetail": "빌드 타임아웃 (600초 초과)",
  "retryable": true,
  "audit": { "..." : "..." }
}
```

#### FailureCode x status 매핑

| failureCode | status | retryable | 설명 |
|-------------|--------|-----------|------|
| `INVALID_SCHEMA` | `validation_failed` | `false` | LLM 출력 JSON 구조 불량 |
| `EMPTY_RESPONSE` | `empty_result` | `false` | LLM 빈 응답 |
| `TIMEOUT` | `timeout` | `true` | 빌드 또는 전체 타임아웃 |
| `MODEL_UNAVAILABLE` | `model_error` | `true` | S7 Gateway 또는 LLM Engine 연결 불가 |
| `LLM_OVERLOADED` | `model_error` | `true` | LLM Engine 429/503 과부하 |
| `INPUT_TOO_LARGE` | `budget_exceeded` | `false` | 프롬프트 문자 수 초과 |
| `TOKEN_BUDGET_EXCEEDED` | `budget_exceeded` | `false` | 에이전트 토큰/스텝 예산 소진 |
| `UNKNOWN_TASK_TYPE` | `validation_failed` | `false` | `build-resolve` 외 taskType |
| `BUILD_FAILED` | `build_failed` | `false` | 에이전트가 최대 시도 내에 빌드 성공 불가 |

#### retryable 필드

`true`이면 S2가 재시도를 판단할 수 있다. Build Agent 내부에서 LLM 출력 품질 문제(INVALID_SCHEMA, EMPTY_RESPONSE)는 자동 재시도한다 (최대 3회). 외부로 노출되는 실패는 내부 재시도 소진 후.

---

### 입력 검증 (422)

Pydantic 검증 실패 시 `422 Unprocessable Entity`:

```json
{
  "detail": [
    {"loc": ["body", "taskType"], "msg": "Field required", "type": "missing"}
  ]
}
```

| 조건 | 응답 코드 |
|------|-----------|
| taskType 누락 | 422 |
| taskType이 `build-resolve` 외 | 422 |
| projectPath 누락 | 422 |
| maxTokens 범위 초과 (>16384) | 422 |
| 빈 body 또는 invalid JSON | 422 |

---

## GET /v1/health

```json
{
  "service": "s3-build",
  "status": "ok",
  "version": "0.1.0",
  "llmMode": "real",
  "llmBackend": {
    "status": "ok",
    "gateway": "http://localhost:8000",
    "gatewayLlmBackend": {"status": "ok", "endpoint": "http://10.126.37.19:8000"}
  },
  "agentConfig": {
    "maxSteps": 10,
    "maxCompletionTokens": 20000,
    "toolBudget": {"cheap": 10, "expensive": 3}
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| service | string | `"s3-build"` 고정 |
| llmMode | string | `"mock"` 또는 `"real"` |
| llmBackend | object | S7 Gateway 연결 상태 (real 모드에서만) |
| agentConfig | object | 에이전트 루프 예산 설정 |

- Build Agent health 자체는 S7 장애와 무관하게 `"ok"`를 반환한다.

---

## S2 연동 플로우

```
1. S2 → S4: POST /v1/discover-targets → 서브 프로젝트 목록 (targets[])
2. S2 → S3(Build Agent :8003): POST /v1/tasks { taskType: "build-resolve", targets }
     → 에이전트가 read_file + try_build로 빌드 성공시킴
3. S3 → S2: result.buildResult = { buildCommand, buildProfile, compileCommandsPath }
4. S2: buildProfile DB 저장 → 이후 SAST/deep-analyze 분석 시 사용
```
