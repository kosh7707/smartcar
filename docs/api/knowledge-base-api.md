# Knowledge Base API 계약서

> **소유자**: S5 (Knowledge Base)
> **포트**: 8002
> **호출자**: S2 (Backend), S3 (Analysis Agent)
> **최종 업데이트**: 2026-03-27 (CVE 응답 확장: risk_score, kb_context 필드 추가)

---

## 공통 사항

### Base URL

```
http://localhost:8002/v1
```

### 헤더

| 헤더 | 필수 | 설명 |
|------|------|------|
| `Content-Type` | POST 요청 시 필수 | `application/json` |
| `X-Request-Id` | 선택 | 교차 서비스 추적용. 전파하면 로그에 포함됨. **응답 헤더에도 동일한 값 반환** |
| `X-Timeout-Ms` | **POST 필수** | 클라이언트 타임아웃 (밀리초). 양의 정수. 누락 시 **400 반환**. 서버가 데드라인 초과 시 **408 반환** |

### 호출자-실행자 경계

**호출자(S3)는 "무엇을(what)" 지정, S5는 "어떻게(how)" 결정.**

- 호출자가 지정: `X-Request-Id`, `X-Timeout-Ms`, `project_id`, `query`, `libraries`, `functions`
- S5 자율 (생략 시 기본값 적용): `top_k`, `min_score`, `graph_depth`, `include_call_chain` 등

호출자는 특별한 이유가 없으면 기본값 파라미터를 생략하고 S5의 기본값에 위임한다.

### 인증

없음. 내부 서비스 간 통신 전용.

### 에러 응답

모든 엔드포인트는 observability.md 준수 에러 포맷을 반환합니다.

```json
{
  "success": false,
  "error": "에러 요약 메시지",
  "errorDetail": {
    "code": "KB_NOT_READY",
    "message": "상세 설명",
    "requestId": "req-xxxx",
    "retryable": true
  }
}
```

| 에러 코드 | HTTP | 설명 |
|-----------|------|------|
| `KB_NOT_READY` | 503 | KB 또는 Neo4j 미초기화 |
| `NOT_FOUND` | 404 | 요청한 리소스 없음 |
| `BAD_REQUEST` | 400 | 필수 헤더 누락 (X-Timeout-Ms 등) |
| `INVALID_INPUT` | 422 | 요청 스키마 불일치 |
| `TIMEOUT` | 408 | 클라이언트 지정 데드라인 초과 |
| `CONFLICT` | 409 | 충돌 (중복, 한도 초과 등) |

### X-Timeout-Ms 권장값

모든 POST 엔드포인트에서 `X-Timeout-Ms` 헤더가 필수입니다. 서버는 처리 단계 사이 체크포인트에서 데드라인을 확인하며, 초과 시 408을 반환합니다.

| 엔드포인트 | 소규모 | 대규모 (~3,000함수/20쿼리) |
|-----------|--------|--------------------------|
| `POST /v1/search` | 10,000 | 10,000 |
| `POST /v1/search/batch` | 10,000 | 30,000 |
| `POST /v1/code-graph/*/ingest` | 15,000 | 90,000 |
| `POST /v1/code-graph/*/search` | 10,000 | 10,000 |
| `POST /v1/code-graph/*/dangerous-callers` | 10,000 | 10,000 |
| `POST /v1/cve/batch-lookup` | 30,000 | 30,000 |

---

## 위협 지식 검색

### POST /v1/search

하이브리드 검색: ID 직접 조회(Neo4j) + 그래프 이웃 확장 + 벡터 시맨틱 검색(Qdrant).

#### 요청

```json
{
  "query": "CWE-78 command injection popen",
  "top_k": 5,
  "min_score": 0.35,
  "graph_depth": 2,
  "source_filter": ["CWE"]
}
```

