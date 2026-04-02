# S4. SAST Runner 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S4(SAST Runner) 개발을 이어받는 다음 세션을 위한 진입점이다.
> **마지막 업데이트: 2026-04-02**

---

## 1. 역할과 경계

### 너는

- **SAST Runner 전담 개발자** (`services/sast-runner/`)
- `docs/api/sast-runner-api.md` API 계약서 소유
- `docs/specs/sast-runner.md` 명세서 소유
- `scripts/start-sast-runner.sh` + `services/sast-runner/.env` 소유
- 12개 엔드포인트 관리: scan (동기+NDJSON 스트리밍), functions, includes, metadata, libraries, build, build-and-analyze, discover-targets, sdk-registry(GET/POST), sdk-registry/:sdkId(DELETE), health
- SDK 레지스트리 관리 (`$SAST_SDK_ROOT/sdk-registry.json` 외부 파일)
- `metadata.cweId` 표준화 — 전 도구에서 CWE 식별자를 `cweId` 필드로 제공 (S2 Finding 매핑용)

### 너는 하지 않는다

- DGX Spark / LLM Engine 관리 -> **S7**
- CVE 조회 -> **S5** (`POST /v1/cve/batch-lookup`으로 이관 완료)
- 프롬프트 작성, LLM 응답 파싱 -> S3
- 지식 그래프, 벡터 검색 -> S5
- UI -> S1
- `scripts/start.sh` / `scripts/stop.sh` 직접 수정 금지 -> S2에 work-request

---

## 2. 서비스 현황

| 항목 | 값 |
|------|-----|
| 위치 | `services/sast-runner/` (monorepo 내, WSL2 로컬) |
| 스택 | Python 3.12 + FastAPI + Uvicorn |
| 포트 | 9000 |
| 버전 | **v0.9.0** |
| 테스트 | **368개** (23개 파일) |
| 벤치마크 | Juliet 12 CWE, Overall Recall **83.7%** |
| 통합테스트 | **통과** (e2e-1774920375, S4 에러 0건) |

### 6개 SAST 도구

| 도구 | profile | 핵심 특성 |
|------|:---:|------|
| Semgrep | -- | taint mode + sanitizer. C++에서 확장자 필터 (`--include *.c *.h`) |
| Cppcheck | **original** | `--check-level=exhaustive`. SDK 헤더 제외 |
| clang-tidy | **enriched** | CWE 매핑 24개. SDK 헤더 포함 |
| Flawfinder | -- | 텍스트 기반 |
| scan-build | **enriched** | CWE 매핑 15개. `-plist` 필수. 파일별 실행. `Semaphore(8)` |
| gcc-fanalyzer | **original** | CWE 매핑 16개. `-c` 필수. 파일별 실행. `Semaphore(8)`. GCC 10+ |

### 코드 구조

```
services/sast-runner/
├── app/
│   ├── main.py              — FastAPI v0.7.0, JSON 로깅
│   ├── config.py            — pydantic-settings (SAST_ prefix)
│   ├── context.py           — contextvars requestId 전파
│   ├── errors.py            — 커스텀 에러 4종
│   ├── routers/scan.py      — 12개 엔드포인트
│   ├── schemas/
│   │   ├── request.py       — ScanRequest, BuildProfile (전 필드 optional)
│   │   └── response.py      — SastFinding, ScanResponse, ExecutionReport
│   └── scanner/
│       ├── orchestrator.py   — 6도구 병렬 + scope-early + 경계면 필터링
│       ├── semgrep_runner.py — taint + sanitizer, include_extensions 필터
│       ├── cppcheck_runner.py
│       ├── clangtidy_runner.py — CWE 매핑 24개
│       ├── flawfinder_runner.py
│       ├── scanbuild_runner.py — CWE 매핑 15개, Semaphore(8)
│       ├── gcc_analyzer_runner.py — CWE 매핑 16개, check_available(profile)
│       ├── sarif_parser.py
│       ├── ruleset_selector.py — semgrep_include_extensions()
│       ├── path_utils.py
│       ├── sca_service.py    — SCA 오케스트레이션 + CloneCache
│       ├── sdk_resolver.py   — SDK 레지스트리 (외부 sdk-registry.json)
│       ├── ast_dumper.py     — 함수 추출 + origin 태깅 + Semaphore(16)
│       ├── include_resolver.py
│       ├── build_metadata.py
│       ├── build_runner.py   — 빌드 실행 + 타겟 탐색
│       ├── library_identifier.py
│       ├── library_differ.py — DiffResult 통일 shape + CloneCache
│       └── library_hasher.py
├── rules/automotive/        — 커스텀 Semgrep 룰 53개 (9 YAML)
├── benchmark/               — Juliet 벤치마크 러너 + 코드그래프 품질 평가
├── tests/                   — 351개 테스트 (23개 파일)
└── requirements.txt
```

