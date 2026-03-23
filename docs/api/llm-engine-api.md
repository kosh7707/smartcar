# S7. LLM Engine API 명세

> S7(LLM Gateway)이 LLM Engine을 호출할 때 참조하는 API 계약서.
> LLM Engine은 vLLM 기반 OpenAI-compatible API(`/v1/chat/completions`)를 제공한다.

---

## Base URL

```
http://10.126.37.19:8000
```

S7 환경변수 `AEGIS_LLM_ENDPOINT`로 변경 가능.

**주의**: S7 Gateway(WSL2)와 LLM Engine(DGX Spark)는 서로 다른 머신이므로 `localhost`가 아닌 DGX Spark IP를 사용한다.

---

## POST /v1/chat/completions

LLM 추론 요청. OpenAI-compatible 형식.

### 요청

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "messages": [
    {
      "role": "system",
      "content": "당신은 사이버보안 전문가입니다. ..."
    },
    {
      "role": "user",
      "content": "[Finding 정보]\n{...}\n\n[사용 가능한 Evidence Refs]\n- eref-001: ...\n\nBEGIN_UNTRUSTED_EVIDENCE\n...\nEND_UNTRUSTED_EVIDENCE\n\n[출력 형식]\n..."
    }
  ],
  "max_tokens": 4096,
  "temperature": 0.3,
  "chat_template_kwargs": {
    "enable_thinking": false
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| model | string | O | 모델 식별자 (`Qwen/Qwen3.5-122B-A10B-GPTQ-Int4`) |
| messages | Message[] | O | 대화 메시지 리스트 |
| max_tokens | number | X | 최대 생성 토큰 수 (S7 기본: `4096`) |
| temperature | number | X | 생성 온도 (S7 기본: `0.3`) |
| top_p | number | X | Top-P 샘플링 (모델 기본: `0.95`) |
| top_k | number | X | Top-K 샘플링 (모델 기본: `20`) |
| stream | boolean | X | 스트리밍 여부. S7은 `false` 사용 (기본: `false`) |
| chat_template_kwargs | object | X | 템플릿 파라미터. thinking 제어에 사용 |

#### 컨텍스트 한도

| 항목 | 값 | 비고 |
|------|-----|------|
| max_model_len | 262,144 토큰 | 모델 컨텍스트 윈도우 |
| 실질 입력 한도 | max_model_len - max_tokens | 요청별 가변. max_tokens=4096이면 입력 최대 258,048 토큰 |
| 초과 시 응답 | HTTP 400 | `VLLMValidationError` 메시지에 실제 토큰 수 포함 |

**주의**: S7은 LLM Engine 호출 전에 프롬프트 크기를 사전 검증하여 400 에러를 방지해야 한다. 대량 소스 코드 입력 시 truncation 또는 chunking 필요.

#### Message 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| role | string | `system`, `user`, `assistant`, `tool` 중 하나 |
| content | string | 메시지 내용 |

### Thinking 모드 제어

vLLM의 `--reasoning-parser qwen3` 옵션으로 OpenAI-compatible API에서 thinking 모드를 제어한다.

| 모드 | `chat_template_kwargs` | 용도 | 비고 |
|------|------------------------|------|------|
| non-thinking | `{"enable_thinking": false}` | 분류, 요약, 일반 분석 | 빠름, 토큰 절약 |
| thinking | `{"enable_thinking": true}` 또는 생략 | 심층 추론, 복합 취약점 분석 | 느리지만 품질 향상 |

**thinking 모드 주의사항**:
- thinking 활성화 시 `reasoning` 필드에 사고 과정이 담긴다
- thinking 토큰도 `max_tokens` 예산에 포함되므로 충분히 크게 설정해야 한다
- S7은 태스크 유형에 따라 `enable_thinking`을 동적으로 전환할 수 있다

### 응답 (성공, non-thinking)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1741830575,
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{ \"summary\": \"...\", \"claims\": [...], ... }",
        "reasoning": null
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 38,
    "total_tokens": 83
  }
}
```

### 응답 (성공, thinking)

```json
{
  "id": "chatcmpl-def456",
  "object": "chat.completion",
  "created": 1741830600,
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "최종 답변 내용",
        "reasoning": "사고 과정 내용 (enable_thinking: true일 때만 존재)"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 39,
    "completion_tokens": 128,
    "total_tokens": 167
  }
}
```

#### 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 고유 응답 ID |
| object | string | 항상 `chat.completion` |
| created | number | Unix timestamp |
| model | string | 사용된 모델명 |
| choices | Choice[] | 응답 리스트 (항상 1개) |
| usage | Usage | 토큰 사용량 |

#### Choice 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| index | number | 항상 `0` |
| message | Message | 생성된 메시지 |
| finish_reason | string | `stop` (정상 종료), `length` (토큰 초과), `tool_calls` (도구 호출) |

#### 응답 Message 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| role | string | 항상 `assistant` |
| content | string \| null | 생성된 응답 내용 (tool_calls 시 `null`) |
| reasoning | string \| null | 사고 과정 (`enable_thinking: true`일 때만 존재) |
| tool_calls | ToolCall[] \| null | 도구 호출 요청 (tool calling 시에만 존재) |

#### Usage 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| prompt_tokens | number | 입력 토큰 수 |
| completion_tokens | number | 생성 토큰 수 |
| total_tokens | number | 총 토큰 수 |

### S7의 응답 처리

S7은 `choices[0].message.content`를 추출하여:

1. JSON 파싱 시도 (코드블록 감싸기 대응 포함)
2. Assessment 스키마 검증
3. Evidence ref hallucination 검사
4. Confidence 산출

파싱 실패 또는 검증 실패 시 S7이 자체적으로 실패 응답을 생성한다 (LLM Engine에 재요청하지 않음).

#### 토큰 사용량 매핑

S7이 audit에 기록할 때:

| S7 필드 | vLLM 필드 | 설명 |
|---------|-----------|------|
| prompt_tokens | `usage.prompt_tokens` | 입력 토큰 수 |
| completion_tokens | `usage.completion_tokens` | 생성 토큰 수 |
| total_tokens | `usage.total_tokens` | 총 토큰 수 |

**참고**: ollama에서 제공하던 `total_duration`, `eval_duration` 등의 시간 메트릭은 vLLM에 없다. 응답 시간 측정이 필요하면 S7이 자체적으로 `time.perf_counter()` 등으로 측정한다.

---

## POST /v1/chat/completions (Tool Calling)

Agentic SAST를 위한 tool calling. vLLM에 `--enable-auto-tool-choice --tool-call-parser qwen3_coder`가 설정되어 있어 즉시 사용 가능하다.

### 요청 (tool calling)

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
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
  "temperature": 0.3,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

### 응답 (tool_call)

```json
{
  "id": "chatcmpl-ghi789",
  "object": "chat.completion",
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "choices": [
    {
      "index": 0,
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
  ],
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 45,
    "total_tokens": 165
  }
}
```

**주의**: `function.arguments`는 **JSON string**이다 (object가 아님). S7(또는 호출자)에서 `json.loads(arguments)`로 파싱 필요.

### Tool Result 전달

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "source.get_span",
            "arguments": "{\"snapshotId\": \"vs_123\", \"fileRef\": \"file_77\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"lines\": [\"#include <stdio.h>\", \"int main() {\", ...]}"
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.3,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

**주의**: tool result 메시지에 `tool_call_id`를 포함해야 한다 (ollama에서는 불필요했음).

**중요**: Tool 실행은 호출자(S3 Agent 등) 또는 외부 MCP Server가 수행한다. LLM Engine은 tool_call을 생성할 뿐, 직접 실행하지 않는다.

---

## Structured Output

`response_format` 파라미터로 JSON 출력을 강제할 수 있다. 즉시 사용 가능.

```json
{
  "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
  "messages": [...],
  "response_format": { "type": "json_object" },
  "max_tokens": 4096,
  "temperature": 0.3,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

---

## GET /v1/models

사용 가능한 모델 목록 조회. OpenAI 호환 엔드포인트.

### 응답

```json
{
  "object": "list",
  "data": [
    {
      "id": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
      "object": "model",
      "created": 1741776000,
      "owned_by": "vllm"
    }
  ]
}
```

S7은 이 응답으로 모델 가용성을 확인하고, model profile에 등록된 모델명과 매칭한다.

---

## GET /health (헬스체크)

vLLM 서비스 상태 확인.

### 응답

HTTP 200이면 정상. S7은 이 엔드포인트 또는 `/v1/models`로 LLM Engine 연결 상태를 확인한다.

---

## 에러 처리

### HTTP 상태 코드

| HTTP | 상황 | S7 처리 |
|------|------|--------|
| 200 | 정상 | 응답 파싱 진행 |
| 400 | 잘못된 요청 (모델명 오류, 파라미터 이상 등) | `LlmHttpError(400)` → S7 502 |
| 404 | 엔드포인트 없음 | `LlmHttpError(404)` → S7 502 |
| 500 | vLLM 내부 오류 | `LlmHttpError(500)` → S7 502 |

### S7 예외 매핑

| LLM Engine 상황 | S7 예외 | S7 HTTP | S7 코드 |
|---------|---------|---------|---------|
| 연결 거부 (서버 미기동) | `LlmUnavailableError` | 502 | `LLM_UNAVAILABLE` |
| read timeout 초과 | `LlmTimeoutError` | 504 | `LLM_TIMEOUT` |
| HTTP 4xx/5xx | `LlmHttpError` | 502 | `LLM_HTTP_ERROR` |
| 응답 JSON 구조 이상 | `LlmHttpError(502)` | 502 | `LLM_HTTP_ERROR` |

**타임아웃 구조**: Gateway는 connect timeout 10초(장애 빠른 감지) + read timeout은 호출자가 `X-Timeout-Seconds` 헤더로 전달(기본 1800초, 상한 1800초). `/v1/tasks`는 Gateway 내부 설정(`AEGIS_LLM_READ_TIMEOUT`, 기본 600초)을 사용.

---

## 연동 테스트

### 1. LLM Engine 단독 테스트

```bash
# WSL2에서 DGX Spark의 vLLM 테스트

# 모델 목록 확인
curl http://10.126.37.19:8000/v1/models

# 헬스체크
curl http://10.126.37.19:8000/health

# 추론 테스트 (non-thinking)
curl -X POST http://10.126.37.19:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
    "messages": [
      {"role": "system", "content": "당신은 보안 전문가입니다."},
      {"role": "user", "content": "gets() 함수의 위험성을 설명하세요."}
    ],
    "max_tokens": 256,
    "temperature": 0.3,
    "chat_template_kwargs": {"enable_thinking": false}
  }'

# 추론 테스트 (thinking)
curl -X POST http://10.126.37.19:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.5-122B-A10B-GPTQ-Int4",
    "messages": [
      {"role": "system", "content": "당신은 보안 전문가입니다."},
      {"role": "user", "content": "gets() 함수의 위험성을 설명하세요."}
    ],
    "max_tokens": 512,
    "temperature": 0.3,
    "chat_template_kwargs": {"enable_thinking": true}
  }'
```

### 2. S7 Gateway↔LLM Engine 연동 테스트

```bash
# S7 환경변수 설정
export AEGIS_LLM_MODE=real
export AEGIS_LLM_ENDPOINT=http://10.126.37.19:8000
export AEGIS_LLM_MODEL=Qwen/Qwen3.5-122B-A10B-GPTQ-Int4

# S7 Gateway 기동 후 v1 Task 테스트
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

- [S7 LLM Engine 기능 명세](../specs/llm-engine.md)
- [S7 인수인계서](../s7-handoff/README.md)
- [S7 LLM Gateway API 명세](llm-gateway-api.md) (S7이 LLM Engine 응답을 어떻게 가공하는지)
