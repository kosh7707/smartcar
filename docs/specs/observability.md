# MSA Observability 규약

> S2 주도로 확정. S1/S3는 이 문서를 참조하여 자체 구현.
> 최초 작성: 2026-03-12

---

## 1. 에러 응답 형식

모든 서비스의 에러 응답은 아래 형식을 따른다.

```json
{
  "success": false,
  "error": "메시지 string (하위호환)",
  "errorDetail": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "requestId": "req-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "retryable": false
  }
}
```

- `error`: 기존 string 메시지 유지 (S1 마이그레이션 전까지 하위호환)
- `errorDetail`: 구조화된 에러 정보. S1이 마이그레이션 완료 후 `error`를 대체

---

## 2. 에러 코드 체계 (v0, flat)

| 코드 | HTTP | retryable | 용도 |
|------|------|-----------|------|
| `INVALID_INPUT` | 400 | N | 필수 필드 누락, 잘못된 형식 |
| `NOT_FOUND` | 404 | N | 리소스 없음 |
| `CONFLICT` | 409 | N | 동시 실행 등 |
| `ADAPTER_UNAVAILABLE` | 502 | Y | 어댑터 미연결 |
| `LLM_UNAVAILABLE` | 502 | Y | S3 네트워크 불가 |
| `LLM_HTTP_ERROR` | 502 | N | S3가 4xx/5xx 반환 |
| `LLM_PARSE_ERROR` | 502 | Y | S3 응답 JSON 파싱 실패 |
| `LLM_TIMEOUT` | 504 | Y | S3 응답 시간 초과 |
| `DB_ERROR` | 500 | N | SQLite 오류 |
| `INTERNAL_ERROR` | 500 | N | catch-all |

---

## 3. 로그 포맷

JSON structured logging (stdout). 모든 서비스 공통.

```json
{
  "level": "info",
  "time": 1741776000000,
  "service": "s2-backend",
  "requestId": "req-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "msg": "Request completed"
}
```

### 공통 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | string | 로그 레벨 (debug/info/warn/error/fatal) |
| `time` | number | Unix timestamp (ms) |
| `service` | string | 서비스 식별자 (s2-backend, adapter, ecu-simulator, s3-llm-gateway) |
| `msg` | string | 로그 메시지 |
| `requestId` | string? | 요청 추적 ID (HTTP 요청 컨텍스트에서만) |

---

## 4. Request ID (Correlation ID) 전파

`requestId`는 HTTP 요청뿐 아니라 **모든 추적 가능한 작업 단위**에 부여된다.

### 4.1 생성 시점과 접두사

| 접두사 | 생성 위치 | 용도 |
|--------|-----------|------|
| `req-` | S1 또는 S2 HTTP 미들웨어 | HTTP 요청 (S1이 `X-Request-Id` 헤더로 전달, 없으면 S2가 생성) |
| `can-` | `DynamicAnalysisService.handleAlert()` | CAN alert 누적 → LLM 분석 체인 |
| `reconn-` | `AdapterClient` auto-reconnect | 어댑터 자동 재연결 시도 |
| `sys-` | `index.ts` 기동 로직 | 기동 시 룰 시딩, 마이그레이션 등 시스템 작업 |

### 4.2 HTTP 전파

- 헤더명: `X-Request-Id`
- S2 미들웨어가 생성 (`req-{uuid}`) 또는 수신 헤더 사용
- S2 → S3 호출 시 `X-Request-Id` 헤더로 전달
- S3는 수신한 Request ID를 로그에 포함
- S3 → S4 호출 시에도 `X-Request-Id` 헤더로 전달 (S4가 무시하더라도 S3 로그에 기록)
- 응답 헤더에 `X-Request-Id` 포함 (디버깅용)

### 4.3 비-HTTP 작업

HTTP 미들웨어를 타지 않는 작업은 `generateRequestId(prefix)` 유틸리티로 직접 생성한다.
생성된 ID는 해당 작업의 모든 로그에 `requestId` 필드로 포함되어, 단일 작업 단위를
로그에서 추적할 수 있다.

---

## 5. 로그 레벨 기준

