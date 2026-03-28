# S4. SAST Runner 기능 명세 (v0.7.0)

> SAST Runner는 C/C++ 프로젝트의 보안 분석에 필요한 **결정론적 전처리**를 담당하는 서비스다.
> 6개 SAST 도구 병렬 실행, SCA(라이브러리 식별 + upstream diff), 코드 구조 추출,
> 빌드 메타데이터 추출, 빌드 자동 실행을 하나의 API로 제공한다.
> S2(Backend) 또는 S3(Analysis Agent)가 호출하며, S4(SAST Runner)가 소유한다.

---

## 1. 핵심 설계 원칙

> **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화한다.**
>
> 도구 선택, 실행, 필터링, 정규화, 라이브러리 식별은 전부 결정론적.
> CVE 조회는 S5(KB)로 이관됨. LLM에게는 정제된 판단 재료만 전달한다.

---

## 2. 서비스 개요

| 항목 | 값 |
|------|-----|
| 위치 | `services/sast-runner/` |
| 스택 | Python 3.12 + FastAPI + Uvicorn |
| 포트 | 9000 |
| 버전 | v0.7.0 |
| API 계약 | `docs/api/sast-runner-api.md` |
| 테스트 | 333개 (22개 파일) |

---

## 3. 엔드포인트 (12개)

| 엔드포인트 | 용도 |
|-----------|------|
| `POST /v1/scan` | 6개 SAST 도구 병렬 + 실행 보고서 + SDK 해석 + scope-early + 노이즈 필터링 |
| `POST /v1/functions` | clang AST -> 함수+호출 관계 + origin 태깅 |
| `POST /v1/includes` | gcc -E -M -> 인클루드 트리 |
| `POST /v1/metadata` | gcc -E -dM -> 타겟 매크로/아키텍처 |
| `POST /v1/libraries` | 라이브러리 식별 + upstream diff (CVE는 S5로 이관) |
| `POST /v1/build` | 빌드만 수행 (bear -> compile_commands.json). 파이프라인 단계별 제어용 |
| `POST /v1/build-and-analyze` | bear 빌드 -> 위 전부 한 번에. buildCommand 자동 감지 + SDK env-setup |
| `POST /v1/discover-targets` | 프로젝트 내 빌드 타겟 자동 탐색 (파일시스템 스캔) |
| `GET /v1/sdk-registry` | 등록된 SDK 목록 조회 |
| `POST /v1/sdk-registry` | SDK 검증 + 등록 |
| `DELETE /v1/sdk-registry/:sdkId` | SDK 삭제 |
| `GET /v1/health` | 6개 도구 상태 + 버전 |

---

## 4. 입력 모드 (3단계)

| 레벨 | 입력 | 사용자 부담 | 정확도 |
|------|------|-----------|--------|
| 최소 | `projectPath`만 | 없음 | 중간 |
| 권장 | `projectPath` + `buildCommand` | 빌드 명령어 | **높음** (compile_commands 자동 생성) |
| 고급 | `projectPath` + `compileCommands` + `buildProfile` | 수동 제공 | 최고 |

### 주요 입력 파라미터

- `buildProfile`: 전 필드 optional. `sdkId`만 보내면 sdk-registry에서 나머지 자동 해석
- `options.tools`: 도구 서브셋 선택 (예: `["cppcheck", "flawfinder"]`). 미지정 시 6개 전부
- `thirdPartyPaths`: vendored 서드파티 경로 목록. scope-early 필터링에 사용
- `X-Timeout-Ms` 헤더: 타임아웃 우선순위 — 헤더 > body `options.timeoutSeconds` > 기본값 600초

---

## 5. SAST 도구 (6개)

