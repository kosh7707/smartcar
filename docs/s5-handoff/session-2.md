# S5 Session 2 — 2026-03-19

## ETL 재설계 + 실시간 CVE 전환

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
