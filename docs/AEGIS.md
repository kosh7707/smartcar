# AEGIS — Automotive Embedded Governance & Inspection System

> 이 문서는 AEGIS 프로젝트의 **공통 제약 사항**을 정의한다.
> 모든 역할(S1~S7)은 이 문서를 준수해야 한다.
> **이 문서의 수정 권한은 S2(AEGIS Core)에게 있다.** 변경 제안은 work-request로.

---

## 1. 프로젝트 정의

**AEGIS** — Automotive Embedded Governance & Inspection System

자동차 임베디드 소프트웨어의 보안 취약점을 SAST + LLM + 동적 분석으로 종합 검증하는 플랫폼.

### 핵심 원칙

1. **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화한다** — 도구 실행, 필터링, 정규화는 결정론적. LLM은 판단만.
2. **Evidence-first** — 모든 Finding은 증적(EvidenceRef)에 근거해야 한다.
3. **Analyst-first** — LLM은 보조 정보. 최종 판단은 분석가(사용자)가 한다.
4. **S2가 플랫폼 오케스트레이터** — 모든 서비스는 S2가 호출하는 하위 서비스이다.

---

## 2. 역할 및 서비스 매핑

| 역할 | 담당 | 서비스 | 포트 |
|------|------|--------|------|
| **S1** | Frontend + QA (세션 분화 가능: 개발 / QA 전담) | `services/frontend/` | :5173 |
| **S2** | AEGIS Core (Backend) | `services/backend/`, `services/shared/` | :3000 |
| **S3** | Analysis Agent — 보안 분석 자율 에이전트 | `services/analysis-agent/` | :8001 |
| **S3** (겸임) | Build Agent — 빌드 자동화 에이전트 | `services/build-agent/` | :8003 |
| **S4** | SAST Runner (정적 분석 도구 + SCA + 코드 구조 + 빌드 자동화) | `services/sast-runner/` | :9000 |
| **S5** | Knowledge Base (위협 그래프 + 벡터 검색) | `services/knowledge-base/` | :8002 |
| **S6** | Dynamic Analysis (ECU Simulator + Adapter) | `services/ecu-simulator/`, `services/adapter/` | :4000 |
| **S7** | LLM Gateway + LLM Engine 관리 — 플랫폼 LLM 서비스 | `services/llm-gateway/` | :8000, DGX |

### 통신 구조

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
           S7 Gateway (:8000)  ← LLM 단일 관문
                │
           LLM Engine
            (DGX Spark)
