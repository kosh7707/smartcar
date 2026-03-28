# S5 Session 10 — 2026-03-26

## ETL 분류 개선 + 기동 스크립트

| 변경 | 상세 |
|------|------|
| CWE 계층 구조 분류 | `ChildOf` 관계로 `parent_map` 구축 → `classify_threat_category`가 부모를 5단계까지 탐색. "Other" 89%→52% |
| automotive_relevance 하이브리드 | 키워드(60%) + 임베딩 유사도(40%) 가중 합산. 공격 표면 분류는 키워드 매칭 유지 (임베딩은 도메인 간 의미 격차로 부적합) |
| related_cwe 중복 제거 | View_ID 무관 unique ID만 적재 (set 기반) |
| ETL 기동 스크립트 | `scripts/knowledge-base/etl-build.sh` 신설 (`--seed` 옵션으로 Neo4j 시드 포함) |
