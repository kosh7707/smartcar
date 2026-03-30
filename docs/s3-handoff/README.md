# S3. Analysis Agent 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S3(Analysis Agent) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-28**

---

## 1. 프로젝트 전체 그림

### AEGIS 7인 체제에서 S3의 위치

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

### S3 소유 서비스

| 서비스 | 포트/위치 | 역할 |
|--------|-----------|------|
| **Analysis Agent** | :8001 | `deep-analyze`, `generate-poc` taskType. Phase 1(SAST+코드그래프+SCA) → Phase 2(LLM 해석) |
| **Build Agent** | :8003 | `build-resolve` taskType. LLM이 소스 탐색 → 빌드 스크립트(`build-aegis/aegis-build.sh`) 작성 → 빌드 성공까지 반복. v0.2.0 |
| **agent-shared** | 라이브러리 | 두 에이전트 공통 프레임 (LLM 통신, 도구 실행, 스키마, 정책). `pip install -e ../agent-shared` |

### S3가 호출하는 서비스 (소유 X)

| 서비스 | 소유 | 엔드포인트 | 역할 |
|--------|------|-----------|------|
| **S7 LLM Gateway** (:8000) | S7 | `POST /v1/chat` | Phase 2 LLM 호출 (모든 LLM 접근은 S7 Gateway 경유) |
| **SAST Runner** (:9000) | S4 | scan, functions, includes, metadata, libraries, build-and-analyze, health (7개) | Phase 1 도구 실행 |
| **Knowledge Base** (:8002) | **S5** (S3가 구축, 인수인계 예정) | search, cve/batch-lookup, graph/*, code-graph/* | Phase 1 + Phase 2 위협 지식 + 코드 그래프 |

### S3 소유 문서

| 문서 | 경로 | 비고 |
|------|------|------|
| S3 인수인계서 | `docs/s3-handoff/README.md` | 이 문서 |
| S3 기능 명세 | `docs/specs/analysis-agent.md` | Analysis Agent 아키텍처, 원칙 |
| S3 API 계약서 | `docs/api/analysis-agent-api.md` | S2↔S3 API 계약 (Analysis Agent) |
| Build Agent API 계약서 | `docs/api/build-agent-api.md` | S2↔S3 API 계약 (Build Agent) |

### S3의 정체성

> S3는 **감사 가능하고, 재현 가능하며, 자동화 가능한 증거 기반 보안 분석** 통제 계층이다.
> 결정론적 처리(Phase 1)를 최대화하고, LLM의 결정 표면(Phase 2)을 최소화한다.

**S3의 성공 기준:**
1. 항상 파싱 가능할 것 → `parsedOk: true`
2. 항상 supplied evidence 안에서만 말할 것 → `evidenceValid: true`
3. 전 구간 requestId로 추적 가능할 것 → 구조화 JSON 로깅
4. SAST 결과는 결정론적으로, LLM 해석은 구조화된 JSON으로 → Phase 1/2 분리

---

## 2. 너의 역할과 경계

### 너는

- **S3 — Analysis Agent**
- 소유 코드:
  - `services/analysis-agent/` — 에이전트 기반 심층 분석 (Phase 1/2)
- 관리하는 문서:
  - `docs/s3-handoff/README.md` — 이 인수인계서

### KB(S5) 인수인계 상태

- S3가 `services/knowledge-base/` 코드를 구축했지만, AEGIS 체제에서 **S5로 분리**
- S5 담당자 투입 시 `docs/s5-handoff/README.md` 초안 작성 + 소유권 이전 예정
- **그때까지 S3가 KB 코드/운영을 임시 관리**

### API 계약 소통 원칙 (필수)

- **다른 서비스의 동작은 반드시 API 계약서(`docs/api/`)로만 파악한다**
- **다른 서비스의 코드를 절대 읽지 않는다** — 코드를 보고 동작을 파악하거나 거기에 맞춰 구현하는 것은 금지
- 계약서에 없는 필드/엔드포인트는 "존재하지 않는다"고 간주한다
- 계약서와 실제 코드가 다르면, 해당 서비스 소유자에게 계약서 갱신을 work-request로 요청한다
- **공유 모델(`shared-models.md`) 또는 API 계약서가 변경되면, 영향받는 상대 서비스에게 반드시 work-request로 고지한다**

### 다른 서비스 코드

- S1(프론트), S2(백엔드), S7(Gateway) 코드는 기본적으로 수정하지 않으며 **읽는 것도 금지** (API 계약서로만 소통)

### 작업 요청 주고받기

- **경로**: `docs/work-requests/`
- **파일명**: `{보내는쪽}-to-{받는쪽}-{주제}.md` (예: `s2-to-s3-mock-enhancement.md`)
- S1이나 S2에게 요청할 일이 있으면 이 폴더에 문서를 작성한다
- 반대로 S1/S2가 너에게 요청한 문서도 여기에 있다
- **작업 완료 후 해당 요청 문서를 반드시 삭제한다**
- 세션 시작 시 이 폴더를 확인하여 밀린 요청이 있는지 체크한다

---

## 3. API

### Analysis Agent (:8001) — 심층 분석

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `deep-analyze` taskType. Phase 1/2 자동 실행. |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 |

### Knowledge Base (:8002) — GraphRAG (S3 임시 관리)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/search` | 하이브리드 검색 (ID exact + graph neighbor + vector) |
| GET | `/v1/graph/stats` | 위협 지식 그래프 통계 |
| GET | `/v1/graph/neighbors/{node_id}` | CWE/CVE/ATT&CK 관계 탐색 |
| POST | `/v1/code-graph/{project_id}/ingest` | 프로젝트 코드 그래프 적재 |
| GET | `/v1/code-graph/{project_id}/callers/{func}` | 함수 호출자 추적 |
| POST | `/v1/code-graph/{project_id}/dangerous-callers` | 위험 함수 호출자 식별 |
| GET | `/v1/health` | 서비스 상태 + Neo4j 연결 + Qdrant 상태 |

### Task Type

| Task Type | 서비스 | 용도 |
|-----------|--------|------|
| **`deep-analyze`** | **Analysis Agent (:8001)** | **프로젝트 전반 보안 분석 (Phase 1/2)** |

> 레거시 5개 taskType (`static-explain`, `static-cluster`, `dynamic-annotate`, `test-plan-propose`, `report-draft`)은 S7 LLM Gateway (:8000)가 담당한다.

---

## 4. Analysis Agent 아키텍처 (2026-03-18 신규)

### Phase 1/2 분리 아키텍처

```
POST /v1/tasks (taskType: "deep-analyze")
  │
  ├── Phase 1: 결정론적 (LLM 없이)
  │   ├── sast.scan        → S4 SAST Runner → findings
  │   ├── code.functions   → S4 SAST Runner → 함수+호출 관계
  │   ├── sca.libraries    → S4 SAST Runner → 라이브러리 + 버전
  │   ├── cve.batch-lookup → S5 KB → 버전 매칭된 CVE (NEW)
  │   ├── threat.search    → S5 KB → CWE별 위협 지식 (NEW)
  │   └── dangerous-callers → S5 KB → 위험 함수 호출자 (NEW)
  │
  ├── Phase 2: LLM 해석
  │   ├── Phase 1 결과(SAST+코드+SCA+CVE+위협+호출자)를 프롬프트에 주입
  │   ├── 시스템 프롬프트: 임무 중심 4단계 (평가→연결→도구→보고서)
  │   ├── LLM이 추가 tool 호출 가능: knowledge.search, code_graph.callers
  │   ├── LLM 호출은 S7 Gateway 경유 (POST /v1/chat)
  │   └── Qwen 122B GPTQ-Int4 → 구조화 JSON (claims + evidence refs)
  │
  └── 응답: TaskSuccessResponse (기존 API 계약 준수)
```

### 핵심 설계 원칙

- **결정론적 처리를 최대화** — Phase 1에서 SAST, 코드 그래프, SCA를 LLM 없이 실행
- **LLM의 결정 표면을 최소화** — Phase 2에서 LLM은 해석만 담당
- **증거 기반** — 모든 claim은 eref(Evidence Reference)로 근거 연결 필수
- **SCA CVE는 참고 정보** — 라이브러리 코드는 미분석이므로 claims가 아닌 caveats에 포함
- **LLM 접근은 S7 경유** — 모든 LLM 호출은 S7 Gateway(`POST /v1/chat`)를 통해 수행

### 파일 구조 (요약)

| 디렉토리 | 핵심 파일 | 역할 |
|----------|----------|------|
| `services/agent-shared/` | `llm/caller.py`, `tools/registry.py`, `schemas/{agent,upstream}.py`, `path_util.py` | 공통 프레임: LLM 통신, 도구 실행, DTO, 경로 검증 |
| `services/analysis-agent/app/core/` | `phase_one.py`, `agent_loop.py`, `result_assembler.py` | Phase 1 결정론적 실행 + Phase 2 LLM 루프 |
| `services/analysis-agent/app/tools/` | `router.py`, `implementations/` (sast, codegraph, knowledge, sca) | 도구 디스패치 + S4/S5 HTTP 위임 |
| `services/build-agent/app/core/` | `phase_zero.py`, `agent_loop.py`, `result_assembler.py` | Phase 0 사전 분석 + 빌드 스크립트 생성/복구 |
| `services/build-agent/app/tools/` | `router.py`, `implementations/` (list/read/write/edit/delete/try_build) | 파일 도구 + S4 빌드 실행 |
| `services/build-agent/app/policy/` | `file_policy.py` | 능력 기반 파일 접근 + 내용 안전성 검사 |

### 환경변수 (.env)

`services/analysis-agent/.env` — pydantic-settings 자동 로드. 주요: `AEGIS_LLM_ENDPOINT` (S7 Gateway), `AEGIS_LLM_MODEL` (모델명).

## 5. 핵심 의존성

### KB (S5, S3 임시 관리)

- Neo4j + Qdrant 하이브리드 GraphRAG. 상세: `docs/s5-handoff/README.md`
- Neo4j: `~/neo4j-community-5.26.3`, 포트 7687/7474, 인증 neo4j/smartcar

### Observability

- service 식별자: `s3-agent`. 로그: `logs/aegis-analysis-agent.jsonl`, `logs/llm-exchange.jsonl`
- `docs/specs/observability.md` 준수. 교차 추적: `grep '{request-id}' logs/*.jsonl`

---

## 7. 분할 문서

| 문서 | 내용 |
|------|------|
| [`session-{N}.md`](.) | 세션별 수정 이력 (1세션 = 1파일, 세션 5~13) |
| [`roadmap.md`](roadmap.md) | 다음 작업 + v2 장기 계획 |

---

## 8. 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 이 인수인계서 | `docs/s3-handoff/README.md` | 진입점 |
| 세션 로그 | `docs/s3-handoff/session-{N}.md` | 수정 이력 (1세션 = 1파일) |
| 로드맵 | `docs/s3-handoff/roadmap.md` | 다음 작업 + 장기 계획 |
| Analysis Agent 명세 | `docs/specs/analysis-agent.md` | 아키텍처, 원칙 |
| Build Agent 명세 | `docs/specs/build-agent.md` | 아키텍처, 원칙 |
| Analysis Agent API | `docs/api/analysis-agent-api.md` | S2↔S3 계약 |
| Build Agent API | `docs/api/build-agent-api.md` | S2↔S3 계약 |

---

## 9. 실행 방법

> **서버를 직접 실행하지 마라.** 서비스 기동/종료는 반드시 사용자에게 요청할 것.

### 사전 조건

- S7 Gateway (:8000) 가동 중
- S4 SAST Runner (:9000) 가동 중
- Neo4j: `$NEO4J_HOME/bin/neo4j start` (~/neo4j-community-5.26.3)
- S5 Knowledge Base (:8002) 가동 중 (S3가 임시 관리)

### Agent 기동

```bash
cd services/analysis-agent && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 확인

```bash
curl http://localhost:8001/v1/health  # Agent
```

### 통합 테스트

```bash
cd services/analysis-agent
bash scripts/project-scan.sh  # RE100 프로젝트 전반 분석
```

**주의**: WSL2 환경. `.venv` + `.env` 구비됨.
