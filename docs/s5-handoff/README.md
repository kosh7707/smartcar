# S5. Knowledge Base 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S5(Knowledge Base) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-24 (프로젝트 메모리 API, origin 메타데이터, observability v2, 서브 프로젝트 지원)**

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
| Qdrant | `services/knowledge-base/data/qdrant/` (파일 기반, S5 자체 보유) |
| ETL 캐시 | `services/knowledge-base/data/threat-db-raw/` |

### 호출자

| 호출자 | 용도 |
|--------|------|
| **S3 Analysis Agent** | Phase 1: 코드 그래프 적재 + CVE 배치 조회 + 프로젝트 메모리, Phase 2: `knowledge.search` 도구 호출 |
| **S2 Backend** | 프로젝트 메모리 CRUD (false_positive, resolved, preference), Finding 상세에서 CWE/CVE 관계 조회 |

---

## 2. 아키텍처

### 2.1 프로젝트별 2개의 GraphRAG

| GraphRAG | 내용 | 생명주기 |
|----------|------|---------|
| **소스코드 그래프** | Function → CALLS → Function | 프로젝트 분석 시 생성 |
| **취약점 지식 그래프** | CWE ↔ ATT&CK ↔ CAPEC (정적, ETL) + 프로젝트 의존성 CVE (동적, NVD 실시간) | 정적=ETL, CVE=실시간 |

### 2.2 하이브리드 검색 (KnowledgeAssembler)

```
쿼리 → KnowledgeAssembler.assemble()
  ├─ _path_id_exact(): ID 정규식 추출 → Neo4j 직접 조회 + 이웃 확장 (source_filter 적용)
  ├─ _path_vector_semantic(): Qdrant 벡터 유사도 검색 (source_filter → Qdrant Filter)
  ├─ _enrich_with_graph(): 각 hit에 Neo4j 관계 보강
  └─ RRF 점수 융합 (k=60) + 중복 제거 + exclude_ids 필터 → 응답
```
- `batch_assemble()`: 여러 쿼리를 한 번에, 교차 중복 제거

### 2.3 실시간 CVE 조회 (NvdClient)

```
S3 Agent Phase 1 (결정론적):
  S3 → S4 /v1/libraries → [{name: "libcurl", version: "7.68.0", repoUrl: "..."}]
  S3 → S5 /v1/cve/batch-lookup → [{cves: [..., version_match: true/false/null]}]
  S3: version_match == true만 필터 → Phase 2 프롬프트에 주입
```

NvdClient 3단계 전략:
1. **OSV.dev commit 기반** (commit + repo_url 필요) — 가장 정밀, version_match=항상 true
2. **NVD CPE 기반** (repoUrl에서 vendor 추론) — 정밀
3. **NVD keywordSearch 폴백** — 넓은 검색

보강:
- **EPSS**: FIRST.org API로 CVE별 30일 내 악용 확률 (`epss_score`, `epss_percentile`)
- **KEV**: CISA 카탈로그로 실제 악용 확인 CVE 플래그 (`kev: true/false`)
- **병렬 조회**: `asyncio.gather` + 세마포어(5) — 배치 20개 기준 ~4~7초
- 인메모리 캐시 (TTL 24시간, 최대 1,000건)

---

## 3. API 엔드포인트

### 위협 지식 검색

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/search` | 하이브리드 검색 (exclude_ids, source_filter 지원) |
| POST | `/v1/search/batch` | 배치 검색 (최대 20쿼리, 교차 중복 제거) |
| GET | `/v1/graph/stats` | 위협 그래프 통계 |
| GET | `/v1/graph/neighbors/{node_id}?depth=2` | CWE/ATT&CK/CAPEC 관계 탐색 |

### 실시간 CVE 조회

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/cve/batch-lookup` | 라이브러리명+버전으로 NVD CVE 실시간 조회 (version_match 판정) |

### 코드 그래프

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/code-graph/{project_id}/ingest` | 함수 목록 → Neo4j 그래프 구축 (origin 메타데이터 지원). project_id: `{projectId}:{targetName}` |
| GET | `/v1/code-graph/{project_id}/callers/{func}` | 호출자 체인 |
| GET | `/v1/code-graph/{project_id}/callees/{func}` | 피호출 함수 |
| POST | `/v1/code-graph/{project_id}/dangerous-callers` | 위험 함수 호출자 |
| GET | `/v1/code-graph/{project_id}/stats` | 그래프 통계 |
| DELETE | `/v1/code-graph/{project_id}` | 프로젝트 그래프 삭제 |
| GET | `/v1/code-graph` | 등록된 프로젝트 목록 |

### 프로젝트 메모리

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/v1/project-memory/{project_id}?type=` | 메모리 조회 (타입 필터 선택) |
| POST | `/v1/project-memory/{project_id}` | 메모리 생성 |
| DELETE | `/v1/project-memory/{project_id}/{memory_id}` | 메모리 삭제 |

