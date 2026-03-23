# Knowledge Base 명세서

> **소유자**: S5
> **최종 업데이트**: 2026-03-20

---

## 1. 서비스 개요

AEGIS 플랫폼의 **위협 지식 그래프 + 코드 구조 그래프 + 실시간 CVE 조회**를 관리하는 서비스.

- **위협 지식**: CWE, CVE/NVD, ATT&CK ICS, CAPEC 데이터를 Neo4j 관계 그래프 + Qdrant 벡터 DB로 이중 관리
- **코드 그래프**: SAST Runner가 추출한 함수 호출 관계를 Neo4j에 적재, 호출자 체인·위험 함수 식별 제공
- **하이브리드 검색**: ID 정확 매칭 + 그래프 이웃 확장 + 벡터 시맨틱 검색을 병합하여 최적의 위협 컨텍스트 반환

---

## 2. 기술 스택

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Python | 3.12 |
| 프레임워크 | FastAPI | 0.115.0 |
| ASGI 서버 | uvicorn | 0.30.0 |
| 그래프 DB | Neo4j Community | 5.26.3 |
| 벡터 DB | Qdrant (파일 기반) | >= 1.12.0 |
| 임베딩 | fastembed (sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) | >= 0.4.0 |
| Neo4j 드라이버 | neo4j-python | >= 5.20.0 |
| 설정 | pydantic-settings | 2.5.0 |

---

## 3. 아키텍처

### 3.1 하이브리드 GraphRAG

```
쿼리: "CWE-78 command injection popen"
  │
  ├─ 경로 1: ID 직접 조회 (Neo4j)
  │  정규식으로 "CWE-78" 추출 → 노드 속성 + 관계 조회 (score=1.0)
  │  → 이웃 노드 depth=2 확장 (score=0.8)
  │
  ├─ 경로 2: 벡터 시맨틱 검색 (Qdrant)
  │  fastembed 임베딩 → 코사인 유사도 (score=가변)
  │
  └─ 병합 + 중복 제거 + 점수 내림차순 정렬 → 응답
```

### 3.2 코드 그래프

```
POST /v1/code-graph/{project_id}/ingest
  │ (SAST Runner /v1/functions 결과)
  ▼
Neo4j (:Function {name, file, line, project_id})-[:CALLS]->(:Function)
  │
  ├─ callers/{func}    → 역방향 BFS (호출자 체인)
  ├─ callees/{func}    → 순방향 1-hop (피호출 함수)
  └─ dangerous-callers → 위험 API(popen, system 등) 호출자 식별
```

### 3.3 모듈 구조

```
app/
├── main.py                       # FastAPI 앱, lifespan (Qdrant→Neo4j→Assembler 조립)
├── config.py                     # Settings (env_prefix: AEGIS_KB_)
├── context.py                    # X-Request-Id ContextVar
├── observability.py              # JSON structured logging
├── graphrag/
│   ├── knowledge_assembler.py    # 하이브리드 검색 오케스트레이터
│   ├── neo4j_graph.py            # Neo4j 위협 지식 그래프 (RelationGraph 호환)
│   ├── code_graph_service.py     # 프로젝트별 코드 호출 그래프
│   └── vector_search.py          # Qdrant 래퍼
├── rag/
│   └── threat_search.py          # Qdrant 클라이언트 (search + scroll)
└── routers/
    ├── api.py                    # /v1/search, /v1/graph/*, /v1/health
    └── code_graph_api.py         # /v1/code-graph/* CRUD
```

---

## 4. 데이터 모델

### 4.1 Neo4j 그래프 스키마

**노드 레이블:**

| 레이블 | 주요 속성 | 용도 |
|--------|----------|------|
| `:CWE` | id, title, source, threat_category, severity, attack_surfaces, automotive_relevance | CWE 취약점 |
| `:Attack` | id, title, source, threat_category, kill_chain_phase, automotive_relevance | ATT&CK 기법 (ICS + Enterprise) |
| `:CAPEC` | id, title, source, threat_category, severity, automotive_relevance | CAPEC 공격 패턴 (풀 노드) |
| `:Function` | name, file, line, project_id | 코드 함수 (프로젝트별) |

**관계 타입:**

| 관계 | 소스 → 대상 | 용도 |
|------|------------|------|
| `RELATED_ATTACK` | CWE → Attack | ATT&CK 기법 연결 |
| `RELATED_CAPEC` | CWE → CAPEC | CAPEC 공격 패턴 |
| `RELATED_CWE` | CAPEC → CWE | CAPEC→CWE 매핑 |
| `RELATED_ATTACK` | CAPEC → Attack | CAPEC→ATT&CK 매핑 |
| `CALLS` | Function → Function | 함수 호출 관계 |

**인덱스:**

```cypher
CREATE INDEX FOR (n:CWE) ON (n.id);
CREATE INDEX FOR (n:CVE) ON (n.id);
CREATE INDEX FOR (n:Attack) ON (n.id);
CREATE INDEX FOR (n:CAPEC) ON (n.id);
CREATE INDEX FOR (n:Function) ON (n.project_id, n.name);
```

### 4.2 Qdrant 벡터 DB

| 항목 | 값 |
|------|-----|
| 컬렉션 | `threat_knowledge` |
| 임베딩 모델 | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| 차원 | 384 |
| 레코드 수 | 2,011건 (CWE 944 + ATT&CK 509 + CAPEC 558) |
| 저장 방식 | 파일 기반 (서버 프로세스 없음) |

