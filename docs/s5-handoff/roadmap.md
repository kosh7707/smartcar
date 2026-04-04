# S5 Knowledge Base — Roadmap

---

## 즉시 다음 작업

| # | 작업 | 우선순위 |
|---|------|---------|
| 1 | 통합 테스트 결과 기반 후속 조치 (S3 WR 응답 대기) | 높음 |
| 2 | Neo4j-enabled parameter tuning + graph hit를 더 직접 검증하는 validation query 강화 | 중간 |

---

## 최근 완료 (2026-04-02)

| # | 작업 | 결과 |
|---|------|------|
| 1 | **Degraded mode 시그널링** (구 로드맵 #6) | 검색/배치/ready 응답에 `degraded` 필드 추가. 테스트 3개 |
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

---

## 후순위 / 장기 계획

| # | 작업 | 현재 상태 | 향후 방향 |
|---|------|---------|---------|
| 1 | Other 카테고리 비율 52% | 8개 상위 카테고리 + 5단계 부모 탐색 | 수작업 큐레이션 또는 다중 레이블 분류 검토 |
| 2 | 다운로드 실패 시 전체 파이프라인 중단 | all-or-nothing (부분 빌드 미지원) | 소스별 독립 빌드 또는 이전 캐시 fallback 도입 |
| 3 | 소스 무결성 검증 없음 | 버전 및 메타데이터만 기록 | checksum 또는 schema validation 도입 검토 |
| 4 | 코드 그래프 대규모 적재 미검증 | RE100(53노드/54관계) 정상 | 대규모 프로젝트 테스트 필요 |
