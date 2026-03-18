# S5. Knowledge Base 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S5(Knowledge Base) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-18**

---

## 1. S5의 역할

AEGIS 플랫폼의 **위협 지식 + 코드 구조 그래프**를 관리한다.

```
                     S2 (AEGIS Core :3000)
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST    ★KB★   동적분석
              :8001    :9000   :8002    :4000
```

### 소유

| 항목 | 경로/위치 |
|------|----------|
| 코드 | `services/knowledge-base/` |
| 포트 | :8002 |
| Neo4j | ~/neo4j-community-5.26.3 (localhost:7687/7474) |
| Qdrant | `services/llm-gateway/data/qdrant/` (파일 기반, 심링크) |

### 호출자

| 호출자 | 용도 |
|--------|------|
| **S3 Analysis Agent** | Phase 2에서 `knowledge.search` tool 호출 + Phase 1에서 코드 그래프 적재 |
| **S2 Backend** | (향후) Finding 상세에서 CWE/CVE 관계 조회, 대시보드에서 그래프 통계 |
| **S1 Frontend** | (향후) CWE/CVE 관계 시각화 |

---

## 2. 아키텍처

### 하이브리드 GraphRAG

```
쿼리: "CWE-78 command injection popen"
  │
  ├─ 경로 1: ID 직접 조회 (Neo4j)
  │  "CWE-78" 추출 → 노드 + 이웃 (score=1.0)
  │
  ├─ 경로 2: 그래프 이웃 확장 (Neo4j)
  │  CWE-78의 depth=2 이웃 (score=0.8)
  │
  └─ 경로 3: 시맨틱 검색 (Qdrant)
     임베딩 유사도 (score=가변)
  │
  └─ 병합 + 중복 제거 + 점수 정렬 → 응답
```

### 코드 그래프

```
POST /v1/code-graph/{project_id}/ingest
  │ (SAST Runner /v1/functions 결과를 받아 적재)
  ▼
Neo4j (:Function {name, file, line, project_id})-[:CALLS]->(:Function)
  │
  ├─ GET /callers/{func} → 호출자 체인 (BFS)
  ├─ GET /callees/{func} → 피호출 함수
  └─ POST /dangerous-callers → 위험 함수(popen, getenv 등) 호출자 식별
```

---

## 3. API 엔드포인트

### 위협 지식 검색

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/search` | 하이브리드 검색 (ID exact + graph neighbor + vector) |
| GET | `/v1/graph/stats` | 위협 그래프 통계 (노드/엣지, 소스 분포, 상위 연결) |
| GET | `/v1/graph/neighbors/{node_id}?depth=2` | CWE/CVE/ATT&CK 관계 탐색 |

### 코드 그래프

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/code-graph/{project_id}/ingest` | 함수 목록 → Neo4j 그래프 구축 |
| GET | `/v1/code-graph/{project_id}/stats` | 노드/엣지, 파일 목록 |
| GET | `/v1/code-graph/{project_id}/callers/{func}?depth=2` | 호출자 체인 |
| GET | `/v1/code-graph/{project_id}/callees/{func}` | 피호출 함수 |
| POST | `/v1/code-graph/{project_id}/dangerous-callers` | 위험 함수 호출자 |
| DELETE | `/v1/code-graph/{project_id}` | 프로젝트 그래프 삭제 |
| GET | `/v1/code-graph` | 등록된 프로젝트 목록 |

### 기타

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/v1/health` | 서비스 상태 + Neo4j 연결 + Qdrant 초기화 |

---

## 4. Neo4j 그래프 스키마

### 노드 레이블

```
(:CWE {id, title, source, threat_category, severity, attack_surfaces, automotive_relevance})
(:CVE {id, title, source, threat_category, severity, attack_vector, automotive_relevance})
(:Attack {id, title, source, threat_category, kill_chain_phase, automotive_relevance})
(:CAPEC {id, title, source, threat_category})
(:Function {name, file, line, project_id})
```

### 관계 타입

```
# 위협 지식 (ETL에서 구축, 영속)
(:CWE)-[:RELATED_CVE]->(:CVE)
(:CWE)-[:RELATED_CAPEC]->(:CAPEC)
(:CWE)-[:RELATED_ATTACK]->(:Attack)
(:CVE)-[:RELATED_CWE]->(:CWE)
(:CVE)-[:RELATED_ATTACK]->(:Attack)
(:CAPEC)-[:MAPS_CWE]->(:CWE)
(:CAPEC)-[:MAPS_ATTACK]->(:Attack)