### 기타

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/v1/health` | 서비스 상태 + Neo4j + Qdrant + NVD |

---

## 4. Neo4j 그래프 스키마

### 현재 데이터 규모

| 지표 | 값 |
|------|-----|
| 위협 노드 | 2,196 (CWE 944 + ATT&CK 694 + CAPEC 558) |
| 위협 관계 | 3,542 |
| CVE | ETL에서 제거됨 — 실시간 조회로 전환 |

### 노드 레이블

```
(:CWE {id, title, source, threat_category, severity, attack_surfaces, automotive_relevance})
(:Attack {id, title, source, threat_category, kill_chain_phase, automotive_relevance})
(:CAPEC {id, title, source, threat_category, severity, automotive_relevance})
(:Function {name, file, line, project_id, origin?, original_lib?, original_version?})
```

```
(:Project {id})
(:Memory {id, type, data, createdAt})
```

### 관계 타입

```
(:CWE)-[:RELATED_CAPEC]->(:CAPEC)
(:CWE)-[:RELATED_ATTACK]->(:Attack)
(:CAPEC)-[:RELATED_CWE]->(:CWE)
(:CAPEC)-[:RELATED_ATTACK]->(:Attack)
(:Function)-[:CALLS]->(:Function)
(:Project)-[:HAS_MEMORY]->(:Memory)
```

---

## 5. 파일 구조

```
services/knowledge-base/
├── app/
│   ├── main.py                    # FastAPI 앱. Qdrant + Neo4j + NvdClient 초기화 + NullGraph 폴백
│   ├── config.py                  # Settings (neo4j, qdrant, nvd 설정)
│   ├── context.py                 # requestId ContextVar
│   ├── observability.py           # JSON structured logging
│   ├── cve/
│   │   └── nvd_client.py          # NvdClient — NVD API 실시간 조회 + CPE 매칭 + 캐시
│   ├── graphrag/
│   │   ├── knowledge_assembler.py    # KnowledgeAssembler — 하이브리드 검색 + RRF + 배치
│   │   ├── neo4j_graph.py            # Neo4jGraph — 위협 지식 관계 그래프
│   │   ├── code_graph_service.py     # CodeGraphService — 프로젝트별 함수 호출 그래프 + origin
│   │   ├── project_memory_service.py # ProjectMemoryService — 프로젝트별 에이전트 메모리
│   │   └── vector_search.py          # VectorSearch — Qdrant 래퍼 + source_filter
│   ├── rag/
│   │   └── threat_search.py       # ThreatSearch — Qdrant 클라이언트
│   └── routers/
│       ├── api.py                    # /v1/search, /v1/search/batch, /v1/graph/*, /v1/health
│       ├── cve_api.py                # /v1/cve/batch-lookup
│       ├── code_graph_api.py         # /v1/code-graph/*
│       └── project_memory_api.py     # /v1/project-memory/*
├── scripts/
│   ├── neo4j-seed.py              # Qdrant → Neo4j 마이그레이션
│   └── threat-db/                 # ETL 파이프라인 (CWE + ATT&CK + CAPEC → Qdrant)
│       ├── build.py               # 오케스트레이터 (NVD 제외, --include-nvd로 레거시 지원)
│       ├── schema.py              # UnifiedThreatRecord, CapecBridge
│       ├── taxonomy.py            # 11개 공격 표면 (자동차 8 + 임베디드 3)
│       ├── download.py            # CWE XML, ATT&CK STIX (ICS+Enterprise), CAPEC XML
│       ├── parse_cwe.py           # CWE 파서 (944건)
│       ├── parse_attack.py        # ATT&CK ICS+Enterprise 듀얼 파서 (509건)
│       ├── parse_capec.py         # CAPEC 풀 노드 파서 (558건) + 브릿지
│       ├── parse_nvd.py           # NVD 파서 (레거시, 기본 비활성)
│       ├── crossref.py            # 4방향 교차 참조 엔진
│       ├── load_qdrant.py         # Qdrant 배치 적재
│       └── stats.py               # 통계
├── data/
│   ├── qdrant/                    # Qdrant 파일 DB
│   └── threat-db-raw/             # ETL 다운로드 캐시
├── requirements.txt               # fastapi, uvicorn, pydantic, neo4j, qdrant-client, fastembed, httpx
├── .env                           # Neo4j + Qdrant + NVD API 키
└── tests/                              # 65 tests
    ├── test_neo4j_graph.py             # 6 tests
    ├── test_code_graph_service.py      # 10 tests (origin 메타데이터 포함)
    ├── test_knowledge_assembler.py     # 15 tests (소스 필터, 배치, RRF)
    ├── test_nvd_client.py              # 26 tests (병렬, EPSS, KEV)
    └── test_project_memory_service.py  # 8 tests (CRUD, 타입 검증, JSON 손상 처리)
