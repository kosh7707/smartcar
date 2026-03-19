# Analysis Agent API 명세

> **소유자**: S3 (Analysis Agent)
> **포트**: 8001
> **호출자**: S2 (Backend)
> **최종 업데이트**: 2026-03-19

S2(AEGIS Core)가 S3(Analysis Agent)를 호출할 때 참조하는 API 계약서.
Analysis Agent는 AEGIS의 **증거 기반 보안 심층 분석 에이전트**로, Phase 1(결정론적 도구 실행) + Phase 2(LLM 해석)를 자동 수행한다.

---

## Base URL

```
http://localhost:8001
```

## 공통 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| `X-Request-Id` | 요청/응답 | 분산 추적용 요청 ID. S2가 전달하면 S3가 로그에 기록하고 S4/S5/S7에도 전파. 응답에도 포함. |

---

## 엔드포인트 요약

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `deep-analyze` — 프로젝트 보안 심층 분석 (Phase 1/2 자동 실행) |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 + S7 Gateway 연결 상태 |

---

## POST /v1/tasks

프로젝트 보안 심층 분석. S2가 소스 파일, 빌드 정보, evidence refs를 전달하면 S3가 SAST → 코드 그래프 → SCA → LLM 해석을 자동 실행하여 구조화된 assessment를 반환한다.

### Task Type

| Task Type | 용도 |
|-----------|------|
| `deep-analyze` | 프로젝트 전반 보안 분석 (유일한 taskType) |

> `deep-analyze` 외의 taskType 전송 시 `422` 반환. 레거시 5개 taskType(`static-explain`, `static-cluster`, `dynamic-annotate`, `test-plan-propose`, `report-draft`)은 S7 LLM Gateway(:8000)가 담당.

### 요청

```json
{
  "taskType": "deep-analyze",
  "taskId": "scan-001",
  "context": {
    "trusted": {
      "objective": "RE100 gateway-webserver 보안 취약점 심층 분석",
      "files": [
        {"path": "src/http_client.cpp", "content": "...소스코드..."}
      ],
      "projectId": "re100-gateway",
      "projectPath": "/home/user/RE100/gateway-webserver",
      "buildProfile": {
        "sdkId": "ti-am335x",
        "compiler": "arm-none-linux-gnueabihf-gcc",
        "targetArch": "arm-cortex-a8",
        "languageStandard": "c++17",
        "headerLanguage": "cpp",
        "includePaths": ["src", "libraries/civetweb/include"]
      },
      "sastFindings": []
    }
  },
  "evidenceRefs": [
    {
      "refId": "eref-file-00",
      "artifactId": "art-re100",
      "artifactType": "raw-source",
      "locatorType": "lineRange",
      "locator": {"file": "src/http_client.cpp", "fromLine": 1, "toLine": 200}
    }
  ],
  "constraints": {
    "maxTokens": 4096,
    "timeoutMs": 300000
  }
}
```

#### TaskRequest 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| taskType | string | O | `"deep-analyze"` 고정 |
| taskId | string | O | 요청 고유 ID |
| context | object | O | 분석 컨텍스트 (trusted/semiTrusted/untrusted) |
| evidenceRefs | array | X | S2가 제공하는 증적 참조. S3는 이 refId만 인용 가능 |
| constraints | object | X | 분석 제약 조건 |
| metadata | object | X | 추적용 메타데이터 |

#### context.trusted 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| objective | string | O | 분석 목표 (자연어) |
| files | array | O | `[{path, content}]` — 분석 대상 소스 파일 |
| projectId | string | X | 프로젝트 식별자 (코드 그래프 적재용) |
| projectPath | string | X | 프로젝트 절대 경로 (SCA 라이브러리 스캔용) |
| buildProfile | object | X | 빌드 환경 (sdkId, compiler, targetArch, languageStandard, headerLanguage, includePaths) |
| sastFindings | array | X | S2가 사전 수행한 SAST findings (있으면 Phase 1 SAST 스캔 보강) |

#### EvidenceRef 스키마

S2가 제공하는 안정적 식별자. S3는 이 ref를 인용만 할 수 있고, 새로 발명할 수 없다.

