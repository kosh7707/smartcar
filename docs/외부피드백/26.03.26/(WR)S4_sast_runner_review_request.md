# S4 SAST Runner 아키텍처 리뷰 요청

> **작성일**: 2026-03-26
> **작성자**: S4 (SAST Runner)
> **대상 독자**: 외부 리뷰어 (정적 분석, 임베디드 보안, CI/CD 도메인 전문가)
> **핵심 질문**: (1) 6도구 오케스트레이션과 Semgrep taint 전략은 건전한가? (2) 서드파티 코드 분석의 OOM 문제를 어떻게 풀어야 하는가?

---

## 1. Executive Summary

S4는 AEGIS 플랫폼의 **결정론적 전처리 엔진**으로, 자동차 임베디드 C/C++ 코드에 대해 6개 SAST 도구를 병렬 실행하고, SCA(소프트웨어 구성 분석), 코드 구조 추출, 빌드 자동화를 제공한다.

- **서비스**: Python 3.12 + FastAPI, 포트 :9000
- **12개 엔드포인트**: scan, functions, includes, metadata, libraries, build, build-and-analyze, discover-targets, sdk-registry(GET/POST/DELETE), health
- **6개 SAST 도구**: Semgrep, Cppcheck, clang-tidy, Flawfinder, scan-build, gcc-fanalyzer
- **53개 커스텀 Semgrep 룰** (automotive CWE 특화, taint mode 포함)
- **313개 테스트** (단위 307 + 통합 6)
- **Juliet Recall 83.7%** (12 CWE, 361파일)

### 핵심 설계 원칙

1. **결정론적 처리 최대화, LLM 결정 표면 최소화** — 도구 실행, 필터링, 정규화는 전부 결정론적. LLM은 S3에서만 사용.
2. **Evidence-first** — 모든 Finding은 도구 출력 + CWE 매핑에 근거
3. **도구별 profile 분리** — 컴파일 기반 도구(clang-tidy, scan-build)는 SDK 헤더 포함, 패턴 기반(Cppcheck, Semgrep)은 원본 경로만
4. **경계면 분석** — 서드파티 코드 findings도 dataFlow에 사용자 코드가 포함되면 유지 (`origin: "cross-boundary"`)

### 최근 주요 변경 (2026-03-26, 이번 세션)

| 변경 | 영향 |
|------|------|
| Semgrep taint mode 도입 | CWE-369: 22%→94%, CWE-190: 53%→89% |
| 벤치마크 Precision/F1/Per-Rule/회귀감지 | 품질 메트릭 체계 확립 |
| check_tools() TTL 캐싱 | 매 스캔 6개 subprocess 제거 |
| 설정 통합 (config.py) | 4개 runner 하드코딩 제거 |
| options.tools API 노출 | 도구 서브셋 선택 가능 |
| /v1/functions include_diff=False | 44초→~1초 성능 개선 |
| 미테스트 8개 모듈 전부 테스트 완료 | 163→313개 |
| 커스텀 룰 21→53개 | CWE-787, CWE-20, CWE-416, Taint source 추가 |
| sync→async 전환 + thread safety | library_identifier, gcc_analyzer, sdk_resolver |

---

## 2. 아키텍처 개요

### 2.1 AEGIS 전체 내 위치

```
S1 (Frontend :5173)
      │
S2 (AEGIS Core :3000)  ← 플랫폼 오케스트레이터
     ╱     │     ╲      ╲
  S3       S4     S5      S6
 Agent    SAST    KB    동적분석
:8001    :9000  :8002    :4000
  │
S7 (LLM Gateway :8000)
```

S4는 **S2가 직접 호출**하거나, **S3 Agent의 Phase 1**에서 호출됨. LLM을 사용하지 않음.

### 2.2 내부 파이프라인

