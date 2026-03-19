# S3. Analysis Agent 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S3(Analysis Agent) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-19**

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
| **Analysis Agent** | :8001 | `deep-analyze` taskType. Phase 1(SAST+코드그래프+SCA) → Phase 2(LLM 해석) |

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
| S3 API 계약서 | `docs/api/analysis-agent-api.md` | S2↔S3 API 계약 |

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
  │   ├── LLM이 추가 tool 호출 가능: knowledge.search, code_graph.get_functions
  │   ├── LLM 호출은 S7 Gateway 경유 (POST /v1/chat)
  │   └── Qwen 35B → 구조화 JSON (claims + evidence refs)
  │
  └── 응답: TaskSuccessResponse (기존 API 계약 준수)
```

### 핵심 설계 원칙

- **결정론적 처리를 최대화** — Phase 1에서 SAST, 코드 그래프, SCA를 LLM 없이 실행
- **LLM의 결정 표면을 최소화** — Phase 2에서 LLM은 해석만 담당
- **증거 기반** — 모든 claim은 eref(Evidence Reference)로 근거 연결 필수
- **SCA CVE는 참고 정보** — 라이브러리 코드는 미분석이므로 claims가 아닌 caveats에 포함
- **LLM 접근은 S7 경유** — 모든 LLM 호출은 S7 Gateway(`POST /v1/chat`)를 통해 수행

### 파일 구조 (analysis-agent)

```
services/analysis-agent/
├── app/
│   ├── main.py                    # FastAPI 앱, lifespan (RAG 비활성화, KB 전담)
│   ├── config.py                  # Settings (agent_*, llm_*)
│   ├── context.py                 # requestId ContextVar
│   ├── observability.py           # 구조화 JSON 로깅 + agent_log()
│   ├── core/
│   │   ├── phase_one.py           # Phase1Executor (SAST+코드그래프+SCA) + build_phase2_prompt()
│   │   ├── agent_loop.py          # AgentLoop (멀티턴 LLM 루프)
│   │   ├── agent_session.py       # AgentSession (변이 가능 상태)
│   │   └── result_assembler.py    # 결과 조립 + 검증 + confidence
│   ├── llm/
│   │   ├── caller.py              # LlmCaller (S7 Gateway HTTP + exchange log + LLM dump)
│   │   ├── message_manager.py     # 메시지 히스토리 관리
│   │   └── turn_summarizer.py     # 턴 요약
│   ├── tools/
│   │   ├── registry.py            # ToolSchema 등록
│   │   ├── router.py              # ToolRouter (디스패치 + 예산 + 중복 차단)
│   │   ├── executor.py            # ToolExecutor (타임아웃)
│   │   └── implementations/
│   │       ├── sast_tool.py       # SAST Runner /v1/scan
│   │       ├── codegraph_tool.py  # SAST Runner /v1/functions
│   │       ├── knowledge_tool.py  # KB /v1/search
│   │       └── sca_tool.py        # SAST Runner /v1/libraries
│   ├── budget/                    # BudgetManager, TokenCounter
│   ├── policy/                    # TerminationPolicy, RetryPolicy, ToolFailurePolicy
│   ├── validators/                # SchemaValidator, EvidenceValidator
│   └── routers/tasks.py           # POST /v1/tasks (deep-analyze → Phase1 → AgentLoop)
├── scripts/
│   ├── integration-test.sh        # 단일 파일 통합 테스트
│   └── project-scan.sh            # 프로젝트 전반 분석 파이프라인
└── tests/                         # 114 tests
```

### 환경변수 (.env)

`services/analysis-agent/.env` 파일에서 환경변수를 로드한다. pydantic-settings가 자동으로 읽는다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| AEGIS_LLM_ENDPOINT | `http://localhost:8000` | S7 LLM Gateway 주소 (http://localhost:8000) |
| AEGIS_LLM_MODEL | `Qwen/Qwen3.5-35B-A3B-FP8` | Agent가 요청 시 지정하는 모델명 |
| LOG_DIR | `../../logs` (프로젝트 루트 `logs/`) | JSONL 로그 파일 디렉토리 |

> 모든 서비스가 동일한 패턴(`services/<서비스명>/.env`)을 사용한다. 너의 `.env`는 네가 직접 관리.

## 5. Knowledge Base 아키텍처 (2026-03-18 신규)

### Neo4j + Qdrant 하이브리드 GraphRAG

