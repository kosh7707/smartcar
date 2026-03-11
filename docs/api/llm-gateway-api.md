# S3. LLM Gateway API 명세

> S2(Core Service)가 S3를 호출할 때 참조하는 API 계약서.
> S3는 Python(FastAPI)으로 구현하며, 이 문서의 스펙에 맞춰 Pydantic 모델을 정의한다.

---

## Base URL

```
http://localhost:8000
```

---

## v1 API (목표)

### POST /v1/tasks

Task 기반 AI 분석 요청. S2가 task type, context, evidence refs를 전달하면 S3가 구조화된 assessment를 반환한다.

#### Task Type Allowlist

| Task Type | 목적 |
|-----------|------|
| `static-explain` | 정적 분석 finding 심층 설명 |
| `static-cluster` | 유사 finding 그룹핑 제안 |
| `dynamic-annotate` | 동적 분석 이벤트 해석 |
| `test-plan-propose` | 테스트 시나리오 제안 |
| `report-draft` | 보고서 초안 생성 |

allowlist 외 taskType → `400 Bad Request`

---

#### 공통 요청 스키마

```json
{
  "taskType": "static-explain",
  "taskId": "task-001",
  "context": {
    "trusted": {},
    "semiTrusted": {},
    "untrusted": {}
  },
  "evidenceRefs": [],
  "constraints": {
    "maxTokens": 4096,
    "timeoutMs": 15000,
    "outputSchema": "static-explain-v1"
  },
  "metadata": {
    "runId": "run-001",
    "requestedBy": "s2-analysis-service"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| taskType | string | O | V1 allowlist 내 task type |
| taskId | string | O | 요청 고유 ID (S2가 생성) |
| context | object | O | 입력 컨텍스트 (신뢰도 레벨별 분리) |
| context.trusted | object | O | S2가 정규화한 구조화 데이터 |
| context.semiTrusted | object | X | 파싱/정규화된 로그 등 |
| context.untrusted | object | X | raw logs, 사용자 입력 등 |
| evidenceRefs | EvidenceRef[] | O | 입력 evidence 식별자 목록 |
| constraints | object | X | 실행 제약 조건 |
| constraints.maxTokens | number | X | 최대 토큰 수 (기본: 4096) |
| constraints.timeoutMs | number | X | 타임아웃 ms (기본: 15000) |
| constraints.outputSchema | string | X | 출력 스키마 ID |
| metadata | object | X | 추적용 메타데이터 |
| metadata.runId | string | X | 분석 실행 ID |
| metadata.requestedBy | string | X | 요청 주체 |

---

#### EvidenceRef 스키마

S2가 제공하는 안정적 식별자. S3는 이 ref를 인용만 할 수 있고, 새로 발명할 수 없다.

```json
{
  "refId": "eref-001",
  "artifactId": "art-456",
  "artifactType": "raw-source",
  "locatorType": "lineRange",
  "locator": {
    "file": "main.c",
    "fromLine": 1,
    "toLine": 50
  },
  "hash": "sha256:abc123...",
  "label": "main.c full source"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| refId | string | O | evidence 참조 ID |
| artifactId | string | O | 원본 아티팩트 ID |
| artifactType | string | O | `raw-source`, `raw-can-window`, `test-result`, `rule-match`, `parsed-log` 등 |
| locatorType | string | O | `lineRange`, `frameWindow`, `requestResponsePair`, `jsonPointer`, `logSpan`, `snippetRange` |
| locator | object | O | 위치 지정 (locatorType별 상이) |
| hash | string | X | 원본 해시 |
| label | string | X | 사람이 읽을 수 있는 라벨 |

---

#### Task별 context 예시

**static-explain:**

```json
{
  "taskType": "static-explain",
  "taskId": "task-se-001",
  "context": {
    "trusted": {
      "finding": {
        "ruleId": "RULE-001",
        "title": "Dangerous gets() usage",
        "severity": "critical",
        "location": "main.c:4"
      },
      "ruleMetadata": {
        "category": "memory-safety",
        "cweId": "CWE-120"
      }
    },
    "untrusted": {
      "sourceSnippet": "#include <stdio.h>\nint main() {\n    char buf[10];\n    gets(buf);\n    printf(\"%s\", buf);\n    return 0;\n}"
    }
  },
  "evidenceRefs": [
    {
      "refId": "eref-001",
      "artifactId": "art-src-main",
      "artifactType": "raw-source",
      "locatorType": "lineRange",
      "locator": { "file": "main.c", "fromLine": 1, "toLine": 7 },
      "label": "main.c source"
    }
  ]
}
```

**dynamic-annotate:**

```json
{
  "taskType": "dynamic-annotate",
  "taskId": "task-da-001",
  "context": {
    "trusted": {
      "ruleMatches": [
        {
          "ruleId": "DYN-001",
          "title": "High frequency on 0x7DF",
          "severity": "high",
          "location": "CAN ID: 0x7DF"
        }
      ]
    },
    "semiTrusted": {
      "parsedEvents": [
        { "ts": "14:30:01.123", "canId": "0x7DF", "dlc": 8, "data": "02 01 00 00 00 00 00 00" },
        { "ts": "14:30:01.124", "canId": "0x7DF", "dlc": 8, "data": "02 01 00 00 00 00 00 00" }
      ]
    },
    "untrusted": {
      "rawCanLog": "14:30:01.123 0x7DF [8] 02 01 00 00 00 00 00 00\n14:30:01.124 0x7DF [8] 02 01 00 00 00 00 00 00"
    }
  },
  "evidenceRefs": [
    {
      "refId": "eref-can-001",
      "artifactId": "art-can-session-1",
      "artifactType": "raw-can-window",
      "locatorType": "frameWindow",
      "locator": { "channel": "can0", "fromTs": "14:30:01.000", "toTs": "14:30:02.000" },
      "label": "burst window around alert"
    }
  ]
}
```

**test-plan-propose:**

```json
{
  "taskType": "test-plan-propose",
  "taskId": "task-tp-001",
  "context": {
    "trusted": {
      "objective": "SecurityAccess 서비스 lockout behavior 평가",
      "ecuCapability": {
        "supportedServices": ["0x10", "0x27", "0x31"],
        "interface": "CAN",
        "environment": "simulator"
      },
      "policyConstraints": {
        "maxAttempts": 10,
        "rateLimit": "1/sec",
        "simulatorOnly": true
      }
    }
  },
  "evidenceRefs": []
}
```

---

#### 공통 응답 스키마 (성공)

```json
{
  "taskId": "task-001",
  "taskType": "static-explain",
  "status": "completed",
  "modelProfile": "qwen-14b-default",
  "promptVersion": "static-explain-v1",
  "schemaVersion": "static-explain-v1",
  "validation": {
    "valid": true,
    "errors": []
  },
  "result": {
    "summary": "...",
    "claims": [
      {
        "statement": "gets() 함수는 입력 길이를 제한하지 않아 스택 기반 버퍼 오버플로우가 발생한다.",
        "supportingEvidenceRefs": ["eref-001"]
      }
    ],
    "caveats": [
      "시뮬레이터 환경에서의 분석이므로 실 ECU 메모리 레이아웃에 따라 영향이 다를 수 있다."
    ],
    "usedEvidenceRefs": ["eref-001"],
    "suggestedSeverity": "critical",
    "confidence": 0.82,
    "confidenceBreakdown": {
      "grounding": 0.95,
      "deterministicSupport": 0.80,
      "consistency": 0.60,
      "schemaCompliance": 1.0
    },
    "needsHumanReview": false,
    "recommendedNextSteps": [
      "fgets()로 교체 후 regression test 수행"
    ],
    "policyFlags": []
  },
  "audit": {
    "inputHash": "sha256:abc123...",
    "latencyMs": 1200,
    "tokenUsage": { "prompt": 1500, "completion": 800 },
    "retryCount": 0,
    "createdAt": "2026-03-09T10:00:00Z"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| taskId | string | 요청 시 전달한 task ID |
| taskType | string | task type |
| status | string | 처리 상태 (아래 표) |
| modelProfile | string | 사용된 model profile ID |
| promptVersion | string | 사용된 prompt 버전 |
| schemaVersion | string | 출력 스키마 버전 |
| validation | object | 스키마 검증 결과 |
| result | object | assessment 본문 (아래 상세) |
| audit | object | 감사/추적 메타데이터 |

**result 필드 상세:**

| 필드 | 타입 | 설명 |
|------|------|------|
| summary | string | 분석 요약 |
| claims | Claim[] | 증거 기반 주장 |
| caveats | string[] | 한계, 불확실성 |
| usedEvidenceRefs | string[] | 사용된 evidence ref ID (입력의 subset) |
| suggestedSeverity | string? | 제안 심각도 (critical/high/medium/low/info, optional) |
| confidence | number | 0~1 운영용 신뢰 지표 |
| confidenceBreakdown | object | grounding, deterministicSupport, consistency, schemaCompliance |
| needsHumanReview | boolean | 인간 검토 필요 여부 |
| recommendedNextSteps | string[] | 후속 조치 제안 |
| policyFlags | string[] | 정책 관련 플래그 |

**Claim 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| statement | string | 주장 문장 |
| supportingEvidenceRefs | string[] | 이 주장을 지지하는 evidence ref ID |

---

#### 응답 스키마 (실패)

```json
{
  "taskId": "task-001",
  "taskType": "static-explain",
  "status": "validation_failed",
  "failureCode": "INVALID_GROUNDING",
  "failureDetail": "응답에 입력에 없는 evidenceRef 'eref-999'가 포함됨",
  "audit": {
    "inputHash": "sha256:abc123...",
    "latencyMs": 800,
    "retryCount": 1,
    "createdAt": "2026-03-09T10:00:00Z"
  }
}
```

**status 값:**

| status | 의미 |
|--------|------|
| `completed` | 정상 완료 |
| `validation_failed` | 출력 스키마/시맨틱 검증 실패 |
| `timeout` | 시간 초과 |
| `model_error` | LLM 호출 실패 |
| `budget_exceeded` | 토큰 예산 초과 |
| `unsafe_output` | 안전하지 않은 출력 감지 |
| `empty_result` | 빈 결과 |

**failureCode 예시:**

| failureCode | 설명 |
|-------------|------|
| `INVALID_SCHEMA` | JSON 파싱 실패 또는 필수 필드 누락 |
| `INVALID_GROUNDING` | 존재하지 않는 evidenceRef 참조 |
| `TIMEOUT` | 지정 시간 내 응답 미수신 |
| `MODEL_UNAVAILABLE` | LLM 서버 연결 불가 |
| `TOKEN_BUDGET_EXCEEDED` | 토큰 한도 초과 |
| `UNSAFE_CONTENT` | 금지된 출력 (실행 가능 코드 등) 감지 |
| `EMPTY_RESPONSE` | 모델이 빈 응답 반환 |
| `UNKNOWN_TASK_TYPE` | 허용되지 않는 task type |

---

#### test-plan-propose 전용 result 필드

test-plan-propose의 result는 공통 assessment 필드에 더해 plan 필드를 포함한다:

```json
{
  "result": {
    "summary": "...",
    "claims": [],
    "caveats": [],
    "usedEvidenceRefs": [],
    "confidence": 0.45,
    "confidenceBreakdown": {},
    "needsHumanReview": true,
    "recommendedNextSteps": [],
    "policyFlags": [],
    "plan": {
      "objective": "SecurityAccess lockout behavior 평가",
      "hypotheses": [
        "연속 실패 시 ECU가 정상적으로 lockout 상태로 전이하는가"
      ],
      "targetProtocol": "UDS",
      "targetServiceClass": "SecurityAccess (0x27)",
      "preconditions": [
        "DiagnosticSession Extended (0x10 0x03) 활성"
      ],
      "dataToCollect": [
        "NRC 코드 시퀀스",
        "응답 latency 변화",
        "lockout 해제까지 소요 시간"
      ],
      "stopConditions": [
        "ECU 비응답 발생",
        "maxAttempts 도달"
      ],
      "safetyConstraints": [
        "simulator-only",
        "rateLimit: 1/sec"
      ],
      "suggestedExecutorTemplateIds": [
        "uds-security-access-probe"
      ],
      "suggestedRiskLevel": "medium"
    }
  }
}
```

**금지**: plan에 실제 CAN frame 바이트열, shell command, ECU write payload, seed/key 계산 결과를 포함하면 안 된다.

---

### GET /v1/health

서비스 상태 확인.

```json
{
  "service": "smartcar-llm-gateway",
  "status": "ok",
  "version": "1.0.0",
  "modelProfiles": ["qwen-14b-default"],
  "activePromptVersions": {
    "static-explain": "v1",
    "dynamic-annotate": "v1"
  }
}
```

### GET /v1/models

등록된 model profile 목록 조회.

```json
{
  "profiles": [
    {
      "profileId": "qwen-14b-default",
      "modelName": "qwen-14b",
      "contextLimit": 8192,
      "allowedTaskTypes": ["static-explain", "dynamic-annotate", "report-draft"],
      "status": "available"
    }
  ]
}
```

### GET /v1/prompts

등록된 prompt template 목록 조회.

```json
{
  "prompts": [
    {
      "promptId": "static-explain",
      "version": "v1",
      "taskType": "static-explain",
      "description": "정적 분석 finding 심층 설명"
    }
  ]
}
```

---

## 에러 처리

| HTTP Status | 상황 |
|------------|------|
| 200 | 정상 (status 필드로 성공/실패 구분) |
| 400 | 잘못된 요청 (unknown taskType, 필수 필드 누락 등) |
| 422 | 요청 본문 검증 실패 (타입 불일치) |
| 429 | Rate limit 초과 |
| 500 | 서버 내부 오류 |
| 503 | LLM 서버 연결 불가 |

---

## v0 API (현행 호환)

> v0는 현재 S2와 연동 중인 레거시 API다. v1 마이그레이션 완료 시까지 유지한다.

### POST /api/llm/analyze

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| module | `"static_analysis" \| "dynamic_analysis" \| "dynamic_testing"` | O | 분석 모듈 |
| sourceCode | string | △ | 소스코드 원문 (정적 분석 시) |
| canLog | string | △ | CAN 로그 데이터 (동적 분석 시) |
| testResults | string | △ | 테스트 결과 데이터 (동적 테스트 시) |
| ruleResults | RuleResult[] | X | 1계층 룰 탐지 결과 (기본: []) |
| maxTokens | number | X | 최대 토큰 수 (기본: 2048) |
| temperature | number | X | 온도 (기본: 0.7) |

**RuleResult:**

| 필드 | 타입 | 설명 |
|------|------|------|
| ruleId | string | 룰 식별자 |
| title | string | 탐지 제목 |
| severity | string | 심각도 (critical/high/medium/low/info) |
| location | string | 발생 위치 |

**응답 (성공):**

```json
{
  "success": true,
  "vulnerabilities": [
    {
      "severity": "critical",
      "title": "Buffer Overflow via gets()",
      "description": "...",
      "location": "line:4",
      "suggestion": "...",
      "fixCode": "fgets(buf, sizeof(buf), stdin);"
    }
  ],
  "error": null
}
```

**응답 (실패):**

```json
{
  "success": false,
  "vulnerabilities": [],
  "error": "LLM inference timeout"
}
```

### GET /health

```json
{
  "service": "smartcar-llm-gateway",
  "status": "ok",
  "version": "0.1.0",
  "llmStatus": "mock"
}
```

| llmStatus 값 | 의미 |
|-------------|------|
| `"mock"` | Mock LLM 사용 중 |
| `"connected"` | 실 LLM 연결됨 |
| `"disconnected"` | 실 LLM 연결 실패 |

### v0 → v1 매핑

| v0 module | v1 task type |
|-----------|-------------|
| static_analysis | static-explain (+ static-cluster) |
| dynamic_analysis | dynamic-annotate |
| dynamic_testing | test-plan-propose |
| (없음) | report-draft |

---

## 관련 문서

- [전체 개요](../specs/technical-overview.md)
- [S3. LLM Gateway 기능 명세](../specs/llm-gateway.md)
- [S2. Core Service](../specs/backend.md)
- [Shared 데이터 구조](shared-models.md)
