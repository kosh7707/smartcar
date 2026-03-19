# S5. Knowledge Base 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S5(Knowledge Base) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-19**

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
| **S3 Analysis Agent** | Phase 1: 코드 그래프 적재 + CVE 배치 조회, Phase 2: `knowledge.search` 도구 호출 |
| **S2 Backend** | (향후) Finding 상세에서 CWE/CVE 관계 조회 |

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
  ├─ _path_id_exact(): ID 정규식 추출 → Neo4j 직접 조회 (score=1.0) + 이웃 확장 (score=0.8)
  ├─ _path_vector_semantic(): Qdrant 벡터 유사도 검색 (score=가변)
  ├─ _enrich_with_graph(): 각 hit에 Neo4j 관계 보강
  └─ 병합 + 중복 제거 + exclude_ids 필터 + 점수 정렬 → 응답
```

### 2.3 실시간 CVE 조회 (NvdClient)

```
S3 Agent Phase 1 (결정론적):
  S3 → S4 /v1/libraries → [{name: "libcurl", version: "7.68.0", repoUrl: "..."}]
  S3 → S5 /v1/cve/batch-lookup → [{cves: [..., version_match: true/false/null]}]
  S3: version_match == true만 필터 → Phase 2 프롬프트에 주입
```

NvdClient 전략:
1. **CPE 정밀 조회** (repoUrl에서 vendor 추론) — 우선
2. **keywordSearch 폴백** — CPE 실패 시
3. **인메모리 캐시** (TTL 24시간)

---

## 3. API 엔드포인트

### 위협 지식 검색

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/search` | 하이브리드 검색 (exclude_ids 지원) |
| GET | `/v1/graph/stats` | 위협 그래프 통계 |
| GET | `/v1/graph/neighbors/{node_id}?depth=2` | CWE/ATT&CK/CAPEC 관계 탐색 |

### 실시간 CVE 조회

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/cve/batch-lookup` | 라이브러리명+버전으로 NVD CVE 실시간 조회 (version_match 판정) |

### 코드 그래프

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/code-graph/{project_id}/ingest` | 함수 목록 → Neo4j 그래프 구축 |
| GET | `/v1/code-graph/{project_id}/callers/{func}` | 호출자 체인 |
| GET | `/v1/code-graph/{project_id}/callees/{func}` | 피호출 함수 |
| POST | `/v1/code-graph/{project_id}/dangerous-callers` | 위험 함수 호출자 |
| GET | `/v1/code-graph/{project_id}/stats` | 그래프 통계 |
| DELETE | `/v1/code-graph/{project_id}` | 프로젝트 그래프 삭제 |
| GET | `/v1/code-graph` | 등록된 프로젝트 목록 |

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
(:Function {name, file, line, project_id})
```

### 관계 타입

```
(:CWE)-[:RELATED_CAPEC]->(:CAPEC)
(:CWE)-[:RELATED_ATTACK]->(:Attack)
(:CAPEC)-[:RELATED_CWE]->(:CWE)
(:CAPEC)-[:RELATED_ATTACK]->(:Attack)
(:Function)-[:CALLS]->(:Function)
```

---

## 5. 파일 구조

```
services/knowledge-base/
├── app/
│   ├── main.py                    # FastAPI 앱. Qdrant + Neo4j + NvdClient 초기화
│   ├── config.py                  # Settings (neo4j, qdrant, nvd 설정)
│   ├── context.py                 # requestId ContextVar
│   ├── observability.py           # JSON structured logging
│   ├── cve/
│   │   └── nvd_client.py          # NvdClient — NVD API 실시간 조회 + CPE 매칭 + 캐시
│   ├── graphrag/
│   │   ├── knowledge_assembler.py # KnowledgeAssembler — 하이브리드 검색 (리팩토링 완료)
│   │   ├── neo4j_graph.py         # Neo4jGraph — 위협 지식 관계 그래프
│   │   ├── code_graph_service.py  # CodeGraphService — 프로젝트별 함수 호출 그래프
│   │   └── vector_search.py       # VectorSearch — Qdrant 래퍼
│   ├── rag/
│   │   └── threat_search.py       # ThreatSearch — Qdrant 클라이언트
│   └── routers/
│       ├── api.py                 # /v1/search (exclude_ids), /v1/graph/*, /v1/health
│       ├── cve_api.py             # /v1/cve/batch-lookup
│       └── code_graph_api.py      # /v1/code-graph/*
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
└── tests/                         # 36 tests
    ├── test_neo4j_graph.py        # 6 tests
    ├── test_code_graph_service.py # 7 tests
    ├── test_knowledge_assembler.py # 6 tests
    └── test_nvd_client.py         # 17 tests (버전 매칭, 캐시, CPE 추론)
```

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
.venv/bin/python -m pytest tests/ -q  # 36 passed
```

| 테스트 파일 | 건수 | 대상 |
|------------|------|------|
| test_neo4j_graph.py | 6 | Neo4jGraph mock |
| test_code_graph_service.py | 7 | CodeGraphService mock |
| test_knowledge_assembler.py | 6 | 하이브리드 검색, 중복 제거 |
| test_nvd_client.py | 17 | 버전 매칭, 캐시, CPE 추론, 배치 |

---

## 11. 2026-03-19 주요 변경 이력

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
| 기동 스크립트 | Neo4j 자동 기동 포함 |
| S4 CVE 조회 이관 | S4 cve_lookup.py → S5 /v1/cve/batch-lookup으로 대체 완료 |

---

## 12. 참고 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 공통 제약 사항 | `docs/AEGIS.md` | **필독** |
| KB API 계약서 | `docs/api/knowledge-base-api.md` | S2↔S5, S3↔S5 계약 |
| KB 명세서 | `docs/specs/knowledge-base.md` | 기술 스택, 데이터 모델 |
| S3 인수인계서 | `docs/s3-handoff/README.md` | Agent Phase 1/2 맥락 |
| SAST Runner API | `docs/api/sast-runner-api.md` | /v1/libraries, /v1/functions |
