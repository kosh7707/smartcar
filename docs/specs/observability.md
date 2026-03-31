# MSA Observability 규약

> **S2(AEGIS Core)가 관리하는 전 서비스 공통 규약.**
> 모든 서비스(S1~S7)는 이 문서를 준수해야 한다.
> 변경 제안은 S2에게 work-request로.
> **마지막 업데이트: 2026-03-28**

---

## 1. 에러 응답 형식

모든 HTTP 서비스의 에러 응답은 아래 형식을 따른다.

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

---

## 2. 에러 코드 체계

| 코드 | HTTP | retryable | 용도 |
|------|------|-----------|------|
| `INVALID_INPUT` | 400 | N | 필수 필드 누락, 잘못된 형식 |
| `NOT_FOUND` | 404 | N | 리소스 없음 |
| `CONFLICT` | 409 | N | 동시 실행 등 |
| `ADAPTER_UNAVAILABLE` | 502 | Y | 어댑터 미연결 |
| `LLM_UNAVAILABLE` | 502 | Y | LLM Gateway 네트워크 불가 |
| `LLM_HTTP_ERROR` | 502 | N | LLM Gateway가 4xx/5xx 반환 |
| `LLM_PARSE_ERROR` | 502 | Y | LLM 응답 JSON 파싱 실패 |
| `LLM_TIMEOUT` | 504 | Y | LLM 응답 시간 초과 |
| `LLM_CIRCUIT_OPEN` | 502 | Y | S7 Circuit Breaker OPEN 상태 |
| `AGENT_UNAVAILABLE` | 502 | Y | S3 Agent 네트워크 불가 |
| `AGENT_TIMEOUT` | 504 | Y | S3 Agent 응답 시간 초과 |
| `SAST_UNAVAILABLE` | 502 | Y | S4 SAST Runner 네트워크 불가 |
| `SAST_TIMEOUT` | 504 | Y | S4 SAST Runner 시간 초과 |
| `BUILD_AGENT_UNAVAILABLE` | 502 | Y | S3 Build Agent 네트워크 불가 |
| `BUILD_AGENT_TIMEOUT` | 504 | Y | S3 Build Agent 응답 시간 초과 |
| `KB_UNAVAILABLE` | 502 | Y | S5 Knowledge Base 네트워크 불가 |
| `KB_HTTP_ERROR` | 502 | N | S5 Knowledge Base가 4xx/5xx 반환 |
| `PIPELINE_STEP_FAILED` | 502 | Y | 서브 프로젝트 파이프라인 단계 실패 (빌드/스캔) |
| `DB_ERROR` | 500 | N | 데이터베이스 오류 |
| `INTERNAL_ERROR` | 500 | N | catch-all |

---

## 3. 구조화 로그 형식

### 3.1 필수 필드

**모든 서비스의 모든 JSONL 로그 라인에 아래 필드를 포함한다.**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `level` | **number** | O | 로그 레벨 (아래 표 참조) |
| `time` | number | O | Unix timestamp (밀리초, epoch ms) |
| `service` | string | O | 서비스 식별자 (아래 표 참조) |
| `msg` | string | O | 로그 메시지 |
| `requestId` | string | △ | 요청 추적 ID (요청 컨텍스트가 있을 때) |

### 3.2 로그 레벨 (숫자 표준)

**전 서비스(TypeScript, Python 무관) 숫자를 사용한다.**

| 값 | 이름 | 기준 | 예시 |
|----|------|------|------|
| 20 | debug | 개발/디버깅 상세 정보 | DB 마이그레이션 스킵, WS 연결/해제 |
| 30 | info | 정상 동작 마일스톤 | 요청 시작/완료, 서버 기동, 분석 시작 |
| 40 | warn | 열화 운전 (기능은 유지) | LLM 호출 실패 (graceful degradation), 재연결 시도 |
| 50 | error | 요청 실패 | 처리 불가 에러, 5xx 응답 |
| 60 | fatal | 서버 기동 불가 | uncaughtException, DB 초기화 실패 |

- TypeScript: pino 기본값과 동일
- Python: `logging.INFO`(30) → `30`, `logging.WARNING`(30) → `40` 으로 매핑