# 코드 그래프 (프로젝트 분석 시, project_id로 구분)
(:Function)-[:CALLS]->(:Function)
```

### 인덱스

```cypher
CREATE INDEX FOR (n:CWE) ON (n.id);
CREATE INDEX FOR (n:CVE) ON (n.id);
CREATE INDEX FOR (n:Attack) ON (n.id);
CREATE INDEX FOR (n:CAPEC) ON (n.id);
CREATE INDEX FOR (n:Function) ON (n.project_id, n.name);
```

### 현재 데이터 규모

| 지표 | 값 |
|------|-----|
| 위협 노드 | 1,857 (CWE 948 + CVE 702 + ATT&CK 207) |
| 위협 관계 | ~4,003 |
| 코드 그래프 (RE100) | 121 노드, 242 엣지, 6 파일 |

---

## 5. 파일 구조

```
services/knowledge-base/
├── app/
│   ├── main.py                    # FastAPI 앱. Neo4j driver + Qdrant + 코드 그래프 초기화
│   ├── config.py                  # Settings (neo4j_uri/user/password, qdrant_path)
│   ├── context.py                 # requestId ContextVar
│   ├── observability.py           # JSON structured logging (observability.md 준수)
│   ├── graphrag/
│   │   ├── neo4j_graph.py         # Neo4jGraph — 위협 지식 관계 그래프 (RelationGraph 인터페이스 호환)
│   │   ├── code_graph_service.py  # CodeGraphService — 프로젝트별 함수 호출 그래프
│   │   ├── knowledge_assembler.py # KnowledgeAssembler — 하이브리드 검색 오케스트레이터
│   │   └── vector_search.py       # VectorSearch — Qdrant 래퍼
│   ├── rag/
│   │   ├── threat_search.py       # ThreatSearch — Qdrant 클라이언트 (search + scroll_all_metadata)
│   │   └── context_enricher.py    # (미사용, S3 Gateway에서 사용)
│   └── routers/
│       ├── api.py                 # /v1/search, /v1/graph/*, /v1/health
│       └── code_graph_api.py      # /v1/code-graph/* (CRUD)
├── scripts/
│   ├── neo4j-seed.py              # Qdrant → Neo4j 마이그레이션 (1회 실행)
│   └── threat-db/                 # ETL 파이프라인 (CWE/NVD/ATT&CK/CAPEC → Qdrant)
│       ├── build.py               # 오케스트레이터 (download → parse → crossref → load)
│       ├── schema.py              # UnifiedThreatRecord, CapecBridge
│       ├── taxonomy.py            # 8개 자동차 공격 표면 분류
│       ├── download.py            # CWE XML, NVD JSON, ATT&CK STIX, CAPEC XML 다운로더
│       ├── parse_cwe.py           # CWE 파서 (944건)
│       ├── parse_nvd.py           # NVD 파서 (702건)
│       ├── parse_attack.py        # ATT&CK ICS STIX 파서 (83건)
│       ├── parse_capec.py         # CAPEC 브릿지 파서
│       ├── crossref.py            # 3방향 교차 참조 엔진
│       ├── load_qdrant.py         # Qdrant 배치 적재
│       └── stats.py               # 통계
├── data/
│   └── qdrant -> ../../../llm-gateway/data/qdrant  # 심링크 (Qdrant 파일 DB)
├── requirements.txt               # fastapi, uvicorn, pydantic, neo4j>=5.20.0, qdrant-client, fastembed
├── .env                           # Neo4j 연결 + Qdrant 경로
└── tests/                         # 19 tests
    ├── test_neo4j_graph.py        # 6 tests (Neo4jGraph mock)
    ├── test_code_graph_service.py # 7 tests (CodeGraphService mock)
    ├── test_knowledge_assembler.py # 6 tests (하이브리드 검색, 중복 제거)
    └── conftest.py