```

**기본 원칙**: S2가 모든 하위 서비스를 호출하는 플랫폼 오케스트레이터이다.
**위임 허용**: S2가 S3에게 분석을 위임하면, S3는 내부적으로 S4/S5를 직접 호출할 수 있다. 마찬가지로 S2가 S4를 직접 호출할 수도 있다(사용자 요청에 의한 단독 SAST 스캔 등).
**LLM 접근 원칙**: 모든 LLM 호출은 S7(Gateway)을 경유한다. LLM Engine을 직접 호출하지 않는다.

| 통신 | 프로토콜 | 비고 |
|------|----------|------|
| S1 → S2 | REST API (HTTP) | S1의 유일한 서버 통신 대상 |
| S2 → S3 | REST API (`POST /v1/tasks`) | 분석 위임 |
| S2 → S7 | REST API (`POST /v1/tasks`) | 구조화된 LLM 태스크 요청 |
| S2 → S4 | REST API (`POST /v1/scan` 등) | 직접 SAST 요청 (사용자 트리거) |
| S2 → S5 | REST API (`POST /v1/search` 등) | 지식 조회 (Finding 상세 등) |
| S2 → S6 | WebSocket | CAN 프레임 실시간 스트리밍 |
| S3 → S7 | REST API (`POST /v1/chat`) | Agent 멀티턴 LLM 호출 |
| S3 → S4 | REST API | 에이전트 Phase 1에서 도구 호출 (S2 위임 하위) |
| S3 → S5 | REST API | 에이전트가 지식 검색 (S2 위임 하위) |
| S2 → S3(Build) | REST API (POST /v1/tasks) | 빌드 자동화 위임 (build-resolve) |
| S7 → LLM Engine | REST API | 추론 요청 (S7만 직접 접근) |

### 인프라 스크립트

#### 소유 구분

| 파일 | 소유자 | 비고 |
|------|--------|------|
| `scripts/start.sh` | **S2** | 전체 서비스 통합 기동. S2만 수정 |
| `scripts/stop.sh` | **S2** | 전체 서비스 통합 종료. S2만 수정 |
| `scripts/start-{서비스명}.sh` | **해당 서비스 소유자** | 자기 서비스 단독 기동 스크립트. 직접 작성/관리 |
| `services/{서비스명}/.env` | **해당 서비스 소유자** | 자기 서비스 환경변수. 직접 작성/관리 |
| `scripts/backend/` | S2 | DB 유틸 (reset-db, db-stats, backup-db) |
| `scripts/common/` | S2 | 로그 관리 유틸 |
| `scripts/knowledge-base/` | **S5** | KB ETL 유틸 (etl-build 등) |

#### 규칙

1. **각 서비스 소유자는 자기 서비스의 `scripts/start-{서비스명}.sh`와 `.env`를 직접 작성·관리한다.**
2. **`scripts/start.sh`와 `scripts/stop.sh`는 S2만 수정한다.** 다른 역할이 직접 수정하는 것은 금지.
3. **신규 서비스 추가 또는 포트/기동 방식 변경 시, 반드시 S2에게 work-request를 보내** `start.sh`/`stop.sh` 통합을 요청한다.
4. work-request에 포함할 정보: 서비스명, 포트, 기동 스크립트 경로, 기동 순서 위치(어떤 서비스 뒤에 기동할지)
5. `start.sh`의 기동 순서와 `stop.sh`의 종료 순서(역순)는 S2가 전체 의존성을 고려하여 결정한다.

---

## 3. 코드 소유권

각 역할은 자신의 코드만 수정한다. 다른 역할의 코드를 **읽는 것도 금지**한다 (API 계약서로만 소통).

| 디렉토리 | 소유자 | 비고 |
|----------|--------|------|
| `services/frontend/` | S1 | |
| `services/backend/` | S2 | |
| `services/shared/` | **S2 단독** | S1 참조만 가능, 변경 시 S2가 work-request로 통보 |
| `services/llm-gateway/` | **S7** | LLM Gateway (:8000) |
| `services/analysis-agent/` | S3 | Analysis Agent (:8001) |
| `services/build-agent/` | S3 | Build Agent (S3 겸임) |
| `services/agent-shared/` | S3 | Analysis/Build Agent 공통 프레임워크 |
| `services/sast-runner/` | S4 | |
| `services/knowledge-base/` | S5 | |
| `services/ecu-simulator/` | S6 | |
| `services/adapter/` | S6 | |
| `scripts/` | S2 | 전체 서비스 기동/종료/유틸 |

**예외 없음.** 다른 역할의 코드를 수정해야 하면 문제점 + 수정방안을 work-request로 전달한다.

---

## 4. 문서 소유권

### 규칙

1. **소유자만 수정한다.** 다른 역할이 변경을 원하면 work-request로 요청한다.
2. **계약서 변경 시 영향받는 상대에게 반드시 work-request로 고지한다.**
3. **`docs/외부피드백/`은 읽기 전용 참고 자료.** 누구든 추가 가능, 삭제 금지.
4. **이 문서(`docs/AEGIS.md`)의 수정 권한은 S2에게 있다.** 변경 제안은 work-request로.

### 명세서 (`docs/specs/`)

| 문서 | 소유자 |
|------|--------|
| `technical-overview.md` | **S2 주도** (전체 아키텍처 통합) |
| `backend.md` | S2 |
| `frontend.md` | S1 |
| `adapter.md` | **S6** |
| `ecu-simulator.md` | **S6** |
| `observability.md` | S2 (MSA 공통 규약) |
| `sast-runner.md` | S4 |
| `knowledge-base.md` | **S5** |
| `analysis-agent.md` | S3 |
| `build-agent.md` | S3 |
| `llm-gateway.md` | **S7** |
| `llm-engine.md` | **S7** (LLM Engine 관리 포함) |

### API 계약서 (`docs/api/`)

| 문서 | 소유자 | 비고 |
|------|--------|------|
| `shared-models.md` | **S2 단독** | 전 서비스 공유 타입 |
| `llm-gateway-api.md` | **S7** | S2↔S7, S3↔S7 계약 |
| `sast-runner-api.md` | S4 | S2↔S4, S3↔S4 계약 |
| `knowledge-base-api.md` | **S5** | S2↔S5, S3↔S5 계약 |
| `llm-engine-api.md` | **S7** | S7↔LLM Engine 계약 |
| `analysis-agent-api.md` | S3 | S2↔S3 계약 |
| `adapter-api.md` | **S6** | S2↔S6 WebSocket 계약 |

### 인수인계서 (`docs/{sN}-handoff/`)

| 문서 | 소유자 |
|------|--------|
| `s1-handoff/` | S1 |
| `s2-handoff/` | S2 |
| `s3-handoff/` | S3 |
| `s4-handoff/` | S4 |
| `s5-handoff/` | **S5** |
| `s6-handoff/` | **S6** |
| `s7-handoff/` | **S7** |

#### 인수인계서 구조 규칙

```
docs/{sN}-handoff/
├── README.md              # 필수. 진입점. "이것만 읽으면 바로 작업 가능" (~200줄 이내 권장)
├── roadmap.md             # 필수. 다음 작업 + 장기 계획
├── session-{N}.md         # 세션별 로그 (1파일 = 1세션)
└── (자유 문서)             # architecture.md, api.md 등 서비스 재량
```

- **README.md**: 역할, 경계, 현재 상태, 핵심 의존성. 세션 시작 시 이것만 읽으면 작업 가능해야 한다.
- **roadmap.md**: 즉시 다음 작업 + 후순위 + 인프라 계획. README에서 분리하여 경량화.
- **session-{N}.md**: 세션 N의 작업 로그. 1세션 = 1파일. 번호는 1부터 순차.
- **자유 문서**: 서비스 특성에 맞게 자유롭게 추가 (architecture.md, api-endpoints.md 등). 파일명/포맷 제한 없음.

---

## 5. 서비스 간 소통 규칙

### 5.1 API 계약 원칙

1. **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다.**
2. **다른 서비스의 코드를 절대 읽지 않는다.**
3. 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다.
4. 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다.
5. **공유 모델(`shared-models.md`) 변경 시, 영향받는 모든 서비스에게 work-request로 고지한다.**

### 5.2 작업 요청 (Work Request)

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md` (예: `s1-to-s2-settings-ui.md`)
- 전체 공지: `{보내는쪽}-to-all-{주제}.md` (예: `s4-to-all-agent-architecture-decision.md`)
- **작업 완료 후 해당 요청 문서를 삭제한다.** 삭제는 **받는 쪽**이 처리 완료 후 수행한다. 단, `to-all` 문서는 **발신자**가 삭제한다.
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크한다.
- 폴더가 `.gitkeep`만 있으면 밀린 작업 없음.

