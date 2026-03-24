# S4. SAST Runner 기능 명세 (v0.4.0)

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

## 2. 엔드포인트 (10개)

| 엔드포인트 | MCP Tool | 용도 |
|-----------|----------|------|
| `POST /v1/scan` | `sast.scan` | 6개 SAST 도구 병렬 + 실행 보고서 + SDK 해석 + 노이즈 필터링 |
| `POST /v1/functions` | `code.functions` | clang AST → 함수+호출 관계 (namespace, CallExpr, projectPath) |
| `POST /v1/includes` | `code.includes` | gcc -E -M → 인클루드 트리 (projectPath 지원) |
| `POST /v1/metadata` | `build.metadata` | gcc -E -dM → 타겟 매크로/아키텍처 (ARM vs x86) |
| `POST /v1/libraries` | `sca.libraries` | 라이브러리 식별 + upstream diff (CVE는 S5로 이관) |
| `POST /v1/build` | — | 빌드만 수행 (bear → compile_commands.json). 파이프라인 단계별 제어용 |
| `POST /v1/build-and-analyze` | — | bear 빌드 자동 실행 → 위 전부 한 번에. buildCommand 자동 감지 + SDK env-setup |
| `POST /v1/discover-targets` | — | 프로젝트 내 빌드 타겟 자동 탐색 (파일시스템 스캔) |
| `GET /v1/sdk-registry` | — | 등록된 SDK 목록 (빌드 Agent 매칭용) |
| `GET /v1/health` | — | 6개 도구 상태 |

---

## 3. 입력 모드 (3단계)

| 레벨 | 입력 | 사용자 부담 | 정확도 |
|------|------|-----------|--------|
| 최소 | `projectPath`만 | 없음 | 중간 |
| 권장 | `projectPath` + `buildCommand` | 빌드 명령어 | **높음** (compile_commands 자동 생성) |
| 고급 | `projectPath` + `compileCommands` + `buildProfile` | 수동 제공 | 최고 |

---

## 4. SAST 도구 (6개)

| 도구 | 역할 | BuildProfile 활용 |
|------|------|-------------------|
| Semgrep | 패턴 매칭 (C++에서 자동 스킵) | 룰셋 자동 선택. 커스텀 룰 `rules/` 5종 (CWE-78, 190, 338, 369, 798) |
| Cppcheck | 코드 품질 + CTU 분석 | `--std`, `-I`, `-D`, `--project=`, `--check-level=exhaustive`. **original profile** (SDK 헤더 제외) |
| clang-tidy | CERT 코딩 표준 + 버그 탐지 (CWE 매핑 24개) | `-std`, `-I`, `-D`, `-p`. **enriched profile** |
| Flawfinder | 위험 함수 빠른 스캔 | — |
| scan-build | Clang Static Analyzer 경로 민감 분석 (CWE 매핑 15개) | `-std`, `-I`, `-D`. **enriched profile**. `-plist` 필수. 파일별 개별 실행 |
| gcc -fanalyzer | GCC 경로 민감 분석 (CWE 매핑 16개 + 출력 직접 파싱) | `-c` 필수. 파일별 개별 실행. **GCC 10+ 필요** → 미지원 시 호스트 gcc 폴백. **original profile** |

### 도구 자동 선택

- C++ 프로젝트 → Semgrep 스킵
- SDK 크로스 컴파일러 GCC 9.x → gcc -fanalyzer **호스트 gcc로 폴백**
- clang 미설치 → scan-build, clang-tidy 스킵

### 도구별 profile 분리

- **enriched** (SDK 헤더 포함): clang-tidy, scan-build — 컴파일 기반 분석에 헤더 필요
- **original** (사용자 경로만): Cppcheck, gcc-fanalyzer — SDK 헤더 시 타임아웃/아키텍처 불일치

### SDK 레지스트리

`buildProfile.sdkId` → SDK 설치 경로 탐색 → 헤더 자동 `-I` 주입 + 크로스 컴파일러 선택 + 빌드 환경 설정.

**경로 규칙**: `.env`의 `SAST_SDK_ROOT` 하위에 `sdkId`와 동일한 폴더명으로 설치.

