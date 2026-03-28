# S5 Session 4 — 2026-03-20

## 고도화: CVE 병렬+EPSS+KEV, 검색 강화

| 변경 | 상세 |
|------|------|
| CVE 배치 병렬 조회 | `asyncio.gather` + 세마포어(5). 20개 기준 ~20s → ~4~7s |
| EPSS 악용 확률 보강 | FIRST.org API 배치 조회. CVE에 `epss_score`, `epss_percentile` 추가 |
| CISA KEV 플래그 | KEV 카탈로그 lazy-load (TTL 1h). CVE에 `kev: true/false` 추가 |
| 검색 소스 필터링 | `source_filter: ["CWE"]` 등. ID exact + vector 모두 필터링 |
| 배치 검색 API | `POST /v1/search/batch` — 최대 20쿼리, 교차 중복 제거 |
| RRF 점수 융합 | Reciprocal Rank Fusion (k=60). id_exact + neighbor + vector 3-list 융합 |
| 테스트 36→54 | NVD client +9, Assembler +9 |
