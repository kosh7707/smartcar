# S5. Knowledge Base 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S5(Knowledge Base) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-04-04 (threat search readiness hardening + provenance seam + graph-aware benchmark compare)**

---

## 1. S5의 역할

AEGIS 플랫폼의 **위협 지식 그래프 + 코드 구조 그래프 + 실시간 CVE 조회**를 관리한다.

```
                     S2 (AEGIS Core :3000)
                    ╱     │     ╲      ╲       ╲
                 S3       S4     S5      S6      S7
               Agent    SAST    ★KB★   동적분석  Gateway
              :8001    :9000   :8002    :4000   :8000
```

### 소유

| 항목 | 경로/위치 |
|------|----------|
| 코드 | `services/knowledge-base/` |
| 포트 | :8002 |
| Neo4j | ~/neo4j-community-5.26.3 (localhost:7687/7474) |
| Qdrant | `services/knowledge-base/data/qdrant/` (파일 기반) |
| ETL 캐시 | `services/knowledge-base/data/threat-db-raw/` |

### 호출자

| 호출자 | 용도 |
|--------|------|
| **S3 Analysis Agent** | Phase 1: 코드 그래프 적재 + CVE 배치 조회 + 프로젝트 메모리, Phase 2: `knowledge.search` 도구 호출 |
| **S2 Backend** | 프로젝트 메모리 CRUD, Finding 상세에서 CWE/CVE 관계 조회 |

### Codex / OMX 운영 메모

- 하드 가드레일 재확인:
  - S5는 **다른 서비스 코드를 읽지 않는다**.
  - 다른 서비스와의 소통은 **WR로만** 한다.
  - 연동 판단은 API 계약서만 보고, 계약이 비었거나 낡았으면 담당자에게 WR을 보낸다.
  - **커밋은 하지 않는다**. 커밋은 S2 세션만 한다.
  - `scripts/start*.sh`, `scripts/stop*.sh`, 서비스 기동 명령은 **사용자 허락 없이 실행하지 않는다**.
  - 로그/장애 분석은 `log-analyzer` MCP를 우선 사용한다.
- 장기 S5 작업 메모와 후속 세션 인계는 `$note`, `docs/s5-handoff/`, session log를 우선 사용한다.
- 공용 `.omx/notepad.md`, `.omx/project-memory.json`은 **여러 lane이 공유하는 전역 durable 메모리**로 간주한다.
  - 여기에 남기는 내용은 **전역 규칙, cross-lane에 실제 필요한 장기 사실, 공통 검증 결과**로 제한한다.
  - **S5 전용 작업 메모, 중간 추론, 세부 TODO, 세션 한정 장문 기록**은 공용 `.omx` 대신 `docs/s5-handoff/`, `docs/work-requests/`, `.omx/state/sessions/{session-id}/...`에 남긴다.
  - 공용 `.omx`에 기록할 때는 가능하면 **날짜 + S5 + 메모 성격(전역 규칙/장기 사실/검증 결과)**를 명시한다.
- **`$ralph`**: ETL, search readiness, provenance seam, 검색 품질, CVE enrichment처럼 한 축을 끝까지 파고드는 작업에 우선 사용한다.
- **`$team`**: S3(GraphRAG 호출), S4(SCA/CVE 입력), S7(LLM 소비), S2(프로젝트 메모리/API 계약)와 병렬로 맞춰야 할 때 우선 사용한다.
- **`$trace`**: 이전 Codex/OMX 세션의 데이터 품질 점검, 장애 분석, 판단 흐름 복기에 사용한다.
- skill을 써도 **다른 서비스 코드를 보는 대신 계약서와 work-request로 소통**한다.

---

## 2. 아키텍처 개요

### 프로젝트별 2개의 GraphRAG

| GraphRAG | 내용 | Qdrant 컬렉션 | 생명주기 |
|----------|------|--------------|---------|
| **소스코드 GraphRAG** | Function 벡터 임베딩 + Neo4j CALLS 관계 | `code_functions` | 프로젝트 ingest/delete 시 동적 |
| **취약점 GraphRAG** | CWE ↔ ATT&CK ↔ CAPEC (정적) + CVE (실시간) | `threat_knowledge` | 정적=ETL, CVE=실시간 |