```

---

## 6. 인프라

### Neo4j

| 항목 | 값 |
|------|-----|
| 버전 | Neo4j Community 5.26.3 |
| 설치 경로 | `~/neo4j-community-5.26.3` |
| 데이터 | `~/neo4j-community-5.26.3/data/` |
| Bolt | localhost:7687 |
| HTTP (Browser) | localhost:7474 |
| 인증 | neo4j / smartcar |
| Java | OpenJDK 17 |

```bash
# 기동/중지
$NEO4J_HOME/bin/neo4j start
$NEO4J_HOME/bin/neo4j stop

# Browser로 시각화
# http://localhost:7474 → MATCH (n:CWE {id:"CWE-78"})-[*1..2]-(m) RETURN *
```

### Qdrant

| 항목 | 값 |
|------|-----|
| 타입 | 파일 기반 (서버 프로세스 없음) |
| 경로 | `/home/kosh/smartcar/services/llm-gateway/data/qdrant/` |
| 컬렉션 | `threat_knowledge` |
| 임베딩 모델 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384차원) |
| 레코드 | 1,729건 |

**주의**: 파일 기반 Qdrant는 동시 접근 불가. KB 서비스가 Qdrant를 독점하므로, 다른 서비스(S3 Gateway, Agent)는 RAG를 비활성화해야 함 (`SMARTCAR_RAG_ENABLED=false`).

---

## 7. 환경변수 (.env)

```bash
SMARTCAR_KB_QDRANT_PATH=/home/kosh/smartcar/services/llm-gateway/data/qdrant
SMARTCAR_KB_RAG_TOP_K=5
SMARTCAR_KB_RAG_MIN_SCORE=0.35
SMARTCAR_KB_GRAPH_DEPTH=2
SMARTCAR_KB_NEO4J_URI=bolt://localhost:7687
SMARTCAR_KB_NEO4J_USER=neo4j
SMARTCAR_KB_NEO4J_PASSWORD=smartcar
```

---

## 8. 데이터 적재 방법

### 위협 지식 ETL (1회, Qdrant)

```bash
cd services/knowledge-base
source .venv/bin/activate
pip install -r scripts/threat-db/requirements.txt
python scripts/threat-db/build.py --qdrant-path /home/kosh/smartcar/services/llm-gateway/data/qdrant
```

CWE/NVD/ATT&CK/CAPEC를 공식 소스에서 다운로드 → 파싱 → 교차 참조 → Qdrant 적재. 오프라인 캐시: `services/llm-gateway/data/threat-db-raw/`

### Neo4j 시드 (1회, Qdrant → Neo4j)

```bash
python scripts/neo4j-seed.py --qdrant-path /home/kosh/smartcar/services/llm-gateway/data/qdrant --clear
```

Qdrant 전체 레코드를 스크롤하여 Neo4j에 노드+관계 생성. `--clear`는 기존 위협 노드 삭제 후 재적재.

### 코드 그래프 적재 (프로젝트별, API)

```bash
# SAST Runner에서 함수 추출 후 KB에 적재
curl -X POST http://localhost:8002/v1/code-graph/re100/ingest \
  -H "Content-Type: application/json" \
  --data-binary @functions.json
```

S3 Analysis Agent의 Phase 1이 자동으로 수행하므로, 수동 적재는 보통 불필요.

---

## 9. 실행 방법

```bash
# 사전 조건: Neo4j 실행 중
$NEO4J_HOME/bin/neo4j status  # → running

# KB 서비스 기동 (Qdrant 독점 — 다른 서비스보다 먼저 기동)
cd services/knowledge-base
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8002

