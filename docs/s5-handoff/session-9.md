# S5 Session 9 — 2026-03-25

## 소스코드 GraphRAG

| 변경 | 상세 |
|------|------|
| 소스코드 GraphRAG | 코드 함수 벡터 임베딩(Qdrant `code_functions`) + 하이브리드 검색 (함수명 exact + 벡터 시맨틱 + 그래프 확장 + RRF) |
| `POST /v1/code-graph/{project_id}/search` 신규 | 자연어로 코드 구조 시맨틱 탐색. S3 Agent 도구 연동용 |
| `CodeVectorSearch` 신규 | 함수 메타데이터 임베딩 텍스트 생성 + Qdrant 적재/검색/삭제 |
| `CodeGraphAssembler` 신규 | name_exact + vector_semantic + graph_neighbor 3경로 하이브리드 |
| ingest 응답 확장 | `vectorCount` 필드 추가 (Qdrant 적재 건수) |
| delete 확장 | 프로젝트 삭제 시 Qdrant 벡터도 동시 삭제 |
| `get_function()` 추가 | CodeGraphService에 단일 함수 노드 조회 메서드 |
| 테스트 80→102 | CodeVectorSearch +10, CodeGraphAssembler +9, get_function +2, expiresAt +1 |