```
POST /v1/scan
  │
  ├── 1. 입력 검증 (path traversal, file list)
  ├── 2. BuildProfile → SDK 해석 (sdk_resolver)
  │      ├── enriched profile (SDK 헤더 포함) → clang-tidy, scan-build
  │      └── original profile (사용자 경로만) → cppcheck, gcc-fanalyzer
  ├── 3. 6도구 병렬 실행 (asyncio.gather)
  │      ├── Semgrep: SARIF JSON (taint mode + 53개 커스텀 룰)
  │      ├── Cppcheck: XML → SastFinding
  │      ├── clang-tidy: text → SastFinding (파일별 개별 실행)
  │      ├── Flawfinder: CSV → SastFinding
  │      ├── scan-build: plist → SastFinding (파일별 개별 실행)
  │      └── gcc-fanalyzer: text → SastFinding (파일별 개별 실행)
  ├── 4. Finding 합산 + 사용자 코드 필터링
  │      ├── 절대 경로 (SDK/시스템) → 제거 (cross-boundary는 유지)
  │      ├── thirdPartyPaths → 제거 (cross-boundary는 유지)
  │      └── 상대 경로 (사용자 코드) → 유지
  ├── 5. projectPath 모드: codeGraph + SCA
  │      ├── identify_libraries → origin 태깅 (third-party / modified)
  │      └── dump_functions (병렬, skip_paths 적용)
  └── 6. ExecutionReport 조립 (도구별 status, 버전, 시간, 필터링 통계)
```

### 2.3 코드 구조

```
services/sast-runner/
├── app/
│   ├── main.py              — FastAPI v0.6.0
│   ├── config.py            — pydantic-settings (SAST_ prefix)
│   ├── routers/scan.py      — 12개 엔드포인트
│   └── scanner/
│       ├── orchestrator.py   — 6도구 병렬 + 도구별 profile + check_tools 캐싱
│       ├── semgrep_runner.py
│       ├── cppcheck_runner.py
│       ├── clangtidy_runner.py
│       ├── flawfinder_runner.py
│       ├── scanbuild_runner.py
│       ├── gcc_analyzer_runner.py
│       ├── build_runner.py
│       ├── sdk_resolver.py   — SDK 레지스트리 + 경로 해석
│       ├── ast_dumper.py     — clang AST 함수 추출 (병렬, Semaphore(16))
│       ├── sca_service.py    — 라이브러리 식별 + upstream diff
│       ├── library_identifier.py / library_differ.py / library_hasher.py
│       ├── sarif_parser.py / path_utils.py / ruleset_selector.py
│       └── include_resolver.py / build_metadata.py
├── rules/automotive/        — 53개 커스텀 Semgrep 룰 (9개 YAML)
├── benchmark/               — Juliet 벤치마크 (Recall/Precision/F1/회귀감지)
└── tests/                   — 313개 테스트 (18개 파일)
```

---

## 3. 핵심 설계 결정 + 트레이드오프

| 결정 | 근거 | 트레이드오프 / 한계 |
|------|------|---------------------|
| **6도구 병렬 실행 (asyncio.gather)** | 도구마다 강점 CWE가 다름. 합집합 Recall이 개별보다 항상 높음 | 전체 소요시간은 가장 느린 도구에 바운드. 리소스 사용량 높음 |
| **도구별 profile 분리** | Cppcheck에 SDK 헤더 -I 시 전체 파싱 → 타임아웃. gcc-fanalyzer에 ARM 헤더 → 아키텍처 불일치 | 도구마다 다른 profile 관리 복잡성 |
| **파일별 개별 실행 (gcc-fanalyzer, scan-build, clang-tidy)** | 동일 심볼 충돌 방지 (Juliet 파일들이 같은 함수명 사용) | 파일 수 × 프로세스 → OOM 위험 (현재 미해결, §5 참조) |
| **Semgrep taint mode** | cross-block 데이터 플로우 추적 (중첩 블록 내 atoi→division). 기존 패턴 매칭으로 22%→taint로 94% | taint 분석은 패턴 매칭보다 느림. fscanf의 &ptr 포인터 전달은 추적 불가 |
| **경계면 분석 (cross-boundary)** | SDK 헤더 finding이라도 dataFlow에 사용자 코드 포함 시 유지 | dataFlow 없는 도구(Flawfinder, Semgrep)는 경계면 판정 불가 |
| **thirdPartyPaths → findings 필터링** | 서드파티 노이즈 제거 (RE100: 254→28, 226개 제거) | **실행은 여전히 전체 파일 대상 → OOM 위험** (§5 핵심 질문) |
| **SCA diff 기반 origin 태깅** | modified-third-party 식별 → S3 LLM에 "이 코드는 수정됨" 컨텍스트 제공 | git clone + hash 비교 비용 (대형 라이브러리 44초) |
| **커스텀 Semgrep 룰 automotive 특화** | 표준 룰셋에 없는 automotive CWE 패턴 (CAN 프로토콜, sensor 입력 등) | 룰 유지보수 부담. 패턴 기반 한계 (복잡한 데이터 플로우는 taint로 보완) |

