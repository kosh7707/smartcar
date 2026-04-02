# Analysis Agent API 명세

> **소유자**: S3 (Analysis Agent)
> **포트**: 8001
> **호출자**: S2 (Backend)
> **최종 업데이트**: 2026-04-02

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
| POST | `/v1/tasks` | `generate-poc` — 특정 클레임에 대한 PoC 코드 생성 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 + S7 Gateway 연결 상태 |

---

## POST /v1/tasks

프로젝트 보안 심층 분석. S2가 프로젝트 경로 또는 소스 파일을 전달하면 S3가 Phase 1(SAST → 코드 그래프 → SCA → CVE 조회 → KB 위협 조회 → 위험 호출자) + Phase 2(LLM 해석)를 자동 실행하여 구조화된 assessment를 반환한다.

### Task Type

| Task Type | 용도 |
|-----------|------|
| `deep-analyze` | 프로젝트 전반 보안 분석 (Phase 1/2 자동 실행) |
| `generate-poc` | 특정 클레임에 대한 PoC 코드 생성 (단일 LLM 호출) |

> 레거시 5개 taskType(`static-explain`, `static-cluster`, `dynamic-annotate`, `test-plan-propose`, `report-draft`)은 S7 LLM Gateway(:8000)가 담당.

### 요청

**projectPath 모드 (권장):**

```json
{
  "taskType": "deep-analyze",
  "taskId": "scan-001",
  "context": {
    "trusted": {
      "objective": "RE100 gateway-webserver 보안 취약점 심층 분석",
      "projectPath": "/home/kosh/AEGIS/uploads/re100-gateway",
      "targetPath": "gateway/",
      "projectId": "re100-gateway",
      "buildProfile": {"sdkId": "ti-am335x"}
    }
  },
  "evidenceRefs": [
    {
      "refId": "eref-project",
      "artifactId": "art-re100",
      "artifactType": "raw-source",
      "locatorType": "lineRange",
      "locator": {"file": "src/http_client.cpp", "fromLine": 1, "toLine": 9999}
    }
  ],
  "constraints": {"maxTokens": 4096, "timeoutMs": 300000}
}
```

**files 모드 (fallback):**

```json
{
  "taskType": "deep-analyze",
  "taskId": "scan-001",
  "context": {
    "trusted": {
      "objective": "보안 취약점 심층 분석",
      "files": [
        {"path": "src/http_client.cpp", "content": "...소스코드..."}
      ],
      "projectId": "re100-gateway",
      "buildProfile": {
        "sdkId": "ti-am335x",
        "compiler": "arm-none-linux-gnueabihf-gcc",
        "targetArch": "arm-cortex-a8",
        "languageStandard": "c++17"
      }
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
  "constraints": {"maxTokens": 4096, "timeoutMs": 300000}
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
| projectPath | string | △ | 프로젝트 절대 경로. 있으면 `build-and-analyze` 한 번에 실행 (SAST+코드그래프+SCA). **`files`와 `projectPath` 중 최소 1개 필수** |
| targetPath | string | X | `projectPath` 기준 상대 경로 (예: `"gateway/"`). 지정 시 `${projectPath}/${targetPath}`를 분석 루트로 사용. 미지정 시 `projectPath` 전체 분석 |
| files | array | △ | `[{path, content}]` — 분석 대상 소스 파일. `projectPath` 없을 때 사용. **`files`와 `projectPath` 중 최소 1개 필수** |
| buildCommand | string | X | 빌드 명령어 (예: `make`, `./scripts/cross_build.sh`). `projectPath`와 함께 사용. 없으면 빌드 없이 SAST 실행 |
| buildProfile | object | X | 빌드 환경. `sdkId`가 있으면 SDK 환경을 자동 설정하여 빌드 정확도 향상. `includePaths`로 공유 라이브러리 경로 지정 가능 |
| projectId | string | X | 프로젝트 식별자 (코드 그래프 적재용) |
| sastFindings | array | X | S2가 사전 수행한 SAST findings. **제공 시 Phase 1 SAST 스캔을 스킵**하고 이 결과를 직접 사용 |
| scaLibraries | array | X | S2가 사전 수행한 SCA 라이브러리 목록. **제공 시 Phase 1 SCA를 스킵**하고 이 결과로 CVE 조회 수행 |
| thirdPartyPaths | string[] | X | 서드파티 디렉토리 경로 목록. S4 SAST에 전달하여 heavy analyzer(gcc-fanalyzer) 제외 대상 지정. 예: `["libraries/civetweb", "third_party/"]` |
| sastTools | string[] \| null | X | S4 v0.6.0 도구 서브셋 선택. 허용 값: `semgrep`, `cppcheck`, `flawfinder`, `clang-tidy`, `scan-build`, `gcc-fanalyzer`. 미지정 시 전체 도구 실행. 예: `["flawfinder", "cppcheck"]` |

**입력 모드:**

| 모드 | 입력 | Phase 1 동작 |
|------|------|-------------|
| **Pre-computed (권장)** | `sastFindings` + `scaLibraries` + `projectId` | SAST/SCA 스킵. CVE 조회 + 위협 지식 + 위험 호출자만 실행. **S2가 Quick 분석 결과를 DB에서 꺼내 전달하는 모드** |
| projectPath 모드 | `projectPath` + (선택) `targetPath` + `buildCommand` 또는 `buildProfile` | S4 `build-and-analyze` 한 방 실행. `targetPath` 지정 시 해당 하위 경로만 분석. `buildCommand`와 `buildProfile` 모두 없으면 개별 도구 fallback |
| files 모드 (fallback) | `files[]` + (선택) `projectPath` | 개별 도구 호출 (scan, functions, libraries) |
| 둘 다 없음 | — | Phase 1 스킵 → 분석 불가 |

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
| maxTokens | int | 2048 | 1~16384 | LLM 최대 생성 토큰 |
| timeoutMs | int | 15000 | 1000~900000 | 전체 분석 타임아웃 (ms) |

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
      "turn_count": 2,
      "tool_call_count": 3,
      "termination_reason": "content_returned",
      "model_name": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
      "prompt_version": "agent-v1",
      "total_prompt_tokens": 15000,
      "total_completion_tokens": 3500,
      "trace": [
        {
          "step_id": 1,
          "tool": "knowledge.search",
          "cost_tier": "cheap",
          "duration_ms": 234,
          "success": true,
          "new_evidence_refs": ["eref-kb-001"]
        }
      ]
    }
  }
}
```

