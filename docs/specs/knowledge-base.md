# Knowledge Base 명세서

> **소유자**: S5
> **최종 업데이트**: 2026-04-04

---

## 1. 서비스 개요

AEGIS 플랫폼의 **위협 지식 그래프 + 코드 구조 그래프 + 실시간 CVE 조회**를 관리하는 서비스.

- **위협 지식**: CWE, CVE/NVD, ATT&CK ICS, CAPEC 데이터를 Neo4j 관계 그래프 + Qdrant 벡터 DB로 이중 관리
- **코드 그래프**: SAST Runner가 추출한 함수 호출 관계를 Neo4j에 적재, 호출자 체인·위험 함수 식별 제공
- **하이브리드 검색**: ID 정확 매칭 + 그래프 이웃 확장 + 벡터 시맨틱 검색을 RRF 점수 융합으로 병합
- **프로젝트 메모리**: 에이전트 분석 이력, false positive, 수정 확인, 사용자 선호를 Neo4j에 저장

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

### 3.2 소스코드 GraphRAG

```
POST /v1/code-graph/{project_id}/ingest
  │ (SAST Runner /v1/functions 결과)
  ▼
Neo4j (:Function)-[:CALLS]->(:Function)  +  Qdrant code_functions (벡터 임베딩)
  │
  ├─ search (신규)     → 하이브리드: 함수명 exact + 벡터 시맨틱 + 그래프 확장 + RRF
  ├─ callers/{func}    → 역방향 BFS (호출자 체인)
  ├─ callees/{func}    → 순방향 1-hop (피호출 함수)
  └─ dangerous-callers → 위험 API(popen, system 등) 호출자 식별
```

### 3.3 모듈 구조

