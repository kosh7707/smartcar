# S3. Build Agent 기능 명세

> **소유자**: S3
> **최종 업데이트**: 2026-04-04

> Build Agent는 업로드된 C/C++ 프로젝트를 위한 **compile-first control plane** 이다.
> 호출자가 선언한 서브프로젝트/빌드 모드/기대 산출물을 기준으로 preflight → build synthesis/repair → artifact validation을 수행한다.

---

## 1. 핵심 설계 원칙

1. **Compile-first가 우선** — Build Agent의 1차 책임은 “선언된 조건에서 실제 컴파일이 성립하는가”를 판정하는 것이다.
2. **호출자 의도는 명시적이어야 한다** — 서브프로젝트, 빌드 모드, SDK 선택, 기대 산출물은 호출자가 선언한다.
3. **No fake success** — compile database, 부분 compile entry, undeclared native fallback, silent feature drop은 성공이 아니다.
4. **Shell + gcc는 1급 경로** — hand-written shell build, cross gcc 스크립트를 CMake/Make와 동등하게 다룬다.
5. **프로젝트 원본 불변** — 원본 소스 수정 금지. 모든 쓰기는 `build-aegis/` 하위에 한정한다.
6. **LLM은 bounded repair만 담당** — 탐색기처럼 행동하지 않고, preflight/Phase 0 이후 빌드 스크립트 작성과 복구에 집중한다.
7. **실패는 actionable 해야 한다** — strict 계약 위반, SDK 문제, 재료 부족, compile 실패, artifact mismatch를 구분해 보고한다.

---

## 2. 엔드포인트

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `build-resolve` strict compile-first 실행 |
| POST | `/v1/tasks` | `sdk-analyze` SDK/툴체인 분석 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 |

---

## 3. 공개 계약 요약

### 3.1 `build-resolve` strict v1

strict v1 요청은 다음을 반드시 포함한다.

- `contractVersion: "build-resolve-v1"`
- `strictMode: true`
- `context.trusted.projectPath`
- `context.trusted.subprojectPath`
- `context.trusted.subprojectName`
- `context.trusted.build.mode` (`native` | `sdk`)
- `context.trusted.expectedArtifacts[]`
- `build.mode == "sdk"` 이면 `build.sdkId`

### 3.2 strict 불변조건

1. `subprojectPath` 누락 시 요청 자체가 invalid contract이다.
2. `native`는 fallback이 아니라 **선언된 모드**다.
3. SDK 모드에서 SDK 정보가 없으면 repair loop 전에 실패한다.
4. `expectedArtifacts`가 충족되지 않으면 성공을 반환하지 않는다.
5. third-party / optional component disable이 필요하면 strict 계약에서는 실패로 보고한다.
6. `compile_commands.json` 생성 가능성만으로 성공 처리하지 않는다.

### 3.3 마이그레이션 의미

- strict v1이 정식 계약이다.
- `strictMode=false` 또는 미지정 호출은 임시 레거시 호환 경로일 수 있으나 deprecated다.
- 레거시 `targetPath`, `targetName`은 migration alias이며 strict 문서에서는 사용하지 않는다.

---

## 4. 실행 아키텍처

```text
POST /v1/tasks (taskType: "build-resolve")
  │
  ├── 0. Preflight (결정론적)
  │   ├── strict 계약 필수 필드 검증
  │   ├── build.mode / sdkId / expectedArtifacts 검증
  │   └── subproject path scope 검증
  │
  ├── 1. Phase 0 (결정론적)
  │   ├── 빌드 시스템 탐지
  │   ├── 빌드 파일/스크립트 탐색
  │   ├── 프로젝트 트리 요약
  │   ├── 언어 탐지
  │   └── SDK registry 조회 (필요 시)
  │
  ├── 2. Agent repair loop (제한적 LLM)
  │   ├── build-aegis/aegis-build.sh 작성
  │   ├── try_build 실행
  │   └── edit_file → try_build 복구 반복
  │
  ├── 3. Artifact validation (결정론적)
  │   ├── expectedArtifacts 존재 여부 검증
  │   └── declared mode / build command 재사용성 검증
  │
  └── 4. 응답 조립
      ├── completed
      └── validation_failed / failed / timeout / model_error / budget_exceeded
```

`build-resolve`는 preflight를 통과하기 전에는 LLM 루프를 시작하지 않는다.

---

## 5. Preflight

### 5.1 검증 항목