```
$SAST_SDK_ROOT/               ← .env: SAST_SDK_ROOT=/home/kosh/sdks
  ├── sdk-registry.json        ← SDK 메타데이터 (외부 설정, 코드 밖)
  └── ti-am335x/               ← sdkId = 폴더명
      └── linux-devkit/
          ├── environment-setup-armv7at2hf-...   ← 빌드 환경 (CC, CXX, SDKTARGETSYSROOT)
          └── sysroots/...                        ← 헤더, 컴파일러
```

`GET /v1/sdk-registry`로 등록된 SDK 목록을 조회 가능 (S3 빌드 Agent 연동용).

| sdkId | SDK | 크로스 컴파일러 | 헤더 | env-setup |
|-------|-----|----------------|:---:|:---:|
| `ti-am335x` | TI Processor SDK Linux AM335x 08.02.00.24 | `arm-none-linux-gnueabihf-gcc 9.2.1` | 7개 | O |

새 SDK 추가: `$SAST_SDK_ROOT/` 하위에 폴더 설치 → `sdk-registry.json`에 항목 추가. 코드 수정 불필요.

### SDK 노이즈 필터링

SDK 헤더 내부 findings 자동 제거 (절대 경로 기반). 실측: 254건 → 28건.

---

## 5. SCA (Software Composition Analysis)

### 라이브러리 식별

프로젝트 내 vendored 라이브러리를 자동 탐지:
- `.git` 디렉토리 → 커밋 해시 + 리모트 URL + `git describe --tags`
- CMakeLists.txt → `project(name VERSION x.y.z)`
- configure.ac → `AC_INIT([name], [version])`
- 서브 라이브러리 재귀 탐색 (wakaama/transport/tinydtls 등)

### upstream diff

- `.git` 커밋 해시 기반 정확한 upstream 매칭 (태그 불일치 해결)
- SHA256 파일 해시 비교 (패키징/줄 끝 차이에 면역)
- 소스 코드만 비교 (test/example/doc 제외)
- `matchRatio` 반환 (100% = 원본, <100% = 수정 있음)

### CVE 조회 → S5 이관 (2026-03-19)

CVE 조회는 S5(KB) `POST /v1/cve/batch-lookup`으로 이관됨. S3 Agent가 S4의 `/v1/libraries` 응답(`name`, `version`, `repoUrl`)을 S5에 전달하여 조회.

### RE100 실측

| 라이브러리 | 버전 | 일치율 | 수정 |
|-----------|------|--------|------|
| rapidjson | 1.1.0 | 100% ✅ | 0 |
| civetweb | 1.16 | 100% ✅ | 0 |
| mosquitto | 2.0.22 | 98.8% ⚠️ | 2파일 |
| libcoap | 4.3.5 | 99.1% ⚠️ | 1파일 |
| tinydtls | 0.8.6 | 100% ✅ | 0 |
| wakaama | ? | 97.6% ⚠️ | 1파일 |

---

## 6. 코드 구조 추출

clang AST 기반 함수+호출 관계:
- `projectPath` 모드 — 실제 프로젝트 디렉토리에서 헤더 포함 분석
- `NamespaceDecl` 재귀 순회 (C++ namespace 함수 지원)
- `CallExpr` → `ImplicitCastExpr` → `DeclRefExpr` + `MemberExpr` 처리
- 3단계 필터링: `loc.file` + `source_lines` + `CompoundStmt`
- 사용자 코드 함수만 반환 (시스템/SDK 함수 제외)

### origin 태깅 (서드파티 출처 식별)

`projectPath` 모드에서 라이브러리 식별 결과와 함수 파일 경로를 교차 대조:
- `origin: "third-party"` — 라이브러리 경로 하위 + matchRatio 100% (원본)
- `origin: "modified-third-party"` — matchRatio < 100% (사용자 수정)
- 필드 없음 → 프로젝트 코드
- `originalLib`, `originalVersion` 포함 (S5 코드 그래프 + S3 LLM 분석에 활용)

RE100 실측: 1,329개 전체 → **73개 사용자 함수**, 242개 호출 관계.

---

## 7. 빌드 자동 실행

`bear -- buildCommand` → `compile_commands.json` 자동 생성.

사용자가 빌드 명령어만 알려주면:
1. bear가 빌드를 감싸서 모든 컴파일 명령을 캡처
2. compile_commands.json 생성 (파일별 정확한 `-I`, `-D`, `-std`)
3. SAST 도구가 이를 사용하여 정확한 분석

### buildCommand 자동 감지