### 5.3 공유 타입 (`services/shared/`)

- **S2가 단독 소유**한다. 다른 역할은 참조만 가능.
- 타입 변경 시 `docs/api/shared-models.md`를 반드시 동시 업데이트한다.
- 변경 후 영향받는 서비스에게 work-request로 통보한다.
- DB 컬럼명(snake_case)과 TypeScript 필드명(camelCase) 변환은 각 서비스의 DAO 레이어에서 처리한다.

---

## 6. 포트 할당

| 포트 | 서비스 | 소유자 |
|------|--------|--------|
| 3000 | AEGIS Core (Backend) | S2 |
| 4000 | Adapter | S6 |
| 5173 | Frontend (dev) | S1 |
| 8000 | LLM Gateway | S7 |
| 8001 | Analysis Agent | S3 |
| 8003 | Build Agent | S3 (겸임) |
| 8002 | Knowledge Base | S5 |
| 9000 | SAST Runner | S4 |

새 서비스 추가 시 기존 포트와 충돌하지 않는 포트를 선정하고, 이 표를 업데이트한다.

---

## 7. Observability 공통 규약

**상세: `docs/specs/observability.md`** — 전 서비스가 이 문서를 참조하며, 각 인수인계서에서도 이 문서를 참조해야 한다.

### 필수 준수 사항

