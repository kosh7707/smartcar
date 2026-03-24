# S4. SAST Runner 인수인계서

> **반드시 `docs/AEGIS.md`를 먼저 읽을 것.** 프로젝트 공통 제약 사항, 역할 정의, 소유권이 그 문서에 있다.
> 이 문서는 S4(SAST Runner) 개발을 이어받는 다음 세션을 위한 인수인계서다.
> 이것만 읽으면 현재 상태를 파악하고 바로 작업을 이어갈 수 있어야 한다.
> **마지막 업데이트: 2026-03-24**

---

## 1. AEGIS 전체 그림

### 7인 체제 (2026-03-19 확정)

```
                     S1 (Frontend :5173)
                          │
                     S2 (AEGIS Core :3000)
                    ╱     │     ╲      ╲
                 S3       S4     S5      S6
               Agent    SAST     KB    동적분석
              :8001    :9000   :8002    :4000
                │
              S7 (LLM Gateway :8000)
                │
           LLM Engine (DGX Spark)
```

| 역할 | 담당 | 포트 |
|------|------|------|
| S1 | Frontend + QA | :5173 |
| S2 | AEGIS Core (Backend) — 플랫폼 오케스트레이터 | :3000 |
| S3 | Analysis Agent — 보안 분석 자율 에이전트 | :8001 |
| **S4** | **SAST Runner (정적 분석 전담)** | **:9000** |
| S5 | Knowledge Base (Neo4j + Qdrant) | :8002 |
| S6 | Dynamic Analysis (ECU Sim + Adapter) | :4000 |
| S7 | LLM Gateway + LLM Engine 관리 | :8000, DGX |

---

## 2. 너의 역할과 경계

### 너는

- **SAST Runner 전담 개발자** (`services/sast-runner/`)
- `docs/api/sast-runner-api.md` API 계약서 소유
- `docs/specs/sast-runner.md` 명세서 소유
- `scripts/start-sast-runner.sh` + `services/sast-runner/.env` 소유
- 10개 엔드포인트 관리: scan, functions, includes, metadata, libraries, build, build-and-analyze, discover-targets, sdk-registry, health
- SDK 레지스트리 관리 (`$SAST_SDK_ROOT/sdk-registry.json` 외부 파일)

### 너는 하지 않는다

- DGX Spark / LLM Engine 관리 → **S7**
- CVE 조회 → **S5** (`POST /v1/cve/batch-lookup`으로 이관 완료, 2026-03-19)
- 프롬프트 작성, LLM 응답 파싱 → S3
- 지식 그래프, 벡터 검색 → S5
- UI → S1
- `scripts/start.sh` / `scripts/stop.sh` 직접 수정 금지 → S2에 work-request

---

## 3. SAST Runner 서비스

### 개요

- **위치**: `services/sast-runner/` (monorepo 내, WSL2 로컬)
- **스택**: Python 3.12 + FastAPI + Uvicorn
- **포트**: 9000
- **버전**: v0.4.0
- **API 계약**: `docs/api/sast-runner-api.md`
- **명세서**: `docs/specs/sast-runner.md`

### 6개 SAST 도구

| 도구 | 역할 | CWE 태깅 | 비고 |
|------|------|:---:|------|
| Semgrep | 패턴 매칭 | O (SARIF) | C++ 자동 스킵. 커스텀 룰 `rules/` 포함 |
| Cppcheck | 코드 품질 + CTU | O (XML) | SDK 헤더 제외 (original profile) |
| clang-tidy | CERT 코딩 표준 + 버그 | O (매핑 24개) | enriched profile (SDK 헤더 포함) |
| Flawfinder | 위험 함수 빠른 스캔 | O (regex) | |
| scan-build | Clang Static Analyzer | O (매핑 15개) | `-plist` 필수. 파일별 개별 실행 |
| gcc -fanalyzer | GCC 경로 민감 분석 | O (출력 직접 + 매핑 16개) | `-c` 필수 (`-fsyntax-only` 안됨). 파일별 개별 실행. GCC 10+ 필요 → 미지원 시 호스트 gcc 폴백 |

### 도구별 profile 분리 (중요)

orchestrator가 도구에 전달하는 BuildProfile이 다르다:

