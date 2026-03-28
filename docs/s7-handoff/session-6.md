# Session 6 — CB OPEN 버그 수정 + 문서-코드 정합성 점검 (2026-03-27)

## 버그 수정: Circuit Breaker OPEN 실패 경로

- **발견**: 문서-코드 정합성 점검 중 `LLM_CIRCUIT_OPEN` failureCode가 API 계약서에는 문서화되어 있었으나 `FailureCode` enum에 누락된 것을 확인. 추적 결과 `LlmCircuitOpenError`가 `/v1/tasks` 파이프라인에서 잡히지 않아 500 에러로 떨어지는 버그 확인.
- **`FailureCode.LLM_CIRCUIT_OPEN` 추가**: `app/types.py`에 enum 값 추가
- **`task_pipeline.py` 예외 처리**: `LlmCircuitOpenError` -> `MODEL_ERROR` + `LLM_CIRCUIT_OPEN` + `retryable: true` 정상 실패 응답 반환
- 테스트 1건 추가: `test_circuit_open_returns_llm_circuit_open`

## 문서 전면 갱신

S7 소유 문서 5건 코드 대조 점검 후 갱신:
- `docs/specs/llm-engine.md`: 모델 비교 테이블 122B 반영, 로그 파일명 3건 현행화, 성능 수치 정리
- `docs/api/llm-gateway-api.md`: CB OPEN 재시도 정책 명시, HTTP 상태코드 설명 정리 (429 제거)
- `docs/specs/llm-gateway.md`: 날짜 갱신
- `docs/s7-handoff/README.md`: 날짜, 테스트 수, 수정 이력 갱신

- 179 tests 통과