---

## 4. Juliet 벤치마크 결과

### 4.1 CWE별 Recall (v0.6.0, 12 CWE, variant_01, 361파일)

| Tier | CWE | Recall | 주력 도구 |
|------|-----|:------:|-----------|
| S | CWE-476 NULL deref | **100%** | Cppcheck + clang-tidy + gcc-fanalyzer + scan-build |
| S | CWE-134 Format String | **100%** | Flawfinder |
| S | CWE-401 Memory Leak | **95%** | gcc-fanalyzer |
| S | CWE-369 Divide by Zero | **94%** | Semgrep taint + Cppcheck |
| A | CWE-190 Int Overflow | **89%** | Semgrep taint + clang-tidy + Flawfinder |
| A | CWE-680 Int→BOF | **83%** | Flawfinder + Semgrep |
| A | CWE-121 Stack BOF | **82%** | Flawfinder + gcc-fanalyzer |
| A | CWE-78 Cmd Injection | **80%** | Flawfinder + clang-tidy + Semgrep |
| A | CWE-122 Heap BOF | **80%** | Flawfinder + gcc-fanalyzer |
| B | CWE-252 Unchecked Return | **72%** | clang-tidy |
| B | CWE-416 UAF | **67%** | gcc-fanalyzer + clang-tidy + scan-build |
| C | CWE-457 Uninitialized | **56%** | gcc-fanalyzer + Cppcheck |
| | **Overall** | **83.7%** | |

### 4.2 Recall 개선 히스토리

| 시점 | Overall | 주요 개선 |
|------|:-------:|----------|
| v0.3.0 초기 | 54.5% | 6도구 기본 설정 |
| v0.5.0 | 70.9% | CWE 매핑 추가, 커스텀 룰, gcc-fanalyzer 수정 |
| v0.6.0 | **83.7%** | Semgrep taint mode, expression context 수정, 소스 패턴 확장 |

---

## 5. 미해결 설계 문제: 서드파티 코드 OOM

### 5.1 문제 상황

gcc-fanalyzer, scan-build, clang-tidy는 **파일별 개별 프로세스**로 실행됨. 서드파티 라이브러리가 500+파일이면 동시에 500개 프로세스가 spawn되어 **WSL2 메모리 폭발 → 시스템 크래시**. (실제 발생: KB5079473 크래시 사고)

### 5.2 현재 상태

- `thirdPartyPaths`로 **findings는 필터링**하지만, **도구 실행 자체는 전체 파일 대상**
- 즉, 500개 파일을 분석한 뒤 결과를 버림 → 완전한 리소스 낭비

### 5.3 충돌하는 목표

1. **서드파티 코드의 cross-boundary 취약점을 탐지하고 싶다** — 사용자가 서드파티를 수정(diff)했을 때, 그 수정이 새 취약점을 만드는지 확인해야 함
2. **500+ 파일을 동시에 gcc-fanalyzer로 돌리면 OOM** — 돌리면 안 됨

### 5.4 현재 검토 중인 접근법

**SCA diff 결과를 활용한 선택적 분석:**

```
500개 서드파티 파일
  ├── ~480개: identical (원본 그대로)  → gcc-fanalyzer 스킵
  ├── ~15개: modified (사용자 수정)    → gcc-fanalyzer 실행 (cross-boundary 대상)
  └── ~5개: added (사용자 추가)        → gcc-fanalyzer 실행
```