`buildCommand` 미지정 시 프로젝트 디렉토리에서 자동 감지 (우선순위 순):
1. 빌드 스크립트: `scripts/cross_build.sh`, `scripts/build.sh`, `cross_build.sh`, `build.sh`
2. `CMakeLists.txt` → `mkdir -p build && cd build && cmake .. && make`
3. `Makefile` → `make`
4. `configure` → `./configure && make`

**주의**: 크로스컴파일(SDK) 프로젝트에서는 자동 감지가 부정확할 수 있음. `buildCommand`를 명시적으로 제공 권장. S3 빌드 Agent(`build-resolve`)가 LLM으로 정확한 빌드 명령을 추론하는 방식으로 해결 예정.

### SDK environment-setup

`buildProfile.sdkId`가 지정되면 SDK의 environment-setup 스크립트를 자동 source:
```
source $SDK_ROOT/$sdkId/.../environment-setup-* && buildCommand
```
이를 통해 CC, CXX, SDKTARGETSYSROOT 등 크로스 컴파일 환경이 자동 설정된다.

RE100 실측: `bear -- ./scripts/cross_build.sh` → 7엔트리, 5초.

---

## 8. 관측성

| 항목 | 값 |
|------|-----|
| service 식별자 | `s4-sast` |
| 로그 파일 | `logs/s4-sast-runner.jsonl` |
| 형식 | JSON structured, `time` epoch ms, `level` 숫자 (pino 표준) |
| 요청 추적 | `contextvars` 기반 `requestId` 전 레이어 전파 |
| X-Request-Id | 수신 → 로그 기록 → 응답 헤더 반환 |
| 실행 보고서 | 응답 `execution` 필드에 도구별 상태/시간/스킵 사유 |

`docs/specs/observability.md` 준수.

---

## 9. 에이전트 파이프라인에서의 위치

```
Phase 1 (결정론적, LLM 없음, ~140초):
  S3 → SAST Runner:
    /v1/build-and-analyze  또는 개별 호출:
    ├─ /v1/scan       → findings
    ├─ /v1/functions   → 코드 그래프
    ├─ /v1/libraries   → SCA (CVE는 S5)
    └─ /v1/metadata    → 타겟 정보

Phase 2 (LLM 해석, ~34초):
  S3 → S7 Gateway (:8000) → LLM Engine → 판단/분류
```

---

## 10. Juliet 벤치마크 결과 (Overall Recall: 70.9%)

NIST Juliet Test Suite C/C++ v1.3 기반 12개 CWE, 361파일 측정.

| CWE | Recall | 주력 도구 |
|-----|:---:|---|
| CWE-476 NULL deref | **100%** | Cppcheck + clang-tidy + gcc-fanalyzer + scan-build |
| CWE-134 Format String | **100%** | Flawfinder |
| CWE-401 Memory Leak | **95%** | gcc-fanalyzer |
| CWE-121 Stack BOF | **82%** | Flawfinder + gcc-fanalyzer |
| CWE-78 Cmd Injection | **80%** | Flawfinder + clang-tidy + Semgrep |
| CWE-122 Heap BOF | **80%** | Flawfinder + gcc-fanalyzer |
| CWE-252 Unchecked Return | **72%** | clang-tidy |
| CWE-416 UAF | **67%** | gcc-fanalyzer + clang-tidy + scan-build |
| CWE-680 Int→BOF | **67%** | Flawfinder + Semgrep |
| CWE-457 Uninitialized | **56%** | gcc-fanalyzer + Cppcheck |
| CWE-190 Int Overflow | **53%** | clang-tidy + Flawfinder + Semgrep |
| CWE-369 Div by Zero | **22%** | Cppcheck + Semgrep |

## 11. 알려진 이슈

- tinydtls 버전: `libcoap/ext/tinydtls`에 configure.ac 없음 → 버전 미탐지
- wakaama 버전: 하위 tinydtls의 configure.ac를 잡아서 오탐
- clang-tidy + compile_commands.json: `-p` 연동 불안정
- `build-and-analyze`: 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함
- CWE-369 (Divide by Zero): 외부 입력 기반 패턴 대부분 미탐 (커스텀 룰로 11%→22% 개선, 소켓/파일 소스는 도구 한계)

---

## 관련 문서

- [API 계약서](../api/sast-runner-api.md) — 전체 엔드포인트 스키마
- [SastFinding 타입](../api/shared-models.md)
- [MSA Observability 규약](observability.md)
- [S4 인수인계서](../s4-handoff/README.md)