### 하이브리드 검색 (KnowledgeAssembler)

```
쿼리 → KnowledgeAssembler.assemble()
  ├─ _path_id_exact(): ID 정규식 추출 → Neo4j 직접 조회 + 이웃 확장
  ├─ _path_vector_semantic(): Qdrant 벡터 유사도 검색
  ├─ _enrich_with_graph(): 각 hit에 Neo4j 관계 보강
  └─ RRF 점수 융합 (k=60) + 중복 제거 → 응답
```

### 실시간 CVE 조회 (NvdClient)

NvdClient 3단계 전략:
1. **OSV.dev commit 기반** — 가장 정밀
2. **NVD CPE 기반** — 정밀
3. **NVD keywordSearch 폴백** — 넓은 검색

보강: KB 지식 보강(`kb_context`) + 복합 위험 점수(`risk_score`: CVSS 40%+EPSS 30%+KEV 20%+도메인 10%) + 캐시 영속화(`data/cve-cache.json`)

---

## 3. API 엔드포인트

### 위협 지식 검색

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/search` | 하이브리드 검색 |
| POST | `/v1/search/batch` | 배치 검색 (최대 20쿼리) |
| GET | `/v1/graph/stats` | 위협 그래프 통계 (edgeTypes 포함) |
| GET | `/v1/graph/neighbors/{node_id}` | CWE/ATT&CK/CAPEC 관계 탐색 |

### 실시간 CVE 조회

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/cve/batch-lookup` | NVD CVE 실시간 조회 (version_match + risk_score) |

### 코드 그래프

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/code-graph/{project_id}/ingest` | 함수 목록 → Neo4j + Qdrant 동시 적재 |
| POST | `/v1/code-graph/{project_id}/search` | 하이브리드 시맨틱 검색 |
| GET | `/v1/code-graph/{project_id}/callers/{func}` | 호출자 체인 |
| GET | `/v1/code-graph/{project_id}/callees/{func}` | 피호출 함수 |
| POST | `/v1/code-graph/{project_id}/dangerous-callers` | 위험 함수 호출자 |
| GET | `/v1/code-graph/{project_id}/stats` | 그래프 통계 |
| DELETE | `/v1/code-graph/{project_id}` | 프로젝트 그래프 삭제 |
| GET | `/v1/code-graph` | 등록된 프로젝트 목록 |

### 프로젝트 메모리

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/v1/project-memory/{project_id}` | 메모리 조회 (타입 필터) |
| POST | `/v1/project-memory/{project_id}` | 메모리 생성 |
| DELETE | `/v1/project-memory/{project_id}/{memory_id}` | 메모리 삭제 |

### 기타

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/v1/health` | liveness probe |
| GET | `/v1/ready` | readiness probe — Qdrant+Neo4j 상태 + ontology 메타 |

---

## 4. 현재 데이터 규모

| 지표 | 값 |
|------|-----|
| Neo4j 위협 노드 | 2,196 (CWE 944 + ATT&CK 694 + CAPEC 558) |
| Neo4j 위협 관계 | 9,298 |
| Qdrant 레코드 | 2,011 (CWE 944 + ATT&CK 509 + CAPEC 558) |
| ATT&CK→CWE 교차 참조 | 118건/509건 (23%) |

> Neo4j(2,196)와 Qdrant(2,011)의 차이는 시드 시 교차 참조 대상이 추가 노드로 생성되기 때문.

---

## 5. 인프라

### Neo4j

| 항목 | 값 |
|------|-----|
| 버전 | Neo4j Community 5.26.3 |
| Bolt | localhost:7687 |
| 인증 | neo4j / aegis-kb |

### Qdrant

| 항목 | 값 |
|------|-----|
| 타입 | 파일 기반 (서버 프로세스 없음) |
| 임베딩 모델 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384차원) |

---

## 6. 실행

```bash
# 기동 스크립트 (Neo4j 자동 기동 포함)
scripts/start-knowledge-base.sh

