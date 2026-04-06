# S5 Session 17 — 2026-04-04

## graph-aware oracle 추가

| 변경 | 상세 |
|------|------|
| validation set 강화 | 일부 exact query(`q001`, `q007`, `q008`, `q026`)에 `required_match_types` oracle 추가 |
| benchmark runner 확장 | `run_benchmark.py`가 query별 oracle pass 여부와 summary의 `full_pass_rate`, `mean_pass_rate`, `passed_checks/total_checks`를 집계하도록 확장 |
| 회귀 테스트 보강 | `test_benchmark_artifacts.py`에 oracle floor 검증과 runner oracle aggregation 테스트 추가 |
| 실제 검증 | compare 실행 기준 oracle full-pass가 **Qdrant-only 0.0000 (0/6)** → **Neo4j-enabled 1.0000 (6/6)** 로 상승 |

### 의미

- 기존 평균 metric(NDCG/MRR) 외에도, 이제 benchmark가 **그래프 경로가 실제 동작했는지**를 직접 체크한다.
- 그래서 앞으로는
  - score uplift
  - query uplift
  - oracle pass rate
  를 같이 보면서 benchmark를 해석할 수 있다.

### 다음 작업 제안

- `required_match_types`에서 한 단계 더 나아가
  - relation family oracle (`expected related_attack / related_cwe` 등)
  - query별 top1 exact-hit 비율
  - match_type_counts 기반 summary
  를 추가하면 graph-aware fixture의 구분력이 더 높아진다.
