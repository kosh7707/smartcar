# Session 2 — 122B 모델 전환 + Gateway 고도화 (2026-03-20)

## 122B 모델 전환 + 문서 전면 갱신

- **모델 전환**: `Qwen/Qwen3.5-35B-A3B-FP8` -> `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4` (Qwen 공식)
- **벤치마크**: 6모델(35B-FP8, 35B-BF16, 35B-INT4, 122B-AutoRound, 122B-GPTQ, 122B-MXFP4) x 5테스트 x 10회 = 300회 정량 벤치 수행
- **모델 오버라이드**: `/v1/chat` 프록시에서 호출자 모델명을 Gateway 운영 모델로 자동 교체 (S3 코드 변경 불필요)
- **로그 리네이밍**: `s3-llm-gateway.jsonl` -> `aegis-llm-gateway.jsonl`, `s4-exchange.jsonl` -> `llm-exchange.jsonl`
- **config.py 기본값**: `qwen-14b` -> `Qwen/Qwen3.5-122B-A10B-GPTQ-Int4`
- **문서 갱신**: S7 소유 5개 문서 + 코드의 구 모델 참조 48건 전체 갱신
- **통합 테스트 성공**: S3 Agent 2턴 멀티턴 분석, tool calling 4건
- **DGX Spark 레시피**: `qwen3.5-122b-gptq-int4.yaml` 영구 저장
- **S3->S7 소유권 이전 반영**: 전 문서에서 S3 -> S7 참조 갱신

## Gateway 고도화 — Circuit Breaker + 메트릭

- **Circuit Breaker**: `app/circuit_breaker.py` — 연속 실패 시 OPEN, recovery 후 HALF_OPEN 탐침, 성공 시 CLOSED
- **TokenTracker**: `app/metrics/token_tracker.py` — 누적 토큰/요청 통계, endpoint별/taskType별 세분화
- **Prometheus 메트릭**: `app/metrics/prom.py` — `prometheus_client` 기반, `/metrics` 엔드포인트
- **`/v1/usage` 엔드포인트**: 누적 사용량 JSON 반환
- **`/v1/health`**: circuitBreaker 상태 필드 추가
- **vLLM 헬스 모니터링**: `scripts/llm-engine-health.sh`
- 환경변수 2건 추가: `AEGIS_CIRCUIT_BREAKER_THRESHOLD`, `AEGIS_CIRCUIT_BREAKER_RECOVERY_SECONDS`
- 의존성 추가: `prometheus_client==0.21.1`

## 운영 정비

- **DGX Spark 캐시 정리**: ~2.0TB 확보 (벤치마크 모델 15건 삭제, 운영 모델 74G만 유지)
- **ollama 정리**: systemd 서비스 `disabled`, 모델 43GB 삭제
- **vLLM restart policy**: `launch-cluster.sh` 패치 — `--rm` -> `--restart unless-stopped`
- **Gateway 워밍업**: lifespan에서 더미 LLM 요청으로 torch.compile 사전 워밍업

- 178 tests 통과 (기존 154 + 신규 22 + 기존 2 삭제)
