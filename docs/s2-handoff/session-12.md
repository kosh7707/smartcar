# 세션 12 — TypeScript 에러 수정 + 코드 고도화 + 문서 전면 갱신

**날짜**: 2026-03-28

---

- **TypeScript 에러 9건 → 0건 수정**:
  1. `@aegis/shared` 재빌드 (stale dist/ → `targetSummary` 타입 불일치 해소)
  2. `sdk.controller.ts` Express 5 params 캐스트 (2건)
  3. `project-settings.service.ts` BuildProfile 폴백 추가 (4건, `DEFAULT_BUILD_PROFILE` 터미널 폴백)
  4. 테스트 mock 누락 메서드 추가 (3파일: approval, quality-gate, result-normalizer)
- **AppError 타입화** (에러 클래스 3개 + 에러코드 3개):
  - `KbUnavailableError` (502, retryable), `KbHttpError` (502, non-retryable), `PipelineStepError` (502, retryable)
  - `kb-client.ts` 3곳, `pipeline-orchestrator.ts` 4곳 적용
- **silent catch 로깅**: `project-settings.service.ts` JSON 파싱 실패에 `logger.warn` 추가 (2곳)
- **쿼리 파라미터 검증**: `finding.controller.ts`에 status/severity/sort/order 유효성 검사 추가
- **S2 담당 문서 6개 전면 갱신**:
  - `backend.md`: 구현 현황, 에러코드 21개, DB 19테이블, 내부 아키텍처, 디렉토리 구조 현행화
  - `observability.md`: 에러코드 5개 추가 (BUILD_AGENT/KB/PIPELINE)
  - `technical-overview.md`: v0→v1 전환기 체크리스트 갱신
  - `shared-models.md`: "후속 과제" 라벨 제거 (전부 구현 완료)
  - `AEGIS.md`: (변경 불필요 — 이미 최신)
  - 이 인수인계서: 세션 11/12 로그, 다음 작업 갱신
- **상태: TypeScript 0에러, 테스트 267개 통과, 수정 파일 10개 (코드) + 5개 (문서)**