| 도구 | 역할 | CWE 태깅 | profile | 비고 |
|------|------|:---:|:---:|------|
| Semgrep | 패턴 매칭 + **taint mode** | O (SARIF) | — | C++ 프로젝트에서 확장자 필터 (`--include *.c *.h`). 커스텀 룰 9종 53개 |
| Cppcheck | 코드 품질 + CTU | O (XML) | **original** | SDK 헤더 제외. `--check-level=exhaustive` |
| clang-tidy | CERT 코딩 표준 + 버그 (CWE 매핑 24개) | O | **enriched** | SDK 헤더 포함 |
| Flawfinder | 위험 함수 빠른 스캔 | O (regex) | — | |
| scan-build | Clang Static Analyzer (CWE 매핑 15개) | O | **enriched** | `-plist` 필수. 파일별 개별 실행. `Semaphore(8)` |
| gcc -fanalyzer | GCC 경로 민감 분석 (CWE 매핑 16개 + 출력 직접 파싱) | O | **original** | `-c` 필수. 파일별 개별 실행. `Semaphore(8)`. GCC 10+ 필요 |

### 도구 최소 버전

| 도구 | 최소 버전 | 비고 |
|------|---------|------|
| Semgrep | >= 1.40 | SARIF 출력 안정성 |
| Cppcheck | >= 2.13 | `--check-level=exhaustive` 지원 |
| Flawfinder | >= 2.0.19 | CSV 출력 형식 호환 |
| clang-tidy | >= 16 | CERT 체커 세트 완성도 |
| scan-build | >= 16 | plist 출력 안정성 |
| gcc (fanalyzer) | >= 10 | `-fanalyzer` 동작. 13+ 권장 (정밀도 개선) |
| bear | >= 3.0 | `compile_commands.json` 생성 |
| clang (AST dump) | >= 16 | `-ast-dump=json` 형식 호환 |

서버 시작 시 `check_tools()`가 버전을 확인하고, 최소 버전 미만 시 경고 로그를 기록한다 (차단하지 않음). 결과는 TTL 300초로 캐시.

### 도구 자동 선택

| 조건 | 동작 |
|------|------|
| C++ 프로젝트 | Semgrep **확장자 필터**: `.c`/`.h` 파일만 스캔 (`--include` 플래그). 스킵하지 않음 |
| 호스트 gcc 미지원 + SDK에 GCC 10+ | gcc-fanalyzer **SDK 컴파일러로 재확인** → 사용 가능하면 활성화 |
| clang 미설치 | scan-build, clang-tidy 스킵 |
| `options.tools` 명시 | 지정된 도구만 실행 |

### 도구별 profile 분리

오케스트레이터가 도구에 전달하는 BuildProfile이 다르다:

| 도구 | 전달되는 profile | 이유 |
|------|:---:|------|
| clang-tidy, scan-build | **enriched** (SDK 헤더 포함) | 컴파일 기반 — 헤더가 있어야 분석 가능 |
| Cppcheck | **original** (사용자 경로만) | SDK 헤더 -I 시 전부 파싱하여 타임아웃 |
| gcc-fanalyzer | **original** (사용자 경로만) | 호스트 gcc 폴백 시 ARM 헤더 불일치 방지 |
| Semgrep, Flawfinder | 없음 | 텍스트/패턴 기반 |

---

## 6. scope-early 필터링

`thirdPartyPaths`에 해당하는 파일을 **도구 실행 전에 제외**하여 OOM과 불필요한 분석을 방지한다.

### 적용 범위

| 도구 | scope-early 적용 | 이유 |
|------|:---:|------|
| clang-tidy, scan-build, gcc-fanalyzer | **O** (scoped_files) | 파일별 개별 실행 — 파일 수가 직접 비용 |
| Cppcheck | X (scan_dir 전체) | `--project=` 기반, 전체 디렉토리 필요 |
| Semgrep, Flawfinder | X (scan_dir 전체) | 텍스트 기반, 경량 |

### 필터링 파이프라인 (3단계)

```
1. [scope-early] thirdPartyPaths 파일 → 도구 실행 전 제외 (heavy analyzer만)
2. [도구 실행] 6개 도구 병렬
3. [post-filter] SDK 절대 경로 + 서드파티 상대 경로 findings 제거
   └── 단, dataFlow에 사용자 코드 step이 있으면 "cross-boundary"로 유지
```

