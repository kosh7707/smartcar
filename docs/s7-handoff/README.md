# S7. LLM Gateway + LLM Engine 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S7(LLM Gateway + LLM Engine 관리) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-04-04**

---

## 1. 프로젝트 전체 그림

### AEGIS 8세션 운영에서 S7의 위치

```
                  S1 / S1-QA (Frontend :5173)
                          |
                     S2 (AEGIS Core :3000)  <- 플랫폼 오케스트레이터
                    /     |     \      \
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                |
           S7 Gateway (:8000)  <- LLM 단일 관문
                |
           LLM Engine
            (DGX Spark)
```

### S7 소유 서비스

| 서비스 | 포트/위치 | 역할 |
|--------|-----------|------|
| **LLM Gateway** | :8000 | 5개 taskType + `/v1/chat` 프록시 (LLM 단일 관문) |
| **LLM Engine** | 10.126.37.19:8000 (DGX Spark) | Qwen3.5-122B-A10B-GPTQ-Int4, vLLM 서빙 |

### S7의 정체성

> S7은 AEGIS 플랫폼의 **LLM 단일 관문(Gateway)** 이자 **LLM Engine 운영자**다.
> 모든 LLM 호출은 S7(Gateway)을 경유한다. LLM Engine을 직접 호출하지 않는다.

---

## 2. 역할과 경계

### 소유 코드

- `services/llm-gateway/` — Gateway 서버 (Task API + `/v1/chat` 프록시)

### 관리 문서

| 문서 | 경로 |
|------|------|
| 이 인수인계서 | `docs/s7-handoff/` |
| LLM Gateway 기능 명세 | `docs/specs/llm-gateway.md` |
| LLM Engine 명세 | `docs/specs/llm-engine.md` |
| S2/S3 <-> S7 API 계약서 | `docs/api/llm-gateway-api.md` |
| S7 <-> LLM Engine 계약 | `docs/api/llm-engine-api.md` |

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다**
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- **공유 모델(`shared-models.md`) 또는 API 계약서 변경 시, 영향받는 상대에게 work-request로 고지**

