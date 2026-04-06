# S7. LLM Gateway API 명세

> **소유자**: S7 (LLM Gateway + LLM Engine)
> S2(Core), S3(Agent) 등이 S7을 호출할 때 참조하는 API 계약서.
> S7은 Python(FastAPI)으로 구현하며, 이 문서의 스펙에 맞춰 Pydantic 모델을 정의한다.

---

## Base URL

```
http://localhost:8000
```

## 공통 헤더

| 헤더 | 방향 | 설명 |
|------|------|------|
| `X-Request-Id` | 요청/응답 | 분산 추적용 요청 ID. 호출자가 전달하면 S7이 로그에 기록하고 LLM Engine에도 전파. **호출자가 미전달 시 Gateway가 `gw-` 접두사로 자동 생성.** 모든 응답에 포함. |
| `X-Timeout-Seconds` | 요청 | `/v1/chat` 전용. 호출자가 원하는 read timeout (초). Gateway가 LLM Engine 호출 시 이 값을 적용. 미전달 시 기본 1800초. 상한 1800초. |
| `X-Model` | 응답 | `/v1/chat` 전용. Gateway가 실제 사용한 모델명 (오버라이드 후). 호출자가 어떤 모델명을 보냈든 실제 적용된 모델을 확인할 수 있다. |
| `X-Gateway-Latency-Ms` | 응답 | `/v1/chat` 전용. Gateway 측정 지연시간 (밀리초). LLM Engine 호출 + 전후 처리 포함. |

---

## API

### POST /v1/chat

LLM Engine 프록시 — OpenAI-compatible chat completion 요청을 LLM Engine(vLLM)에 전달하고 응답을 그대로 반환한다.

S3 Agent의 멀티턴 에이전트 루프, 또는 향후 다른 서비스의 LLM 호출에 사용. **모든 LLM 호출은 이 엔드포인트를 경유한다.**

#### 요청