### 4.3 현재 데이터 규모

| 지표 | 값 |
|------|-----|
| 위협 노드 | 2,196 (CWE 944 + ATT&CK 694 + CAPEC 558) |
| 위협 관계 | 3,542 |
| CVE | ETL에서 제거됨 — `POST /v1/cve/batch-lookup`으로 실시간 조회 |

---

## 5. ETL 파이프라인

### 데이터 소스

| 소스 | 형식 | URL | 건수 |
|------|------|-----|------|
| CWE | XML (ZIP) | cwe.mitre.org | 944건 |
| ATT&CK | STIX 2.1 JSON | github.com/mitre-attack | 509건 (ICS 83 + Enterprise 426) |
| CAPEC | XML | capec.mitre.org | 558건 (풀 노드) |
| ~~CVE/NVD~~ | — | — | ETL에서 제거. `POST /v1/cve/batch-lookup`으로 실시간 조회 |

### 실행 절차

```bash
cd services/knowledge-base
source .venv/bin/activate

# 1. Qdrant 적재 (ETL)
python scripts/threat-db/build.py --qdrant-path data/qdrant

# 2. Neo4j 시드 (Qdrant → Neo4j)
python scripts/neo4j-seed.py --qdrant-path data/qdrant --clear
```

### 자동차 관련성 분류

ETL에서 11개 공격 표면으로 분류 (`scripts/threat-db/taxonomy.py`):
- 자동차 8개: CAN Bus, IVI/헤드유닛, V2X/텔레매틱스, OTA/펌웨어, ECU/게이트웨이, 키/인증, ADAS, 충전 인프라
- 임베디드/시스템 3개: 임베디드/RTOS, 시스템 라이브러리, 산업제어/ICS

---

## 6. 인프라

### Neo4j

| 항목 | 값 |
|------|-----|
| 버전 | Neo4j Community 5.26.3 |
| Bolt | localhost:7687 |
| HTTP (Browser) | localhost:7474 |
| 인증 | neo4j / aegis-kb |

### Qdrant

| 항목 | 값 |
|------|-----|
| 타입 | 파일 기반 (동시 접근 불가) |
| 경로 | `services/knowledge-base/data/qdrant/` |

**제약**: 파일 기반 Qdrant는 단일 프로세스만 접근 가능. KB 서비스가 독점하며, 다른 서비스는 KB REST API를 통해 검색 기능을 사용한다.

---

## 7. 설정

환경변수 prefix: `AEGIS_KB_`

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `AEGIS_KB_QDRANT_PATH` | `data/qdrant` | Qdrant 파일 스토리지 경로 |
| `AEGIS_KB_RAG_TOP_K` | 5 | 검색 기본 반환 건수 |
| `AEGIS_KB_RAG_MIN_SCORE` | 0.35 | 벡터 검색 최소 유사도 |
| `AEGIS_KB_GRAPH_DEPTH` | 2 | 그래프 이웃 탐색 기본 깊이 |
| `AEGIS_KB_NEO4J_URI` | `bolt://localhost:7687` | Neo4j Bolt URI |
| `AEGIS_KB_NEO4J_USER` | `neo4j` | Neo4j 사용자 |
| `AEGIS_KB_NEO4J_PASSWORD` | `aegis-kb` | Neo4j 비밀번호 |
| `AEGIS_KB_NVD_API_KEY` | (없음) | NVD API 키 (실시간 CVE 조회용) |
| `AEGIS_KB_NVD_CACHE_TTL` | 86400 | CVE 캐시 TTL (초) |

---

## 8. Observability

- **로그**: `logs/aegis-knowledge-base.jsonl` (JSON structured, observability.md 준수)
- **X-Request-Id**: 수신 시 ContextVar에 저장, 로그에 포함
- **Health**: `GET /v1/health` — Qdrant 초기화 상태, Neo4j 연결 상태, 노드/엣지 수

---

## 9. 테스트

```bash
cd services/knowledge-base
.venv/bin/python -m pytest tests/ -q  # 54 passed (2026-03-20 확인)
```

모든 테스트는 Neo4j 드라이버를 mock하여 실행 — Neo4j/Qdrant 미설치 환경에서도 통과.

| 테스트 파일 | 건수 | 대상 |
|------------|------|------|
| `test_neo4j_graph.py` | 6 | Neo4jGraph (노드/엣지 카운트, 이웃, 관계, 노드 조회) |
| `test_code_graph_service.py` | 7 | CodeGraphService (적재, 호출자/피호출, 위험함수, 프로젝트 관리) |
| `test_knowledge_assembler.py` | 15 | 하이브리드 검색, 중복 제거, 소스 필터링, 배치, RRF |
| `test_nvd_client.py` | 26 | 버전 매칭, 캐시, CPE 추론, 배치 병렬, EPSS, KEV |

---

## 10. 알려진 제약

| 제약 | 영향 | 비고 |
|------|------|------|
| Qdrant 파일 기반 동시 접근 불가 | KB 독점, 다른 서비스는 REST API 경유 | 서버 모드 전환으로 해결 가능 |
| Neo4j Community (클러스터 불가) | 단일 인스턴스, HA 불가 | 현재 개발 환경에서는 문제 없음 |
| 코드 그래프 대규모 적재 미검증 | RE100(121노드)은 정상, 대규모 프로젝트 미테스트 | |
