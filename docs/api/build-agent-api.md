# Build Agent API 명세 (v0.4.0)

> **소유자**: S3 (Analysis Agent 겸 Build Agent)
> **포트**: 8003
> **호출자**: S2 (Backend)
> **최종 업데이트**: 2026-04-02

S2(AEGIS Core)가 S3(Build Agent)를 호출할 때 참조하는 API 계약서.
Build Agent는 AEGIS의 **LLM 기반 빌드 자동화 에이전트**로, 프로젝트 소스를 탐색하여 빌드 스크립트(`build-aegis/aegis-build.sh`)를 작성하고 빌드를 성공시킨다. compile_commands.json 추출은 S4의 영역.

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
| POST | `/v1/tasks` | `build-resolve` — 빌드 스크립트 작성 + 빌드 성공 |
| POST | `/v1/tasks` | `sdk-analyze` — SDK 디렉토리 분석 + `sdkProfile` 추출 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 |

---

## POST /v1/tasks

프로젝트 빌드 자동화. S2가 프로젝트/서브프로젝트 경로를 전달하면 Build Agent가 소스를 탐색하고, 빌드 스크립트를 작성하여 빌드를 성공시킨다.

### Task Type

| Task Type | 용도 |
|-----------|------|
| `build-resolve` | 빌드 스크립트 작성 + 빌드 성공. 산출물: `build-aegis/aegis-build.sh` + `buildCommand` |
| `sdk-analyze` | SDK/툴체인 디렉토리를 분석하여 `sdkProfile`을 추출 |

### 요청

```json
{
  "taskType": "build-resolve",
  "taskId": "build-001",
  "context": {
    "trusted": {
      "projectPath": "/home/kosh/AEGIS/uploads/re100-gateway",
      "targetPath": "gateway-webserver/",
      "targetName": "gateway-webserver"
    }
  },
  "constraints": {"maxTokens": 8192, "timeoutMs": 600000}
}
```

#### context.trusted 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| projectPath | string | O | 프로젝트 절대 경로 |
| targetPath | string | X | `projectPath` 기준 상대 경로. 서브프로젝트 지정 시 `${projectPath}/${targetPath}`가 빌드 루트. **build-aegis/도 이 경로 내에 생성.** |
| targetName | string | X | 빌드 타겟 이름 (사람이 읽기 쉬운 식별자) |
| targets | array | X | S4 `discover-targets` 결과 |

---

### 에이전트 도구

Build Agent가 LLM 루프 안에서 사용하는 도구:

| 도구 | 비용 등급 | 설명 |
|------|-----------|------|
| `list_files` | CHEAP | 프로젝트 디렉토리 구조를 트리 형태로 반환. `path`(선택), `max_depth`(기본 3) |
| `read_file` | CHEAP | 프로젝트 내 파일 읽기 (읽기 전용, 8KB 제한, 초과 시 절삭 공지) |
| `write_file` | CHEAP | `build-aegis/` 안에 파일 생성. 내용 안전성 스캔 포함 |
| `edit_file` | CHEAP | `build-aegis/` 내 에이전트가 생성한 파일 수정 (전체 덮어쓰기). 내용 안전성 스캔 포함 |
| `delete_file` | CHEAP | `build-aegis/` 내 에이전트가 생성한 파일 삭제 |
| `try_build` | EXPENSIVE | S4에 빌드 명령어 전송. `sdk_id` 옵션으로 SDK 자동 source. 실패 시 에러 분류 자동 첨부 |

### Phase 0 사전 분석 (v0.3.0)

에이전트 루프 실행 전에 결정론적으로 프로젝트를 분석한다:

- **빌드 시스템 탐지**: CMakeLists.txt → cmake, Makefile → make, configure → autotools, *.sh → shell
- **SDK registry 조회**: S4에서 사용 가능한 SDK/툴체인 정보 가져옴
- **언어 탐지**: 파일 확장자 기반 (.c, .cpp, .h, .hpp)
- **기존 빌드 스크립트 탐지**: scripts/cross_build.sh, build.sh 등
- **프로젝트 트리 생성**: depth 2 컴팩트 트리

결과는 시스템 프롬프트의 `## 사전 분석 결과 (Phase 0)` 섹션으로 주입되며, 빌드 시스템별 전략 가이드가 자동 분기된다.

### 스크립트 내용 안전성 검사 (v0.3.0)

`write_file`/`edit_file` 시 스크립트 내용에 금지 패턴을 스캔한다:
- `rm -rf`, `curl`, `wget`, `git clone/push/pull`, `docker`, `chmod`, `chown`, `sudo`, `apt-get`, `pip install`
- 발견 시 결과에 `_content_warnings` 필드가 첨부됨 (차단하지는 않음)

### 중복 호출 정책 v2 (v0.3.0)

- 동일 tool + 동일 arguments의 반복 호출은 차단 (args_hash 기반)
- **단, mutating tool** (`write_file`, `edit_file`, `delete_file`) 성공 후에는 duplicate hash가 **초기화**됨
- 이로써 `edit_file → try_build(같은 명령어)` 재시도가 정상 동작

### `try_build` 에러 분류 (v0.3.0)

빌드 실패 시 `_error_classification` 필드가 자동 첨부된다:

| 필드 | 타입 | 설명 |
|------|------|------|
| category | string | `MISSING_HEADER`, `UNDEFINED_SYMBOL`, `TOOLCHAIN_NOT_FOUND`, `PERMISSION_DENIED`, `SYNTAX_ERROR`, `MISSING_LIBRARY`, `CMAKE_CONFIG_ERROR`, `FILE_NOT_FOUND`, `UNKNOWN` |
| message | string | 에러 원문 발췌 (최대 200자) |
| suggestion | string | 결정론적 복구 제안 |

