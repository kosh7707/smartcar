# S5 Session 8 — 2026-03-25

## 외부 리뷰 피드백 반영

| 변경 | 상세 |
|------|------|
| 외부 리뷰 피드백 반영 | 에러 시맨틱 정상화 (200+error → 503 + observability 포맷), health/ready 분리, ontology 버전 추적, 메모리 lifecycle (중복제거/TTL/한도) |
| HTTP 에러 포맷 통일 | 전 엔드포인트 observability.md 에러 포맷 준수 (`{success, error, errorDetail}`) |
| `/v1/ready` 신규 | readiness probe — Qdrant+Neo4j 상태 + ontology 메타데이터 |
| Ontology 버전 추적 | ETL 파서에서 CWE/ATT&CK/CAPEC 버전 추출 → `kb-meta.json` → `:KBMeta` Neo4j 노드 |
| 메모리 lifecycle | content-hash 중복 제거, 선택적 TTL, 프로젝트당 메모리 한도 (1000) |
| 테스트 65→80 | API 에러 +9, 메모리 lifecycle +6 |
| expiresAt coalesce() | 기존 Memory 노드에 expiresAt 프로퍼티 미존재 경고 수정 (S3 WR 대응) |
