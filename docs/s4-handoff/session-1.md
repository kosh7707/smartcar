# S4 세션 1 — 전체 빌드업 (~ 2026-03-27)

> 초기 구축부터 v0.7.0까지의 전체 작업 로그.

---

## 완료 항목

- [x] 6도구 SAST + SCA + 코드 구조 + 빌드 자동화 (v0.5.0)
- [x] CVE 조회 -> S5 이관 (`cve_lookup.py` 삭제)
- [x] SDK 경로 표준화 (`SAST_SDK_ROOT` + sdkId = 폴더명)
- [x] gcc-fanalyzer/scan-build 버그 수정 + 파일별 실행
- [x] CWE Enrichment (scan-build 15개, gcc-fanalyzer 16개 + 출력 직접 파싱, clang-tidy 24개)
- [x] 커스텀 Semgrep 룰 3종 (CWE-78, 798, 338) + custom_rules_dir 연결
- [x] Juliet 벤치마크 인프라 (12 CWE, 361파일, 4분 측정)
- [x] orchestrator 도구별 profile 분리 (Cppcheck/gcc-fanalyzer 타임아웃 해결)
- [x] gcc-fanalyzer GCC 버전 체크 + 호스트 폴백 (GCC 9.x SDK 대응)
- [x] `smartcar` -> `AEGIS` 네이밍 -> `s4-sast` 로그 표준화
- [x] 기동 스크립트 수정 (venv PATH, .env 파싱)
- [x] 통합 테스트 성공 (S3 Agent Phase 1/2 전 구간)
- [x] `/v1/includes`에 `projectPath` 지원 추가
- [x] SDK environment-setup 자동 적용 (`build_runner.py`)
- [x] `buildCommand` 자동 감지 (빌드 스크립트 우선 -> CMake -> Make -> configure)
- [x] 커스텀 Semgrep 룰 추가: CWE-369 (7룰), CWE-190 (5룰)
- [x] Cppcheck `--check-level=exhaustive` 활성화
- [x] 벤치마크 `--no-custom-rules` delta 측정 기능
- [x] Juliet Recall 54.5% -> **70.9%** (+16.4%)
- [x] `/v1/scan` 응답에 `codeGraph` + `sca` 통합 (projectPath 모드)
- [x] `/v1/functions` origin 태깅 (third-party / modified-third-party 식별)
- [x] `/v1/build` 엔드포인트 신규 (빌드 전용, 파이프라인 단계별 제어)
- [x] `/v1/discover-targets` 엔드포인트 신규 (빌드 타겟 자동 탐색)
- [x] `/v1/sdk-registry` 엔드포인트 신규 (등록된 SDK 목록, 빌드 Agent 연동)
- [x] SDK 레지스트리 외부화 (`sdk-registry.json`, 코드 수정 불필요)
- [x] 전역 SastRunnerError 예외 핸들러 + 전 엔드포인트 에러 핸들링
- [x] Observability v2 준수 (service `s4-sast`, level 숫자, X-Request-Id 전파)
- [x] `/v1/build` success 판정 수정 (2026-03-25): exitCode!=0 -> success:false + CMakeFiles/ 임시 항목 필터링
- [x] `/v1/build` `wrapWithBear` 옵션 추가 (2026-03-25)
- [x] `/v1/scan` `thirdPartyPaths` 필터링 (2026-03-25): vendored 서드파티 경로 findings 제거 + cross-boundary 유지
- [x] `/v1/build` buildProfile 500 크래시 수정 (2026-03-26): BuildProfile 필드 전부 optional
- [x] SDK 관리 API (2026-03-26): `POST /v1/sdk-registry`, `DELETE /v1/sdk-registry/:sdkId`
- [x] X-Timeout-Ms 헤더 수용 (2026-03-26): 헤더 > body > 기본값 600초
- [x] BuildProfile None 안전 처리 (2026-03-26)
- [x] build_runner sh -> bash 변경 (2026-03-26)
- [x] **경계면 취약점 탐지** (v0.5.0, 2026-03-25):
  - 필터링 개선: SDK/라이브러리 경로 finding이라도 dataFlow에 사용자 코드 포함 시 유지
  - gcc-fanalyzer: SDK 크로스 컴파일러 사용 시 enriched profile 전달
  - gcc-fanalyzer: note 라인 -> dataFlow 파싱
  - `SastFinding.origin`, `FindingsFilterInfo.crossBoundaryKept` 필드 추가
- [x] **외부 리뷰 피드백 반영** (2026-03-25):
  - 저장소 위생: `.o` 298개 삭제 + `.gitignore` 추가
  - `ExecutionReport` 타입화: 4개 Pydantic 모델
  - 도구 최소 버전 경고 (`check_tools()` + `requirements.txt` 고정)
  - 단위 테스트 51 -> 144개 (+93)
  - Automotive 룰 메타데이터 강화: 21개 룰에 `automotive_rationale` + references
  - Router 책임 분리: `path_utils.py`, `sca_service.py`