```
app/
├── main.py                       # FastAPI 앱, lifespan (Qdrant→Neo4j→Assembler 조립)
├── errors.py                     # observability.md 에러 포맷 헬퍼
├── config.py                     # Settings (env_prefix: AEGIS_KB_)
├── context.py                    # X-Request-Id ContextVar
├── observability.py              # JSON structured logging
├── timeout.py                    # X-Timeout-Ms 헤더 파싱 + 데드라인 체크
├── graphrag/
│   ├── knowledge_assembler.py    # 위협 하이브리드 검색 + RRF + 배치
│   ├── neo4j_graph.py            # Neo4j 위협 지식 그래프
│   ├── code_graph_service.py     # 프로젝트별 코드 호출 그래프 + origin
│   ├── code_vector_search.py     # 코드 함수 Qdrant 벡터 적재/검색 (code_functions 컬렉션)
│   ├── code_graph_assembler.py   # 코드 그래프 하이브리드 검색 (name_exact + vector + graph + RRF)
│   ├── project_memory_service.py # 프로젝트별 에이전트 메모리
│   └── vector_search.py          # 위협 Qdrant 래퍼 + source_filter
├── rag/
│   └── threat_search.py          # Qdrant 클라이언트 (search + scroll)
└── routers/
    ├── api.py                    # /v1/search, /v1/search/batch, /v1/graph/*, /v1/health, /v1/ready
    ├── cve_api.py                # /v1/cve/batch-lookup
    ├── code_graph_api.py         # /v1/code-graph/*
    └── project_memory_api.py     # /v1/project-memory/*
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
| `:Function` | name, file, line, project_id, origin?, original_lib?, original_version?, build_snapshot_id?, build_unit_id?, source_build_attempt_id? | 코드 함수 (프로젝트별, provenance seam 포함) |
| `:Project` | id | 프로젝트 (메모리 루트) |
| `:Memory` | id, type, data, createdAt, content_hash, expiresAt?, build_snapshot_id?, build_unit_id?, source_build_attempt_id? | 에이전트 메모리 (analysis_history, false_positive, resolved, preference + provenance seam) |
| `:KBMeta` | id, build_timestamp, cwe_version, attack_ics_version, attack_enterprise_version, capec_version, total_records, seed_timestamp | Ontology 버전 추적 |

**관계 타입:**

| 관계 | 소스 → 대상 | 용도 |
|------|------------|------|
| `RELATED_ATTACK` | CWE → Attack | ATT&CK 기법 연결 |
| `RELATED_CAPEC` | CWE → CAPEC | CAPEC 공격 패턴 |
| `RELATED_CWE` | CAPEC → CWE | CAPEC→CWE 매핑 |
| `RELATED_ATTACK` | CAPEC → Attack | CAPEC→ATT&CK 매핑 |
| `CALLS` | Function → Function | 함수 호출 관계 |
| `HAS_MEMORY` | Project → Memory | 프로젝트 메모리 |

**인덱스:**

```cypher
CREATE INDEX FOR (n:CWE) ON (n.id);
CREATE INDEX FOR (n:CVE) ON (n.id);
CREATE INDEX FOR (n:Attack) ON (n.id);
CREATE INDEX FOR (n:CAPEC) ON (n.id);
CREATE INDEX FOR (n:Function) ON (n.project_id, n.name);
CREATE INDEX FOR (n:Project) ON (n.id);
CREATE INDEX FOR (n:Memory) ON (n.id);
CREATE INDEX FOR (n:KBMeta) ON (n.id);
CREATE INDEX FOR (n:Memory) ON (n.content_hash);
```

### 4.2 Qdrant 벡터 DB

| 컬렉션 | 임베딩 모델 | 차원 | 내용 | 생명주기 |
|--------|------------|------|------|---------|
| `threat_knowledge` | paraphrase-multilingual-MiniLM-L12-v2 | 384 | CWE/ATT&CK/CAPEC (2,011건) | 정적 (ETL) |
| `code_functions` | (동일 모델 공유) | 384 | 프로젝트별 함수 메타데이터 | 프로젝트 ingest/delete 시 동적 |

저장 방식: 파일 기반 (서버 프로세스 없음). 단일 QdrantClient 인스턴스가 두 컬렉션을 모두 관리.

### 4.3 현재 데이터 규모

| 지표 | 값 |
|------|-----|
| 위협 노드 | 2,196 (CWE 944 + ATT&CK 694 + CAPEC 558) |
| 위협 관계 | 9,298 |
| CVE | ETL에서 제거됨 — `POST /v1/cve/batch-lookup`으로 실시간 조회 |

> **참고**: Neo4j 위협 노드(2,196)와 Qdrant 레코드(2,011)의 차이는 Neo4j 시드 시 교차 참조 대상이 추가 노드로 생성되기 때문이다. Qdrant의 2,011건이 ETL 원본(`kb-meta.json`) 기준.

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
| `AEGIS_KB_QDRANT_PATH` | `data/qdrant` | Qdrant 파일 스토리지 경로 (file 모드) |
| `AEGIS_KB_QDRANT_URL` | (없음) | Qdrant 서버 URL (server 모드). 설정 시 path 대신 사용 |
| `AEGIS_KB_QDRANT_API_KEY` | (없음) | Qdrant 서버 인증 키 (server 모드) |
| `AEGIS_KB_RAG_TOP_K` | 5 | 검색 기본 반환 건수 |
| `AEGIS_KB_RAG_MIN_SCORE` | 0.35 | 벡터 검색 최소 유사도 |
| `AEGIS_KB_GRAPH_DEPTH` | 2 | 그래프 이웃 탐색 기본 깊이 |
| `AEGIS_KB_NEO4J_URI` | `bolt://localhost:7687` | Neo4j Bolt URI |
| `AEGIS_KB_NEO4J_USER` | `neo4j` | Neo4j 사용자 |
| `AEGIS_KB_NEO4J_PASSWORD` | `aegis-kb` | Neo4j 비밀번호 |
| `AEGIS_KB_NVD_API_KEY` | (없음) | NVD API 키 (실시간 CVE 조회용) |
| `AEGIS_KB_NVD_CACHE_TTL` | 86400 | CVE 캐시 TTL (초) |
| `AEGIS_KB_NVD_CACHE_FILE` | `data/cve-cache.json` | CVE 캐시 영속화 파일 경로 |
| `AEGIS_KB_NVD_BATCH_CONCURRENCY` | 5 | CVE 배치 병렬 조회 동시 실행 수 |
| `AEGIS_KB_EPSS_ENABLED` | true | EPSS 악용 확률 보강 on/off |
| `AEGIS_KB_KEV_TTL` | 3600 | CISA KEV 카탈로그 캐시 TTL (초) |
| `AEGIS_KB_RRF_K` | 60 | RRF 상수 (0=비활성) |
| `AEGIS_KB_MEMORY_LIMIT_PER_PROJECT` | 1000 | 프로젝트당 메모리 한도 |

---

## 8. Observability