---

## 7. 경계면 분석 (cross-boundary)

SDK/라이브러리 경로 finding이라도 **dataFlow에 사용자 코드가 포함**되면 유지한다.

### 분류 기준

| 조건 | 결과 |
|------|------|
| 절대 경로 (SDK/시스템 헤더) + dataFlow에 사용자 코드 없음 | 제거 (`sdk_noise_removed`) |
| 절대 경로 + dataFlow에 사용자 코드 있음 | 유지, `origin: "cross-boundary"` |
| thirdPartyPaths 해당 + dataFlow에 사용자 코드 없음 | 제거 (`third_party_removed`) |
| thirdPartyPaths 해당 + dataFlow에 사용자 코드 있음 | 유지, `origin: "cross-boundary"` |
| 그 외 상대 경로 | 사용자 코드 — 유지 |

### 실행 보고서 (FindingsFilterInfo)

```json
{
  "beforeFilter": 150,
  "afterFilter": 120,
  "sdkNoiseRemoved": 20,
  "thirdPartyRemoved": 10,
  "crossBoundaryKept": 5,
  "filesScopedOut": 45
}
```

---

## 8. SCA (Software Composition Analysis)

### 라이브러리 식별

프로젝트 내 vendored 라이브러리를 자동 탐지:
- 탐색 경로: `libraries/`, `lib/`, `libs/`, `third_party/`, `vendor/`, `deps/`, `external/`, `contrib/`, `ext/`, `transport/`
- `.git` 디렉토리 -> 커밋 해시 + 리모트 URL + `git describe --tags`
- CMakeLists.txt -> `project(name VERSION x.y.z)`
- configure.ac -> `AC_INIT([name], [version])`
- 서브 라이브러리 재귀 탐색

### upstream diff

- SHA256 파일 해시 비교 (패키징/줄 끝 차이에 면역, 소스 코드만)
- **DiffResult 통일 shape**: 성공/에러 모두 동일한 필드 구조 (nullable)
  ```json
  {
    "matchedVersion": "v1.16.0",
    "repoUrl": "https://...",
    "matchRatio": 0.95,
    "identicalFiles": 10,
    "modifiedFiles": 2,
    "addedFiles": 1,
    "deletedFiles": 0,
    "modifications": [...],
    "error": null
  }
  ```
- **CloneCache**: TTL 기반 git clone 캐시 (`/tmp/aegis-lib-cache/`). 동일 repo 재요청 시 `git fetch`만 수행
  - 설정: `SAST_LIB_CACHE_DIR`, `SAST_LIB_CACHE_TTL` (기본 3600초)

### CVE 조회 -> S5 이관 (2026-03-19)

CVE 조회는 S5(KB) `POST /v1/cve/batch-lookup`으로 이관됨. S3 Agent가 S4의 `/v1/libraries` 응답(`name`, `version`, `repoUrl`)을 S5에 전달하여 조회.

---

## 9. 코드 구조 추출

clang AST 기반 함수+호출 관계:
- `projectPath` 모드 -- 실제 프로젝트 디렉토리에서 헤더 포함 분석
- `NamespaceDecl` 재귀 순회 (C++ namespace 함수 지원)
- `CallExpr` -> `ImplicitCastExpr` -> `DeclRefExpr` + `MemberExpr` 처리
- 3단계 필터링: `loc.file` + `source_lines` + `CompoundStmt`
- 사용자 코드 함수만 반환 (시스템/SDK 함수 제외)
- **skip_paths**: vendored/third-party 경로는 clang 실행 전 조기 스킵
- **병렬화**: `asyncio.gather` + `Semaphore(16)` 동시 실행

### origin 태깅 (서드파티 출처 식별)

`projectPath` 모드에서 라이브러리 식별 결과와 함수 파일 경로를 교차 대조:
- `origin: "third-party"` -- 라이브러리 경로 하위 + matchRatio 100% (원본)
- `origin: "modified-third-party"` -- matchRatio < 100% (사용자 수정)
- 필드 없음 -> 프로젝트 코드
- `originalLib`, `originalVersion` 포함 (S5 코드 그래프 + S3 LLM 분석에 활용)