### 3.3 서비스 식별자

| 서비스 | `service` 값 | 로그 파일 |
|--------|-------------|----------|
| S1 Frontend | `s1-frontend` | (콘솔 로그, JSONL 해당 없음) |
| S2 Backend | `s2-backend` | `logs/s2-backend.jsonl` |
| S3 Agent | `s3-agent` | `logs/aegis-analysis-agent.jsonl` |
| S4 SAST | `s4-sast` | `logs/s4-sast-runner.jsonl` |
| S5 KB | `s5-kb` | `logs/aegis-knowledge-base.jsonl` |
| S6 Adapter | `s6-adapter` | `logs/adapter.jsonl` |
| S6 ECU Sim | `s6-ecu` | `logs/ecu-simulator.jsonl` |
| S7 Gateway | `s7-gateway` | `logs/aegis-llm-gateway.jsonl` |
| S3 Build Agent | `s3-build` | `logs/aegis-build-agent.jsonl` |

### 3.4 로그 출력 예시

```jsonl
{"level":30,"time":1774252583684,"service":"s2-backend","requestId":"req-abc123","msg":"→ POST :8001/v1/tasks","target":"s3-agent"}
{"level":30,"time":1774252774000,"service":"s3-agent","requestId":"req-abc123","msg":"deep-analyze completed","claims":4,"confidence":0.865}
{"level":30,"time":1774252774100,"service":"s2-backend","requestId":"req-abc123","msg":"← 200 OK from :8001/v1/tasks","elapsedMs":190416}
```

---

## 4. X-Request-Id 전파 규약

### 4.1 생성 규칙

| 조건 | 행동 |
|------|------|
| S1→S2 요청에 `X-Request-Id` 없음 | S2가 생성 (`req-{uuid}`) |
| S1→S2 요청에 `X-Request-Id` 있음 | S2가 그대로 사용 |
| 내부 이벤트 (CAN alert, 시스템 시딩 등) | 해당 서비스가 생성 (접두사 자유) |
| 하위 서비스가 헤더 없이 요청 수신 | 서버 측에서 자체 생성 |

### 4.2 접두사 규약

| 접두사 | 생성 위치 | 용도 |
|--------|-----------|------|
| `req-` | S1 또는 S2 HTTP 미들웨어 | HTTP 요청 |
| `can-` | S2 동적 분석 서비스 | CAN alert → LLM 분석 체인 |
| `reconn-` | S2 AdapterClient | 어댑터 자동 재연결 |
| `sys-` | 각 서비스 기동 로직 | 시스템 초기화 |
| `gw-` | S7 Gateway | S7이 자체 생성 시 |

### 4.3 전파 원칙

**한 번 생성된 requestId는 파이프라인 끝까지 전파한다.**

```
S1 → [X-Request-Id: req-abc123] → S2
  S2 → [X-Request-Id: req-abc123] → S4 (SAST scan)
  S2 → [X-Request-Id: req-abc123] → S3 (deep-analyze)
    S3 → [X-Request-Id: req-abc123] → S4 (functions)
    S3 → [X-Request-Id: req-abc123] → S5 (CVE lookup)
    S3 → [X-Request-Id: req-abc123] → S7 (LLM chat)
      S7 → [X-Request-Id: req-abc123] → LLM Engine
```

### 4.4 구현 규칙

1. **HTTP 클라이언트**: 하위 서비스 호출 시 반드시 `X-Request-Id` 헤더를 포함
2. **HTTP 서버**: 수신한 `X-Request-Id`를 요청 컨텍스트에 저장, 모든 로그에 `requestId` 기록
3. **응답 헤더**: HTTP 응답에 `X-Request-Id` 헤더를 포함하여 반환
4. **WebSocket**: 요청-응답 패턴 메시지에 `requestId` 필드 포함 (스트리밍/이벤트는 해당 없음)

### 4.5 S1 (Frontend) 규칙

- S2 API 호출 시 `X-Request-Id` 헤더를 생성하여 전달 (UUID v4 권장, `req-` 접두사)
- fetch/axios 인터셉터에서 자동 부착 권장
- 응답의 `X-Request-Id`를 콘솔 로그에 기록하면 프론트-백 추적 가능