| 필드 | 타입 | 기본값 | 범위 | 설명 |
|------|------|--------|------|------|
| `query` | string | (필수) | - | 검색 쿼리. CWE-ID/CVE-ID/CAPEC-ID/ATT&CK ID 포함 시 자동 추출하여 정확 매칭 |
| `top_k` | int | 5 | 1~20 | 최대 반환 건수 (실제로는 top_k*2까지 반환 가능) |
| `min_score` | float | 0.35 | 0.0~1.0 | 벡터 검색 최소 유사도 |
| `graph_depth` | int | 2 | 0~5 | 그래프 이웃 탐색 깊이 |
| `exclude_ids` | array[string] | [] | 최대 100개 | 결과에서 제외할 노드 ID 목록 |
| `source_filter` | array[string]? | null | - | 소스 필터. `["CWE"]`, `["ATT&CK"]`, `["CAPEC"]` 등. null이면 전체 |

#### 응답 (정상)

```json
{
  "query": "CWE-78 command injection popen",
  "hits": [
    {
      "id": "CWE-78",
      "source": "CWE",
      "title": "Improper Neutralization of Special Elements used in an OS Command",
      "score": 1.0,
      "threat_category": "Injection",
      "match_type": "id_exact",
      "graph_relations": {
        "cve": ["CVE-2021-28372"],
        "capec": ["CAPEC-88"],
        "attack": ["T0807"]
      }
    },
    {
      "id": "CAPEC-88",
      "source": "CAPEC",
      "title": "OS Command Injection",
      "score": 0.8,
      "threat_category": "Injection",
      "match_type": "graph_neighbor",
      "graph_relations": {
        "cwe": ["CWE-78"]
      }
    },
    {
      "id": "CWE-77",
      "source": "CWE",
      "title": "Command Injection",
      "score": 0.72,
      "threat_category": "Injection",
      "match_type": "vector_semantic"
    }
  ],
  "total": 3,
  "extracted_ids": ["CWE-78"],
  "related_cwe": ["CWE-77", "CWE-78"],
  "related_cve": ["CVE-2021-28372"],
  "related_attack": ["T0807"]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `query` | string | 원본 쿼리 |
| `hits` | array | 검색 결과 목록 (점수 내림차순) |
| `hits[].id` | string | 위협 DB ID (CWE-78, CVE-2021-28372 등) |
| `hits[].source` | string | 소스: `"CWE"`, `"CVE"`, `"ATT&CK"`, `"CAPEC"` |
| `hits[].title` | string | 제목 |
| `hits[].score` | float | 점수. RRF 융합 점수 (기본) 또는 raw 점수 (RRF 비활성 시) |
| `hits[].threat_category` | string | 위협 분류 |
| `hits[].match_type` | string | `"id_exact"`, `"graph_neighbor"`, `"vector_semantic"` |
| `hits[].graph_relations` | object? | 그래프 관계 (있는 경우만). 키: `"cwe"`, `"cve"`, `"attack"`, `"capec"` |
| `total` | int | 총 hit 수 |
| `extracted_ids` | array[string] | 쿼리에서 추출된 ID 목록 |
| `related_cwe` | array[string] | 전체 hit에서 수집된 관련 CWE (정렬됨) |
| `related_cve` | array[string] | 전체 hit에서 수집된 관련 CVE (정렬됨) |
| `related_attack` | array[string] | 전체 hit에서 수집된 관련 ATT&CK (정렬됨) |
| `match_type_counts` | object | 매칭 타입별 건수 |
| `match_type_counts.id_exact` | int | ID 정확 매칭 건수 |
| `match_type_counts.graph_neighbor` | int | 그래프 이웃 건수 |
| `match_type_counts.vector_semantic` | int | 벡터 시맨틱 건수 |

#### 에러

| HTTP | 조건 | 응답 |
|------|------|------|
| 503 | KB 미초기화 | `{success: false, error: "Knowledge base not initialized", errorDetail: {code: "KB_NOT_READY", retryable: true}}` |

---

### POST /v1/search/batch

여러 검색 쿼리를 한 번에 실행. 쿼리 간 결과 중복을 자동 제거 (global dedup).

#### 요청

```json
{
  "queries": [
    {"query": "CWE-78", "top_k": 3, "min_score": 0.35},
    {"query": "CWE-120", "top_k": 3, "source_filter": ["CWE"]},
    {"query": "CWE-676", "top_k": 3}
  ]
}
```

| 필드 | 타입 | 기본값 | 범위 | 설명 |
|------|------|--------|------|------|
| `queries` | array | (필수) | 1~20개 | 배치 검색 쿼리 목록 |
| `queries[].query` | string | (필수) | - | 검색 쿼리 |
| `queries[].top_k` | int | 5 | 1~20 | 최대 반환 건수 |
| `queries[].min_score` | float | 0.35 | 0.0~1.0 | 최소 유사도 |
| `queries[].graph_depth` | int | 2 | 0~5 | 그래프 이웃 깊이 |
| `queries[].source_filter` | array[string]? | null | - | 소스 필터 |

#### 응답

```json
{
  "results": [
    {
      "query": "CWE-78",
      "hits": [...],
      "total": 5,
      "extracted_ids": ["CWE-78"],
      "related_cwe": [...],
      "related_cve": [...],
      "related_attack": [...],
      "match_type_counts": {"id_exact": 1, "graph_neighbor": 2, "vector_semantic": 2}
    },
    ...
  ],
  "global_stats": {
    "total_queries": 3,
    "total_hits": 12,
    "unique_ids": 12
  },
  "latency_ms": 2500
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `results` | array | 쿼리별 검색 결과 (각 항목은 `/v1/search` 응답과 동일 구조) |
| `global_stats.total_queries` | int | 쿼리 수 |
| `global_stats.total_hits` | int | 전체 hit 수 (중복 제거 후) |
| `global_stats.unique_ids` | int | 유니크 노드 ID 수 |
| `latency_ms` | int | 총 소요 시간 (ms) |

**중복 제거**: 이전 쿼리에서 반환된 노드 ID는 이후 쿼리 결과에서 자동 제외됨.

---

### GET /v1/graph/stats

위협 그래프 통계.

#### 응답 (정상)

```json
{
  "nodeCount": 2196,
  "edgeCount": 9298,
  "sources": {
    "CWE": 944,
    "CVE": 0,
    "Attack": 694,
    "CAPEC": 558
  },
  "topConnected": [
    {
      "id": "CWE-119",
      "title": "Improper Restriction of Operations within the Bounds of a Memory Buffer",
      "label": "CWE",
      "degree": 142
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `nodeCount` | int | 위협 노드 총 수 (CWE+CVE+Attack+CAPEC) |
| `edgeCount` | int | 관계 총 수 |
| `sources` | object | 레이블별 노드 수. 키: `"CWE"`, `"CVE"`, `"Attack"`, `"CAPEC"` |
| `topConnected` | array | degree 기준 상위 20개 노드 |
| `topConnected[].id` | string | 노드 ID |
| `topConnected[].title` | string | 제목 |
| `topConnected[].label` | string | 노드 레이블 |
| `topConnected[].degree` | int | 연결 수 |

#### 에러

| HTTP | 조건 | 응답 |
|------|------|------|
| 503 | Neo4j 미초기화 | `{success: false, error: "Graph not initialized", errorDetail: {code: "KB_NOT_READY", retryable: true}}` |

---

### GET /v1/graph/neighbors/{node_id}

특정 노드의 이웃 탐색.

#### 파라미터

| 이름 | 위치 | 타입 | 기본값 | 범위 | 설명 |
|------|------|------|--------|------|------|
| `node_id` | path | string | (필수) | - | 노드 ID (예: `CWE-78`) |
| `depth` | query | int | 2 | 1~5 | 탐색 깊이 |

#### 응답 (정상)

```json
{
  "nodeId": "CWE-78",
  "nodeInfo": {
    "id": "CWE-78",
    "title": "OS Command Injection",
    "source": "CWE",
    "threat_category": "Injection"
  },
  "neighbors": [
    {
      "id": "CVE-2021-28372",
      "title": "...",
      "source": "CVE"
    }
  ],
  "related": {
    "cve": ["CVE-2021-28372"],
    "capec": ["CAPEC-88"]
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `nodeId` | string | 요청한 노드 ID |
| `nodeInfo` | object | 노드 속성 |
| `neighbors` | array | 이웃 노드 목록 (최대 50건) |
| `related` | object | 관계 타입별 ID 목록. 키: `"cwe"`, `"cve"`, `"attack"`, `"capec"` |

#### 에러

| HTTP | 조건 | 응답 |
|------|------|------|
| 503 | Neo4j 미초기화 | `{success: false, error: "Graph not initialized", errorDetail: {code: "KB_NOT_READY", retryable: true}}` |
| 404 | `node_id`에 해당하는 노드 없음 | `{success: false, error: "Node 'XXX' not found", errorDetail: {code: "NOT_FOUND", retryable: false}}` |

---

## 코드 그래프

**공통 에러**: 모든 `/v1/code-graph/*` 엔드포인트는 Neo4j 미연결 시 **HTTP 503**을 반환합니다.

```json
{"detail": "Code graph service not initialized"}
```

### POST /v1/code-graph/{project_id}/ingest

SAST Runner의 함수 추출 결과를 받아 Neo4j에 코드 호출 그래프를 구축한다. **기존 project_id 데이터는 삭제 후 재생성.**

#### 요청

```json
{
  "functions": [
    {
      "name": "postJson",
      "file": "src/http_client.cpp",
      "line": 8,
      "calls": ["popen", "fgets"]
    },
    {
      "name": "curl_exec",
      "file": "third-party/libcurl/curl_exec.c",
      "line": 42,
      "calls": ["curl_multi_perform"],
      "origin": "modified-third-party",
      "originalLib": "libcurl",
      "originalVersion": "7.68.0"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `functions` | array | (필수) 함수 목록 |
| `functions[].name` | string | 함수명 |
| `functions[].file` | string | 소스 파일 경로 |
| `functions[].line` | int | 정의 줄 번호 |
| `functions[].calls` | array[string] | 호출하는 함수명 목록 |
| `functions[].origin` | string? | 출처: `"third-party"` (원본), `"modified-third-party"` (수정됨). 없으면 프로젝트 코드 |
| `functions[].originalLib` | string? | 원본 라이브러리명. camelCase/snake_case 모두 수용 |
| `functions[].originalVersion` | string? | 원본 라이브러리 버전 |

#### 응답

```json
{
  "project_id": "re100",
  "nodeCount": 121,
  "edgeCount": 242,
  "files": ["src/http_client.cpp", "src/main.cpp"],
  "vectorCount": 121
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `vectorCount` | int | Qdrant에 벡터로 적재된 함수 수. 벡터 검색 미초기화 시 `0` |

---

### POST /v1/code-graph/{project_id}/search

코드 함수를 시맨틱 검색한다. 함수명 정확 매칭 + 벡터 유사도 + 호출 그래프 확장을 결합한 하이브리드 검색.

#### 요청

```json
{
  "query": "시스템 명령을 실행하는 네트워크 핸들러",
  "top_k": 10,
  "min_score": 0.3,
  "graph_depth": 2,
  "include_call_chain": true
}
```

| 필드 | 타입 | 기본값 | 범위 | 설명 |
|------|------|--------|------|------|
| `query` | string | (필수) | - | 자연어 검색 쿼리 또는 함수명 |
| `top_k` | int | 10 | 1~50 | 최대 반환 건수 |
| `min_score` | float | 0.3 | 0.0~1.0 | 최소 유사도 |
| `graph_depth` | int | 2 | 0~5 | 호출 체인 탐색 깊이 |
| `include_call_chain` | bool | true | - | 결과에 callers/callees 포함 |

#### 응답

```json
{
  "query": "시스템 명령을 실행하는 네트워크 핸들러",
  "hits": [
    {
      "name": "postJson",
      "file": "src/http_client.cpp",
      "line": 8,
      "calls": ["popen", "fgets"],
      "origin": null,
      "original_lib": null,
      "original_version": null,
      "score": 0.032787,
      "match_type": "vector_semantic",
      "call_chain": {
        "callers": [{"name": "main", "file": "src/main.cpp", "line": 1}],
        "callees": [{"name": "popen", "file": null, "line": null}]
      }
    }
  ],
  "total": 3,
  "match_type_counts": {
    "name_exact": 0,
    "vector_semantic": 2,
    "graph_neighbor": 1
  },
  "latency_ms": 45
}
```

| `match_type` | 의미 |
|-------------|------|
| `name_exact` | 쿼리에 포함된 함수명이 Neo4j에서 정확 매칭 |
| `vector_semantic` | Qdrant 벡터 유사도 검색 |
| `graph_neighbor` | 매칭된 함수의 호출 체인에서 발견 |

#### 에러

| HTTP | 조건 |
|------|------|
| 503 | 벡터 검색 미초기화 (Qdrant 미적재) |

---

### GET /v1/code-graph/{project_id}/stats

프로젝트 코드 그래프 통계.

#### 응답

```json
{
  "nodeCount": 121,
  "edgeCount": 242,
  "files": ["src/http_client.cpp", "src/main.cpp"]
}
```

---

### GET /v1/code-graph/{project_id}/callers/{function_name}

특정 함수를 호출하는 함수 체인 (역방향 BFS).

#### 파라미터

| 이름 | 위치 | 타입 | 기본값 | 범위 |
|------|------|------|--------|------|
| `project_id` | path | string | (필수) | - |
| `function_name` | path | string | (필수) | - |
| `depth` | query | int | 2 | 1~10 |

#### 응답

```json
{
  "function": "popen",
  "depth": 2,
  "callers": [
    {"name": "curl_exec", "file": "third-party/libcurl/curl_exec.c", "line": 42, "origin": "modified-third-party", "original_lib": "libcurl", "original_version": "7.68.0"},
    {"name": "postJson", "file": "src/http_client.cpp", "line": 8, "origin": null, "original_lib": null, "original_version": null},
    {"name": "main", "file": "src/main.cpp", "line": 1, "origin": null, "original_lib": null, "original_version": null}
  ]
}
```

`origin`/`original_lib`/`original_version`은 서드파티 함수에만 값이 있고, 프로젝트 코드 함수는 `null`.

---

### GET /v1/code-graph/{project_id}/callees/{function_name}

특정 함수가 호출하는 함수 목록.

#### 응답

```json
{
  "function": "postJson",
  "callees": [
    {"name": "popen", "file": null, "line": null, "origin": null, "original_lib": null, "original_version": null},
    {"name": "fgets", "file": null, "line": null, "origin": null, "original_lib": null, "original_version": null}
  ]
}
```

---

### POST /v1/code-graph/{project_id}/dangerous-callers

위험 함수(system, popen 등)를 호출하는 사용자 코드 함수를 식별.

#### 요청

```json
{
  "dangerous_functions": ["popen", "system", "memcpy", "strcpy"]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `dangerous_functions` | array[string] | (필수) 위험 함수 이름 목록 |

#### 응답

```json
{
  "results": [
    {
      "name": "curl_exec",
      "file": "third-party/libcurl/curl_exec.c",
      "line": 42,
      "dangerous_calls": ["popen"],
      "origin": "modified-third-party",
      "original_lib": "libcurl",
      "original_version": "7.68.0"
    }
  ]
}
```

---

### DELETE /v1/code-graph/{project_id}

프로젝트 코드 그래프 삭제.

#### 응답

```json
{"deleted": true, "project_id": "re100"}
```

#### 에러

| HTTP | 조건 |
|------|------|
| 404 | 해당 프로젝트 없음 |
| 503 | Neo4j 미연결 |

---

### GET /v1/code-graph

등록된 프로젝트 목록.

#### 응답

```json
{"projects": ["re100", "sample-ecu"]}
```

---

## 실시간 CVE 조회

### POST /v1/cve/batch-lookup

프로젝트 의존성(라이브러리명+버전)으로 CVE를 실시간 조회한다. 3단계 전략:

1. **OSV.dev commit 기반** (commit + repo_url 필요) — 가장 정밀, `version_match`=항상 `true`
2. **NVD CPE 기반** (repo_url에서 vendor 추론) — 정밀
3. **NVD keywordSearch 폴백** — 넓은 검색

#### 요청

```json
{
  "libraries": [
    {
      "name": "mosquitto",
      "version": "2.0.22",
      "repo_url": "https://github.com/eclipse/mosquitto.git",
      "commit": "28f914788f6a22c8aee5e25eb5a5cc2d82a8a3a2"
    },
    {
      "name": "libcurl",
      "version": "7.68.0",
      "repo_url": "https://github.com/curl/curl.git"
    }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `libraries` | array | 필수 | 라이브러리 목록 (1~20개) |
| `libraries[].name` | string | 필수 | 라이브러리 이름 (S4 `/v1/libraries` 응답의 `name`) |
| `libraries[].version` | string | 필수 | 버전 문자열 |
| `libraries[].repo_url` (또는 `repoUrl`) | string? | 선택 | upstream git URL. 있으면 vendor 추론하여 CPE 정밀 조회. camelCase/snake_case 모두 수용 |
| `libraries[].commit` | string? | 선택 | git commit hash. repo_url과 함께 제공 시 OSV.dev 정밀 조회 |

#### 응답

```json
{
  "results": [
    {
      "library": "mosquitto",
      "version": "2.0.22",
      "cves": [
        {
          "id": "CVE-2021-28825",
          "title": "...",
          "description": "...",
          "severity": 8.8,
          "attack_vector": "NETWORK",
          "affected_versions": "<= 1.3.0",
          "version_match": false,
          "risk_score": 0.582,
          "epss_score": 0.42,
          "epss_percentile": 0.78,
          "kev": false,
          "related_cwe": ["CWE-863"],
          "related_attack": [],
          "kb_context": {
            "threat_categories": ["Authentication/Authorization"],
            "attack_surfaces": ["ECU/게이트웨이"],
            "max_automotive_relevance": 0.35
          }
        }
      ],
      "total": 26,
      "cached": false
    }
  ],
  "latency_ms": 2175
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `results` | array | 라이브러리별 CVE 조회 결과 |
| `results[].library` | string | 라이브러리 이름 |
| `results[].version` | string | 조회한 버전 |
| `results[].cves` | array | CVE 목록 (`risk_score` 내림차순, 동점 시 `severity` 내림차순) |
| `results[].cves[].id` | string | CVE ID |
| `results[].cves[].severity` | float? | CVSS 점수 |
| `results[].cves[].attack_vector` | string? | 공격 벡터 |
| `results[].cves[].affected_versions` | string | 영향 버전 범위 (사람 읽기용) |
| `results[].cves[].version_match` | bool? | **핵심 필드** — `true`: 범위 안(유효), `false`: 범위 밖(해당 없음), `null`: 판정 불가 |
| `results[].cves[].epss_score` | float? | EPSS 악용 확률 (0.0~1.0). 30일 내 실제 악용 가능성. `null`=데이터 없음 |
| `results[].cves[].epss_percentile` | float? | EPSS 백분위 (0.0~1.0). `null`=데이터 없음 |
| `results[].cves[].kev` | bool | CISA KEV 등록 여부. `true`=실제 악용 확인된 CVE |
| `results[].cves[].risk_score` | float | 복합 위험 점수 (0.0~1.0). CVSS 40% + EPSS 30% + KEV 20% + 도메인 관련성 10% 가중 합산 |
| `results[].cves[].related_cwe` | array[string] | 관련 CWE |
| `results[].cves[].related_attack` | array[string] | Neo4j 그래프 보강된 ATT&CK 기법 |
| `results[].cves[].kb_context` | object | KB 위협 지식 보강 맥락 |
| `results[].cves[].kb_context.threat_categories` | array[string] | CWE에서 도출된 위협 카테고리 (예: "Memory Corruption") |
| `results[].cves[].kb_context.attack_surfaces` | array[string] | CWE에서 도출된 공격 표면 태그 (예: "ECU/게이트웨이") |
| `results[].cves[].kb_context.max_automotive_relevance` | float | 관련 CWE 중 최대 도메인 관련성 점수 (0.0~1.0) |
| `results[].cves[].source` | string | 조회 소스: `"osv"` (commit 기반) 또는 `"nvd"` (CPE/keyword) |
| `results[].total` | int | CVE 건수 |
| `results[].cached` | bool | 캐시 히트 여부 |
| `latency_ms` | int | 총 소요 시간 (ms) |

#### 캐시 및 성능

- TTL: 24시간 (인메모리, 최대 1,000건)
- 동일 `name:version` 재조회 시 0ms 응답
- 서비스 재시작 시 캐시 초기화
- **병렬 조회**: `asyncio.gather` + 세마포어(5) 기반. 20개 라이브러리 기준 기존 ~20초 → ~4~7초
- **EPSS 보강**: FIRST.org API로 CVE별 악용 확률 배치 조회 (100건/요청)
- **KEV 보강**: CISA KEV 카탈로그 lazy-load (TTL 1시간), 실제 악용 확인 CVE 플래그

#### 에러

| HTTP | 조건 |
|------|------|
| 503 | NVD 클라이언트 미초기화 |
| 422 | 요청 스키마 불일치 (라이브러리 0개 또는 21개 이상) |

#### 호출 흐름 (S3 Agent Phase 1)

```
S3 → S4 POST /v1/libraries → [{name, version, repoUrl, commit}]
S3 → S5 POST /v1/cve/batch-lookup → [{cves: [..., version_match, epss_score, kev]}]
S3: version_match == true + epss_score/kev 기반 필터 → Phase 2 프롬프트에 주입
```

---

## 프로젝트 메모리

**공통 에러**: 모든 `/v1/project-memory/*` 엔드포인트는 Neo4j 미연결 시 **HTTP 503**을 반환합니다.

### GET /v1/project-memory/{project_id}

프로젝트의 에이전트 메모리 목록을 조회한다. 이전 분석 이력, false positive, 수정 확인, 사용자 선호를 기억하여 분석 품질을 높인다.

#### 파라미터

| 이름 | 위치 | 타입 | 기본값 | 설명 |
|------|------|------|--------|------|
| `project_id` | path | string | (필수) | 프로젝트 ID |
| `type` | query | string? | null | 메모리 타입 필터: `analysis_history`, `false_positive`, `resolved`, `preference` |

#### 응답

```json
{
  "projectId": "re100-gateway",
  "memories": [
    {
      "id": "mem-a1b2c3d4",
      "type": "analysis_history",
      "data": {
        "date": "2026-03-23",
        "claimCount": 4,
        "severity": "critical",
        "confidence": 0.865
      },
      "createdAt": "2026-03-23T15:00:00+00:00"
    },
    {
      "id": "mem-e5f6g7h8",
      "type": "false_positive",
      "data": {
        "pattern": "readlink TOCTOU in fs.cpp",
        "cwe": "CWE-362",
        "reason": "사용자 기각: readlink는 /proc/self/exe에만 사용"
      },
      "createdAt": "2026-03-23T16:00:00+00:00"
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `projectId` | string | 프로젝트 ID |
| `memories` | array | 메모리 목록 (생성일 내림차순) |
| `memories[].id` | string | 메모리 ID (`mem-{hex8}`) |
| `memories[].type` | string | 메모리 타입 |
| `memories[].data` | object | 자유 형식 데이터 |
| `memories[].createdAt` | string | ISO 8601 생성 시각 |
| `memories[].expiresAt` | string? | (선택) TTL 설정 시 만료 시각. null이면 영구 보존 |

---

### POST /v1/project-memory/{project_id}

프로젝트 메모리를 생성한다.

#### 요청

```json
{
  "type": "false_positive",
  "data": {
    "pattern": "readlink TOCTOU in fs.cpp",
    "cwe": "CWE-362",
    "reason": "사용자 기각: readlink는 /proc/self/exe에만 사용"
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | (필수) `analysis_history`, `false_positive`, `resolved`, `preference` 중 하나 |
| `data` | object | (필수) 자유 형식 JSON 데이터 |
| `ttl_seconds` | int? | (선택) TTL (초, 최소 60). null이면 영구 보존 |

#### 응답

```json
{
  "id": "mem-a1b2c3d4",
  "type": "false_positive",
  "createdAt": "2026-03-24T10:00:00+00:00",
  "expiresAt": "2026-03-25T10:00:00+00:00",
  "deduplicated": false
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 메모리 ID |
| `type` | string | 메모리 타입 |
| `createdAt` | string | ISO 8601 생성 시각 |
| `expiresAt` | string? | (선택) TTL 설정 시 만료 시각. null이면 영구 보존 |
| `deduplicated` | bool? | (선택) `true`이면 동일 패턴 메모리가 이미 존재하여 기존 항목을 반환 |

#### 에러

| HTTP | 조건 |
|------|------|
| 409 | 메모리 한도 초과 (`MEMORY_LIMIT_EXCEEDED`) |
| 422 | 유효하지 않은 메모리 타입 |
| 503 | Neo4j 미연결 |

---

### DELETE /v1/project-memory/{project_id}/{memory_id}

프로젝트 메모리를 삭제한다.

#### 응답

```json
{"deleted": true, "projectId": "re100-gateway", "memoryId": "mem-a1b2c3d4"}
```

#### 에러

| HTTP | 조건 |
|------|------|
| 404 | 해당 메모리 없음 |
| 503 | Neo4j 미연결 |

---

### 메모리 타입

| type | 설명 | 생성 주체 |
|------|------|----------|
| `analysis_history` | 분석 세션 결과 요약 | S3 (분석 완료 후) |
| `false_positive` | 사용자가 기각한 claim | S2 (사용자 피드백 시) |
| `resolved` | 수정 확인된 취약점 | S2/S3 |
| `preference` | 사용자 분석 선호 설정 | S2 (사용자 설정 시) |

---

## 헬스체크

### GET /v1/health

Liveness 전용. 프로세스가 살아 있으면 200을 반환한다.

#### 응답

```json
{
  "service": "aegis-knowledge-base",
  "status": "ok",
  "version": "0.2.0"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `service` | string | 항상 `"aegis-knowledge-base"` |
| `status` | string | 항상 `"ok"` |
| `version` | string | 서비스 버전 |

---

### GET /v1/ready

Readiness 체크. 모든 하위 컴포넌트 상태를 포함한다.

#### 응답 (정상 — HTTP 200)

```json
{
  "service": "aegis-knowledge-base",
  "status": "ok",
  "version": "0.2.0",
  "components": {
    "qdrant": {"status": "ok", "path": "/home/kosh/AEGIS/services/knowledge-base/data/qdrant"},
    "neo4j": {"status": "ok", "nodeCount": 2196, "edgeCount": 9298}
  },
  "ontology": {
    "sources": {"CWE": 944, "CVE": 0, "Attack": 694, "CAPEC": 558}
  }
}
```

#### 응답 (미준비 — HTTP 503)

```json
{
  "service": "aegis-knowledge-base",
  "status": "degraded",
  "version": "0.2.0",
  "components": {
    "qdrant": {"status": "ok", "path": "/home/kosh/AEGIS/services/knowledge-base/data/qdrant"},
    "neo4j": {"status": "error", "error": "Connection refused"}
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `service` | string | 항상 `"aegis-knowledge-base"` |
| `status` | string | `"ok"` 또는 `"degraded"` |
| `version` | string | 서비스 버전 |
| `components` | object | 하위 컴포넌트 상태 |
| `components.qdrant` | object | Qdrant 상태. `status`: `"ok"` \| `"error"` |
| `components.qdrant.path` | string | Qdrant 파일 스토리지 경로 |
| `components.neo4j` | object | Neo4j 상태. `status`: `"ok"` \| `"error"` |
| `components.neo4j.nodeCount` | int? | 위협 노드 수 (정상 시) |
| `components.neo4j.edgeCount` | int? | 관계 수 (정상 시) |
| `components.neo4j.error` | string? | 에러 메시지 (실패 시) |
| `ontology` | object? | (선택) 온톨로지 통계. 정상 시에만 포함 |
| `ontology.sources` | object | 레이블별 노드 수 |

---

## 서비스 상태별 동작 요약

| Qdrant | Neo4j | 검색 | 그래프 | 코드 그래프 | CVE 조회 |
|--------|-------|------|--------|------------|---------|
| OK | OK | 정상 (3경로 하이브리드) | 정상 | 정상 | 정상 (그래프 보강 포함) |
| OK | 실패 | 정상 (벡터 전용, 그래프 보강 없음) | 503 | 503 | 정상 (그래프 보강 없음) |
| 실패 | OK | 503 | 정상 | 정상 | 정상 (그래프 보강 포함) |
| 실패 | 실패 | 503 | 503 | 503 | 정상 (그래프 보강 없음) |