| 도구 | 전달되는 profile | 이유 |
|------|:---:|------|
| clang-tidy, scan-build | **enriched** (SDK 헤더 포함) | 컴파일 기반 — 헤더가 있어야 분석 가능 |
| Cppcheck | **original** (사용자 경로만) | SDK 헤더 -I 시 전부 파싱하여 타임아웃 |
| gcc-fanalyzer | **original** (사용자 경로만) | 호스트 gcc 폴백 시 ARM 헤더 불일치 방지 |
| Semgrep, Flawfinder | 없음 | 텍스트/패턴 기반 |

### 코드 구조

```
services/sast-runner/
├── app/
│   ├── main.py              — FastAPI v0.4.0, JSON 로깅
│   ├── config.py            — pydantic-settings (SAST_ prefix)
│   ├── context.py           — contextvars requestId 전파
│   ├── errors.py            — 커스텀 에러 4종
│   ├── routers/scan.py      — 10개 엔드포인트
│   ├── schemas/
│   │   ├── request.py       — ScanRequest, BuildProfile
│   │   └── response.py      — SastFinding, ScanResponse, HealthResponse
│   └── scanner/
│       ├── orchestrator.py   — 6도구 병렬 + 도구별 profile 분리
│       ├── semgrep_runner.py — custom_rules_dir 연결됨
│       ├── cppcheck_runner.py
│       ├── clangtidy_runner.py — CWE 매핑 24개
│       ├── flawfinder_runner.py
│       ├── scanbuild_runner.py — CWE 매핑 15개, -plist, 파일별 실행
│       ├── gcc_analyzer_runner.py — CWE 매핑 16개 + gcc 출력 직접 파싱, 파일별 실행, GCC 버전 체크 + 캐시
│       ├── sarif_parser.py
│       ├── ruleset_selector.py
│       ├── sdk_resolver.py   — SDK 레지스트리 (외부 sdk-registry.json 로드)
│       ├── ast_dumper.py     — 함수 추출 + origin 태깅 (서드파티 출처 식별)
│       ├── include_resolver.py
│       ├── build_metadata.py
│       ├── build_runner.py   — 빌드 실행 + 타겟 탐색 + buildCommand 감지
│       ├── library_identifier.py
│       ├── library_differ.py
│       └── library_hasher.py
├── rules/automotive/        — 커스텀 Semgrep 룰
│   ├── command-injection.yaml  (CWE-78, 5개 룰)
│   ├── divide-by-zero.yaml     (CWE-369, 7개 룰)
│   ├── integer-overflow.yaml   (CWE-190, 5개 룰)
│   ├── hardcoded-credentials.yaml (CWE-798, 2개 룰)
│   └── weak-prng.yaml         (CWE-338, 2개 룰)
├── benchmark/               — Juliet 벤치마크 러너
│   ├── juliet_runner.py
│   ├── juliet_manifest.py
│   ├── cwe_matcher.py
│   ├── metrics.py
│   └── data/baselines/      — 측정 결과 JSON
├── tests/                   — 51개 테스트
└── requirements.txt
```

### 기동 방법

```bash
./scripts/start-sast-runner.sh
```

스크립트 내부: `.env` 로드 → `PATH`에 `.venv/bin` 추가 → `.venv/bin/python -m uvicorn`

### .env

```env
SAST_PORT=9000
SAST_SCAN_TIMEOUT=120
SAST_MAX_CONCURRENT_SCANS=1
SAST_SDK_ROOT=/home/kosh/sdks
```

**주의**: `list[str]` 타입 필드를 `.env`에 쓰면 pydantic-settings JSON 파싱 실패. `str` 타입 + `@property`로 우회 (config.py 참조).

### 로그

```bash
tail -20 logs/s4-sast-runner.jsonl
```

### Observability

`docs/specs/observability.md` 준수. 로그 레벨 숫자 표준, 서비스 식별자, X-Request-Id 전파 규칙은 해당 문서 참조.
- service 식별자: `s4-sast`
- 로그 파일: `logs/s4-sast-runner.jsonl`

---

## 4. SDK 레지스트리

```
$SAST_SDK_ROOT/              ← .env: SAST_SDK_ROOT=/home/kosh/sdks
  ├── sdk-registry.json       ← SDK 메타데이터 (외부 설정, 코드 밖)
  └── ti-am335x/              ← sdkId = 폴더명 (현재 ~/ti-sdk 심링크)
```