```
쿼리: "CWE-78 command injection popen"
  │
  ├─ 경로 1: ID 직접 조회 (Neo4j)
  │  "CWE-78" → 노드 정보 + 이웃 (score=1.0)
  │
  ├─ 경로 2: 그래프 이웃 확장 (Neo4j)
  │  CWE-78의 depth=2 이웃 (score=0.8)
  │
  └─ 경로 3: 시맨틱 검색 (Qdrant)
     임베딩 유사도 (score=가변)
  │
  └─ 병합 + 중복 제거 + 점수 정렬
```

### Neo4j 인프라

- **설치 경로**: `~/neo4j-community-5.26.3`
- **포트**: 7687 (Bolt), 7474 (HTTP/Browser)
- **인증**: neo4j / smartcar
- **시드**: `python scripts/neo4j-seed.py --qdrant-path <path>` (1회 실행, 영속)

### 파일 구조 (knowledge-base)

```
services/knowledge-base/
├── app/
│   ├── main.py                    # Neo4j driver + Qdrant + KnowledgeAssembler 초기화
│   ├── config.py                  # Settings (neo4j_uri/user/password, qdrant_path)
│   ├── graphrag/
│   │   ├── neo4j_graph.py         # Neo4jGraph (RelationGraph 대체, 동일 인터페이스)
│   │   ├── code_graph_service.py  # CodeGraphService (프로젝트별 코드 그래프)
│   │   ├── knowledge_assembler.py # 하이브리드 검색 오케스트레이터
│   │   └── vector_search.py       # Qdrant 래퍼
│   ├── rag/
│   │   └── threat_search.py       # Qdrant 클라이언트 + scroll_all_metadata()
│   └── routers/
│       ├── api.py                 # /v1/search, /v1/graph/*, /v1/health
│       └── code_graph_api.py      # /v1/code-graph/*
├── scripts/
│   ├── neo4j-seed.py              # Qdrant → Neo4j 마이그레이션
│   └── threat-db/                 # ETL 파이프라인 (CWE/NVD/ATT&CK/CAPEC)
└── tests/                         # 19 tests
```

## 6. 구조화된 로깅 체계 (2026-03-18 신규)

### 로그 파일

| 파일 | 서비스 | 내용 |
|------|--------|------|
| `logs/s3-analysis-agent.jsonl` | Agent | Phase 1/2 전체 이벤트 (phase_one, agent_loop, llm_caller, tool_router 등) |
| `logs/s4-exchange.jsonl` | Agent | LLM 호출 요약 (turn, tokens, latency, dumpFile) |
| `logs/llm-dumps/*.json` | Agent | LLM 호출별 request+response 전문 (프롬프트 재현용) |
| `logs/aegis-knowledge-base.jsonl` | KB | 검색 요청, 코드 그래프 적재 |
| `logs/s4-sast-runner.jsonl` | SAST Runner (S4) | 도구 실행 상세 |

### 교차 서비스 추적

```bash
grep '{request-id}' logs/*.jsonl  # 여러 서비스 한번에 추적
```

---

## 7. 수정 이력

### Phase 1 확장 + 시스템 프롬프트 재설계 (2026-03-19, 완료)

Phase 1에 결정론적 KB 연동 3건 추가 + 시스템 프롬프트를 분석가 관점으로 재설계:
- **CVE 실시간 조회**: SCA 라이브러리+버전 → S5 `POST /v1/cve/batch-lookup` → version_match 필터링
- **KB 위협 조회**: SAST CWE ID → S5 `POST /v1/search` → CWE/CVE/ATT&CK 위협 지식
- **위험 함수 호출자**: findings 위험 함수 → S5 `POST /v1/code-graph/dangerous-callers`
- **프롬프트 재설계**: "JSON만 출력하라" 선두 → 임무 중심 4단계 (평가→연결→도구→보고서). 스키마를 마지막 단계로 이동
- **테스트**: 18건 신규 추가 (114 passed)

### S7 분리 + Agent LLM 호출 Gateway 경유 전환 (2026-03-19, 완료)

S3에서 LLM Gateway + LLM Engine 관리를 S7으로 분리:
- **S7 신설**: `services/llm-gateway/` 코드, LLM Engine(DGX Spark) 운영, 관련 문서 5건 → S7 소유
- **S3 범위 축소**: Analysis Agent(:8001) 전담 + KB(:8002) 임시 관리
- **LLM 호출 경로 전환**: Agent의 LLM 호출이 S7 Gateway(`POST /v1/chat`)를 경유
- **환경변수 변경**: `AEGIS_LLM_ENDPOINT` → S7 LLM Gateway 주소 (`http://localhost:8000`)
- **S7 인수인계서 작성**: `docs/s7-handoff/README.md`

### 에이전트 통합 로깅 + Neo4j GraphRAG + Phase 1/2 + SCA (2026-03-18, 완료)

오늘 하루 동안 수행한 대규모 작업:

1. **에이전트 통합 로깅** — 14개 파일 수정. Phase/턴/컴포넌트별 구조화 JSON. LLM 전문 덤프(`logs/llm-dumps/`). S4 교환 로그 보강.
2. **Neo4j GraphRAG** — NetworkX 제거 → Neo4j 전환. Qdrant 벡터 + Neo4j 그래프 하이브리드 검색. CWE/CVE/ATT&CK 1857노드 + 코드 그래프 121노드.
3. **하이브리드 검색** — ID exact(score=1.0) + graph neighbor(score=0.8) + vector semantic 3경로 병합. "CWE-78" 검색 정확도 극적 개선.
4. **Phase 1/2 분리** — S4 제안 채택. SAST+코드그래프+SCA를 LLM 없이 자동 실행 → LLM에 결과 주입.
5. **projectPath 코드 그래프** — S4 구현. clang AST + namespace 순회 + CallExpr 추출. 1→98 함수.
6. **SCA 라이브러리 분석** — S4 `/v1/libraries` 통합. 6개 라이브러리 식별, 3개 수정 탐지, CVE 40건.
7. **출력 스키마 명시** — Phase 2 프롬프트에 스키마+evidence refs 추가. confidence 0.15→0.865.
8. **max_tokens 4096** — LLM 응답 잘림 해결.
9. **Qdrant 잠금 해결** — KB 전담, Agent RAG 비활성화.
10. **dangerous-callers API** — 코드 그래프에서 위험 함수 호출자 자동 식별 (popen, getenv, readlink).

최종 테스트 결과: RE100 12개 소스 → SAST 16건 + 코드 그래프 98함수 + SCA 6라이브러리 → LLM 8 claims, confidence 0.865, schemaValid=true

---

## 8. 구현 로드맵

### 1단계: Task API 뼈대 — 완료

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry 구조 (5개 task type 등록)
- model profile registry 구조 (Settings 기반 자동 등록)
- schema validation + evidence validation 프레임워크
- confidence calculator (4항목 가중합)
- mock dispatcher

### 2단계: 핵심 Task 구현

- static-explain
- dynamic-annotate
- report-draft

### 3단계: Provenance / Audit / Trust

- provenance metadata 생성
- budget / timeout / cache
- input trust labeling
- confidence 산출

### 4단계: Planner + Safety

- test-plan-propose
- planner output DSL
- static-cluster
- safety / policy integration

### 5단계: Evaluation

- evaluation harness
- golden set 관리
- regression 검증

---

## 관리하는 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 이 인수인계서 | `docs/s3-handoff/README.md` | 다음 세션용 (Analysis Agent + KB 포함) |
| 외부 피드백 (Agentic SAST) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 근거 |

**참조 문서 (타 서비스 소유):**

| 문서 | 경로 | 소유 | 용도 |
|------|------|------|------|
| SAST Runner API | `docs/api/sast-runner-api.md` | S4 | S3↔S4 계약 (7개 엔드포인트) |
| SAST Runner 명세 | `docs/specs/sast-runner.md` | S4 | SAST Runner 내부 아키텍처 |
| LLM Gateway API | `docs/api/llm-gateway-api.md` | S7 | S3↔S7 계약 (`POST /v1/chat`) |
| KB API | `docs/api/knowledge-base-api.md` | S5 | S3↔S5 계약 |
| 공유 모델 | `docs/api/shared-models.md` | S2 | 전 서비스 공유 타입 |

**중요**: 구현을 바꾸면 관련 명세서와 API 계약서도 반드시 같이 업데이트할 것.

---

## 실행 방법

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

---

## 참고할 문서들

| 문서 | 경로 | 왜 봐야 하는지 |
|------|------|--------------|
| 전체 기술 개요 | `docs/specs/technical-overview.md` | 프로젝트 전체 구조 이해 |
| AEGIS 공통 규약 | `docs/AEGIS.md` | 역할, 소유권, 소통 규칙 |
| S2 백엔드 명세 | `docs/specs/backend.md` | S2가 S3를 어떻게 쓰는지 이해 |
| 공유 모델 | `docs/api/shared-models.md` | S2-S3 간 데이터 구조 |
| SAST Runner API | `docs/api/sast-runner-api.md` | S4 소유. 7개 엔드포인트 명세 |
| SAST Runner 명세 | `docs/specs/sast-runner.md` | S4 소유. 내부 아키텍처 |
| LLM Gateway API | `docs/api/llm-gateway-api.md` | S7 소유. LLM 호출 계약 (`POST /v1/chat`) |
| 외부 피드백 (Agentic) | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | Prepared Guided Agent 설계 |
