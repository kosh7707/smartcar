# S4. LLM Engine API 명세

> S3(LLM Gateway)가 S4를 호출할 때 참조하는 API 계약서.
> S4는 vLLM 기반 OpenAI-compatible API를 제공하며, 이 문서는 S3가 기대하는 요청/응답 형식을 정의한다.

---

## Base URL

```
http://localhost:8080
```

환경변수 `SMARTCAR_LLM_ENDPOINT`로 변경 가능.

---

## POST /v1/chat/completions

LLM 추론 요청. S3가 조립한 프롬프트를 전달하고, 모델 응답을 받는다.

### 요청

```json
{
  "model": "Qwen/Qwen2.5-32B-Instruct",
  "messages": [
    {
      "role": "system",
      "content": "당신은 자동차 전장부품 사이버보안 전문가입니다. ..."
    },
    {
      "role": "user",
      "content": "[Finding 정보]\n{...}\n\n[사용 가능한 Evidence Refs]\n- eref-001: ...\n\nBEGIN_UNTRUSTED_EVIDENCE\n...\nEND_UNTRUSTED_EVIDENCE\n\n[출력 형식]\n..."
    }
  ],
  "max_tokens": 4096,
  "temperature": 0.3
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| model | string | O | 모델 식별자 |
| messages | Message[] | O | 대화 메시지 리스트 |
| max_tokens | number | X | 최대 생성 토큰 수 (기본: S3에서 4096 전달) |
| temperature | number | X | 생성 온도 (기본: S3에서 0.3 전달) |

#### Message 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| role | string | `system`, `user`, `assistant`, `tool` 중 하나 |
| content | string | 메시지 내용 |

### 응답 (성공)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1741776000,
  "model": "Qwen/Qwen2.5-32B-Instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{ \"summary\": \"...\", \"claims\": [...], ... }"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1500,
    "completion_tokens": 800,
    "total_tokens": 2300
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 응답 고유 ID |
| choices | Choice[] | 생성 결과 (S3는 `choices[0].message.content`만 사용) |
| usage | Usage | 토큰 사용량 (S3가 audit에 기록) |

#### Choice 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| index | number | 선택지 인덱스 |
| message | Message | 생성된 메시지 |
| finish_reason | string | `stop`, `length`, `tool_calls` 중 하나 |

#### Usage 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| prompt_tokens | number | 입력 토큰 수 |
| completion_tokens | number | 생성 토큰 수 |
| total_tokens | number | 총 토큰 수 |

### S3의 응답 처리

S3는 `choices[0].message.content`를 추출하여:

1. JSON 파싱 시도 (코드블록 감싸기 대응 포함)
2. Assessment 스키마 검증
3. Evidence ref hallucination 검사
4. Confidence 산출

파싱 실패 또는 검증 실패 시 S3가 자체적으로 실패 응답을 생성한다 (S4에 재요청하지 않음).

---

## POST /v1/chat/completions (Tool Calling, 향후)

Agentic SAST를 위한 tool calling 확장. vLLM이 네이티브 지원.

### 요청 (tool calling)

```json
{
  "model": "Qwen/Qwen2.5-32B-Instruct",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "source.get_span",
        "description": "소스 코드 구간 조회",
        "parameters": {
          "type": "object",
          "properties": {
            "snapshotId": { "type": "string" },
            "fileRef": { "type": "string" },
            "fromLine": { "type": "integer" },
            "toLine": { "type": "integer" }
          },
          "required": ["snapshotId", "fileRef"]
        }
      }
    }
  ],
  "tool_choice": "auto",
  "max_tokens": 2048,
  "temperature": 0.3
}
```

### 응답 (tool_call)

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "source.get_span",
              "arguments": "{\"snapshotId\": \"vs_123\", \"fileRef\": \"file_77\", \"fromLine\": 1, \"toLine\": 50}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

### Tool Result 전달

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [{ "id": "call_abc123", "type": "function", "function": { "name": "source.get_span", "arguments": "..." } }]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"lines\": [\"#include <stdio.h>\", \"int main() {\", ...]}"
    }
  ]
}
```