### 작업 요청

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md`
- **작업 완료 후 삭제** (받는 쪽이 처리 후 수행, `to-all`은 발신자가 삭제)

### Codex / OMX 운영 메모

- 하드 가드레일 재확인:
  - S7은 **다른 서비스 코드를 읽지 않는다**.
  - 다른 서비스와의 소통은 **WR로만** 한다.
  - 연동 판단은 API 계약서만 보고, 계약이 비었거나 낡았으면 담당자에게 WR을 보낸다.
  - **커밋은 하지 않는다**. 커밋은 S2 세션만 한다.
  - `scripts/start*.sh`, `scripts/stop*.sh`, 서비스 기동 명령은 **사용자 허락 없이 실행하지 않는다**.
  - 로그/장애 분석은 `log-analyzer` MCP를 우선 사용한다.
- 장기 S7 작업 메모와 후속 세션 인계는 `$note`와 `.omx` 메모리를 사용한다.
- 단, `docs/AEGIS.md`(2026-04-04) 기준으로 공용 `.omx/notepad.md`, `.omx/project-memory.json`은 **전역 durable 정보만** 남긴다. S7 전용 장문 작업 메모, 중간 추론, 세부 TODO는 `docs/s7-handoff/` 또는 `.omx/state/sessions/{session-id}/...`로 남긴다.
- **`$ralph`**: Gateway 정책, prompt/profile 조정, DGX 연동 안정화처럼 단일 lane 완주가 필요한 작업에 우선 사용한다.
- **`$team`**: S2/S3/S5와 계약·RAG·모델 소비 경계를 동시에 맞춰야 하거나, Gateway/Engine 운영과 호출자 검증을 병렬로 돌릴 때 우선 사용한다.
- **`$trace`**: 이전 Codex/OMX 세션의 장애 대응, 호출 흐름, 프롬프트/모델 판단 경로 복기에 사용한다.
- skill을 써도 **LLM 호출 단일 관문 원칙, API 계약, work-request 규칙은 그대로 유지한다**.

---

## 3. API

### LLM Gateway (:8000)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | Task 기반 AI 분석 요청 (5개 taskType) |
| POST | `/v1/chat` | OpenAI-compatible chat completion 프록시 |
| GET | `/v1/health` | 서비스 상태 (Circuit Breaker 포함) |
| GET | `/v1/usage` | 누적 토큰/요청 통계 |
| GET | `/v1/models` | 등록된 model profile 목록 |
| GET | `/v1/prompts` | 등록된 prompt template 목록 |
| GET | `/metrics` | Prometheus 메트릭 |

### Task Type Allowlist

| Task Type | 용도 |
|-----------|------|
| `static-explain` | 정적 분석 finding 심층 설명 |
| `static-cluster` | 유사 finding 그룹핑 |
| `dynamic-annotate` | 동적 분석 이벤트 해석 |
| `test-plan-propose` | 테스트 시나리오 제안 |
| `report-draft` | 보고서 초안 생성 |

### `/v1/chat` 프록시

OpenAI-compatible chat completion 프록시. S3 Agent가 멀티턴 LLM 호출 시 사용.
- 요청 body의 `model` 필드를 실제 운영 모델로 자동 오버라이드
- `X-Timeout-Seconds` 헤더로 호출자 주도 타임아웃 (기본 1800초)
- Circuit Breaker OPEN이면 즉시 503
- LLM Engine 응답을 그대로 반환 (모든 응답에 `X-Request-Id` 포함)
- 상세: `docs/api/llm-gateway-api.md`

---

## 4. 현재 상태

| 항목 | 상태 |
|------|------|
| 테스트 | **185 passed** (`PYTHONPATH=. .venv/bin/python3 -m pytest -q`, 2026-04-03 검증) |
| LLM 모드 | `real` (DGX Spark vLLM) |
| 모델 | Qwen3.5-122B-A10B-GPTQ-Int4 |
| Circuit Breaker | 구현 완료 (CLOSED/OPEN/HALF_OPEN) |
| RAG (S5 KB) | 통합 완료 (`rag_enabled=true`) |
| Prometheus 메트릭 | `/metrics` 제공 중 |
| 미완료 항목 | **없음** |

### 최근 변경 (2026-04-03~04)

- Gateway 안정화 패치:
  - schema-invalid 응답이 성공 처리되던 버그 수정
  - commentary-wrapped JSON object 파싱 보강
- 회귀 테스트 2건 추가 후 전체 S7 테스트 **185 passed** 재검증
- 공용 `.omx` 메모 운영 규칙 반영:
  - 전역 durable 정보만 공용 `.omx`에 유지
  - S7 전용 장문 메모는 `docs/s7-handoff/`와 session state로 이관

### 이전 변경 (2026-03-31)

- chat proxy 로그 강화: `toolChoice`, `toolCount`, `finishReason` 필드 추가
- CB OPEN 503 응답에 `X-Gateway-Latency-Ms` 헤더 추가 (일관성)
- `LLM_CIRCUIT_OPEN → MODEL_ERROR` contract test 추가 (180 tests)
- `llm-engine.md`에 모델 행동 특성 섹션 추가 (tool_calls 선호, evidence 환각)
- 통합 테스트 2회 로그 분석 완료 — S7 에러 0건

---

## 5. 상세 문서

| 문서 | 내용 |
|------|------|
| [architecture.md](architecture.md) | 파일 구조, 요청 흐름, 환경변수, Observability, 동시성, Thinking 제어 |
| [llm-engine-ops.md](llm-engine-ops.md) | DGX Spark 접속, vLLM 기동/중지, 성능 실측, 트러블슈팅 |
| [roadmap.md](roadmap.md) | 다음 작업 + LoRA 파인튜닝 장기 계획 |
| session-{1~11}.md | 세션별 작업 로그 |