#### AssessmentResult 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| summary | string | O | 분석 요약 (1~3문장) |
| claims | array | O | 증거가 지지하는 취약점 주장 목록 |
| claims[].statement | string | O | 취약점 요약 (1문장) |
| claims[].detail | string | X | 상세 분석 — 공격 경로, 영향 범위, 코드 흐름, 악용 시나리오 |
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
| agentAudit | object | 에이전트 루프 상세 (아래 참조) |

#### agentAudit 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| turn_count | int | 총 LLM 턴 수 |
| tool_call_count | int | 총 도구 호출 수 |
| termination_reason | string | 종료 사유 (`content_returned`, `max_steps`, `budget_exhausted`, `timeout`, `no_evidence`, `all_tiers_exhausted`) |
| model_name | string | LLM 모델 식별자 (예: `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4`) |
| prompt_version | string | 프롬프트 버전 (예: `agent-v1`) |
| total_prompt_tokens | int | 전체 루프에서 소비한 프롬프트 토큰 합계 |
| total_completion_tokens | int | 전체 루프에서 생성한 완성 토큰 합계 |
| trace | array | 도구 실행 기록 (아래 참조) |

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
| `MAX_STEPS_EXCEEDED` | `budget_exceeded` | `false` | 에이전트 스텝/턴 한도 도달 |
| `INSUFFICIENT_EVIDENCE` | `budget_exceeded` | `false` | 연속 무증거 턴 초과 |
| `ALL_TOOLS_EXHAUSTED` | `budget_exceeded` | `false` | 모든 도구 티어 예산 소진 |
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
  "service": "s3-agent",
  "status": "ok",
  "version": "0.1.0",
  "llmMode": "real",
  "llmBackend": {
    "status": "ok",
    "gateway": "http://localhost:8000",
    "gatewayLlmBackend": {"status": "ok", "endpoint": "http://10.126.37.19:8000"}
  },
  "llmConcurrency": 4,
  "modelProfiles": ["Qwen/Qwen3.5-122B-A10B-GPTQ-Int4-default"],
  "activePromptVersions": {"deep-analyze": "agent-v1", "generate-poc": "v1"},
  "agentConfig": {
    "maxSteps": 12,
    "maxCompletionTokens": 20000,
    "toolBudget": {"cheap": 6, "medium": 4, "expensive": 1}
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

---

## generate-poc 사용법

`deep-analyze` 완료 후, 특정 클레임에 대한 PoC 코드를 생성한다.

### 요청

```json
{
  "taskType": "generate-poc",
  "taskId": "poc-001",
  "context": {
    "trusted": {
      "objective": "CWE-78 OS Command Injection PoC 생성",
      "claim": {
        "statement": "popen()에 HTTP 파라미터가 새니타이징 없이 전달됨",
        "detail": "...(deep-analyze 응답의 claim.detail)...",
        "location": "src/net.c:142"
      },
      "files": [
        {"path": "src/net.c", "content": "...해당 파일 소스코드..."}
      ]
    }
  },
  "evidenceRefs": [],
  "constraints": {"maxTokens": 4096, "timeoutMs": 120000}
}
```

#### context.trusted 필드 (generate-poc)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| objective | string | O | PoC 생성 목표 |
| claim | object | O | deep-analyze 응답의 claim 객체 (statement, detail, location) |
| files | array | O | 취약 코드가 포함된 소스 파일 `[{path, content}]` |

### 응답

`AssessmentResult`와 동일한 구조. `claims[0].detail`에 PoC 코드, 실행 방법, 예상 결과가 마크다운으로 포함된다.

| 필드 | 값 | 비고 |
|------|-----|------|
| `modelProfile` | `"poc-v1"` | PoC 전용 프로필 |
| `promptVersion` | `"generate-poc-v1"` | PoC 전용 프롬프트 |
| `schemaVersion` | `"agent-v1"` | deep-analyze와 동일 |

### S2 연동 플로우

```
1. S2 → S3: deep-analyze → 상세 클레임 포함 보고서
2. 사용자: UI에서 특정 클레임의 "PoC 생성" 클릭
3. S2: 해당 claim + 소스 파일을 context.trusted에 포함
4. S2 → S3: generate-poc → PoC 코드 반환
5. S2 → S1: PoC 결과를 UI에 표시
```

> **build-resolve**는 별도 서비스 `services/build-agent/`(:8003)로 분리되었습니다. API 계약서: `docs/api/build-agent-api.md`