```json
{
  "refId": "eref-001",
  "artifactId": "art-456",
  "artifactType": "raw-source",
  "locatorType": "lineRange",
  "locator": {"file": "src/main.cpp", "fromLine": 1, "toLine": 100}
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| refId | string | O | 고유 참조 ID (claims에서 인용) |
| artifactId | string | O | 산출물 ID |
| artifactType | string | O | `"raw-source"`, `"sast-finding"` 등 |
| locatorType | string | O | `"lineRange"` |
| locator | object | O | 위치 지정 (`file`, `fromLine`, `toLine`) |
| hash | string | X | 산출물 해시 |

#### Constraints 스키마

| 필드 | 타입 | 기본값 | 범위 | 설명 |
|------|------|--------|------|------|
| maxTokens | int | 2048 | 1~8192 | LLM 최대 생성 토큰 |
| timeoutMs | int | 15000 | 1000~300000 | 전체 분석 타임아웃 (ms) |

---

### 성공 응답

HTTP `200` + `status: "completed"`

```json
{
  "taskId": "scan-001",
  "taskType": "deep-analyze",
  "status": "completed",
  "modelProfile": "agent-loop",
  "promptVersion": "agent-v1",
  "schemaVersion": "agent-v1",
  "validation": {
    "valid": true,
    "errors": []
  },
  "result": {
    "summary": "RE100 gateway-webserver에서 popen shell injection, TOCTOU 경쟁 조건 등 치명적 취약점 발견",
    "claims": [
      {
        "statement": "src/http_client.cpp:62에서 popen 함수 사용으로 CWE-78 명령어 인젝션 취약점 존재",
        "supportingEvidenceRefs": ["eref-file-00", "eref-sast-01"],
        "location": "src/http_client.cpp:62"
      }
    ],
    "caveats": ["정적 분석만으로는 런타임 취약점을 완전히 파악하기 어렵습니다."],
    "usedEvidenceRefs": ["eref-file-00", "eref-sast-01"],
    "suggestedSeverity": "critical",
    "confidence": 0.865,
    "confidenceBreakdown": {
      "grounding": 0.95,
      "deterministicSupport": 1.0,
      "ragCoverage": 0.4,
      "schemaCompliance": 1.0
    },
    "needsHumanReview": true,
    "recommendedNextSteps": ["popen 사용을 execve로 교체"],
    "policyFlags": []
  },
  "audit": {
    "inputHash": "sha256:a1b2c3d4e5f6",
    "latencyMs": 188000,
    "tokenUsage": {"prompt": 3083, "completion": 1411},
    "retryCount": 0,
    "ragHits": 0,
    "createdAt": "2026-03-19T02:20:06Z",
    "agentAudit": {
      "turn_count": 1,
      "tool_call_count": 0,
      "termination_reason": "content_returned",
      "trace": []
    }
  }
}
```

#### AssessmentResult 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| summary | string | O | 분석 요약 (1~3문장) |
| claims | array | O | 증거가 지지하는 취약점 주장 목록 |
| claims[].statement | string | O | 구체적 취약점 주장 |
| claims[].supportingEvidenceRefs | array | O | 주장을 뒷받침하는 evidenceRef refId 목록 |
| claims[].location | string | X | `"파일경로:줄번호"` 또는 `null` |
| caveats | array | O | 분석의 한계, 불확실성 |
| usedEvidenceRefs | array | O | 분석에 사용된 전체 refId 목록 |
| suggestedSeverity | string | X | `"critical"`, `"high"`, `"medium"`, `"low"`, `"info"` 또는 `null` |
| confidence | float | O | S3가 자체 산출한 신뢰도 (0.0~1.0) |
| confidenceBreakdown | object | O | 4항목 가중합 상세 |
| needsHumanReview | bool | O | 사람 검토 필요 여부 |
| recommendedNextSteps | array | X | 후속 조치 제안 |
| policyFlags | array | X | `"ISO21434-noncompliant"`, `"MISRA-violation"` 등 |

#### confidenceBreakdown

```
confidence = 0.45×grounding + 0.30×deterministicSupport + 0.15×ragCoverage + 0.10×schemaCompliance
```

| 항목 | 가중치 | 산출 방식 |
|------|--------|-----------|
| grounding | 0.45 | usedEvidenceRefs 유효 비율 + claims 증거 연결 비율 |
| deterministicSupport | 0.30 | SAST/SCA 결과 존재 여부 + claims/caveats 수 |
| ragCoverage | 0.15 | `0.4 + 0.6 × min(rag_hits / top_k, 1.0)` |
| schemaCompliance | 0.10 | validation.valid이면 1.0 |

#### AuditInfo 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| inputHash | string | 요청 해시 (`sha256:` 접두어 + 16자 hex) |
| latencyMs | int | 전체 처리 시간 (ms) |
| tokenUsage | object | `{prompt, completion}` — LLM 토큰 사용량 |
| retryCount | int | LLM 출력 품질 재시도 횟수 (0이면 첫 시도 성공) |
| ragHits | int | 위협 지식 DB 검색 히트 수 |
| createdAt | string | ISO 8601 UTC |
| agentAudit | object | 에이전트 루프 상세 (`turn_count`, `tool_call_count`, `termination_reason`, `trace`) |

#### agentAudit.trace[]

에이전트가 호출한 도구 실행 기록:

```json
{
  "step_id": 1,
  "tool": "knowledge.search",
  "cost_tier": "cheap",
  "duration_ms": 234,
  "success": true,
  "new_evidence_refs": ["eref-kb-001"]
}
```

---

### 실패 응답

HTTP `200` + `status: "{failure_status}"`

```json
{
  "taskId": "scan-001",
  "taskType": "deep-analyze",
  "status": "timeout",
  "failureCode": "TIMEOUT",
  "failureDetail": "LLM 응답 타임아웃 (120초 초과)",
  "retryable": true,
  "audit": { ... }
}
```

#### FailureCode × status 매핑

| failureCode | status | retryable | 설명 |
|-------------|--------|-----------|------|
| `INVALID_SCHEMA` | `validation_failed` | `false` | LLM 출력 JSON 구조 불량 |
| `INVALID_GROUNDING` | `validation_failed` | `false` | LLM이 없는 refId를 발명 |
| `EMPTY_RESPONSE` | `empty_result` | `false` | LLM 빈 응답 |
| `TIMEOUT` | `timeout` | `true` | LLM 또는 전체 타임아웃 |
| `MODEL_UNAVAILABLE` | `model_error` | `true` | S7 Gateway 또는 LLM Engine 연결 불가 |
| `LLM_OVERLOADED` | `model_error` | `true` | LLM Engine 429/503 과부하 |
| `INPUT_TOO_LARGE` | `budget_exceeded` | `false` | 프롬프트 문자 수 초과 |
| `TOKEN_BUDGET_EXCEEDED` | `budget_exceeded` | `false` | 에이전트 토큰/스텝 예산 소진 |
| `UNKNOWN_TASK_TYPE` | `validation_failed` | `false` | `deep-analyze` 외 taskType |
| `UNSAFE_CONTENT` | `unsafe_output` | `false` | (미사용, 예약) |

#### retryable 필드

`true`이면 S2가 재시도를 판단할 수 있다. S3 내부에서 LLM 출력 품질 문제(INVALID_SCHEMA, INVALID_GROUNDING, EMPTY_RESPONSE)는 자동 재시도한다 (최대 3회). 외부로 노출되는 실패는 내부 재시도 소진 후.

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
| taskType이 allowlist 외 | 422 |
| maxTokens 범위 초과 (>8192) | 422 |
| 빈 body 또는 invalid JSON | 422 |

---

## GET /v1/health

```json
{
  "service": "aegis-analysis-agent",
  "status": "ok",
  "version": "0.1.0",
  "llmMode": "real",
  "llmBackend": {
    "status": "ok",
    "gateway": "http://localhost:8000",
    "gatewayLlmBackend": {"status": "ok", "endpoint": "http://10.126.37.19:8000"}
  },
  "llmConcurrency": 4,
  "modelProfiles": ["Qwen/Qwen3.5-35B-A3B-FP8-default"],
  "activePromptVersions": {"deep-analyze": "agent-v1"},
  "agentConfig": {
    "maxSteps": 6,
    "maxCompletionTokens": 2000,
    "toolBudget": {"cheap": 3, "medium": 2, "expensive": 1}
  },
  "rag": {
    "enabled": false,
    "kbEndpoint": "http://localhost:8002",
    "status": "disabled"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| llmMode | string | `"mock"` 또는 `"real"` |
| llmBackend | object | S7 Gateway 연결 상태 (real 모드에서만) |
| agentConfig | object | 에이전트 루프 예산 설정 |
| rag | object | S5 KB 연동 상태 |

- Agent health 자체는 S7/S5 장애와 무관하게 `"ok"`를 반환한다.