1. **에러 응답 형식**: `{ success: false, error: string, errorDetail: { code, message, requestId, retryable } }`
2. **구조화 로깅**: JSON structured logging. 서비스별 `logs/{service-name}.jsonl`에 기록.
3. **로그 레벨 숫자 표준**: `20`(debug), `30`(info), `40`(warn), `50`(error), `60`(fatal). TypeScript/Python 무관 전 서비스 동일.
4. **로그 필수 필드**: `level`(숫자), `time`(epoch ms), `service`(서비스 식별자), `msg`, `requestId`(요청 컨텍스트 시).
5. **서비스 식별자**: `s1-frontend`, `s2-backend`, `s3-agent`, `s4-sast`, `s5-kb`, `s6-adapter`, `s6-ecu`, `s7-gateway`.
6. **X-Request-Id 전파**: 모든 서비스 간 HTTP 호출 시 `X-Request-Id` 헤더를 전파한다. 없으면 생성. 응답에도 포함.
7. **로그 파일 위치**: 프로젝트 루트 `logs/` 디렉토리 (git-ignored, 자동 생성).

### 개발 도구 (MCP)

AEGIS는 개발·디버깅용 MCP 도구(`log-analyzer`)를 제공한다. **모든 역할이 적극 활용할 것.**
- **로그를 직접 파싱(`cat`, `grep`, `jq`)하지 말 것.** 반드시 아래 MCP 도구를 사용한다.
- 장애 추적, 성능 분석, 에이전트 효율 점검, 에러 원인 파악 모두 이 도구로 해결 가능하다.
- `logs/*.jsonl`을 수동으로 읽는 것은 도구가 커버하지 못하는 극히 예외적인 경우에만 허용한다.

| 도구 | 설명 |
|------|------|
| `trace_request(request_id, max_lines=60)` | 전 서비스 파이프라인 시간순 워터폴 추적 + LLM 턴별 토큰 증가. 자동 축약/중복 그룹핑. |
| `search_errors(since_minutes, service, min_level, limit)` | 최근 에러/경고 로그 검색. 동일 패턴 자동 그룹핑 `(xN)`. |
| `search_logs(query, since_minutes, service, min_level, limit)` | 로그 메시지 full-text 검색. 동일 패턴 자동 그룹핑. |
| `list_requests(limit, service)` | 최근 requestId 목록 + 요약 |
| `service_stats(service, since_minutes)` | 서비스별 통계 (요청 수, 지연, 에러율, 토큰) |
| `llm_stats(since_minutes)` | LLM exchange 전용 통계 (호출 수, 레이턴시, 토큰, tool_calls 비율) |

- **위치**: `tools/log-analyzer/` (S2 소유)
- **등록**: `.mcp.json`에 `log-analyzer` 서버로 등록
- **상세 사용법**: `docs/specs/observability.md` 참조

---

## 8. 개발 환경

### 하드웨어 + OS

| 머신 | CPU / GPU | 메모리 | OS | 용도 |
|------|-----------|--------|-----|------|
| **개발 머신** | Intel i7-14700K (3.42GHz) | 64GB DDR5 | Windows 11 Education 24H2 (WSL2 Ubuntu 24.04.4 LTS) | S1, S2, S3, S4, S5, S6, S7(Gateway) 실행 |
| **DGX Spark** | NVIDIA GB10 (aarch64) | 128GB LPDDR5x | DGX Spark OS 7.4.0 (GNU/Linux 6.14.0) | S7(LLM Engine) — Qwen3.5-122B-A10B-GPTQ-Int4 서빙 |

### 언어 + 런타임

- **TypeScript**: S1, S2, S6 (Node.js + tsx)
- **Python**: S3, S4, S5, S7 (venv + uvicorn)
- **monorepo**: `npm install` 완료 상태에서 `@aegis/shared` 심볼릭 링크 동작

