# S5 Session 13 — 2026-03-31

## 통합 테스트 참여 + 이슈 수정 + 로그 점검

| 변경 | 상세 |
|------|------|
| 코드 점검 | 통합 테스트 전 전 엔드포인트/비즈니스 로직 코드 리뷰. 블로킹 이슈 없음 확인 |
| S3에 체크리스트 WR | `s5-to-s3-integration-test-checklist.md` — X-Timeout-Ms 필수, ingest 순서, CVE 외부 의존 |
| `expiresAt` 센티넬 도입 | TTL 미지정 Memory 노드에 `_NO_EXPIRY` 센티넬 설정 → Neo4j `01N52` 경고 해소 |
| `expiresAt` 자동 마이그레이션 | `_ensure_indexes()`에 기존 노드 마이그레이션 로직 추가 — 기동 시 자동 실행 |
| 400 응답 확인 | `X-Timeout-Ms` 누락 시 `errorDetail.message`에 사유 이미 포함 확인 — 변경 없음 |
| NVD 로그 레벨 보정 | 404(라이브러리 미발견): ERROR→WARN, batch_lookup 개별 실패: ERROR→WARN |
| E2E 로그 전수 점검 | `e2e-1774920375-*` 4건 전부 S5 구간 정상. 에러 0건. 테스트 잔재(libA/badlib/req-test-123) 식별 → S3에 WR |
| 테스트 115→119 | +3 센티넬 테스트 + 1 마이그레이션 테스트 |
| WR 수신 2건 처리 | `s3-to-s5-integration-test-issues.md` (2건), `s3-to-s5-expiresat-existing-nodes.md` |
| WR 발송 4건 | 체크리스트, 이슈 응답, 마이그레이션 완료, E2E 로그 위생 |
| 문서 3건 현행화 | 인수인계서/명세서/API 계약서 테스트 카운트 및 날짜 갱신 |