**하지만 미해결 트레이드오프가 있다:**

- SCA diff 정보가 필요 → 도구 실행 전에 `analyze_libraries(include_diff=True)` 선행 필요 → 파이프라인 순서 변경 + git clone latency 추가
- 또는 S2가 이미 diff 정보를 갖고 있으면 `modifiedThirdPartyFiles` 목록을 API로 전달 → S4는 그 파일만 분석 (API 변경 필요)
- 동시 실행 제한(Semaphore)도 안전장치로 필요하지만, 근본 해결은 아님

### 5.5 리뷰어에게 묻는 질문

1. **"modified 파일만 분석" 전략이 충분한가?** — identical 서드파티 코드에서 사용자 코드와의 cross-boundary 취약점을 놓칠 가능성은 없는가?
2. **파이프라인 순서를 바꾸는 게 나은가, API로 외부에서 diff 정보를 받는 게 나은가?** — S4 내부 완결성 vs 호출자 의존
3. **per-file 리소스 제한(ulimit -v)은 실용적인가?** — gcc-fanalyzer 파일당 적정 메모리 상한은?

---

## 6. 리뷰어에게 묻는 추가 질문

### Q1. 6도구 오케스트레이션 전략은 건전한가?

- 도구마다 다른 BuildProfile(enriched vs original)을 전달하는 방식은 적절한가?
- 도구 자동 선택(C++ → Semgrep 스킵)의 기준은 합리적인가?
- check_tools 결과 캐싱(TTL 300초)은 안전한가?

### Q2. Semgrep taint mode 활용은 적절한가?

- 커스텀 taint 룰(53개)의 유지보수 부담은 감당 가능한 수준인가?
- fscanf의 &ptr 포인터 전달을 추적 못하는 것은 Semgrep 한계인가, 우회 가능한가?
- Juliet 83.7% Recall은 실제 프로젝트에서도 유효한 지표인가?

### Q3. 벤치마크 전략에 빈 것은?

- Recall 외에 Precision이 ~7%로 매우 낮은데, 이는 Juliet 구조(bad+good 동일 파일) 때문인가, 실제 FP가 심각한 것인가?
- 12 CWE만 측정 중인데, 다른 CWE를 추가해야 하는가?
- variant_01만 테스트 중인데, 전체 variant로 확장하면 Recall이 크게 달라질 수 있는가?

### Q4. 테스트 전략에서 빠진 것은?

- 313개 테스트 중 통합 테스트(실제 도구 실행)가 6개뿐인데 충분한가?
- 성능/부하 테스트가 없는데, 필요한가?

---

## 7. 첨부 파일

리뷰의 정확도를 위해 아래 파일들의 전체 소스 코드를 첨부합니다.

### 7.1 핵심 오케스트레이션

```
첨부 대상: services/sast-runner/app/scanner/orchestrator.py
```

### 7.2 Semgrep taint 룰 (CWE-369/190 개선의 핵심)

```
첨부 대상: services/sast-runner/rules/automotive/divide-by-zero.yaml
첨부 대상: services/sast-runner/rules/automotive/integer-overflow.yaml
```

### 7.3 경계면 분석 + 서드파티 필터링

```
첨부 대상: services/sast-runner/app/scanner/gcc_analyzer_runner.py
첨부 대상: services/sast-runner/app/scanner/sca_service.py
첨부 대상: services/sast-runner/app/scanner/library_differ.py
```

### 7.4 벤치마크 인프라

```
첨부 대상: services/sast-runner/benchmark/juliet_runner.py
첨부 대상: services/sast-runner/benchmark/metrics.py
첨부 대상: services/sast-runner/benchmark/compare.py
```

### 7.5 API 계약서 + 기능 명세

```
첨부 대상: docs/api/sast-runner-api.md
첨부 대상: docs/specs/sast-runner.md
```

---

## 8. 참고: 최신 벤치마크 결과 JSON

```
첨부 대상: services/sast-runner/benchmark/data/baselines/v0.6.0-full.json
```
