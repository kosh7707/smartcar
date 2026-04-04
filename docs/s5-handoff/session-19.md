# S5 Session 19 — 2026-04-04

## threat search readiness hardening + provenance seam 구현

| 변경 | 상세 |
|------|------|
| threat search hardening | `_NullGraph` 기반 degraded fallback 제거. Neo4j 없으면 `/v1/search`, `/v1/search/batch`도 `503 KB_NOT_READY` |
| code graph provenance seam | ingest/search/read에 optional `buildSnapshotId`, `buildUnitId`, `sourceBuildAttemptId` 메타데이터/필터 추가 |
| project memory provenance seam | create/list에 optional provenance 메타데이터/필터 추가, dedup hash에 provenance 포함 |
| 계약/고지 | `docs/api/knowledge-base-api.md` 업데이트 + S3 통지 WR 작성 |

### 구현 메모

- 현재 code graph는 여전히 **프로젝트당 활성 그래프 1개** 모델이다.
- 즉 provenance는 지금 단계에서 multi-snapshot 동시 보존이 아니라, 이후 확장을 위한 **metadata/filter seam**이다.
- S3 WR(`s3-to-s5-build-snapshot-provenance-alignment.md`) 요청은 이번에 최소 seam 형태로 수용했다.

### 검증

- targeted pytest: API readiness + code graph + vector + project memory 회귀 통과
- full pytest: `161 passed`
- py_compile: 관련 Python 모듈 PASS