# 확인
curl http://localhost:8002/v1/health
```

---

## 7. 테스트

```bash
.venv/bin/python -m pytest tests/ -q  # 161 passed
```

| 테스트 파일 | 건수 | 대상 |
|------------|------|------|
| test_neo4j_graph.py | 7 | Neo4jGraph mock (edgeTypes 포함) |
| test_code_graph_service.py | 16 | CodeGraphService mock + origin + provenance seam |
| test_code_vector_search.py | 12 | CodeVectorSearch + provenance metadata/filter |
| test_code_graph_assembler.py | 10 | CodeGraphAssembler + buildSnapshotId filter 전달 |
| test_knowledge_assembler.py | 15 | 위협 하이브리드 검색 + RRF |
| test_nvd_client.py | 37 | CVE 조회 + EPSS/KEV/risk_score |
| test_project_memory_service.py | 22 | 메모리 CRUD + lifecycle + 센티넬 + provenance seam |
| test_api_error_responses.py | 15 | 에러 포맷 + health/ready + threat-search readiness hardening |
| test_qdrant_modes.py | 5 | Qdrant file/server 듀얼 모드 초기화 |
| test_benchmark_metrics.py | 15 | 벤치마크 메트릭 (P@k, R@k, NDCG, MRR) |
| test_benchmark_artifacts.py | 7 | validation set shape/coverage + sweep summary + graph compare/oracle summary |

벤치마크 validation set은 현재 **45 queries**이며:
- `scripts/benchmark/sweep.py`는 CSV와 JSON 요약 출력을 지원한다.
- `scripts/benchmark/run_benchmark.py --compare-neo4j`는 **Qdrant-only vs Neo4j-enabled** 비교와 query uplift 요약을 지원한다.
- 2026-04-04 비교 실행 기준, **Qdrant-only → Neo4j-enabled**에서 `ndcg_5` **0.4048 → 0.6111**, `mrr` **0.4636 → 0.7399**, `hit_rate` **0.7442 → 0.9070**로 상승했고, `ndcg_5` 기준 개선된 쿼리는 **14/43개**였다.
- 같은 날 수행한 **Neo4j-enabled 36조합 sweep**(`min_score 0.25~0.4`, `neighbor_score 0.7~0.9`, `rrf_k 30/60/100`)도 전 구간에서 동일한 `ndcg_5=0.6111`, `mrr=0.7399`를 보여, 현재 병목은 파라미터보다 validation set 구분력 쪽에 더 가깝다.
- validation set에는 이제 일부 exact/graph query에 대해 `required_match_types` oracle이 들어가며, compare 실행 기준 **Qdrant-only oracle full-pass 0.0000 → Neo4j-enabled 1.0000**로 graph path 존재 여부를 직접 검증할 수 있다.
- threat search는 이제 **Neo4j 필수**다. Neo4j가 없으면 `/v1/search`, `/v1/search/batch`, `/v1/ready` 모두 `503 KB_NOT_READY`.
- code graph / project memory는 선택적으로 `buildSnapshotId`, `buildUnitId`, `sourceBuildAttemptId` provenance를 수용한다.
- 현재 code graph는 **프로젝트당 활성 그래프 1개** 모델이며, provenance는 지금 단계에서 multi-snapshot 동시 보존이 아니라 **projection/filter seam**이다.

---

## 8. 관련 문서

| 문서 | 경로 |
|------|------|
| 공통 제약 사항 | `docs/AEGIS.md` |
| KB API 계약서 | `docs/api/knowledge-base-api.md` |
| KB 명세서 | `docs/specs/knowledge-base.md` |
| **아키텍처 상세** | `docs/s5-handoff/architecture.md` |
| **로드맵** | `docs/s5-handoff/roadmap.md` |
| **세션 로그** | `docs/s5-handoff/session-{1~19}.md` |