---

## 10. 빌드 자동 실행

`bear -- buildCommand` -> `compile_commands.json` 자동 생성.

### buildCommand 자동 감지

`buildCommand` 미지정 시 프로젝트 디렉토리에서 자동 감지 (우선순위 순):
1. 빌드 스크립트: `scripts/cross_build.sh`, `scripts/build.sh`, `cross_build.sh`, `build.sh`
2. `CMakeLists.txt` -> `mkdir -p build && cd build && cmake .. && make`
3. `Makefile` -> `make`
4. `configure` -> `./configure && make`

### `/v1/build` 옵션

- `wrapWithBear`: 기본 true. false면 bear 없이 순수 빌드 실행
- `userEntries` 필드: CMakeFiles/ 임시 항목 자동 필터링
- exitCode != 0 -> `success: false`

### SDK environment-setup

`buildProfile.sdkId`가 지정되면 SDK의 environment-setup 스크립트를 자동 source:
```
source $SDK_ROOT/$sdkId/.../environment-setup-* && buildCommand
```

---

## 11. SDK 레지스트리

외부 파일(`$SAST_SDK_ROOT/sdk-registry.json`)로 SDK 메타데이터를 관리한다.

```
$SAST_SDK_ROOT/               <- .env: SAST_SDK_ROOT=/home/kosh/sdks
  |- sdk-registry.json         <- SDK 메타데이터 (외부 설정, 코드 밖)
  +- ti-am335x/                <- sdkId = 폴더명
```

### API

| 엔드포인트 | 용도 |
|-----------|------|
| `GET /v1/sdk-registry` | 등록된 SDK 목록 |
| `POST /v1/sdk-registry` | SDK 등록 (경로 검증 + 컴파일러 존재 확인) |
| `DELETE /v1/sdk-registry/:sdkId` | SDK 삭제 + 캐시 무효화 |

새 SDK 추가: `$SAST_SDK_ROOT/` 하위에 폴더 설치 -> `POST /v1/sdk-registry`로 등록 또는 `sdk-registry.json` 직접 편집. 코드 수정 불필요.

---

## 12. 커스텀 Semgrep 룰

`rules/automotive/` 디렉토리에 자동차 임베디드 특화 룰 53개 (9 YAML 파일).

| 파일 | CWE | 룰 수 | 모드 |
|------|-----|:---:|------|
| divide-by-zero.yaml | CWE-369 | 7 | **taint** (atoi/rand -> division sink) + **sanitizer** (if != 0) + 패턴 |
| integer-overflow.yaml | CWE-190 | 7 | **taint** (atoi/rand -> arithmetic sink) + **sanitizer** (bounds check) + MAX 상수 + 패턴 |
| use-after-free.yaml | CWE-416 | 4 | **taint** (free -> use sink) + **sanitizer** (= NULL/malloc/calloc/realloc) + 패턴 |
| command-injection.yaml | CWE-78 | 5 | 패턴 |
| buffer-overflow-write.yaml | CWE-787 | 4 | 패턴 |
| input-validation.yaml | CWE-20 | 5 | taint |
| taint-sources.yaml | 다수 | 5 | taint (recv/read/fgets -> 위험 함수) |
| hardcoded-credentials.yaml | CWE-798 | 2 | 패턴 |
| weak-prng.yaml | CWE-338 | 2 | 패턴 |

### taint mode + sanitizer

taint 룰은 **source -> sink** 데이터 플로우를 자동 추적하며, **sanitizer** 패턴이 있으면 가드된 코드를 제외한다:

```yaml
# 예: divide-by-zero taint rule
pattern-sources:
  - pattern: atoi(...)
pattern-sinks:
  - patterns:
      - pattern: $X / $SINK
      - focus-metavariable: $SINK
pattern-sanitizers:              # <- FP 감소
  - patterns:
      - pattern-inside: |
          if ($SINK != 0) { ... }
      - focus-metavariable: $SINK
```

