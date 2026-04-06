# S5 Knowledge Base — Roadmap

---

## 즉시 다음 작업

| # | 작업 | 우선순위 |
|---|------|---------|
| 1 | S3가 `s5-to-s3-search-readiness-and-provenance-update.md`에 회신하거나 후속 WR을 보낼 때까지 계약 변화 모니터링 | 높음 |
| 2 | code graph multi-snapshot coexistence 설계 (`project당 활성 그래프 1개` → snapshot-aware 모델) | 중간 |
| 3 | graph-aware benchmark oracle 확장 (`relation-family`, `top1 exact-hit`, `match_type_counts` 활용 강화) | 중간 |

## 최근 완료 (2026-04-02)

| # | 작업 | 결과 |
|---|------|------|
| 1 | **Degraded mode 시그널링** (구 로드맵 #6) | 2026-04-02 시점 구현. 이후 2026-04-04 readiness hardening으로 threat search 성공 payload의 `degraded`는 제거되어 현재는 **historical context**만 남음 |
| 2 | **Qdrant 서버 모드 지원** (구 로드맵 #3) | `qdrant_url` 설정으로 file/server 듀얼 모드. 테스트 5개 |
| 3 | **벤치마크 프레임워크** (구 로드맵 #2) | `scripts/benchmark/` — validation set 35쿼리 + metrics + runner + sweep. 테스트 15개 |

---

## 최근 완료 (2026-04-03)

| # | 작업 | 결과 |
|---|------|------|
| 1 | **벤치마크 validation set 확장** | validation set 35→45 쿼리. automotive/authorization/configuration/concurrency/attack/capec coverage 보강 |
| 2 | **Sweep 결과 출력 보강 + 실제 실행** | `scripts/benchmark/sweep.py` — 범위 축소 실행 옵션 + CSV/JSON 요약 출력 지원. Qdrant-only 36조합 sweep 실행 결과 NDCG@5/MRR이 전 구간 동일(0.4048/0.4636) |
| 3 | **벤치마크 회귀 테스트 추가** | `test_benchmark_artifacts.py` 신설 — fixture shape/coverage + sweep summary 회귀 검증 |

---

## 최근 완료 (2026-04-04)

| # | 작업 | 결과 |
|---|------|------|
| 1 | **Graph-aware benchmark compare** | `run_benchmark.py --compare-neo4j` 추가. Qdrant-only 대비 Neo4j-enabled에서 `ndcg_5 0.4048 → 0.6111`, `mrr 0.4636 → 0.7399`, `hit_rate 0.7442 → 0.9070` 확인 |
| 2 | **Compare 회귀 테스트 추가** | compare summary 집계/정렬과 sequential profile 실행을 테스트로 고정 |
| 3 | **Neo4j-enabled 36조합 sweep 실행** | `min_score 0.25~0.4 × neighbor_score 0.7~0.9 × rrf_k 30/60/100` 전 구간에서 `ndcg_5=0.6111`, `mrr=0.7399`로 동일. 현재 benchmark는 graph-aware 상태에서도 파라미터 감도가 낮음 |
| 4 | **Graph-aware oracle 추가** | validation set의 일부 exact query에 `required_match_types`를 추가하고 benchmark runner가 oracle full-pass/mean-pass를 집계하도록 확장. compare 기준 Qdrant-only `0/6` vs Neo4j-enabled `6/6` |
| 5 | **Threat search readiness hardening + provenance seam** | Qdrant-only degraded fallback 제거. threat search는 Neo4j 필수로 정렬. code graph / project memory는 optional `buildSnapshotId` / `buildUnitId` / `sourceBuildAttemptId` seam 추가 |
| 6 | **S3 회신 + architect 승인 + closeout sync** | `docs/work-requests/s5-to-s3-search-readiness-and-provenance-update.md` 작성, Boyle architect 승인 확보, handoff/spec/API 문서 최신 상태로 동기화 |

---

## 후순위 / 장기 계획

| # | 작업 | 현재 상태 | 향후 방향 |
|---|------|---------|---------|
| 1 | Other 카테고리 비율 52% | 8개 상위 카테고리 + 5단계 부모 탐색 | 수작업 큐레이션 또는 다중 레이블 분류 검토 |
| 2 | 다운로드 실패 시 전체 파이프라인 중단 | all-or-nothing (부분 빌드 미지원) | 소스별 독립 빌드 또는 이전 캐시 fallback 도입 |
| 3 | 소스 무결성 검증 없음 | 버전 및 메타데이터만 기록 | checksum 또는 schema validation 도입 검토 |
| 4 | 코드 그래프 대규모 적재 미검증 | RE100(53노드/54관계) 정상 | 대규모 프로젝트 테스트 필요 |
