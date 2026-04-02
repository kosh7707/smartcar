# Session 5 — NDJSON 하트비트 스트리밍 프로토콜 구현 + 진행 지표 보강 (2026-04-01, 미완료)

## 배경

S3 WR: RE100 4개 프로젝트 중 3개에서 SAST 타임아웃 실패. 동기 HTTP의 고정 타임아웃으로는 대형 프로젝트(sqlite3.c 230K줄, duktape.c 87K줄) 소요 시간을 예측할 수 없음.

S3 제안: 하트비트 기반 타임아웃 전환 — "총 N초 안에 끝내라" → "M초간 진행 없으면 중단"
S3 명시 철회: thirdPartyPaths 자동 탐지 — "분석 범위 축소는 안 됨" (modified-third-party도 분석 필수)

## 산출물

### v0.7.0 → v0.8.0 버전업

### 1. thirdPartyPaths 자동 탐지 롤백

세션 초반에 구현했으나 S3 WR 수정으로 철회. scan.py에서 auto-detection 블록 전체 제거, 변수/주석 복원.

### 2. `_run_scan_core()` 추출 (`scan.py`)

기존 `scan()` 함수의 핵심 로직(세마포어, 디렉토리 준비, orchestrator.run, codeGraph, SCA, 정리, ScanResponse 조립)을 별도 코루틴으로 분리. 동기/스트리밍 양쪽에서 공유.

### 3. NDJSON 스트리밍 모드 (`scan.py`)

`Accept: application/x-ndjson` 헤더 opt-in. `_scan_streaming()` 함수:
- asyncio.Queue 기반 fan-in (progress callback + heartbeat timer → queue → generator)
- 4개 이벤트 타입: progress, heartbeat, result, error
- 25초 간격 heartbeat keepalive → S3의 60초 inactivity timeout 내 여유
- finally 블록에서 heartbeat_task + scan_task 정리 (CancelledError 처리)

### 4. orchestrator `on_progress` 콜백 (`orchestrator.py`)

`ProgressCallback` 타입 정의 + `run()` 메서드에 `on_progress` 선택 매개변수 추가.
도구 완료/실패 시 콜백 호출. 기존 동작(on_progress=None) 변경 없음.

### 5. 테스트 (360개, +9)

| 테스트 | 검증 내용 |
|--------|----------|
| test_scan_ndjson_streaming_basic | NDJSON Accept → 스트리밍 응답, result 이벤트 |
| test_scan_ndjson_has_progress_events | progress/result 이벤트 존재 |
| test_scan_ndjson_result_matches_sync | 동기/스트리밍 동일 결과 |
| test_scan_ndjson_error_event | ScanTimeoutError → error 이벤트 |
| test_scan_without_ndjson_unchanged | Accept 없으면 기존 동기 JSON |
| test_scan_ndjson_validation_error_returns_json | NDJSON + 입력 실패 → HTTP 400 |
| test_progress_callback_called_per_tool | 도구별 콜백 호출 |
| test_progress_callback_called_on_failure | 실패 도구 status=failed 콜백 |
| test_no_callback_no_error | on_progress=None 정상 동작 |

### 6. 문서 갱신

- `docs/api/sast-runner-api.md` — "NDJSON 스트리밍 모드" 섹션 추가
- `docs/specs/sast-runner.md` — 엔드포인트 테이블에 스트리밍 언급, 테스트 수 360개
- `docs/s4-handoff/README.md` — v0.8.0, 360개 테스트, 스트리밍 언급
- `docs/s4-handoff/roadmap.md` — 완료 처리, per-file v2 후순위 추가

## 테스트 결과

```
360 passed, 1 warning in 8.34s
```

## 주의사항

- thirdPartyPaths는 사용자(S3)가 **명시적으로 지정한 경우에만** scope-early 적용. 자동 감지 안 함.
- cppcheck은 전체 프로젝트 단일 실행이라 per-file progress 없음 — activeTools로 생존 확인.

---

## 미완료: S3 후속 WR 처리 (heartbeat 진행 지표 보강)

**세션 중단 사유**: Claude Code 문제

S3 WR `s3-to-s4-heartbeat-progress-metrics.md` 처리 중 세션 종료.
**상세 백로그**: `docs/work-requests/s4-to-s4-session5-backlog.md`
**구현 플랜**: `/home/kosh/.claude/plans/declarative-squishing-naur.md`

### 완료된 코드 변경
- `gcc_analyzer_runner.py` — `on_file_progress` 콜백 추가
- `scanbuild_runner.py` — `on_file_progress` 콜백 추가
- `orchestrator.py` — `FileProgressCallback` 타입 + `on_file_progress` 파라미터 + `_timed()` "started" 이벤트 (부분)

### 남은 코드 변경
- orchestrator의 `_run_gcc_analyzer`/`_run_scanbuild`에 on_file_progress 전달
- scan.py의 공유 상태 + 보강된 heartbeat + on_started
- config.py max_concurrent_scans 기본값 2
- 테스트 ~8개 + 문서 + S3 회신 WR
