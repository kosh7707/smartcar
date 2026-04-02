# S5 Knowledge Base — 아키텍처 상세

> README.md에서 분리된 기술 상세 문서.

---

## 1. Neo4j 그래프 스키마

### 노드 레이블

```
(:CWE {id, title, source, threat_category, severity, attack_surfaces, automotive_relevance})
(:Attack {id, title, source, threat_category, kill_chain_phase, automotive_relevance})
(:CAPEC {id, title, source, threat_category, severity, automotive_relevance})
(:Function {name, file, line, project_id, origin?, original_lib?, original_version?})
```

```
(:Project {id})
(:Memory {id, type, data, createdAt, content_hash, expiresAt?})
(:KBMeta {id, build_timestamp, cwe_version, attack_ics_version, ...})
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

## 2. 파일 구조

```
services/knowledge-base/
├── app/
│   ├── main.py                    # FastAPI 앱. Qdrant + Neo4j + NvdClient 초기화 + NullGraph 폴백 + global HTTPException handler
│   ├── errors.py                  # observability.md 에러 포맷 헬퍼
│   ├── config.py                  # Settings (neo4j, qdrant, nvd 설정)
│   ├── context.py                 # requestId ContextVar
│   ├── observability.py           # JSON structured logging
│   ├── timeout.py                # X-Timeout-Ms 헤더 파싱 + 데드라인 체크
│   ├── cve/
│   │   └── nvd_client.py          # NvdClient — NVD API 실시간 조회 + KB 보강 + risk_score + 캐시 영속화
│   ├── graphrag/
│   │   ├── knowledge_assembler.py    # KnowledgeAssembler — 위협 하이브리드 검색 + RRF + 배치
│   │   ├── neo4j_graph.py            # Neo4jGraph — 위협 지식 관계 그래프
│   │   ├── code_graph_service.py     # CodeGraphService — 프로젝트별 함수 호출 그래프 + origin
│   │   ├── code_vector_search.py     # CodeVectorSearch — 코드 함수 Qdrant 벡터 적재/검색
│   │   ├── code_graph_assembler.py   # CodeGraphAssembler — 코드 그래프 하이브리드 검색 + RRF
│   │   ├── project_memory_service.py # ProjectMemoryService — 프로젝트별 에이전트 메모리
│   │   └── vector_search.py          # VectorSearch — 위협 Qdrant 래퍼 + source_filter
│   ├── rag/
│   │   └── threat_search.py       # ThreatSearch — Qdrant 클라이언트 + get_by_id()
│   └── routers/
│       ├── api.py                    # /v1/search, /v1/search/batch, /v1/graph/*, /v1/health, /v1/ready
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
│   ├── cve-cache.json             # CVE 캐시 영속화 파일
│   └── threat-db-raw/             # ETL 다운로드 캐시
├── requirements.txt               # fastapi, uvicorn, pydantic, neo4j, qdrant-client, fastembed, httpx
├── .env                           # Neo4j + Qdrant + NVD API 키
└── tests/                              # 115 tests
    ├── test_neo4j_graph.py             # 7 tests
    ├── test_code_graph_service.py      # 12 tests
    ├── test_code_vector_search.py      # 11 tests
    ├── test_code_graph_assembler.py    # 9 tests
    ├── test_knowledge_assembler.py     # 15 tests
    ├── test_nvd_client.py              # 37 tests
    ├── test_project_memory_service.py  # 14 tests
    └── test_api_error_responses.py     # 10 tests
```

---

## 3. 환경변수 (.env)

```bash
AEGIS_KB_QDRANT_PATH=/home/kosh/AEGIS/services/knowledge-base/data/qdrant
# AEGIS_KB_QDRANT_URL=http://localhost:6333    # 서버 모드 시 설정 (qdrant_path 대신 사용)
# AEGIS_KB_QDRANT_API_KEY=                     # 서버 인증 시 설정
AEGIS_KB_RAG_TOP_K=5
AEGIS_KB_RAG_MIN_SCORE=0.35
AEGIS_KB_GRAPH_DEPTH=2
AEGIS_KB_NEO4J_URI=bolt://localhost:7687
AEGIS_KB_NEO4J_USER=neo4j
AEGIS_KB_NEO4J_PASSWORD=aegis-kb
AEGIS_KB_NVD_API_KEY=<NVD API 키>
AEGIS_KB_NVD_CACHE_TTL=86400
AEGIS_KB_NVD_CACHE_FILE=data/cve-cache.json
NVD_API_KEY=<NVD API 키 (ETL용)>
```

### Qdrant 연결 모드

| 모드 | 설정 | 용도 | 제약 |
|------|------|------|------|
| **file** (기본) | `AEGIS_KB_QDRANT_PATH` | 개발/단일 프로세스 | 단일 프로세스만 접근 가능. ETL `--fresh` 시 서비스 중지 필요 |
| **server** | `AEGIS_KB_QDRANT_URL` | 운영/다중 프로세스 | Qdrant 서버 별도 기동 필요. 무중단 ETL 가능 |

`AEGIS_KB_QDRANT_URL`이 설정되면 서버 모드 우선. 미설정 시 `AEGIS_KB_QDRANT_PATH` (파일 모드).

### Degraded Mode

Neo4j 미연결 + Qdrant 정상 시 **degraded mode**로 동작:
- 벡터 검색은 정상 작동 (Qdrant)
- 그래프 보강(이웃 확장, 관계 조회)은 비활성
- 검색 응답에 `"degraded": true` 포함 → 호출자가 결과 품질 저하를 인식
- `/v1/ready`는 여전히 503 반환 (완전한 readiness가 아님)

---

## 4. 데이터 적재

### ETL (CWE + ATT&CK + CAPEC)

```bash
# 기본 (Qdrant 적재만)
./scripts/knowledge-base/etl-build.sh

# Qdrant + Neo4j 시드
./scripts/knowledge-base/etl-build.sh --seed

# 캐시 삭제 후 전체 재빌드
./scripts/knowledge-base/etl-build.sh --fresh --seed
```

CVE/NVD는 ETL에서 제외됨 — 프로젝트 분석 시 `POST /v1/cve/batch-lookup`으로 실시간 조회.

---

## 5. Observability

`docs/specs/observability.md` 준수. 로그 레벨 숫자 표준, 서비스 식별자, X-Request-Id 전파 규칙은 해당 문서 참조.
- service 식별자: `s5-kb`
- 로그 파일: `logs/aegis-knowledge-base.jsonl`
- 응답 헤더에 `X-Request-Id` 반환 (`_RequestIdMiddleware`)