`sdk-registry.json` 예시:
```json
{
  "ti-am335x": {
    "description": "TI Processor SDK Linux AM335x 08.02.00.24",
    "sysroot": "linux-devkit/sysroots/x86_64-arago-linux",
    "compiler_prefix": "arm-none-linux-gnueabihf",
    "gcc_version": "9.2.1",
    "environment_setup": "linux-devkit/environment-setup-armv7at2hf-neon-linux-gnueabi"
  }
}
```

| sdkId | SDK | 크로스 컴파일러 | 헤더 | env-setup | GCC 버전 |
|-------|-----|----------------|:---:|:---:|:---:|
| `ti-am335x` | TI AM335x 08.02.00.24 | `arm-none-linux-gnueabihf-gcc` | 7개 | O | 9.2.1 (**-fanalyzer 미지원** → 호스트 폴백) |

새 SDK 추가: `$SAST_SDK_ROOT/` 하위에 폴더 설치 → `sdk-registry.json`에 항목 추가. 코드 수정 불필요.

---

## 5. Juliet 벤치마크

### 개요

NIST Juliet Test Suite C/C++ v1.3으로 CWE별 Recall을 측정하는 인프라.

```bash
cd services/sast-runner
.venv/bin/python -m benchmark.juliet_runner \
    --juliet-path ~/Juliet/C \
    --cwes 78,121,122,190,416,476 \
    --variant-filter 01 \
    --output benchmark/data/baselines/result.json
```

Juliet 위치: `~/Juliet/C/` (프로젝트 외부, 106K 파일)

### 최신 Recall 결과 (v0.4.0, 12 CWE, 361 파일)

| Tier | CWE | Recall | 주력 도구 |
|------|-----|:---:|---|
| S | CWE-476 NULL deref | **100%** | Cppcheck + clang-tidy + gcc-fanalyzer + scan-build |
| S | CWE-134 Format String | **100%** | Flawfinder |
| A | CWE-401 Memory Leak | **95%** | gcc-fanalyzer |
| A | CWE-121 Stack BOF | **82%** | Flawfinder + gcc-fanalyzer |
| A | CWE-78 Cmd Injection | **80%** | Flawfinder + clang-tidy + Semgrep |
| A | CWE-122 Heap BOF | **80%** | Flawfinder + gcc-fanalyzer |
| B | CWE-252 Unchecked Return | **72%** | clang-tidy |
| B | CWE-416 UAF | **67%** | gcc-fanalyzer + clang-tidy + scan-build |
| B | CWE-680 Int→BOF | **67%** | Flawfinder + Semgrep |
| C | CWE-457 Uninitialized | **56%** | gcc-fanalyzer + Cppcheck |
| C | CWE-190 Int Overflow | **53%** | clang-tidy + Flawfinder + Semgrep |
| D | CWE-369 Divide by Zero | **22%** | Cppcheck + Semgrep |
| | **Overall** | **70.9%** | |

### 초기 대비 개선

| 수정 | 효과 |
|------|------|
| gcc-fanalyzer `-fsyntax-only` → `-c` | 도구 부활 (0% → 동작) |
| gcc-fanalyzer/scan-build 파일별 개별 실행 | 심볼 충돌 해결 |
| scan-build `-plist` 추가 | plist 출력 활성화 (0% → 동작) |
| CWE 매핑 추가 (3개 runner) | CWE 태깅 → 벤치마크 매칭 |
| clang-tidy `narrowing-conversions` → CWE-190 | CWE-190 22%→46% |
| 커스텀 Semgrep 룰 (CWE-369, 190) | CWE-369 11%→22%, CWE-190 46%→53% |
| Cppcheck `--check-level=exhaustive` | 정밀 분석 활성화 |
| **Overall** | **54.5% → 70.9% (+16.4%)** |

---

## 6. 현재 상태

### 완료