# 확인
curl http://localhost:8002/v1/health
# → {"initialized": true, "graph": {"backend": "neo4j", "nodeCount": 1857, "connected": true}}
```

---

## 10. 핵심 코드 설명

### KnowledgeAssembler (`knowledge_assembler.py`)

하이브리드 검색의 핵심. 쿼리에서 ID(CWE-78 등)를 정규식으로 추출하여 3경로 병합:

```python
def assemble(self, query, *, top_k=5, min_score=0.35, graph_depth=2):
    # 경로 1: ID 직접 조회 (Neo4j) — score=1.0
    extracted_ids = _extract_ids(query)  # "CWE-78" → ["CWE-78"]
    for eid in extracted_ids:
        node_info = self._graph.get_node_info(eid)
        neighbors = self._graph.neighbors(eid, depth=2)  # score=0.8

    # 경로 2: 시맨틱 검색 (Qdrant) — score=가변
    vector_hits = self._vector.search(query, top_k, min_score)

    # 병합 + 중복 제거 + 점수 정렬
    return {"hits": [...], "related_cwe": [...], "related_cve": [...]}
```

### Neo4jGraph (`neo4j_graph.py`)

`RelationGraph`(NetworkX, 삭제됨)와 동일한 인터페이스(duck typing). `KnowledgeAssembler`가 변경 없이 사용.

- `load_from_records(records)` — Qdrant 메타데이터 → Neo4j 배치 생성
- `neighbors(node_id, depth)` — Cypher BFS
- `get_related(node_id)` — 관계 타입별 그룹핑
- `get_node_info(node_id)` — 노드 속성

### CodeGraphService (`code_graph_service.py`)

프로젝트별 `:Function` 노드 + `:CALLS` 관계를 Neo4j에서 관리.

- `ingest(project_id, functions)` — 기존 삭제 → 노드/관계 배치 생성
- `get_callers(project_id, func, depth)` — 역방향 BFS
- `find_dangerous_callers(project_id, dangerous_functions)` — 위험 API 호출자 식별

---

## 11. 테스트

```bash
cd services/knowledge-base
source .venv/bin/activate
pytest tests/ -q  # 19 passed
```

모든 테스트는 Neo4j 드라이버를 mock하여 실행 — Neo4j 미설치 환경에서도 통과.

---

## 12. 로깅

| 파일 | 내용 |
|------|------|
| `logs/smartcar-knowledge-base.jsonl` | 검색 요청(query, hits, latencyMs), 코드 그래프 적재, Neo4j 연결 |

JSON structured logging (observability.md 준수). `X-Request-Id` 헤더로 교차 서비스 추적.

---

## 13. 알려진 이슈

| 이슈 | 상태 | 비고 |
|------|------|------|
| Qdrant 동시 접근 불가 | 운영 중 | KB가 독점. 다른 서비스 RAG off |
| Qdrant 경로 심링크 | 운영 중 | `.env`에 절대 경로 사용으로 해결 |
| Neo4j Community (클러스터 불가) | 알려진 한계 | 단일 인스턴스, HA 불가 |
| 코드 그래프 대량 적재 시 Neo4j 성능 | 미검증 | RE100 121노드는 문제 없음, 대규모 프로젝트 미테스트 |

---

## 14. 향후 과제

| 과제 | 우선순위 |
|------|----------|
| `docs/specs/knowledge-base.md` 작성 | 높음 |
| `docs/api/knowledge-base-api.md` 작성 | 높음 |
| Qdrant → 서버 모드 전환 (동시 접근 해결) | 중간 |
| 위협 지식 자동 갱신 (NVD 주기 크롤링) | 낮음 |
| 코드 그래프 ↔ 위협 지식 교차 쿼리 API | 중간 |

---

## 15. 참고 문서

| 문서 | 경로 | 용도 |
|------|------|------|
| 공통 제약 사항 | `docs/AEGIS.md` | **필독** |
| S3 인수인계서 | `docs/s3-handoff/README.md` | KB 구축 배경, Phase 1/2 맥락 |
| S4 인수인계서 | `docs/s4-handoff/README.md` | SAST Runner /v1/functions 출력 형식 |
| SAST Runner API | `docs/api/sast-runner-api.md` | 코드 그래프 데이터 소스 |
| ETL 스키마 | `services/knowledge-base/scripts/threat-db/schema.py` | UnifiedThreatRecord 모델 |