- `contractVersion == "build-resolve-v1"`
- `strictMode == true`
- `projectPath`, `subprojectPath`, `subprojectName` 존재
- `build.mode ∈ {native, sdk}`
- `sdk` 모드면 `sdkId` 존재
- `expectedArtifacts` 비어있지 않음
- `subprojectPath`가 `projectPath` 경계 안에 있음

### 5.2 실패 분류

| 상황 | failureCode | status |
|------|-------------|--------|
| strict 필수 필드 누락/형식 오류 | `INVALID_CONTRACT` | `validation_failed` |
| sdk 모드인데 SDK 식별 정보 누락 | `SDK_REQUIRED` | `validation_failed` |
| 빌드 루트 scope 위반 | `INVALID_CONTRACT` | `validation_failed` |

---

## 6. Phase 0

`Phase0Executor`가 LLM 개입 없이 프로젝트를 요약한다.

### 6.1 탐지 항목

| 항목 | 방식 |
|------|------|
| 빌드 시스템 | `CMakeLists.txt`, `Makefile`, `configure`, `*.sh` 존재 여부 |
| 빌드 파일 | glob 매칭 (`CMakeLists.txt`, `Makefile`, `*.sh`, `*.cmake`) |
| 프로젝트 트리 | depth 제한 컴팩트 트리 |
| 언어 | `.c`, `.cpp`, `.h`, `.hpp` 등 확장자 기반 |
| SDK registry | S4 `GET /v1/sdk-registry` |
| 기존 빌드 스크립트 | `scripts/cross_build.sh`, `build.sh`, `compile.sh` 등 |

### 6.2 shell / gcc 우선성

Phase 0는 `scripts/cross_build.sh`, hand-written gcc shell 빌드를 “fallback용 희귀 사례”가 아니라 **우선 고려할 빌드 입력**으로 취급한다.

### 6.3 Phase0 결과 예시

```python
@dataclass
class Phase0Result:
    build_system: str                # cmake | make | autotools | shell | unknown
    build_files: list[str]
    project_tree: str
    detected_languages: list[str]
    sdk_registry: dict
    existing_script_path: str | None
    duration_ms: int
```

---

## 7. Agent repair loop

### 7.1 역할 경계

LLM은 아래만 수행한다.

1. 필요한 빌드 파일 1~2개 읽기
2. `build-aegis/aegis-build.sh` 작성
3. `try_build` 결과를 기반으로 스크립트 수정
4. 최종 보고서 초안 작성

LLM은 아래를 수행하지 않는다.

- 호출자가 선언하지 않은 `native`/`sdk` 전환
- third-party exclusion을 성공처럼 포장
- 원본 프로젝트 파일 수정
- compile database-only 결과를 성공으로 선언

### 7.2 루프 전략

```text
1. list_files -> read_file (짧게)
2. write_file(build-aegis/aegis-build.sh)
3. try_build
4. 실패 시 edit_file -> try_build
5. 성공 또는 임계 실패 시 force_report
```

### 7.3 종료 조건

- build 성공 + artifact validation 통과
- 연속 빌드 실패 임계값 도달
- max steps / token budget / evidence budget 소진
- timeout / model error

---

## 8. 도구 시스템

### 8.1 도구 목록

| 도구 | cost tier | 용도 | 핵심 제약 |
|------|-----------|------|-----------|
| `list_files` | CHEAP | 구조 탐색 | scope 내부만 |
| `read_file` | CHEAP | 파일 읽기 | 8KB 제한 |
| `write_file` | CHEAP | 새 스크립트 작성 | `build-aegis/` 하위만 |
| `edit_file` | CHEAP | 스크립트 수정 | 에이전트 생성 파일만 |
| `delete_file` | CHEAP | 임시 파일 삭제 | 에이전트 생성 파일만 |
| `try_build` | EXPENSIVE | S4 `POST /v1/build` 실행 | 선언된 모드만 사용 |

### 8.2 `try_build` strict semantics

- `build.mode == "native"` 이면 native 조건으로만 실행한다.
- `build.mode == "sdk"` 이면 선언된 SDK 조건으로만 실행한다.
- SDK가 실패했다고 native로 재시도하지 않는다.
- 부분 compile entry, compile database 생성 가능성, 일부 타깃만 통과한 결과는 success 조건이 아니다.

---

## 9. 정책 엔진

### 9.1 파일 접근 정책

| 대상 | 권한 |
|------|------|
| 프로젝트 원본 파일 | read-only |
| `build-aegis/` 내 에이전트 생성 파일 | read/write/edit/delete |
| `build-aegis/` 내 미생성 파일 | read-only |
| `build-aegis/` 외부 | 쓰기 금지 |

