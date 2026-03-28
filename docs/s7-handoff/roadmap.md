# S7 Roadmap

> 다음 작업 + 장기 계획

---

## 즉시 다음 작업

현재 미완료 항목 없음. 통합 테스트 후 발견되는 이슈에 따라 업데이트.

---

## 향후 고도화 — LoRA 파인튜닝 (데이터 축적 후)

플랫폼 운영으로 [finding -> 전문가 검증 assessment] 데이터가 충분히 쌓이면, LoRA 파인튜닝으로 모델을 자동차 보안 도메인에 특화시킬 수 있다.

**Data Flywheel**: 플랫폼 운영 -> 분석가 리뷰 -> 학습 데이터 축적 -> 파인튜닝 -> 모델 품질 향상 -> 분석가 부담 감소 -> 더 많은 데이터 축적 (선순환)

**인프라 준비 상태**:
- DGX Spark 3대 클러스터링 가능 (ConnectX-7, 200 Gbps RDMA, QSFP 스위치 필요)
- 384GB 통합 메모리 -> 122B 모델 Full Fine-tune도 이론상 가능
- NVIDIA 공식 자동 설정 스크립트 제공 (`spark_cluster_setup.py`)
- 분산 학습 프레임워크: PyTorch Torchrun + NCCL (sm_121 빌드 필요)
- `llm-exchange.jsonl`에 모든 LLM 호출 전문이 이미 기록 중 (미래 학습 데이터 원본)

**전제 조건** (착수 전 확인):
1. 전문가 검증된 학습 데이터 500건+ 확보
2. 평가 벤치마크 테스트셋 구축 (파인튜닝 전후 비교용)
3. ARM64 + CC 12.1 환경에서 학습 라이브러리 호환 검증 (PEFT, bitsandbytes, NCCL)
4. 학습 중 서빙 중단 계획 (클러스터 전체를 학습에 투입)

**참고 자료**:
- [DGX Spark Clustering 공식 문서](https://docs.nvidia.com/dgx/dgx-spark/spark-clustering.html)
- [NVIDIA DGX Spark Multi-Node Playbooks](https://deepwiki.com/NVIDIA/dgx-spark-playbooks/7-multi-node-setups)