---

## 5. 서비스 간 HTTP 호출 로그 표준

서비스 간 HTTP 호출 시 **요청 시작**과 **응답 수신**을 각각 기록한다.

```jsonl
{"level":30,"time":...,"service":"s2-backend","requestId":"req-abc123","msg":"→ POST :8001/v1/tasks","target":"s3-agent","method":"POST","path":"/v1/tasks"}
{"level":30,"time":...,"service":"s2-backend","requestId":"req-abc123","msg":"← 200 OK from :8001/v1/tasks","target":"s3-agent","status":200,"elapsedMs":190316}
```

| 필드 | 설명 |
|------|------|
| `target` | 호출 대상 서비스 식별자 |
| `method` | HTTP 메서드 |
| `path` | 요청 경로 |
| `status` | 응답 HTTP 상태 코드 (응답 시) |
| `elapsedMs` | 소요 시간 (응답 시) |

이 형식으로 로그를 남기면 `aegis-trace` 도구가 requestId → grep → 시간순 정렬 → 워터폴 생성 가능.

---

## 6. 로그 저장

### 6.1 저장 위치

```
logs/                              # 프로젝트 루트 (git-ignored, 자동 생성)
├── s2-backend.jsonl               # S2 Backend
├── aegis-analysis-agent.jsonl     # S3 Agent
├── s4-sast-runner.jsonl           # S4 SAST Runner
├── aegis-knowledge-base.jsonl     # S5 Knowledge Base
├── adapter.jsonl                  # S6 Adapter
├── ecu-simulator.jsonl            # S6 ECU Simulator
├── aegis-llm-gateway.jsonl        # S7 Gateway (메인 앱 로그)
├── aegis-build-agent.jsonl        # S3 Build Agent
└── llm-exchange.jsonl             # S7 LLM 교환 전문 (디버깅용)
```

- 환경변수 `LOG_DIR`로 경로 변경 가능 (기본값: 프로젝트 루트 `logs/`)
- append 모드 — 서비스 재시작해도 기존 로그 유지
- 관리: `scripts/common/reset-logs.sh`로 일괄 초기화

### 6.2 JSONL 형식

파일의 각 줄이 독립된 JSON 객체 (JSON Lines 형식).
관리자 도구에서 줄 단위로 `JSON.parse()` 하여 필터링/시각화.

---

## 7. LLM Engine 관측

S7(LLM Gateway)이 LLM Engine(DGX Spark)의 유일한 caller이므로, S7에서 호출 전후를 기록한다.

| 시점 | 필드 |
|------|------|
| 호출 시작 | `requestId`, `model`, `maxTokens` |
| 호출 성공 | `requestId`, `latencyMs`, `promptTokens`, `completionTokens` |
| 호출 실패 | `requestId`, `errorCode`, `latencyMs` |

vLLM의 `GET /metrics` (Prometheus 형식) 엔드포인트로 서빙 레벨 메트릭 수집 가능 (향후).

---

## 8. 파이프라인 추적 도구 (예정)

`scripts/common/aegis-trace.sh` — requestId 입력 → 전 서비스 로그에서 해당 요청의 파이프라인을 시간순 워터폴로 표시.

```bash
scripts/common/aegis-trace.sh <requestId> [--errors-only] [--service s3,s7]
```

---

## 9. MCP 로그 분석 도구 (log-analyzer)

**위치**: `tools/log-analyzer/` (S2 소유)
**등록**: `.mcp.json` → `log-analyzer` 서버
**기반**: Python + FastMCP + SQLite 캐시 (mtime/size 기반 무효화)

### 도구 목록 (6개)

#### `trace_request(request_id, max_lines=60)`
전 서비스 파이프라인을 시간순 워터폴로 추적. LLM exchange가 있으면 턴별 프롬프트 토큰 증가도 자동 표시.
**토큰 절감**: 메시지 자동 축약 (120자), 동일 패턴 중복 `(xN)` 축약, `max_lines` 초과 시 자동 잘림.

