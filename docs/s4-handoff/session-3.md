# S4 세션 3 — 통합테스트 전 코드 점검 + 통합테스트 대응 (2026-03-28 ~ 2026-03-31)

---

## 완료 항목

### 1. 코드 점검 7건 수정 (2026-03-28)

통합테스트 전 S3/S4/S5/S7 협력 대비 코드 점검:

- [x] Fix #1: `sdk_resolver.py` 4곳 KeyError 방어 — `.get()` 전환
- [x] Fix #2: `scanbuild_runner.py` plist 파싱 에러 무로깅 → `logger.warning`
- [x] Fix #3: `scanbuild_runner.py` plist 음수 `file_idx` 바운드 체크
- [x] Fix #4: `library_differ.py` `find_closest_version()` 완벽 매치 조기 종료
- [x] Fix #5: `scanbuild_runner.py` `_run_single()` 반환 타입 `list | None` 정정
- [x] Fix #6: 오케스트레이터 `"partial"` 상태 + `timedOutFiles` 필드 + 전 도구 실패 경고
- [x] Fix #7: `per_file_timeout` 배치 기반 계산 (파일 수 → 배치 수), 최소 15→10초

### 2. S3 WR: SAST 응답 파싱 예외 조사 (2026-03-31)

- [x] RE100 `apps/central/` 대상 스캔 재현 — 107건 findings 전수 검증: **이상 없음**
- [x] 에러 `'str' object has no attribute 'get'` — S4 응답 형식 문제 아님
- [x] `/v1/scan` 응답에 `response_model_exclude_none=True` 적용 → null 필드 제거
- [x] 2차 통합테스트에서 **에러 해소 확인**

### 3. 통합테스트 로그 검토 (2026-03-31)

- [x] e2e-1774920375 파이프라인 6건 전체 트레이스 분석
- [x] S4 에러 0건, 경고 4건 (빌드 실패 — S3 스크립트 문제, S4 정상 동작)
- [x] 빌드 실패 중복 로그 제거 — `scan.py` 간략 warning 삭제
- [x] 빌드 부분 실패 처리 — `exitCode!=0 + userEntries>0` → `success: false` + `warning`

### 4. S3 WR: success/exitCode 불일치 수정 (2026-03-31)

- [x] 부분 성공 로직(`success: true` + `exitCode: 1`)이 API 계약 위반 → 즉시 수정
- [x] `exitCode != 0` → 항상 `success: false`. `warning` 필드로 부분 compile_commands 가용성 표시

## 변경 파일 (코드)

| 파일 | 변경 |
|------|------|
| `app/scanner/scanbuild_runner.py` | 반환 타입 정정, plist 로깅, 음수 인덱스 가드, 배치 기반 timeout |
| `app/scanner/sdk_resolver.py` | 4곳 `.get()` 방어 |
| `app/scanner/library_differ.py` | find_closest_version() 조기 종료 |
| `app/schemas/response.py` | ToolExecutionResult: `"partial"` 상태 + `timedOutFiles` |
| `app/scanner/orchestrator.py` | partial 판정 + 전 도구 실패 경고 |
| `app/scanner/gcc_analyzer_runner.py` | 배치 기반 per_file_timeout |
| `app/routers/scan.py` | `response_model_exclude_none=True` + 빌드 중복 로그 제거 |
| `app/scanner/build_runner.py` | 부분 실패 `warning` 필드 + 중복 로그 제거 + success/exitCode 일관성 |

## 변경 파일 (테스트)

| 파일 | 변경 |
|------|------|
| `tests/test_scanbuild_runner.py` | `test_negative_file_index` |
| `tests/test_sdk_resolver.py` | `test_malformed_registry_entry` |
| `tests/test_library_differ.py` | `test_perfect_match_short_circuits` |
| `tests/test_orchestrator.py` | `TestPartialStatus` 2건 |
| `tests/test_build_runner.py` | `test_failure_with_partial_entries` (수정) |

## 변경 파일 (문서)

| 파일 | 변경 |
|------|------|
| `docs/api/sast-runner-api.md` | timedOutFiles, /v1/build 부분 실패 + warning, success 판정 기준 |
| `docs/specs/sast-runner.md` | ToolExecutionResult 스키마 |
| `docs/s4-handoff/README.md` | 테스트 수, 버전 |
| `docs/s4-handoff/roadmap.md` | 통합테스트 결과 반영 |
| `docs/s4-handoff/session-3.md` | 이번 세션 |

## WR 이력

| WR | 방향 | 상태 |
|------|------|------|
| `s4-to-s3-tool-execution-partial-status.md` | S4→S3 | 발행 (세션2, timedOutFiles 고지) |
| `s3-to-s4-sast-response-parsing.md` | S3→S4 | 수신 → 조사 → 삭제 완료 |
| `s4-to-s3-sast-response-parsing-reply.md` | S4→S3 | 발행 (조사 결과 회신) |
| `s3-to-s4-build-success-exitcode-mismatch.md` | S3→S4 | 수신 → 수정 → 삭제 완료 |
| `s4-to-s3-build-exitcode-fix.md` | S4→S3 | 발행 (수정 완료 고지) |