```

### Observability

`docs/specs/observability.md` 준수. 로그 레벨 숫자 표준, 서비스 식별자, X-Request-Id 전파 규칙은 해당 문서 참조.
- service 식별자: `s5-kb`
- 로그 파일: `logs/aegis-knowledge-base.jsonl`
- 응답 헤더에 `X-Request-Id` 반환 (`_RequestIdMiddleware`)

---

## 6. 인프라

### Neo4j

| 항목 | 값 |
|------|-----|
| 버전 | Neo4j Community 5.26.3 |
| Bolt | localhost:7687 |
| HTTP | localhost:7474 |
| 인증 | neo4j / aegis-kb |
| 기동 | `scripts/start-knowledge-base.sh`에서 자동 기동 |

### Qdrant

| 항목 | 값 |
|------|-----|
| 타입 | 파일 기반 (서버 프로세스 없음) |
| 경로 | `services/knowledge-base/data/qdrant/` |
| 컬렉션 | `threat_knowledge` |
| 임베딩 모델 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384차원) |
| 레코드 | 2,011건 (CWE 944 + ATT&CK 509 + CAPEC 558) |

---

## 7. 환경변수 (.env)

```bash
AEGIS_KB_QDRANT_PATH=/home/kosh/AEGIS/services/knowledge-base/data/qdrant
AEGIS_KB_RAG_TOP_K=5
AEGIS_KB_RAG_MIN_SCORE=0.35
AEGIS_KB_GRAPH_DEPTH=2
AEGIS_KB_NEO4J_URI=bolt://localhost:7687
AEGIS_KB_NEO4J_USER=neo4j
AEGIS_KB_NEO4J_PASSWORD=aegis-kb
AEGIS_KB_NVD_API_KEY=<NVD API 키>
AEGIS_KB_NVD_CACHE_TTL=86400
NVD_API_KEY=<NVD API 키 (ETL용)>
```

---

## 8. 데이터 적재

### ETL (CWE + ATT&CK + CAPEC)

```bash
cd services/knowledge-base
.venv/bin/python scripts/threat-db/build.py --qdrant-path data/qdrant
```

CVE/NVD는 ETL에서 제외됨 — 프로젝트 분석 시 `POST /v1/cve/batch-lookup`으로 실시간 조회.

### Neo4j 시드

```bash
.venv/bin/python scripts/neo4j-seed.py --qdrant-path data/qdrant --clear
```

---

## 9. 실행 방법

```bash
# 기동 스크립트 (Neo4j 자동 기동 포함)
scripts/start-knowledge-base.sh

# 또는 수동
~/neo4j-community-5.26.3/bin/neo4j start && sleep 5
cd services/knowledge-base
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8002