### 정책 엔진

금지 명령어 블랙리스트 대신 **능력 기반 정책**:

| 대상 | 권한 |
|------|------|
| 프로젝트 원본 파일 | read-only |
| `build-aegis/` 내 에이전트 생성 파일 | read/write/edit/delete |
| `build-aegis/` 내 에이전트 미생성 파일 | read-only |
| `build-aegis/` 외부 | 쓰기 금지 |

### 고정 산출물 경로

빌드 성공 시 스크립트는 항상 고정 경로에 생성:

```
targetPath 있음: {projectPath}/{targetPath}/build-aegis/aegis-build.sh
targetPath 없음: {projectPath}/build-aegis/aegis-build.sh
```

S4가 이후 `bear -- bash build-aegis/aegis-build.sh`로 compile_commands.json을 추출한다.

---

### 성공 응답

HTTP `200` + `status: "completed"`

```json
{
  "taskId": "build-001",
  "taskType": "build-resolve",
  "status": "completed",
  "modelProfile": "agent-loop",
  "promptVersion": "build-v3",
  "schemaVersion": "agent-v1",
  "validation": {
    "valid": true,
    "errors": []
  },
  "result": {
    "summary": "gateway-webserver 크로스 빌드 성공. ti-am335x SDK 사용.",
    "claims": [
      {
        "statement": "셸 스크립트 기반 크로스 컴파일 빌드 성공",
        "supportingEvidenceRefs": [],
        "location": "scripts/cross_build.sh"
      }
    ],
    "caveats": ["MQTT/CoAP 라이브러리 비활성화하여 의존성 우회"],
    "usedEvidenceRefs": [],
    "confidence": 0.85,
    "needsHumanReview": false,
    "buildResult": {
      "success": true,
      "buildCommand": "bash gateway-webserver/build-aegis/aegis-build.sh",
      "buildScript": "build-aegis/aegis-build.sh",
      "buildDir": "build-aegis",
      "errorLog": null
    }
  },
  "audit": {
    "inputHash": "sha256:b2c3d4e5f6a7",
    "latencyMs": 45000,
    "tokenUsage": {"prompt": 2100, "completion": 980},
    "retryCount": 0,
    "createdAt": "2026-03-25T10:00:00Z",
    "agentAudit": {
      "turn_count": 4,
      "tool_call_count": 5,
      "termination_reason": "content_returned",
      "trace": [...]
    }
  }
}
```

#### buildResult 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| success | bool | O | 빌드 성공 여부 |
| buildCommand | string | O | 빌드 실행 명령어 |
| buildScript | string | O | 에이전트가 작성한 빌드 스크립트 경로 (`build-aegis/aegis-build.sh`) |
| buildDir | string | O | 빌드 출력 디렉토리 (`build-aegis`) |
| errorLog | string | X | 실패 시 에러 로그 |

### `sdk-analyze`

SDK 또는 툴체인 디렉토리를 읽고 `sdkProfile`을 반환하는 보조 taskType이다. 소스 코드를 수정하지 않으며, `read_file` + 제한적 `try_build(--version)`만 사용한다.

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

### 실패 응답

HTTP `200` + `status: "{failure_status}"`

성공/실패 모두 **유저에게 의미 있는 결과물**을 반환한다. 실패 시 진단 보고서(실패 원인, 필요 조치) 포함.

```json
{
  "taskId": "build-001",
  "taskType": "build-resolve",
  "status": "budget_exceeded",
  "failureCode": "MAX_STEPS_EXCEEDED",
  "failureDetail": "3회 연속 빌드 실패. 원인: libssl-dev 미설치",
  "retryable": false,
  "audit": { "..." : "..." }
}
```

#### FailureCode x status 매핑

| failureCode | status | retryable | 설명 |
|-------------|--------|-----------|------|
| `INVALID_SCHEMA` | `validation_failed` | `false` | LLM 출력 JSON 구조 불량 |
| `EMPTY_RESPONSE` | `empty_result` | `false` | LLM 빈 응답 |
| `TIMEOUT` | `timeout` | `true` | 전체 타임아웃 |
| `MODEL_UNAVAILABLE` | `model_error` | `true` | S7 Gateway 또는 LLM Engine 연결 불가 |
| `TOKEN_BUDGET_EXCEEDED` | `budget_exceeded` | `false` | 토큰 예산 소진 |
| `MAX_STEPS_EXCEEDED` | `budget_exceeded` | `false` | 스텝/턴 한도 도달 |
| `INSUFFICIENT_EVIDENCE` | `budget_exceeded` | `false` | 연속 무증거 턴 초과 |
| `ALL_TOOLS_EXHAUSTED` | `budget_exceeded` | `false` | 모든 도구 티어 예산 소진 |

---

## GET /v1/health

```json
{
  "service": "s3-build",
  "status": "ok",
  "version": "0.3.0",
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

```
1. S2 → S4: POST /v1/discover-targets → 서브 프로젝트 목록 (targets[])
2. S2 → S3(Build Agent :8003): POST /v1/tasks { taskType: "build-resolve", targetPath }
     → 에이전트가 소스 탐색 → 빌드 스크립트 작성 → 빌드 성공
3. S3 → S2: result.buildResult = { buildCommand, buildScript }
4. S2 → S4: POST /v1/build { buildCommand } → S4가 bear 감싸서 compile_commands.json 생성
5. S2: compile_commands.json 경로 저장 → 이후 SAST/deep-analyze 분석 시 사용
```
