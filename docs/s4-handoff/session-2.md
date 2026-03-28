# S4 세션 2 — 외부 피드백 잔여 5건 + 문서 전면 갱신 (2026-03-28)

---

## 완료 항목

- [x] **외부 피드백 잔여 5건 전체 반영**:
  - P1-4: Semgrep auto-skip -> 파일 확장자 기반 필터 전환 (`--include *.c *.h`)
  - P1-5: gcc-fanalyzer `check_available(profile)` -> SDK 크로스 컴파일러 반영
  - P2-1: Semgrep taint sanitizer 패턴 추가 (divide-by-zero 5패턴, integer-overflow 4패턴, use-after-free 4패턴)
  - P2-2: 벤치마크 noise -> targeted/portfolio 분리 (`CWEMetrics`, `ToolMetrics`, `compare.py`)
  - P2-3: LibraryDiffer `DiffResult` dataclass 통일 + `CloneCache` TTL 캐시
- [x] **테스트 313 -> 333개** (+20)
- [x] **`docs/specs/sast-runner.md` 전면 재작성** (v0.5.0 -> v0.7.0, 16개 섹션)
- [x] **`docs/api/sast-runner-api.md` 부분 갱신** (Semgrep 필터, gcc SDK 재확인, DiffResult 통일)
- [x] **인수인계서 분할 구조 전환** (S2 WR 대응):
  - README.md (~160줄, 진입점)
  - roadmap.md (다음 작업)
  - session-1.md (전체 빌드업 로그)
  - session-2.md (이번 세션)

## 변경 파일 (코드)

| 파일 | 변경 |
|------|------|
| `rules/automotive/divide-by-zero.yaml` | taint sanitizer 5패턴 추가 |
| `rules/automotive/integer-overflow.yaml` | taint sanitizer 4패턴 추가 |
| `rules/automotive/use-after-free.yaml` | taint sanitizer 4패턴 추가 |
| `benchmark/metrics.py` | targeted_noise + portfolio_noise 분리, 하위호환 property |
| `benchmark/juliet_runner.py` | targeted/portfolio noise 분류 로직 |
| `benchmark/compare.py` | targeted noise per-file 추적 |
| `app/scanner/gcc_analyzer_runner.py` | `check_available(profile)` SDK 컴파일러 지원 |
| `app/scanner/orchestrator.py` | async `_select_tools`, gcc SDK 재확인, Semgrep 확장자 필터 |
| `app/scanner/semgrep_runner.py` | `include_extensions` 파라미터 |
| `app/scanner/ruleset_selector.py` | `semgrep_include_extensions()` 함수 |
| `app/scanner/library_differ.py` | `DiffResult` dataclass + `CloneCache` 클래스 |
| `app/scanner/sca_service.py` | `CloneCache` 주입 |
| `app/config.py` | `lib_cache_dir`, `lib_cache_ttl` 설정 추가 |

## 변경 파일 (테스트)

| 파일 | 변경 |
|------|------|
| `tests/test_benchmark.py` | targeted/portfolio noise 테스트 + 하위호환 |
| `tests/test_orchestrator.py` | async _select_tools, gcc SDK 재확인 2건 |
| `tests/test_gcc_analyzer_runner.py` | check_available(profile) 3건 |
| `tests/test_semgrep_runner.py` | include_extensions 2건 |
| `tests/test_ruleset_selector.py` | semgrep_include_extensions 4건 |
| `tests/test_library_differ.py` | DiffResult + CloneCache 6건 |
