# S4 Session 6 — 2026-04-02

## 요약

Session-5 긴급 중단 백로그 전체 처리. S3 WR(heartbeat 진행 지표 보강) + S2 WR(cweId 메타데이터 표준화) 완료.

---

## 처리한 WR

### S3 → S4: heartbeat 진행 지표 보강 (`s3-to-s4-heartbeat-progress-metrics.md`)

6개 요청 → 4개 구현, 2개 기존 메커니즘으로 충분:

| # | 요청 | 대응 |
|---|------|------|
| 1 | heartbeat `progress` 필드 | **구현** — activeTools, completedTools, findingsCount, filesCompleted, filesTotal, currentFile |
| 2 | heartbeat `status` 필드 | **구현** — `queued` (세마포어 대기) / `running` (분석 중) |
| 3 | False Alive 방지 | 기존 충분 — subprocess 사망 시 즉시 감지 |
| 4 | Stall 시 부분 결과 | 기존 충분 — `gather(return_exceptions=True)` |
| 5 | 동시성 세마포어 | 기존 있음. 기본값 1→2 변경 |
| 6 | API 계약서 갱신 | 완료 |

### S2 → S4: cweId 메타데이터 (`s2-to-s4-cwe-metadata.md`)

전 도구(6개 runner + sarif_parser)에 `metadata.cweId` 추가. `metadata.cwe` 배열의 첫 번째 원소를 단일 string으로 제공. S2가 Finding에 자동 매핑.

---

## 코드 변경

### session-5 미완료 → 완료

- `orchestrator.py` — `_run_scanbuild()`, `_run_gcc_analyzer()`에 `on_file_progress` 래퍼 + task_map 전달
- `scan.py` — `_run_scan_core()`에 `on_started`/`on_file_progress` 추가. `_scan_streaming()`에 공유 상태 dict + 보강된 heartbeat (status + progress 필드)
- `config.py` — `max_concurrent_scans` 1→2

### session-5 기존 테스트 수정

- `test_orchestrator.py` — session-5에서 `_timed()`에 "started" 이벤트 추가했지만 기존 테스트 미갱신 → 2개 테스트 수정

### 신규

- `sarif_parser.py`, `cppcheck_runner.py`, `clangtidy_runner.py`, `flawfinder_runner.py`, `scanbuild_runner.py`, `gcc_analyzer_runner.py` — `metadata["cweId"]` 추가
- `main.py` — 버전 v0.8.0 → v0.9.0

### 테스트

+10개 신규:
- `test_orchestrator.py` — `test_progress_callback_started_event`, `test_file_progress_callback_forwarded`
- `test_gcc_analyzer_runner.py` — `test_on_file_progress_called`
- `test_scanbuild_runner.py` — `test_on_file_progress_called`
- `test_scan_endpoint.py` — `test_scan_ndjson_progress_started_event`, `test_scan_ndjson_heartbeat_has_progress`, `test_scan_ndjson_file_progress_in_heartbeat`, `test_scan_ndjson_queued_status`

기존 테스트 수정 +2개. 총 **368개** 전부 통과.

---

## 문서 갱신

- `docs/api/sast-runner-api.md` — v0.9.0. heartbeat 포맷 보강 (status + progress). `metadata.cweId` 필드 추가.
- `docs/specs/sast-runner.md` — v0.9.0. 테스트 수 368. 12-1절 NDJSON 진행 지표 + cweId 설명.
- `docs/s4-handoff/README.md` — v0.9.0. 테스트 수 368. cweId 언급.
- `docs/s4-handoff/roadmap.md` — S3/S2 WR 완료 기록. "즉시 다음" 비움.

---

## WR 정리

- 삭제: `s3-to-s4-heartbeat-progress-metrics.md`, `s2-to-s4-cwe-metadata.md`, `s4-to-s4-session5-backlog.md`
- 작성: `s4-to-s3-heartbeat-progress-response.md` (S3 회신)