| 레벨 | 기준 | 예시 |
|------|------|------|
| `debug` | 개발/디버깅 상세 정보 | DB 마이그레이션 스킵, WS 연결/해제 |
| `info` | 정상 동작 마일스톤 | 요청 시작/완료, 서버 기동, 분석 시작 |
| `warn` | 열화 운전 (기능은 유지) | LLM 호출 실패 (graceful degradation), 재연결 시도 |
| `error` | 요청 실패 | 처리 불가 에러, 5xx 응답 |
| `fatal` | 서버 기동 불가 | uncaughtException, DB 초기화 실패 |

---

## 6. 로그 저장

### 6.1 저장 방식

pino transport를 사용하여 **stdout + JSONL 파일** 동시 출력.

- stdout: 개발 시 터미널에서 실시간 확인 (`| npx pino-pretty` 조합 가능)
- JSONL 파일: 관리자 도구에서 파싱/시각화 용도

### 6.2 파일 위치

```
logs/                       # 프로젝트 루트 (git-ignored)
├── s2-backend.jsonl        # S2 백엔드
├── adapter.jsonl           # Adapter
├── ecu-simulator.jsonl     # ECU Simulator
└── s3-llm-gateway.jsonl    # S3 LLM Gateway (S3가 관리)
```

- 환경변수 `LOG_DIR`로 경로 변경 가능 (기본값: 프로젝트 루트 `logs/`)
- pino `mkdir: true` 옵션으로 디렉토리 자동 생성
- append 모드 — 서비스 재시작해도 기존 로그 유지

### 6.3 JSONL 형식

파일의 각 줄이 독립된 JSON 객체 (JSON Lines 형식):

```
{"level":30,"time":1741776000000,"name":"s2-backend","component":"llm-task-client","requestId":"req-xxx","msg":"v1 Task completed"}
{"level":30,"time":1741776001000,"name":"s2-backend","component":"llm-v1-adapter","requestId":"req-xxx","msg":"LLM request queued (concurrency=1)"}
```

관리자 도구에서 줄 단위로 `JSON.parse()` 하여 필터링/시각화.

### 6.4 관리자 도구 연동 (예정)

별도 프로그램에서 `logs/*.jsonl` 파일을 읽어 파싱하는 구조:

```
서비스 (pino transport)
  ├── stdout (개발 터미널)
  └── logs/{service}.jsonl (JSONL 파일)

관리자 도구 (별도 앱)
  └── logs/*.jsonl 읽기 → 줄 단위 JSON.parse
      → requestId로 요청 경로 추적
      → 레벨별 필터링
      → 서비스별 로그 분리
      → 시간대별 에러 추이
```

### 6.5 로그 로테이션 (후속 과제)

현재는 단일 파일에 append. 파일이 커지면 날짜/크기 기반 로테이션 도입 예정 (`pino-roll` 등).

---

## 7. S4 (LLM Engine) 관측 원칙

S4는 vLLM 컨테이너로 자체 계측이 불가능하다. 대신 **S3가 관측 지점** 역할을 수행한다.

### 7.1 관측 방식

S3가 S4의 유일한 caller이므로, S3에서 S4 호출 전후를 기록하면 S4를 별도 계측 없이 관측할 수 있다.

```
S3 로그 (S4 호출 시):
  ┌─ 호출 시작: requestId, model, max_tokens
  │   ↓ S4 처리 (블랙박스)
  └─ 호출 완료: requestId, latencyMs, tokenUsage, status
     또는
  └─ 호출 실패: requestId, error, latencyMs
```

### 7.2 S3가 기록해야 하는 S4 관측 필드

| 시점 | 필드 | 설명 |
|------|------|------|
| 호출 시작 | `requestId`, `model`, `maxTokens` | 어떤 요청을 보냈는지 |
| 호출 성공 | `requestId`, `latencyMs`, `promptTokens`, `completionTokens` | 응답 성능 + 토큰 사용량 |
| 호출 실패 | `requestId`, `errorCode`, `latencyMs` | 실패 원인 + 소요 시간 |

### 7.3 vLLM 자체 메트릭 (향후)

vLLM은 `GET /metrics` (Prometheus 형식) 엔드포인트를 제공한다.
토큰 처리량, 큐 깊이, GPU 사용률 등 서빙 레벨 메트릭을 수집할 수 있으며, 필요 시 S4 운영 담당이 별도 수집 체계를 구성한다.