- [x] **functions 추출 성능 개선** (2026-03-26):
  - `dump_functions`/`dump_ast` 병렬화: `asyncio.gather` + `Semaphore(16)`
  - `skip_paths` 파라미터 추가
  - 단위 테스트 13개 추가
- [x] **Phase 1 기반 정비** (2026-03-26):
  - 벤치마크 러너 Pydantic 크래시 수정
  - `check_tools()` 캐싱: TTL 300초
  - 설정 통합: `config.py`
  - `ScanOptions.tools` 파라미터 추가
  - `/v1/functions` 성능: diff 없이 식별만 (44초 -> ~1초)
- [x] **벤치마크 인프라 고도화** (2026-03-26):
  - Per-Rule 메트릭, `--tools` 옵션, `--show-rules`, `--baseline`
  - `benchmark/compare.py` 신규
  - 벤치마크 테스트 20개 추가
- [x] **커스텀 Semgrep 룰 확장** (2026-03-26, 21 -> 38개 룰, +17):
  - buffer-overflow-write, input-validation, use-after-free, taint-sources
- [x] **코드 품질 + 안정성 개선** (2026-03-26):
  - `library_identifier._parse_git_info()` -> `asyncio.to_thread()`
  - `gcc_analyzer_runner`, `sdk_resolver` threading.Lock 추가
- [x] **CWE-369/190 Recall 대폭 개선** (2026-03-26, 70.9% -> **83.7%**):
  - Taint mode 도입: source -> sink 자동 추적
  - CWE-369: 22% -> 94%, CWE-190: 53% -> 89%
- [x] **테스트 커버리지 대폭 확대** (2026-03-26, 196 -> 313개, +117)
- [x] **외부 피드백 P0 반영** (2026-03-27):
  - P0-1: Recall + Noise/File로 재정의
  - P0-2: scope-early 도입
  - P0-3: Semaphore(8) 동시성 제한
  - FindingsFilterInfo 분리, 버전 v0.7.0
- [x] **외부 피드백 P1 반영** (2026-03-27):
  - P1-1: per-tool timing wrapper
  - P1-2: timeout sentinel + timed_out 카운트
  - P1-6: `-Wanalyzer*` strict 필터
- [x] **CWE-416 taint mode 룰** (2026-03-27)
- [x] **Juliet 전체 variant 벤치마크** (2026-03-27): 12 CWE, 8,783파일, Recall 78.7%
- [x] **S3 빌드 Agent 연동 WR** 발송

---

## 통합 테스트 결과 (2026-03-20)

S3 Agent가 S4를 호출한 전체 흐름:

```
Phase 1: S3 -> S4 /v1/scan        -> 49 findings (6도구, 11초)
         S3 -> S4 /v1/functions    -> 1,329 함수 (75초)
         S3 -> S4 /v1/libraries    -> 6 라이브러리 (44초)
         S3 -> S5 /v1/cve/batch-lookup -> CVE 실시간 조회
Phase 2: S3 -> S7 -> LLM           -> 3 claims (핵심 취약점만 정제)
```

---

## Juliet 벤치마크 (v0.7.0, 12 CWE, 361 파일)

| Tier | CWE | Recall | 주력 도구 |
|------|-----|:---:|---|
| S | CWE-476 NULL deref | **100%** | Cppcheck + clang-tidy + gcc-fanalyzer + scan-build |
| S | CWE-134 Format String | **100%** | Flawfinder |
| S | CWE-401 Memory Leak | **95%** | gcc-fanalyzer |
| S | CWE-369 Divide by Zero | **94%** | Semgrep taint + Cppcheck |
| A | CWE-190 Int Overflow | **89%** | Semgrep taint + clang-tidy + Flawfinder |
| A | CWE-680 Int->BOF | **83%** | Flawfinder + Semgrep |
| A | CWE-121 Stack BOF | **82%** | Flawfinder + gcc-fanalyzer |
| A | CWE-78 Cmd Injection | **80%** | Flawfinder + clang-tidy + Semgrep |
| A | CWE-122 Heap BOF | **80%** | Flawfinder + gcc-fanalyzer |
| B | CWE-252 Unchecked Return | **72%** | clang-tidy |
| B | CWE-416 UAF | **67%** | gcc-fanalyzer + clang-tidy + scan-build |
| C | CWE-457 Uninitialized | **56%** | gcc-fanalyzer + Cppcheck |
| | **Overall** | **83.7%** | |

### 초기 대비 개선

| 수정 | 효과 |
|------|------|
| gcc-fanalyzer `-fsyntax-only` -> `-c` | 도구 부활 (0% -> 동작) |
| gcc-fanalyzer/scan-build 파일별 개별 실행 | 심볼 충돌 해결 |
| scan-build `-plist` 추가 | plist 출력 활성화 (0% -> 동작) |
| CWE 매핑 추가 (3개 runner) | CWE 태깅 -> 벤치마크 매칭 |
| Semgrep taint mode (CWE-369, 190) | CWE-369 22%->94%, CWE-190 53%->89% |
| **Overall** | **54.5% -> 83.7% (+29.2%)** |