# 확인
curl http://localhost:8002/v1/health
```

---

## 10. 테스트

```bash
.venv/bin/python -m pytest tests/ -q  # 65 passed
```

| 테스트 파일 | 건수 | 대상 |
|------------|------|------|
| test_neo4j_graph.py | 6 | Neo4jGraph mock |
| test_code_graph_service.py | 10 | CodeGraphService mock + origin 메타데이터 |
| test_knowledge_assembler.py | 15 | 하이브리드 검색, 중복 제거, 소스 필터, 배치, RRF |
| test_nvd_client.py | 26 | 버전 매칭, 캐시, CPE 추론, 배치 병렬, EPSS, KEV |
| test_project_memory_service.py | 8 | 메모리 CRUD, 타입 검증, JSON 손상 처리 |

---

## 11. 변경 이력

### 2026-03-24

| 변경 | 상세 |
|------|------|
| 프로젝트 메모리 API | `POST/GET/DELETE /v1/project-memory/{project_id}` — 분석 이력, false positive, resolved, preference |
| 서브 프로젝트 네이밍 | `{projectId}:{targetName}` 컨벤션 확정 (S2 협의) |

### 2026-03-23

| 변경 | 상세 |
|------|------|
| Observability v2 | service `s5-kb`, level 숫자(pino), X-Request-Id 응답 헤더 반환 |
| Neo4j coalesce() | origin 필드 미존재 노드에서 경고 제거 |
| httpx 로그 억제 | httpx/httpcore WARNING 레벨로 설정 |
| API 계약서 정합성 | NullGraph 폴백 상태 테이블 수정, X-Request-Id 응답 기재 |

### 2026-03-21

| 변경 | 상세 |
|------|------|
| Origin 메타데이터 | Function 노드에 `origin`, `original_lib`, `original_version` 추가. S4 camelCase 자동 변환 |
| 통합 테스트 v2 통과 | CVE-2025-55763 자동 발견, origin 태깅 실전 확인 |

### 2026-03-20 (고도화: CVE 병렬+EPSS+KEV, 검색 강화)

| 변경 | 상세 |
|------|------|
| CVE 배치 병렬 조회 | `asyncio.gather` + 세마포어(5). 20개 기준 ~20s → ~4~7s |
| EPSS 악용 확률 보강 | FIRST.org API 배치 조회. CVE에 `epss_score`, `epss_percentile` 추가 |
| CISA KEV 플래그 | KEV 카탈로그 lazy-load (TTL 1h). CVE에 `kev: true/false` 추가 |
| 검색 소스 필터링 | `source_filter: ["CWE"]` 등. ID exact + vector 모두 필터링 |
| 배치 검색 API | `POST /v1/search/batch` — 최대 20쿼리, 교차 중복 제거 |
| RRF 점수 융합 | Reciprocal Rank Fusion (k=60). id_exact + neighbor + vector 3-list 융합 |
| 테스트 36→54 | NVD client +9, Assembler +9 |

### 2026-03-20 (통합 테스트 + 코드 리뷰 안정화)

| 변경 | 상세 |
|------|------|
| OSV.dev commit 기반 조회 추가 | 3단계: OSV commit → NVD CPE → NVD keyword |
| CVE batch-lookup camelCase 호환 | `repoUrl`(S4 원본)과 `repo_url` 모두 수용 |
| Assembler fallback (NullGraph) | Neo4j 다운 시에도 벡터 검색 가능하도록 _NullGraph 폴백 |
| NvdClient 초기화 보호 | try/except 감싸기 |
| 빈 쿼리 검증 | assemble()에서 빈/공백 쿼리 시 즉시 빈 결과 반환 |
| 캐시 크기 제한 | 최대 1,000건, 초과 시 oldest 제거 |
| requestId 전파 보강 | graph/stats, graph/neighbors, code-graph ingest/dangerous-callers에 추가 |
| Neo4j 종료 graceful 처리 | 외부 종료 시 에러 대신 경고 |
| 기동 스크립트 Neo4j 대기 | sleep 5 → Bolt 포트 능동 대기 |
| 통합 테스트 통과 | S3 Agent Phase 1+2 정상, LLM 자발적 도구 호출 3건 확인 |

### 2026-03-19

| 변경 | 상세 |
|------|------|
| ETL에서 NVD 제거 | CVE는 실시간 조회로 전환. `--include-nvd` 레거시 옵션 유지 |
| ATT&CK Enterprise 추가 | ICS 83 + Enterprise 426 = 509건 |
| CAPEC 풀 노드 승격 | 브릿지 전용 → 558건 UnifiedThreatRecord 생성 |
| taxonomy 확장 | 공격 표면 8→11개, 키워드 29→63개, Concurrency 카테고리 추가 |
| POST /v1/cve/batch-lookup | NVD 실시간 CVE 조회 + CPE 정밀 + version_match 판정 |
| POST /v1/search exclude_ids | 결과 제외 후 재검색 지원 |
| KnowledgeAssembler 리팩토링 | 메서드 분리, _enrich_with_graph, match_type_counts |
| Neo4j 비밀번호 | smartcar → aegis-kb |
| S4 CVE 조회 이관 | S4 cve_lookup.py → S5 /v1/cve/batch-lookup으로 대체 완료 |

### 2026-03-18

| 변경 | 상세 |
|------|------|
| S3 코드/데이터 이관 | Qdrant, ETL 캐시, context_enricher.py |
| smartcar → AEGIS 리네이밍 | env_prefix, 서비스명, 로그, 문서 전부 |
| API 계약서 + 명세서 작성 | docs/api/knowledge-base-api.md, docs/specs/knowledge-base.md |

---

## 12. 참고 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 공통 제약 사항 | `docs/AEGIS.md` | **필독** |
| KB API 계약서 | `docs/api/knowledge-base-api.md` | S2↔S5, S3↔S5 계약 |
| KB 명세서 | `docs/specs/knowledge-base.md` | 기술 스택, 데이터 모델 |
| S3 인수인계서 | `docs/s3-handoff/README.md` | Agent Phase 1/2 맥락 |
| SAST Runner API | `docs/api/sast-runner-api.md` | /v1/libraries, /v1/functions |
