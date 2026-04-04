# S5 Session 18 — 2026-04-04

## degraded Qdrant-only fallback 제거 계획

| 항목 | 내용 |
|------|------|
| 판단 | 현재 S5 운영 모델은 Qdrant+Neo4j가 정상 경로이며, Qdrant-only degraded fallback은 제품/계약 모델과 어긋날 가능성이 큼 |
| 근거 | `/ready`는 이미 Neo4j 없으면 503인데 `/search`는 200 degraded를 허용하고 있어 계약이 어긋남. 2026-04-04 benchmark 기준 Qdrant-only는 `ndcg_5=0.4048`, `mrr=0.4636`, oracle `0/6`, Neo4j-enabled는 `ndcg_5=0.6111`, `mrr=0.7399`, oracle `6/6` |
| 산출물 | `.omx/plans/prd-s5-remove-degraded-fallback.md`, `.omx/plans/test-spec-s5-remove-degraded-fallback.md` |
| 권고안 | threat search에서 degraded fallback 제거. Neo4j 없으면 `/v1/search`, `/v1/search/batch`도 `503 KB_NOT_READY`로 맞추고, `degraded` 성공 payload 제거 |
| 연동 WR 반영 | `docs/work-requests/s3-to-s5-build-snapshot-provenance-alignment.md`를 계획에 반영. 다만 build snapshot provenance는 **별도 후속 seam**으로 두고 이번 변경 범위에는 포함하지 않음 |

### 계획상 핵심 포인트

- `app/main.py`에서 `_NullGraph` 기반 threat-search assembler fallback 제거
- `app/routers/api.py`에서 search/batch를 ready와 같은 방향으로 조정
- 단, `/ready`는 Qdrant와 Neo4j 상태를 **분리해서** 보여주도록 유지/정리 필요
- `degraded` 필드는 success payload에서 제거하는 쪽으로 명시
- 호출자 S2/S3에는 WR로 계약 변경 통지 필요
- S3의 build snapshot provenance 정렬 요청은 acknowledged 상태로 기록하고, code graph / project memory provenance 계획으로 별도 이어가야 함

### 검토 메모

- Architect 검토 결과: **ITERATE**
  - 제거 방향 자체는 맞지만, `degraded` 필드 결정, `/ready`의 Qdrant 상태 모델링, lifespan/init-path 테스트 의무화가 필요하다는 피드백
- 위 피드백을 반영해 PRD / test spec을 수정함