- **로그**: `logs/aegis-knowledge-base.jsonl` (JSON structured, `docs/specs/observability.md` 준수)
- **service 식별자**: `s5-kb`
- **level**: 숫자 (pino 표준: 30=info, 40=warn, 50=error)
- **X-Request-Id**: 수신 시 ContextVar에 저장 → 로그에 포함 + 응답 헤더에 반환
- **Health/Ready**: `GET /v1/health` (liveness), `GET /v1/ready` (readiness + ontology 메타)

---

## 9. 테스트

```bash
cd services/knowledge-base
.venv/bin/python -m pytest tests/ -q  # 161 passed (2026-04-04 확인)
```

모든 테스트는 Neo4j 드라이버를 mock하여 실행 — Neo4j/Qdrant 미설치 환경에서도 통과.

| 테스트 파일 | 건수 | 대상 |
|------------|------|------|
| `test_neo4j_graph.py` | 7 | Neo4jGraph (노드/엣지 카운트, 이웃, 관계, 노드 조회, edgeTypes) |
| `test_code_graph_service.py` | 16 | CodeGraphService (적재, 호출자/피호출, 위험함수, 프로젝트 관리, origin, get_function, provenance seam) |
| `test_code_vector_search.py` | 12 | CodeVectorSearch (_build_document, ingest, search, delete, provenance metadata/filter) |
| `test_code_graph_assembler.py` | 10 | CodeGraphAssembler (빈 쿼리, name_exact, vector, RRF, call_chain, buildSnapshotId filter) |
| `test_knowledge_assembler.py` | 15 | 위협 하이브리드 검색, 중복 제거, 소스 필터링, 배치, RRF |
| `test_nvd_client.py` | 37 | 버전 매칭, 캐시, CPE 추론, 배치 병렬, EPSS, KEV, risk_score, KB 보강, 캐시 영속화 |
| `test_project_memory_service.py` | 22 | 메모리 CRUD, 타입 검증, JSON 손상 처리, lifecycle, 센티넬, 마이그레이션, provenance seam |
| `test_api_error_responses.py` | 15 | 에러 포맷, health/ready, threat-search readiness hardening |
| `test_qdrant_modes.py` | 5 | Qdrant file/server 듀얼 모드 초기화 |
| `test_benchmark_metrics.py` | 15 | 벤치마크 메트릭 (P@k, R@k, NDCG, MRR, hit rate) |
| `test_benchmark_artifacts.py` | 7 | validation set shape/coverage + sweep summary + compare/oracle summary |

### 벤치마크 비교 명령

```bash
cd services/knowledge-base
.venv/bin/python scripts/benchmark/run_benchmark.py --qdrant-path data/qdrant --compare-neo4j --output /tmp/s5-graph-compare.json
```

2026-04-04 기준 비교 결과:
- Qdrant-only: `ndcg_5=0.4048`, `mrr=0.4636`, `hit_rate=0.7442`
- Neo4j-enabled: `ndcg_5=0.6111`, `mrr=0.7399`, `hit_rate=0.9070`
- `ndcg_5` 기준 uplift가 확인된 query: **14 / 43**
- graph-aware oracle(`required_match_types`) 기준 full-pass는 **Qdrant-only 0/6** vs **Neo4j-enabled 6/6**

### readiness / provenance 메모

- threat search는 이제 **Qdrant + Neo4j 모두 필요**하다. Neo4j 없으면 `/v1/search`, `/v1/search/batch`, `/v1/ready`는 `503 KB_NOT_READY`.
- code graph / project memory는 선택적으로 `buildSnapshotId`, `buildUnitId`, `sourceBuildAttemptId`를 수용한다.
- 현재 code graph는 **프로젝트당 활성 그래프 1개**를 유지하며, provenance는 multi-snapshot 동시 보존이 아니라 future 확장을 위한 seam이다.

---

## 10. 알려진 제약

| 제약 | 영향 | 비고 |
|------|------|------|
| Qdrant 파일 기반 동시 접근 불가 | KB 독점, 다른 서비스는 REST API 경유 | `AEGIS_KB_QDRANT_URL` 설정으로 서버 모드 전환 가능 |
| Neo4j Community (클러스터 불가) | 단일 인스턴스, HA 불가 | 현재 개발 환경에서는 문제 없음 |
| 코드 그래프 대규모 적재 미검증 | RE100(390노드, origin 포함)은 정상, 대규모 프로젝트 미테스트 | |
