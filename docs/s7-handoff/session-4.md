# Session 4 — 외부 리뷰 피드백 개선 (2026-03-25)

## 변경 사항

- **CORS 제한**: `allow_origins=["*"]` -> 환경변수 `AEGIS_CORS_ALLOW_ORIGINS` 기반 (기본 `localhost:5173,3000`)
- **GatewayError 리네이밍**: 레거시 `S3Error` -> `GatewayError` (S7 소유 반영)
- **`/v1/chat` 응답 메타데이터**: `X-Model`, `X-Gateway-Latency-Ms` 헤더 추가 (성공/실패 전 응답)
- **`.env.example` 생성**: 전 환경변수 + placeholder IP + 한 줄 설명
- **내부 운영 정보 분리**: specs/README에서 DGX IP 제거 -> `${LLM_ENGINE_HOST}` / 환경변수 참조 (인수인계서는 유지)
- **명세서 최신화**: /v1/tasks vs /v1/chat 역할 대비 테이블, CB/TT/Prometheus/CORS 반영
- **API 계약서**: `X-Model`, `X-Gateway-Latency-Ms` 응답 헤더 문서화
- 178 tests 통과
