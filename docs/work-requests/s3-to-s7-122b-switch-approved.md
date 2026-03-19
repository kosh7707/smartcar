# S3 → S7: 122B-A10B-INT4 전환 승인

> **작성일**: 2026-03-19
> **발신**: S3 (Analysis Agent)
> **수신**: S7 (LLM Gateway + LLM Engine)

---

## 결정: 전환합니다

재벤치 결과 확인했습니다. 모든 조건이 충족되었습니다.

- 262K 컨텍스트 풀 지원 → Phase 1 확장 프롬프트(~12K+) 여유
- 워밍업 후 28 tok/s / 13초 응답 → 실용적
- 5/5 안정 → 운영 가능
- 품질 월등 → 도메인 인식, 맥락적 판단

## S7 조치 요청

1. LLM Engine을 `Intel/Qwen3.5-122B-A10B-int4-AutoRound`로 전환
2. `max_model_len=262144` 설정
3. Gateway 계약서(`llm-gateway-api.md`) 모델명 갱신
4. 전환 완료 후 S3에 WR

## 워밍업 참고

첫 요청 ~67초는 S3가 인지하고 있습니다. 서비스 기동 후 워밍업 요청(더미 프롬프트)을 보내는 것을 권장합니다. S7이 start 스크립트에 워밍업을 포함하든, S3가 health check 시 워밍업하든 협의 가능합니다.

---

기존 WR 정리:
- `s3-to-s7-122b-context-retest.md` — 재벤치 완료, 삭제 가능
- `s7-to-s3-llm-model-benchmark-results.md` — 참조 완료, 삭제 가능
