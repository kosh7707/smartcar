# S5 Session 3 — 2026-03-20

## 통합 테스트 + 코드 리뷰 안정화

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