- [x] 6도구 SAST + SCA + 코드 구조 + 빌드 자동화 (v0.4.0)
- [x] CVE 조회 → S5 이관 (`cve_lookup.py` 삭제)
- [x] SDK 경로 표준화 (`SAST_SDK_ROOT` + sdkId = 폴더명)
- [x] gcc-fanalyzer/scan-build 버그 수정 + 파일별 실행
- [x] CWE Enrichment (scan-build 15개, gcc-fanalyzer 16개 + 출력 직접 파싱, clang-tidy 24개)
- [x] 커스텀 Semgrep 룰 3종 (CWE-78, 798, 338) + custom_rules_dir 연결
- [x] Juliet 벤치마크 인프라 (12 CWE, 361파일, 4분 측정)
- [x] orchestrator 도구별 profile 분리 (Cppcheck/gcc-fanalyzer 타임아웃 해결)
- [x] gcc-fanalyzer GCC 버전 체크 + 호스트 폴백 (GCC 9.x SDK 대응)
- [x] `smartcar` → `AEGIS` 네이밍 → `s4-sast` 로그 표준화 (`s4-sast-runner.jsonl`, level 숫자, service `s4-sast`)
- [x] 기동 스크립트 수정 (venv PATH, .env 파싱)
- [x] 통합 테스트 성공 (S3 Agent Phase 1/2 전 구간)
- [x] 51개 테스트 통과
- [x] `/v1/includes`에 `projectPath` 지원 추가
- [x] SDK environment-setup 자동 적용 (`build_runner.py`)
- [x] `buildCommand` 자동 감지 (빌드 스크립트 우선 → CMake → Make → configure)
- [x] 커스텀 Semgrep 룰 추가: CWE-369 (7룰), CWE-190 (5룰)
- [x] Cppcheck `--check-level=exhaustive` 활성화
- [x] 벤치마크 `--no-custom-rules` delta 측정 기능
- [x] Juliet Recall 54.5% → **70.9%** (+16.4%)
- [x] `/v1/scan` 응답에 `codeGraph` + `sca` 통합 (projectPath 모드)
- [x] `/v1/functions` origin 태깅 (third-party / modified-third-party 식별)
- [x] `/v1/build` 엔드포인트 신규 (빌드 전용, 파이프라인 단계별 제어)
- [x] `/v1/discover-targets` 엔드포인트 신규 (빌드 타겟 자동 탐색)
- [x] `/v1/sdk-registry` 엔드포인트 신규 (등록된 SDK 목록, 빌드 Agent 연동)
- [x] SDK 레지스트리 외부화 (`sdk-registry.json`, 코드 수정 불필요)
- [x] 전역 SastRunnerError 예외 핸들러 + 전 엔드포인트 에러 핸들링
- [x] Observability v2 준수 (service `s4-sast`, level 숫자, X-Request-Id 전파)

### 미완료

- (현재 없음 — 향후 개선 아이디어는 아래 참조)

### 향후 개선 아이디어

- S3 빌드 Agent 연동: S3가 `build-resolve` Agent 구현 중 — `/v1/build` + `/v1/sdk-registry`로 연동 예정
- functions 추출 성능: 782파일 79.8초 → 병렬화 또는 vendored 라이브러리 스킵 검토
- CWE-369 (22%) / CWE-190 (53%) 추가 개선: 데이터 플로우 추적은 SAST 한계 → S3 LLM에 위임
- Juliet variant 확장: 현재 variant_01만 → 전체 variant 벤치마크

---

## 7. 관리하는 문서

| 문서 | 경로 |
|------|------|
| API 계약서 | `docs/api/sast-runner-api.md` |
| 기능 명세서 | `docs/specs/sast-runner.md` |
| 이 인수인계서 | `docs/s4-handoff/README.md` |

---

## 8. 통합 테스트 결과 (2026-03-20)

S3 Agent가 S4를 호출한 전체 흐름:

```
Phase 1: S3 → S4 /v1/scan        → 49 findings (6도구, 11초)
         S3 → S4 /v1/functions    → 1,329 함수 (75초)
         S3 → S4 /v1/libraries    → 6 라이브러리 (44초)
         S3 → S5 /v1/cve/batch-lookup → CVE 실시간 조회
Phase 2: S3 → S7 → LLM           → 3 claims (핵심 취약점만 정제)
```

LLM이 49개 findings에서 **CWE-78, CWE-362, CWE-807** 3건만 claim으로 판정. 나머지는 caveats로 분류. "결정론적 Phase 1 + 자율적 Phase 2" 시너지 확인.

---

## 9. 핵심 설계 원칙

- **결정론적 처리 최대화, LLM 결정 표면 최소화**
- **도구별 profile 분리** — 컴파일 기반 도구만 SDK enriched, 나머지는 original
- **gcc-fanalyzer는 `-c`** (`-fsyntax-only`에서는 analyzer가 실행 안 됨)
- **scan-build는 `-plist`** (없으면 plist 파일 미생성)
- **파일별 개별 실행** (gcc-fanalyzer, scan-build — 동일 심볼 충돌 방지)
- **CWE는 전 도구에서 태깅** — scan-build/gcc-fanalyzer도 매핑 추가 완료
