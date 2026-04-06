# S5 Session 15 — 2026-04-04

## graph-aware benchmark compare 정리

| 변경 | 상세 |
|------|------|
| benchmark compare 추가 | `scripts/benchmark/run_benchmark.py --compare-neo4j`로 Qdrant-only와 Neo4j-enabled를 순차 실행하고 metric delta / query uplift를 요약하도록 확장 |
| 회귀 테스트 보강 | `test_benchmark_artifacts.py`에 compare summary 정렬/집계와 sequential profile 실행 회귀 추가 |
| 실제 비교 검증 | 43 scored queries 기준 `ndcg_5 0.4048 → 0.6111`, `mrr 0.4636 → 0.7399`, `hit_rate 0.7442 → 0.9070`, latency ratio 2.66x 확인 |
| team 시도 결과 | `omx team`은 현재 리더 workspace의 타 lane 미커밋 변경 때문에 worktree launch가 차단됨. S5 구현은 로컬에서 진행하고 결과만 handoff로 정리 |

### 관찰

- graph-aware 모드의 이득은 전체 평균뿐 아니라 일부 ID/관계 기반 쿼리에서 매우 큼
  - 예: `T0866`, `CWE-119 CWE-120 buffer overflow`, `CWE-94 code injection eval`
- qdrant-only sweep이 평평했던 문제는 **그래프 유무 차이**를 비교하면 분명한 uplift가 드러난다는 점으로 정리 가능
- 다음 S5 benchmark 작업은 **Neo4j-enabled parameter tuning** 또는 **graph hit를 더 직접 검증하는 validation query 강화**가 적절함