### 9.2 스크립트 내용 안전성

`write_file` / `edit_file` 시 위험 명령(`rm -rf`, `curl`, `wget`, `docker`, `sudo`, `apt-get`, `pip install` 등)을 경고한다.

### 9.3 빌드 명령 금지 패턴

`try_build`는 `rm`, `dd`, `curl`, `wget`, `git`, `docker`, `chmod`, `chown`, `patch`, `sed -i` 등 destructive / mutation 명령을 차단한다.

---

## 10. 실패 분류와 복구 방향

### 10.1 빌드 실패 분류

| category | 예시 | 기본 복구 방향 |
|----------|------|----------------|
| `missing_header` | `fatal error: foo.h: No such file` | include path / sysroot 확인 |
| `toolchain_not_found` | `arm-linux-gnueabihf-gcc: not found` | 선언된 SDK setup 검증 |
| `undefined_symbol` | `undefined reference to 'foo'` | 링크 플래그 점검 |
| `missing_library` | `cannot find -lfoo` | 라이브러리 경로/재료 부족 보고 |
| `cmake_config_error` | `CMake Error at ...` | CMake 입력 변수/패키지 확인 |
| `permission_denied` | `Permission denied` | 스크립트 실행 방식 수정 |
| `syntax_error` | `syntax error` | 스크립트 문법 수정 |
| `file_not_found` | `No such file or directory` | 경로/산출물 기준 재검토 |

### 10.2 strict 계약에서 허용되지 않는 복구

- SDK 실패 후 undeclared native fallback
- missing library를 해결하기 위한 silent feature disable
- compile database만 남기고 성공 처리

이 경우에는 복구가 아니라 **명시적 실패**로 반환해야 한다.

---

## 11. 성공 / 실패 의미

### 11.1 성공 조건

성공은 아래를 모두 만족해야 한다.

1. 선언된 `subprojectPath`를 기준으로 빌드가 수행되었다.
2. 선언된 `build.mode`로 실행되었다.
3. `buildCommand`가 재사용 가능하다.
4. `expectedArtifacts`의 required 항목이 실제로 존재한다.
5. 응답이 S4 handoff에 필요한 경로/명령을 포함한다.

### 11.2 실패 조건

아래 중 하나라도 해당하면 성공이 아니다.

- strict 계약 필드 누락
- SDK 모드인데 SDK를 사용할 수 없음
- 입력 재료 부족
- compile 실패
- expected artifact 미생성
- third-party exclusion 없이는 통과할 수 없음

---

## 12. 출력 구조

### 12.1 성공 응답 핵심 필드

```python
TaskSuccessResponse:
    taskId
    taskType
    contractVersion
    strictMode
    status = "completed"
    result.buildResult:
        success: bool
        declaredMode: str
        sdkId: str | None
        buildCommand: str
        buildScript: str
        buildDir: str
        producedArtifacts: list[dict]
        artifactValidation: dict
        errorLog: str | None
```

### 12.2 실패 응답 핵심 필드

```python
TaskFailureResponse:
    taskId
    taskType
    contractVersion
    strictMode
    status: validation_failed | failed | timeout | model_error | budget_exceeded | empty_result
    failureCode: str
    failureDetail: str
    retryable: bool
```

---

## 13. Observability

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/s3-build-agent.jsonl` |
| 교환 로그 | `logs/llm-exchange.jsonl` |
| LLM dump | `logs/llm-dumps/{requestId}_turn-{nn}_{ts}.json` |
| 요청 추적 | `X-Request-Id` 전파 |

### 필수 로그 의미

- strict contract validation 결과
- declared build mode (`native` / `sdk`)
- selected SDK ID (있다면)
- build command
- expected artifact validation 결과
- 실패 분류 (`INVALID_CONTRACT`, `SDK_NOT_USABLE`, `EXPECTED_ARTIFACT_MISMATCH` 등)

---

## 14. 서비스 의존

```text
Build Agent (:8003)
  ├── S7 Gateway (:8000)       POST /v1/chat         제한적 repair loop LLM
  └── S4 SAST Runner (:9000)   GET  /v1/sdk-registry SDK 조회
                               POST /v1/build        실제 빌드 실행
```

---

## 15. 운영 메모

- S2/S4와의 의미 정렬은 코드 열람이 아니라 API 계약 / WR로 수행한다.
- strict 계약을 강화할수록 docs/api와 docs/specs를 함께 갱신해야 한다.
- runtime/Docker/QEMU/debug/payload orchestration은 이 문서의 범위 밖이다.