**중요**: Tool 실행은 S3 또는 외부 MCP Server가 수행한다. S4는 tool_call을 생성할 뿐, 직접 실행하지 않는다.

---

## GET /v1/models

사용 가능한 모델 목록 조회.

### 응답

```json
{
  "object": "list",
  "data": [
    {
      "id": "Qwen/Qwen2.5-32B-Instruct",
      "object": "model",
      "created": 1741776000,
      "owned_by": "local"
    }
  ]
}
```

S3는 이 응답으로 모델 가용성을 확인하고, model profile에 등록된 모델명과 매칭한다.

---

## GET /health

서비스 상태 확인. vLLM 기본 제공.

### 응답

```json
{
  "status": "ok"
}
```

HTTP 200이면 정상. S3는 이 엔드포인트로 S4 연결 상태를 확인한다.

---

## 에러 처리

### HTTP 상태 코드

| HTTP | 상황 | S3 처리 |
|------|------|--------|
| 200 | 정상 | 응답 파싱 진행 |
| 400 | 잘못된 요청 (모델명 오류 등) | `LlmHttpError(400)` → S3 502 |
| 422 | 요청 본문 검증 실패 | `LlmHttpError(422)` → S3 502 |
| 429 | Rate limit 초과 | `LlmHttpError(429)` → S3 502 (retryable) |
| 500 | vLLM 내부 오류 | `LlmHttpError(500)` → S3 502 |
| 503 | 모델 로딩 중 | `LlmHttpError(503)` → S3 502 (retryable) |

### S3 예외 매핑

| S4 상황 | S3 예외 | S3 HTTP | S3 코드 |
|---------|---------|---------|---------|
| 연결 거부 | `LlmUnavailableError` | 502 | `LLM_UNAVAILABLE` |
| 60초 초과 | `LlmTimeoutError` | 504 | `LLM_TIMEOUT` |
| HTTP 4xx/5xx | `LlmHttpError` | 502 | `LLM_HTTP_ERROR` |
| 응답 JSON 구조 이상 | `LlmHttpError(502)` | 502 | `LLM_HTTP_ERROR` |

---

## 연동 테스트

### 1. S4 단독 테스트

```bash
# 모델 목록 확인
curl http://localhost:8080/v1/models

# 헬스체크
curl http://localhost:8080/health

# 추론 테스트
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-32B-Instruct",
    "messages": [
      {"role": "system", "content": "당신은 보안 전문가입니다."},
      {"role": "user", "content": "gets() 함수의 위험성을 설명하세요."}
    ],
    "max_tokens": 256,
    "temperature": 0.3
  }'
```

### 2. S3↔S4 연동 테스트

```bash
# S3 환경변수 설정
export SMARTCAR_LLM_MODE=real
export SMARTCAR_LLM_ENDPOINT=http://localhost:8080
export SMARTCAR_LLM_MODEL=Qwen/Qwen2.5-32B-Instruct

# S3 기동 후 v1 Task 테스트
curl -X POST http://localhost:8000/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskType": "static-explain",
    "taskId": "integration-test-001",
    "context": {
      "trusted": {
        "finding": {
          "ruleId": "RULE-001",
          "title": "gets() usage",
          "severity": "critical",
          "location": "main.c:4"
        }
      },
      "untrusted": {
        "sourceSnippet": "#include <stdio.h>\nint main(){char buf[10];gets(buf);}"
      }
    },
    "evidenceRefs": [{
      "refId": "eref-001",
      "artifactId": "art-1",
      "artifactType": "raw-source",
      "locatorType": "lineRange",
      "locator": {"file": "main.c", "fromLine": 1, "toLine": 5}
    }]
  }'
```

---

## 관련 문서

- [S4 기능 명세](../specs/llm-engine.md)
- [S4 인수인계서](../s4-handoff/README.md)
- [S3 API 명세](llm-gateway-api.md) (S3가 S4 응답을 어떻게 가공하는지)
- [외부 피드백: vLLM 권고](../외부피드백/S3_agentic_sast_design_feedback.md)
