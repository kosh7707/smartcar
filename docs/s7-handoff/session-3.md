# Session 3 — 관측성 고도화 + vLLM 튜닝 + MCP 호환 (2026-03-21~24)

## 변경 사항

- **타임아웃 분리**: 단일 120초 -> connect 10초 / read 호출자 주도 (`X-Timeout-Seconds` 헤더, 기본 1800초)
- **requestId 자동 생성**: `/v1/tasks`, `/v1/chat` 모두 미전달 시 `gw-{hex12}` 자동 생성, 응답 헤더에 포함
- **Observability v2**: service 식별자 `s7-gateway`, 로그 레벨 pino 숫자 (30/40/50), 교환 로그 v2 호환
- **chat proxy 로그 강화**: promptTokens, completionTokens, finishReason, hasTools, elapsedMs 추가
- **Circuit Breaker Prometheus 연동**: 상태 전이 시 gauge 실시간 갱신
- **dump 파일 자동 정리**: Gateway 기동 시 7일 초과 파일 삭제
- **vLLM 성능 튜닝**: gpu_memory_utilization 0.7->0.75, chunked prefill 활성화 -> 13->14 tok/s
- **MCP 호환**: `llm-exchange.jsonl`에 service/level/msg/elapsedMs 필드 추가
- **코드 정리**: S4/S3 구 명칭 12건 제거 (로그 메시지, 에러 docstring)
- 178 tests 통과 (기존 176 + 신규 2: requestId 자동 생성, caller timeout)