### 서비스별 의존성

각 서비스의 핵심 의존성(라이브러리, 버전)은 **해당 서비스의 spec 문서(`docs/specs/{서비스명}.md`)에 명시**한다.
의존성 추가/변경 시 spec 문서를 반드시 동시 업데이트할 것.

### 운영 규칙

- **서비스 기동/종료**: `scripts/start.sh`, `scripts/stop.sh` (S2 관리)
- **각 서비스 환경변수**: `services/{서비스명}/.env` (git-ignored)
- **서버 직접 실행 금지**: 기동/종료는 반드시 사용자에게 요청
- **Git 커밋 권한은 S2에게만 있다.** 다른 역할은 직접 커밋하지 않는다. 커밋이 필요하면 사용자에게 요청하거나 S2 세션에서 일괄 커밋한다.

---

## 9. 문서 구조 규칙

```
docs/
├── AEGIS.md                      # 이 문서 — 공통 제약 사항 (S2 관리)
├── specs/                        # 서비스별 기능 명세
│   ├── technical-overview.md     # 전체 아키텍처 (S2 주도)
│   ├── backend.md                # S2
│   ├── frontend.md               # S1
│   ├── build-agent.md             # S3
│   ├── adapter.md                # S6
│   ├── ecu-simulator.md          # S6
│   ├── sast-runner.md            # S4
│   ├── knowledge-base.md         # S5
│   ├── analysis-agent.md         # S3
│   ├── llm-gateway.md            # S7
│   ├── llm-engine.md             # S7
│   └── observability.md          # S2 (공통 규약)
├── api/                          # API 계약서
│   ├── shared-models.md          # S2 단독
│   ├── llm-gateway-api.md        # S7
│   ├── sast-runner-api.md        # S4
│   ├── knowledge-base-api.md     # S5
│   └── llm-engine-api.md        # S7
├── {sN}-handoff/                 # 역할별 인수인계서
│   └── README.md
├── work-requests/                # 서비스 간 작업 요청
└── 외부피드백/                    # 읽기 전용 참고 자료
```

### 문서 작성 규칙

1. **명세서는 소유자만 수정한다.** 다른 역할이 변경을 원하면 work-request.
2. **인수인계서는 "이것만 읽으면 바로 작업 가능"해야 한다.** 세션 종료 시 반드시 최신화.
3. **API 계약서는 코드와 항상 동기화한다.** 코드를 바꾸면 계약서도 같이 바꾼다.
4. **새 문서 추가 시 위 구조를 따른다.** 구조 변경이 필요하면 S2에게 제안.
5. **문서 내 상대 날짜 금지.** "내일", "이번 주" 대신 절대 날짜를 사용한다 (예: 2026-03-18).

---

## 10. 버전 히스토리

| 날짜 | 변경 |
|------|------|
| 2026-03-18 | 최초 작성. AEGIS 명명 + 6인 체제 확정. S2(AEGIS Core) 관리. |
| 2026-03-19 | S7(LLM Gateway + LLM Engine) 신설. S3에서 분리. 7인 체제. LLM 접근 원칙 추가. |
| 2026-03-23 | S5/S6/S7 인수인계서 (신규) 태그 제거. Observability 규약 강화 (로그 레벨 숫자 표준, 서비스 식별자, X-Request-Id 규약). |
| 2026-03-24 | Build Agent(:8003) 신설 (S3 겸임). 서브 프로젝트 파이프라인 아키텍처. 풀스택 통합 테스트. |
| 2026-03-26 | MCP 개발 도구 섹션 추가 (log-analyzer 6개 도구). 전 역할 적극 활용 권장. |
| 2026-03-28 | Git 커밋 권한 S2 전담 명시. log-analyzer 필수 사용 규칙 강화. 인수인계서 분할 구조 규칙 신설 (README+roadmap+session-{N}). |
| 2026-03-31 | log-analyzer 토큰 절감 (메시지 축약, 중복 그룹핑, max_lines). 레거시 전면 제거 (Rule 엔진, LlmV1Adapter, MockEcu). |