전 룰에 `automotive_rationale` + ISO 26262/MISRA/AUTOSAR/CERT 참조 포함.

---

## 13. 관측성

| 항목 | 값 |
|------|-----|
| service 식별자 | `s4-sast` |
| 로그 파일 | `logs/s4-sast-runner.jsonl` |
| 형식 | JSON structured, `time` epoch ms, `level` 숫자 (pino 표준) |
| 요청 추적 | `contextvars` 기반 `requestId` 전 레이어 전파 |
| X-Request-Id | 수신 -> 로그 기록 -> 응답 헤더 반환 |
| 실행 보고서 | 응답 `execution` 필드에 도구별 상태/시간/버전/스킵 사유 |

`docs/specs/observability.md` 준수.

### ToolExecutionResult

```json
{
  "status": "ok | failed | skipped",
  "findingsCount": 25,
  "elapsedMs": 1200,
  "skipReason": null,
  "version": "2.13.0"
}
```

---

## 14. Juliet 벤치마크 결과 (Overall Recall: 83.7%)

NIST Juliet Test Suite C/C++ v1.3 기반 12개 CWE, 361파일, variant 01 측정.

| Tier | CWE | Recall | 주력 도구 |
|------|-----|:---:|---|
| S | CWE-476 NULL deref | **100%** | Cppcheck + clang-tidy + gcc-fanalyzer + scan-build |
| S | CWE-134 Format String | **100%** | Flawfinder |
| S | CWE-401 Memory Leak | **95%** | gcc-fanalyzer |
| S | CWE-369 Divide by Zero | **94%** | **Semgrep taint** + Cppcheck |
| A | CWE-190 Int Overflow | **89%** | **Semgrep taint** + clang-tidy + Flawfinder |
| A | CWE-680 Int->BOF | **83%** | Flawfinder + Semgrep |
| A | CWE-121 Stack BOF | **82%** | Flawfinder + gcc-fanalyzer |
| A | CWE-78 Cmd Injection | **80%** | Flawfinder + clang-tidy + Semgrep |
| A | CWE-122 Heap BOF | **80%** | Flawfinder + gcc-fanalyzer |
| B | CWE-252 Unchecked Return | **72%** | clang-tidy |
| B | CWE-416 UAF | **67%** | gcc-fanalyzer + clang-tidy + scan-build |
| C | CWE-457 Uninitialized | **56%** | gcc-fanalyzer + Cppcheck |

### Noise 메트릭

벤치마크는 noise를 2종으로 분리 추적:
- **targeted noise**: 타겟 파일 내 wrong-CWE findings (의미 있는 FP 신호)
- **portfolio noise**: 비타겟 파일 findings (지원 파일 등, 무관한 활성화)

전체 variant (8,783파일) 벤치마크: Overall Recall **78.7%**

---

## 15. 의존성

```
fastapi>=0.115.0
uvicorn>=0.30.0
pydantic>=2.9.0
pydantic-settings>=2.5.0
python-json-logger>=2.0.7
semgrep>=1.40.0,<2.0.0
pytest>=7.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

---

## 16. 에이전트 파이프라인에서의 위치

```
Phase 1 (결정론적, LLM 없음):
  S3 -> SAST Runner:
    /v1/build-and-analyze  또는 개별 호출:
    |- /v1/scan       -> findings
    |- /v1/functions   -> 코드 그래프
    |- /v1/libraries   -> SCA (CVE는 S5)
    +- /v1/metadata    -> 타겟 정보

Phase 2 (LLM 해석):
  S3 -> S7 Gateway (:8000) -> LLM Engine -> 판단/분류
```

---

## 관련 문서

- [API 계약서](../api/sast-runner-api.md) -- 전체 엔드포인트 스키마
- [SastFinding 타입](../api/shared-models.md)
- [MSA Observability 규약](observability.md)
- [S4 인수인계서](../s4-handoff/README.md)