```
trace_request("integ-1774504776-analyze")
→ 워터폴 + "Turn 1: prompt=2,368 (+2,368) ... Turn 3: prompt=23,818 (+15,088) ← 폭발 지점"

trace_request("e2e-build-test", max_lines=30)
→ 상위 30건만 표시 + "전체 158건 중 상위 30건 표시"
```

#### `search_errors(since_minutes=60, service=None, request_id=None, min_level=50, limit=20)`
최근 에러/경고 로그 검색. `min_level=40`으로 WARN까지 포함 가능.
**토큰 절감**: 동일 패턴 자동 그룹핑 (`"expiresAt 경고 5건" → 1줄 (x5)`), 메시지 150자 잘림.

#### `search_logs(query, since_minutes=1440, service=None, min_level=20, limit=30)`
로그 메시지(msg) full-text 검색 (case-insensitive). 키워드로 특정 이벤트를 빠르게 탐색.
**토큰 절감**: 동일 패턴 그룹핑 + 메시지 150자 잘림. 헤더에 "N건 → M개 패턴" 표시.

```
search_logs("OOM", since_minutes=1440)
search_logs("BUILD_FAILED", service="s3-build")
```

#### `list_requests(limit=10, service=None)`
최근 requestId 목록과 요약 (서비스, 소요시간, 에러 여부).

#### `service_stats(service=None, since_minutes=60)`
서비스별 통계: 요청 수, 에러율, 평균/최대 레이턴시, 토큰 사용량, 도구 호출 빈도.

#### `llm_stats(since_minutes=1440)`
LLM exchange 전용 통계: 호출 수, 평균/최대 레이턴시, 평균/최대 prompt 토큰, tool_calls vs content 비율.

```
llm_stats(since_minutes=60)
→ 총 호출: 90회 / 평균 레이턴시: 10.4s / 최대 prompt 토큰: 41,740 / tool_calls: 95%
```

### 활용 가이드

| 상황 | 도구 |
|------|------|
| 요청 추적 (워터폴) | `trace_request` |
| 장애 원인 파악 | `search_errors` + `trace_request` |
| 특정 키워드 검색 (OOM, timeout 등) | `search_logs` |
| 서비스 건강 점검 | `service_stats` |
| 에이전트 효율 분석 | `llm_stats` + `trace_request` (턴별 토큰) |
| 최근 활동 확인 | `list_requests` |

### 로그 파일

| 파일 | 서비스 | 비고 |
|------|--------|------|
| `s2-backend.jsonl` | S2 Backend | |
| `aegis-analysis-agent.jsonl` | S3 Analysis Agent | |
| `aegis-build-agent.jsonl` | S3 Build Agent | |
| `s4-sast-runner.jsonl` | S4 SAST Runner | |
| `aegis-knowledge-base.jsonl` | S5 Knowledge Base | |
| `adapter.jsonl` | S6 Adapter | |
| `ecu-simulator.jsonl` | S6 ECU Simulator | |
| `aegis-llm-gateway.jsonl` | S7 LLM Gateway | |
| `llm-exchange.jsonl` | LLM 호출 상세 | `llm_stats` 전용 데이터소스 |

---

## 10. 버전 히스토리

| 날짜 | 변경 |
|------|------|
| 2026-03-12 | 최초 작성 (에러 응답, 에러 코드, 로그 포맷, Request ID) |
| 2026-03-23 | 전면 개편: 로그 레벨 숫자 표준 확정, 서비스 식별자 7개 확정, X-Request-Id 전파 규약 강화, HTTP 호출 로그 표준 추가, 로그 파일 위치 현행화, S1 규칙 추가, 에러 코드 확장 (Agent/SAST/Circuit Breaker) |
| 2026-03-26 | MCP 로그 분석 도구 섹션 추가 (6개 도구 상세 문서화). S3 피드백 반영: 턴별 토큰 추적, full-text 검색, LLM 전용 통계 |
| 2026-03-28 | 에러 코드 확장: BUILD_AGENT_UNAVAILABLE/TIMEOUT, KB_UNAVAILABLE/HTTP_ERROR, PIPELINE_STEP_FAILED 추가 |