OpenAI chat completion 포맷을 그대로 수용한다:

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "max_tokens": 4096,
  "temperature": 0.3,
  "chat_template_kwargs": {"enable_thinking": false},
  "tools": [...],
  "tool_choice": "auto",
  "response_format": {"type": "json_object"}
}
```

**모델 오버라이드**: 요청의 `model` 필드는 Gateway가 실제 운영 모델로 교체한다. 호출자는 어떤 모델명을 보내도 되며, Gateway가 현재 Engine에 배포된 모델로 자동 매핑한다. 그 외 필드는 LLM Engine에 그대로 전달된다.

#### 응답

LLM Engine(vLLM)의 OpenAI-compatible 응답을 그대로 반환:

```json
{
  "choices": [{
    "message": {
      "content": "...",
      "tool_calls": [...]
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 1500,
    "completion_tokens": 500
  }
}
```

#### 에러

| HTTP | 조건 | `retryable` |
|------|------|------------|
| 503 | LLM Engine 연결 실패 | `true` |
| 503 | Circuit Breaker OPEN (연속 장애로 회로 차단) | `true` |
| 504 | LLM Engine 응답 타임아웃 (`X-Timeout-Seconds` 기반, 기본 1800초) | `true` |
| 4xx/5xx | LLM Engine 원본 에러 코드 그대로 전달 | 상황별 |

#### 비고

- Gateway가 동시성 제어(Semaphore)를 적용한다
- 교환 로그(`logs/llm-exchange.jsonl`)에 모든 호출이 기록된다
- Circuit Breaker가 연속 장애를 감지하면 즉시 503을 반환한다 (타임아웃 대기 없이 빠른 실패)
- `X-Request-Id` 헤더를 LLM Engine에 전파한다

---

### POST /v1/tasks

Task 기반 AI 분석 요청. S2가 task type, context, evidence refs를 전달하면 S7이 구조화된 assessment를 반환한다.

#### Task Type Allowlist

| Task Type | 서비스 | 목적 |
|-----------|--------|------|
| `static-explain` | LLM Gateway (:8000) | 정적 분석 finding 심층 설명 |
| `static-cluster` | LLM Gateway (:8000) | 유사 finding 그룹핑 제안 |
| `dynamic-annotate` | LLM Gateway (:8000) | 동적 분석 이벤트 해석 |
| `test-plan-propose` | LLM Gateway (:8000) | 테스트 시나리오 제안 |
| `report-draft` | LLM Gateway (:8000) | 보고서 초안 생성 |
| **`deep-analyze`** | **Analysis Agent (:8001)** | **프로젝트 전반 보안 분석 (Phase 1/2)** |

- LLM Gateway(:8000)의 allowlist 외 taskType → `422 Unprocessable Entity`
- `deep-analyze`는 **Analysis Agent(:8001)**로 직접 요청 (S2 → :8001)
- 요청/응답 형식은 동일 (`TaskRequest` → `TaskSuccessResponse | TaskFailureResponse`)

#### deep-analyze 추가 context 필드

`deep-analyze` 요청 시 `context.trusted`에 포함 가능한 추가 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `objective` | string | 분석 목표 (자연어) |
| `projectId` | string | 프로젝트 식별자 |
| `projectPath` | string? | 파일시스템 프로젝트 경로 (있으면 SCA + projectPath 코드 그래프 활성화) |
| `buildProfile` | object? | 빌드 환경 (sdkId, compiler, targetArch, languageStandard, includePaths 등) |
| `files` | FileEntry[]? | 소스 파일 목록 [{path, content}]. projectPath 없을 때 사용 |

Phase 1이 자동으로 SAST + 코드 그래프 + SCA를 실행하므로, S2는 파일/프로젝트 정보만 전달하면 됩니다.

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
    "maxTokens": 2048,
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
| context.trusted.buildProfile | object | X | 빌드 환경 정보 (static-explain). `languageStandard`, `targetArch`, `compiler` 포함. 프로젝트에 설정된 경우에만 전달 |
| context.semiTrusted | object | X | 파싱/정규화된 로그 등 |
| context.untrusted | object | X | raw logs, 사용자 입력 등 |
| evidenceRefs | EvidenceRef[] | O | 입력 evidence 식별자 목록 |
| constraints | object | X | 실행 제약 조건 |
| constraints.maxTokens | number | X | 최대 토큰 수 (기본: 2048, 범위: 1~8192) |
| constraints.timeoutMs | number | X | 타임아웃 ms (기본: 15000) |
| constraints.outputSchema | string | X | 출력 스키마 ID |
| metadata | object | X | 추적용 메타데이터 |
| metadata.runId | string | X | 분석 실행 ID |
| metadata.requestedBy | string | X | 요청 주체 |

---

#### EvidenceRef 스키마

S2가 제공하는 안정적 식별자. S7은 이 ref를 인용만 할 수 있고, 새로 발명할 수 없다.

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
      },
      "buildProfile": {
        "languageStandard": "c99",
        "targetArch": "arm-cortex-m7",
        "compiler": "arm-none-eabi-gcc"
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
  "modelProfile": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4-default",
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
        "supportingEvidenceRefs": ["eref-001"],
        "location": "src/main.c:42"
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
      "ragCoverage": 0.76,
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
    "ragHits": 5,
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

**audit 필드 상세:**

| 필드 | 타입 | 설명 |
|------|------|------|
| inputHash | string | 입력 해시 (sha256 앞 16자리) |
| latencyMs | int | 처리 소요 시간 (ms) |
| tokenUsage | object | `{prompt, completion}` 토큰 사용량 |
| retryCount | int | LLM 출력 품질 재시도 횟수 (0이면 첫 시도 성공). 재시도 대상: INVALID_SCHEMA, INVALID_GROUNDING, EMPTY_RESPONSE |
| ragHits | int | RAG 위협 지식 DB 관련성 있는 검색 결과 수 (0이면 RAG 미사용 또는 관련 결과 없음). min_score 미만 결과는 제외되므로 0~top_k 범위의 가변값 |
| createdAt | string | 생성 시각 (ISO 8601) |

**result 필드 상세:**

| 필드 | 타입 | 설명 |
|------|------|------|
| summary | string | 분석 요약 |
| claims | Claim[] | 증거 기반 주장 |
| caveats | string[] | 한계, 불확실성 |
| usedEvidenceRefs | string[] | 사용된 evidence ref ID (입력의 subset) |
| suggestedSeverity | string? | 제안 심각도 (critical/high/medium/low/info, optional) |
| confidence | number | 0~1 운영용 신뢰 지표 |
| confidenceBreakdown | object | grounding, deterministicSupport, ragCoverage, schemaCompliance |
| needsHumanReview | boolean | 인간 검토 필요 여부 |
| recommendedNextSteps | string[] | 후속 조치 제안 |
| policyFlags | string[] | 정책 관련 플래그 |

**Claim 스키마:**

| 필드 | 타입 | 설명 |
|------|------|------|
| statement | string | 주장 문장 |
| supportingEvidenceRefs | string[] | 이 주장을 지지하는 evidence ref ID |
| location | string? | 코드 위치 (`"파일경로:라인번호"`, 예: `"src/main.c:42"`). 특정 불가 시 `null` |

---

#### 응답 스키마 (실패)

```json
{
  "taskId": "task-001",
  "taskType": "static-explain",
  "status": "validation_failed",
  "failureCode": "INVALID_GROUNDING",
  "failureDetail": "응답에 입력에 없는 evidenceRef 'eref-999'가 포함됨",
  "retryable": false,
  "audit": {
    "inputHash": "sha256:abc123...",
    "latencyMs": 800,
    "retryCount": 1,
    "ragHits": 0,
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
| `INVALID_SCHEMA` | JSON 파싱 실패, top-level JSON object 복구 실패, 또는 필수 필드/스키마 검증 실패 |
| `INVALID_GROUNDING` | 존재하지 않는 evidenceRef 참조 |
| `TIMEOUT` | 지정 시간 내 응답 미수신 |
| `MODEL_UNAVAILABLE` | LLM 서버 연결 불가 |
| `TOKEN_BUDGET_EXCEEDED` | 토큰 한도 초과 |
| `UNSAFE_CONTENT` | 금지된 출력 (실행 가능 코드 등) 감지 |
| `EMPTY_RESPONSE` | 모델이 빈 응답 반환 |
| `LLM_OVERLOADED` | LLM 백엔드 과부하 (429/503). `retryable: true` |
| `LLM_CIRCUIT_OPEN` | Circuit Breaker OPEN (연속 장애로 회로 차단). `retryable: true`. 일정 시간 후 자동 복구 시도 |
| `INPUT_TOO_LARGE` | 프롬프트가 입력 한도 초과 (status: `budget_exceeded`). 입력 크기를 줄여 재시도 필요. `retryable: false` |
| `UNKNOWN_TASK_TYPE` | 허용되지 않는 task type |

**retryable 필드:**

실패 응답에 `retryable: bool` 필드가 포함된다 (기본 `false`). `true`이면 S2가 재시도를 판단할 수 있다.
- `LLM_OVERLOADED` → `retryable: true`
- `LLM_CIRCUIT_OPEN` → `retryable: true`
- `TIMEOUT` → `retryable: true`
- `MODEL_UNAVAILABLE` → `retryable: true`
- 그 외 → `retryable: false`

**S7 내부 재시도 정책:**

S7은 LLM 출력 품질 문제(INVALID_SCHEMA, INVALID_GROUNDING, EMPTY_RESPONSE)에 대해 자동 재시도한다:
- 최대 시도 횟수: `1 + AEGIS_LLM_MAX_RETRIES` (기본 3회)
- 같은 프롬프트를 재사용 (temperature=0.3이므로 비결정적 출력 기대)
- 인프라 에러(TIMEOUT, MODEL_UNAVAILABLE, LLM_OVERLOADED, LLM_CIRCUIT_OPEN, INPUT_TOO_LARGE)는 재시도하지 않고 즉시 실패
- 재시도 간 딜레이 없음 (rate limit이 아닌 출력 품질 문제이므로)
- `audit.retryCount`: 실제 재시도 횟수 (0이면 첫 시도 성공)
- `audit.tokenUsage`: 모든 시도의 토큰 사용량 누적

**confidenceBreakdown.ragCoverage:**

RAG 위협 지식 DB 검색 결과에 따른 분석 배경 충실도:
- `ragCoverage = 0.4 + 0.6 × min(rag_hits / top_k, 1.0)`
- 0 hits → 0.40 (LLM 사전학습 지식만으로 분석)
- 5 hits → 1.00 (위협 DB 근거 완비)
- 이전 `consistency` 필드를 대체 (기존에는 1.0 고정이었으므로 분별력 없었음)

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
  "service": "s7-gateway",
  "status": "ok",
  "version": "1.0.0",
  "llmMode": "real",
  "modelProfiles": ["Qwen/Qwen3.5-122B-A10B-GPTQ-Int4-default"],
  "activePromptVersions": {
    "static-explain": "v1",
    "dynamic-annotate": "v1",
    "test-plan-propose": "v1",
    "static-cluster": "v1",
    "report-draft": "v1"
  },
  "circuitBreaker": {
    "state": "closed",
    "consecutiveFailures": 0,
    "threshold": 3,
    "recoverySeconds": 30.0
  },
  "llmBackend": {
    "status": "ok",
    "endpoint": "http://10.126.37.19:8000"
  },
  "llmConcurrency": 4,
  "rag": {
    "enabled": true,
    "kbEndpoint": "http://localhost:8002",
    "status": "ok"
  }
}
```

- `circuitBreaker` 필드는 항상 포함. `state`는 `"closed"` (정상), `"open"` (장애 차단), `"half_open"` (복구 탐침 중).
- `real` 모드일 때 `llmBackend`, `llmConcurrency` 필드가 포함되며, vLLM 백엔드 연결 상태와 동시 처리 가능 수를 보고한다.
- `rag` 필드는 항상 포함. `status`가 `"ok"`이면 RAG 활성 상태(S5 KB 연결 확인), `"disabled"`이면 비활성 (설정 off 또는 S5 미연결).
- S7 Gateway health 자체는 백엔드/RAG 장애와 무관하게 `"ok"`를 반환한다.

### GET /v1/usage

누적 토큰/요청 사용량 통계 조회. Gateway 프로세스 기동 이후 누적.

```json
{
  "startedAt": "2026-03-20T10:00:00+00:00",
  "totalRequests": 42,
  "totalErrors": 2,
  "tokens": {
    "prompt": 63000,
    "completion": 21000,
    "total": 84000
  },
  "byEndpoint": {
    "tasks": { "prompt": 45000, "completion": 15000, "count": 30, "errors": 1 },
    "chat": { "prompt": 18000, "completion": 6000, "count": 12, "errors": 1 }
  },
  "byTaskType": {
    "static-explain": { "prompt": 30000, "completion": 10000, "count": 20 },
    "static-cluster": { "prompt": 15000, "completion": 5000, "count": 10 }
  }
}
```

### GET /metrics

Prometheus 형식 메트릭. Prometheus scraper가 이 엔드포인트를 poll한다.

| 메트릭 | 타입 | 라벨 |
|--------|------|------|
| `aegis_llm_requests_total` | Counter | endpoint, status |
| `aegis_llm_request_duration_seconds` | Histogram | endpoint |
| `aegis_llm_tokens_total` | Counter | type (prompt/completion) |
| `aegis_llm_errors_total` | Counter | endpoint, error_type |
| `aegis_llm_circuit_breaker_state` | Gauge | — |
| `aegis_llm_concurrent_requests` | Gauge | — |

응답 Content-Type: `text/plain; version=0.0.4; charset=utf-8`

### GET /v1/models

등록된 model profile 목록 조회.

```json
{
  "profiles": [
    {
      "profileId": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4-default",
      "modelName": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
      "contextLimit": 8192,
      "allowedTaskTypes": ["static-explain", "static-cluster", "dynamic-annotate", "test-plan-propose", "report-draft"],
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

| HTTP Status | 상황 | 비고 |
|------------|------|------|
| 200 | 정상 (status 필드로 성공/실패 구분) | Task 레벨 실패도 HTTP 200 |
| 422 | 요청 본문 검증 실패 (unknown taskType, 필수 필드 누락, 타입 불일치, maxTokens 범위 초과 등) | Pydantic 검증 |
| 500 | 서버 내부 오류 | Observability 규약 형식 |
| 503 | `/v1/chat` 전용: LLM Engine 연결 불가 또는 Circuit Breaker OPEN | `/v1/tasks`는 200 + failureCode로 반환 |

### 에러 응답 형식 (Observability 규약 준수)

HTTP 500 에러 시 아래 형식으로 응답한다 (`docs/specs/observability.md` 준수):

```json
{
  "success": false,
  "error": "Internal server error",
  "errorDetail": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "requestId": "req-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "retryable": false
  }
}
```

**참고**: Task 레벨 실패 (LLM 파싱 오류, hallucination 등)는 HTTP 200 + `TaskFailureResponse`로 반환된다. HTTP 에러는 S7 내부 예외 상황에만 사용된다.

---

---

## 관련 문서

- [전체 개요](../specs/technical-overview.md)
- [S7. LLM Gateway 기능 명세](../specs/llm-gateway.md)
- [S2. Core Service](../specs/backend.md)
- [Shared 데이터 구조](shared-models.md)
