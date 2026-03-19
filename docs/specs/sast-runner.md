# S4. SAST Runner 기능 명세 (v0.4.0)

> SAST Runner는 C/C++ 프로젝트의 보안 분석에 필요한 **결정론적 전처리**를 담당하는 서비스다.
> 6개 SAST 도구 병렬 실행, SCA(라이브러리 식별 + upstream diff + CVE 조회), 코드 구조 추출,
> 빌드 메타데이터 추출, 빌드 자동 실행을 하나의 API로 제공한다.
> S2(Backend) 또는 S3(Analysis Agent)가 호출하며, S4(SAST Runner)가 소유한다.

---

## 1. 핵심 설계 원칙

> **결정론적 처리를 최대화하고, LLM의 결정 표면을 최소화한다.**
>
> 도구 선택, 실행, 필터링, 정규화, 라이브러리 식별, CVE 조회는 전부 결정론적.
> LLM에게는 정제된 판단 재료만 전달한다.

---

## 2. 엔드포인트 (7개)

| 엔드포인트 | MCP Tool | 용도 |
|-----------|----------|------|
| `POST /v1/scan` | `sast.scan` | 6개 SAST 도구 병렬 + 실행 보고서 + SDK 해석 + 노이즈 필터링 |
| `POST /v1/functions` | `code.functions` | clang AST → 함수+호출 관계 (namespace, CallExpr, projectPath) |
| `POST /v1/includes` | `code.includes` | gcc -E -M → 인클루드 트리 |
| `POST /v1/metadata` | `build.metadata` | gcc -E -dM → 타겟 매크로/아키텍처 (ARM vs x86) |
| `POST /v1/libraries` | `sca.libraries` | 라이브러리 식별 + upstream diff + CVE (NVD/OSV) |
| `POST /v1/build-and-analyze` | — | bear 빌드 자동 실행 → 위 전부 한 번에 |
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
| Semgrep | 패턴 매칭 (C++에서 자동 스킵) | 룰셋 자동 선택 |
| Cppcheck | 코드 품질 + CTU 분석 | `--std`, `-I`, `-D`, `--project=` |
| clang-tidy | CERT 코딩 표준 + 버그 탐지 | `-std`, `-I`, `-D`, `-p` |
| Flawfinder | 위험 함수 빠른 스캔 | — |
| scan-build | Clang Static Analyzer 경로 민감 분석 | `-std`, `-I`, `-D` |
| gcc -fanalyzer | GCC 내장 정적 분석 | SDK 크로스 컴파일러 사용 가능 |

### 도구 자동 선택

- C++ 프로젝트 → Semgrep 스킵
- SDK 크로스 컴파일러 없으면 → gcc -fanalyzer 호스트 폴백
- clang 미설치 → scan-build, clang-tidy 스킵

### SDK 자동 해석

`buildProfile.sdkId` → SDK 설치 경로 탐색 → 헤더 7개 경로 자동 `-I` 주입 + 크로스 컴파일러 선택.

등록 SDK: `ti-am335x` (TI Processor SDK Linux AM335x 08.02.00.24)

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

### CVE 조회

- OSV.dev API + NVD API 실시간 조회
- 라이브러리 이름 + 버전 기반
- 노이즈 포함 (키워드 검색 한계) → S3 reranking + LLM 최종 판정

### RE100 실측

| 라이브러리 | 버전 | 일치율 | 수정 | CVE |
|-----------|------|--------|------|-----|
| rapidjson | 1.1.0 | 100% ✅ | 0 | 3건 |
| civetweb | 1.16 | 100% ✅ | 0 | 5건 |
| mosquitto | 2.0.22 | 98.8% ⚠️ | 2파일 | 20건 |
| libcoap | 4.3.5 | 99.1% ⚠️ | 1파일 | 1건 |
| tinydtls | 0.8.6 | 100% ✅ | 0 | 9건 |
| wakaama | ? | 97.6% ⚠️ | 1파일 | 2건 |

---

## 6. 코드 구조 추출

clang AST 기반 함수+호출 관계:
- `projectPath` 모드 — 실제 프로젝트 디렉토리에서 헤더 포함 분석
- `NamespaceDecl` 재귀 순회 (C++ namespace 함수 지원)
- `CallExpr` → `ImplicitCastExpr` → `DeclRefExpr` + `MemberExpr` 처리
- 3단계 필터링: `loc.file` + `source_lines` + `CompoundStmt`
- 사용자 코드 함수만 반환 (시스템/SDK 함수 제외)

RE100 실측: 1,329개 전체 → **73개 사용자 함수**, 242개 호출 관계.

---

## 7. 빌드 자동 실행

`bear -- buildCommand` → `compile_commands.json` 자동 생성.

사용자가 빌드 명령어만 알려주면:
1. bear가 빌드를 감싸서 모든 컴파일 명령을 캡처
2. compile_commands.json 생성 (파일별 정확한 `-I`, `-D`, `-std`)
3. SAST 도구가 이를 사용하여 정확한 분석

RE100 실측: `bear -- ./scripts/cross_build.sh` → 7엔트리, 5초.

---

## 8. 관측성

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/s4-sast-runner.jsonl` |
| 형식 | JSON structured, `time` epoch ms |
| 요청 추적 | `contextvars` 기반 `requestId` 전 레이어 전파 |
| 실행 보고서 | 응답 `execution` 필드에 도구별 상태/시간/스킵 사유 |

---

## 9. 에이전트 파이프라인에서의 위치

```
Phase 1 (결정론적, LLM 없음, ~140초):
  S3 → SAST Runner:
    /v1/build-and-analyze  또는 개별 호출:
    ├─ /v1/scan       → findings
    ├─ /v1/functions   → 코드 그래프
    ├─ /v1/libraries   → SCA + CVE
    └─ /v1/metadata    → 타겟 정보

Phase 2 (LLM 해석, ~34초):
  S3 → S7 Gateway (:8000) → LLM Engine → 판단/분류
```

---

## 10. 알려진 이슈

- tinydtls 버전: `libcoap/ext/tinydtls`에 configure.ac 없음 → 버전 미탐지
- wakaama 버전: 하위 tinydtls의 configure.ac를 잡아서 오탐
- CVE 노이즈: NVD 키워드 검색에 무관한 CVE 포함 (mosquitto ≠ Mimosa)
- clang-tidy + compile_commands.json: `-p` 연동 불안정
- `build-and-analyze`: 빌드 환경(SDK, 컴파일러)이 서버에 설치되어 있어야 함

---

## 관련 문서

- [API 계약서](../api/sast-runner-api.md) — 전체 엔드포인트 스키마
- [SastFinding 타입](../api/shared-models.md)
- [MSA Observability 규약](observability.md)
- [S4 인수인계서](../s4-handoff/README.md)