### 기동 / 환경

```bash
./scripts/start-sast-runner.sh
tail -20 logs/s4-sast-runner.jsonl
```

`.env`:
```env
SAST_PORT=9000
SAST_SCAN_TIMEOUT=120
SAST_MAX_CONCURRENT_SCANS=1
SAST_SDK_ROOT=/home/kosh/sdks
```

**주의**: `list[str]` 타입 필드를 `.env`에 쓰면 pydantic-settings JSON 파싱 실패. `str` 타입 + `@property`로 우회 (config.py 참조).

### Observability

`docs/specs/observability.md` 준수.
- service 식별자: `s4-sast`
- 로그 파일: `logs/s4-sast-runner.jsonl`
- JSON structured, `time` epoch ms, `level` 숫자 (pino 표준)
- `X-Request-Id` 전파

---

## 3. 핵심 설계 원칙

- **결정론적 처리 최대화, LLM 결정 표면 최소화**
- **도구별 profile 분리** — 컴파일 기반 도구만 SDK enriched, 나머지는 original
- **scope-early** — `thirdPartyPaths` 파일을 도구 실행 전에 제외 (OOM 방지)
- **경계면 분석** — SDK/라이브러리 경로 finding이라도 dataFlow에 사용자 코드 포함 시 유지 (`origin: "cross-boundary"`)
- **gcc-fanalyzer는 `-c`** (`-fsyntax-only`에서는 analyzer가 실행 안 됨)
- **scan-build는 `-plist`** (없으면 plist 파일 미생성)
- **파일별 개별 실행** (gcc-fanalyzer, scan-build — 동일 심볼 충돌 방지)
- **CWE는 전 도구에서 태깅** — scan-build/gcc-fanalyzer도 매핑 추가 완료
- **Semgrep taint + sanitizer** — source/sink 자동 추적 + 가드 패턴 제외

---

## 4. SDK 레지스트리

```
$SAST_SDK_ROOT/              <- .env: SAST_SDK_ROOT=/home/kosh/sdks
  ├── sdk-registry.json       <- SDK 메타데이터 (외부 설정, 코드 밖)
  └── ti-am335x/              <- sdkId = 폴더명
```

| sdkId | SDK | GCC 버전 | 비고 |
|-------|-----|:---:|------|
| `ti-am335x` | TI AM335x 08.02.00.24 | 9.2.1 | `-fanalyzer` 미지원 -> 호스트 gcc 폴백 또는 SDK gcc 재확인 |

API: `GET/POST/DELETE /v1/sdk-registry`

---

## 5. 관리하는 문서

| 문서 | 경로 |
|------|------|
| API 계약서 | `docs/api/sast-runner-api.md` |
| 기능 명세서 | `docs/specs/sast-runner.md` |
| 이 인수인계서 | `docs/s4-handoff/README.md` |
| 로드맵 | `docs/s4-handoff/roadmap.md` |
| 세션 로그 | `docs/s4-handoff/session-*.md` |

---

## 6. 다음 작업

`roadmap.md` 참조.
