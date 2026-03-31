# Session 8 — 통합 테스트 로그 분석 + 로그 개선 (2026-03-30~31)

## 배경

S3→S7 WR(`s3-to-s7-llm-report-transition.md`): RE100 대상 에이전트 통합 테스트에서 Qwen3.5-122B가 tool_calls→content 전환에 실패하는 현상 보고.

## 로그 분석 결과

- S7 Gateway 에러 0건. 46회 LLM 호출 전부 HTTP 200 성공.
- Gateway는 `tool_choice`, `tools`, `temperature` 등 모든 파라미터를 투명 전달 (model만 오버라이드).
- `finish_reason` 원인: Gateway가 아닌 **모델 특성** — tools 제공 시 73.9% 확률로 tool_calls 선택.
- S3의 `force_report` 메커니즘(tools 제거 + 시스템 메시지 주입) 적용 후 100% 전환 성공 확인.

## 변경 사항

### chat proxy 로그 강화 (`app/routers/tasks.py`)

- **성공 로그**: `toolChoice`, `toolCount` 필드 추가 (기존 `hasTools`에 더해 구체적 정보 기록)
- **교환 로그**: `finishReason`, `toolChoice`, `toolCount` 3개 필드 추가
- `finish_reason` 추출을 교환 로그 기록 전으로 이동하여 중복 제거

### 문서 갱신

- `docs/specs/llm-engine.md`: 모델 행동 특성 섹션 추가 (tool_calls 선호, evidence ref 환각)

### 기존 수정 (Session 8 초반)

- `app/routers/tasks.py`: `/v1/chat` CB OPEN 응답에 `X-Gateway-Latency-Ms` 헤더 추가 (일관성)
- `tests/test_contract_task_failure.py`: `LLM_CIRCUIT_OPEN → MODEL_ERROR` 매핑 테스트 추가

## WR 대응 요약

| S3 요청 | S7 답변 |
|---------|---------|
| `tool_choice` 통과 확인 | Gateway 투명 전달 확인. 조작 없음. |
| `finish_reason` 원인 분석 | 모델 특성. Gateway에서 발생하는 이슈 아님. |
| temperature 권장 설정 | 0.3은 적정. tool→content 전환에 유의미한 영향 없음. |
| 모델 행동 특성 공유 | llm-engine.md에 문서화 완료. |

- 179 tests → 180 tests (LLM_CIRCUIT_OPEN 매핑 1건 추가)

## 2차 통합 테스트 로그 분석 (2026-03-31)

S3이 통합 테스트를 완료한 후 전체 로그 점검 실시.

### 1차 vs 2차 비교

| 항목 | 1차 (03-28) | 2차 (03-31) |
|------|------------|------------|
| LLM 호출 수 | 46회 | 40회 (-13%) |
| tool_calls 비율 | 73.9% | 70.0% |
| build 턴 수 | 12 | 10 |
| analyze 턴 수 | 7 | 6 |
| 총 prompt 토큰 | 347,090 | 273,340 (-21%) |

- S7 에러/경고: **0건** (양쪽 모두)
- Session 8 로그 개선 필드(`toolChoice`, `toolCount`) 정상 출력 확인
- S3 `force_report` 최적화 효과: 더 적은 턴으로 동일 결과 도출
- S7 추가 개선 필요 사항: 없음
