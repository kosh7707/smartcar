# S4 세션 3 — 통합테스트 전 코드 점검 7건 수정 (2026-03-28)

---

## 완료 항목

- [x] **코드 점검 7건 전체 수정** (통합테스트 전 S3/S4/S5/S7 협력 대비):
  - Fix #1: `sdk_resolver.py` 4곳 KeyError 방어 — `.get()` 전환 + 불완전 레지스트리 안전 처리
  - Fix #2: `scanbuild_runner.py` plist 파싱 에러 무로깅 → `logger.warning` 추가
  - Fix #3: `scanbuild_runner.py` plist 음수 `file_idx` 바운드 체크 (`< 0` 가드)
  - Fix #4: `library_differ.py` `find_closest_version()` 완벽 매치 조기 종료 (`diff_size == 0 → break`)
  - Fix #5: `scanbuild_runner.py` `_run_single()` 반환 타입 `list | None` 정정
  - Fix #6: 오케스트레이터 `"partial"` 상태 + `timedOutFiles` 필드 + 전 도구 실패 경고
  - Fix #7: `per_file_timeout` 배치 기반 계산 (파일 수 → 배치 수), 최소 15초 → 10초 하향
- [x] **테스트 333 → 338개** (+5)
- [x] **API 계약서** `toolResults.timedOutFiles` 필드 추가
- [x] **기능 명세서** `ToolExecutionResult` 스키마 갱신 (`"partial"` + `timedOutFiles`)

## 변경 파일 (코드)

| 파일 | 변경 |
|------|------|
| `app/scanner/scanbuild_runner.py` | 반환 타입 정정, plist 로깅, 음수 인덱스 가드, 배치 기반 timeout |
| `app/scanner/sdk_resolver.py` | 4곳 `.get()` 방어 (get_sdk_compiler, get_sdk_compiler_path, get_sdk_registry, _resolve_from_registry) |
| `app/scanner/library_differ.py` | find_closest_version() 조기 종료 |
| `app/schemas/response.py` | ToolExecutionResult: `"partial"` 상태 + `timedOutFiles` 필드 |
| `app/scanner/orchestrator.py` | partial 판정 로직 + 전 도구 실패 경고 |
| `app/scanner/gcc_analyzer_runner.py` | 배치 기반 per_file_timeout |

## 변경 파일 (테스트)

| 파일 | 변경 |
|------|------|
| `tests/test_scanbuild_runner.py` | `test_negative_file_index` 추가 |
| `tests/test_sdk_resolver.py` | `test_malformed_registry_entry` 추가 |
| `tests/test_library_differ.py` | `test_perfect_match_short_circuits` 추가 |
| `tests/test_orchestrator.py` | `TestPartialStatus` 2건 추가 |

## 변경 파일 (문서)

| 파일 | 변경 |
|------|------|
| `docs/api/sast-runner-api.md` | toolResults에 timedOutFiles 필드 추가 |
| `docs/specs/sast-runner.md` | ToolExecutionResult 스키마 갱신 |
| `docs/s4-handoff/session-3.md` | 이번 세션 로그 |
