# S5 Session 16 — 2026-04-04

## Neo4j-enabled parameter tuning 결과

| 항목 | 내용 |
|------|------|
| 실행 명령 | `cd services/knowledge-base && .venv/bin/python scripts/benchmark/sweep.py --qdrant-path data/qdrant --neo4j --min-score-range 0.25,0.3,0.35,0.4 --neighbor-score-range 0.7,0.8,0.9 --rrf-k-range 30,60,100 --top-n 10 --csv-output /tmp/s5-neo4j-sweep.csv --json-output /tmp/s5-neo4j-sweep.json` |
| 조합 수 | 36 |
| 결과 | 전 조합 성공, 전 조합에서 `ndcg_5=0.6111`, `mrr=0.7399`, `precision_5=0.2186`, `recall_5=0.6140`, `hit_rate=0.9070` 동일 |
| 산출물 | `/tmp/s5-neo4j-sweep.csv`, `/tmp/s5-neo4j-sweep.json` |

### 해석

- 기존 Qdrant-only sweep이 평평했던 것뿐 아니라, **Neo4j-enabled sweep도 동일하게 flat**했다.
- 즉 현재 benchmark는
  1. 그래프 유무 비교에는 민감하지만
  2. 현재 파라미터 축(`min_score`, `neighbor_score`, `rrf_k`) 변화에는 거의 반응하지 않는다.

### 다음 작업 제안

- validation set에 **graph_neighbor / id_exact / vector_semantic 기대 혼합비**를 더 직접 고정
- query별로 **expected relation family**(예: CAPEC 동반, ATT&CK 동반, direct ID exact 필수) 같은 graph-aware oracle을 추가
- sweep/compare 결과에 평균값 외에 **match_type_counts**나 top1 exact-hit 비율을 넣으면 파라미터 영향이 더 드러날 수 있음
