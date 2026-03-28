# S4 SAST Runner 종합 피드백

## 총평

S4의 큰 방향은 좋습니다.  
**“결정론적 전처리 엔진 + 다중 정적분석 포트폴리오 + SCA/origin 태깅 + S3/S5와의 역할 분리”**라는 구조는 AEGIS 전체에서 설득력이 있습니다. 특히 S4가 LLM 판단을 하지 않고, 도구 실행·정규화·필터링·라이브러리 식별을 맡는 현재 역할 정의는 아키텍처적으로 일관됩니다.

다만, **외부 리뷰어 설득력**이라는 관점에서는 아직 네 가지를 먼저 정리해야 합니다.

1. **벤치마크 지표 해석의 엄밀성** — 현재 Precision/F1은 그대로 대외 지표로 내세우기 어렵습니다.  
2. **서드파티 코드 OOM 문제의 구조적 해소** — 지금은 “실행 후 버리기”라서 비용을 통제하지 못합니다.  
3. **실행 보고서와 문서의 신뢰도** — 일부 필드는 코드가 뜻하는 바와 문서가 설명하는 바가 어긋납니다.  
4. **문서 드리프트 정리** — S4 내부 문서끼리, 그리고 S3 연동 문서와의 표현 차이가 큽니다.

한 문장으로 요약하면 다음과 같습니다.

> **핵심 설계는 건전하지만, 리뷰 패키지로 제출하기 전에는 “측정의 정확성”과 “운영 리스크 통제”를 먼저 고쳐야 합니다.**

---

## 잘한 점

### 1) 역할 분리가 분명합니다

S4가 **도구 실행과 정규화**만 맡고,  
CVE 조회는 S5, 해석은 S3/S7로 넘기는 현재 구조는 좋습니다.

이 분리는 다음 점에서 장점이 있습니다.

- 재현성 있는 전처리 계층을 만들 수 있습니다.
- LLM 품질 변동이 SAST/SCA의 기본 품질을 흔들지 않습니다.
- S4 결과를 S3 이외의 다른 소비자도 활용하기 쉽습니다.

### 2) 도구별 profile 분리 전략은 현실적입니다

`clang-tidy`/`scan-build`에 SDK 헤더를 주고,  
`cppcheck`/`gcc-fanalyzer`에는 원본 profile을 우선 주는 전략은 “도구별 실제 동작 차이”를 반영한 결정입니다.

이는 단순히 “도구 6개를 붙였다”가 아니라,  
각 도구가 **어떤 입력에서 잘 동작하고 어떤 입력에서 망가지는지**를 경험적으로 학습한 흔적이라서 좋습니다.

### 3) cross-boundary 개념 자체는 강합니다

`origin: "cross-boundary"`는 이 시스템의 좋은 차별점입니다.

- SDK/서드파티 내부에서 발생한 finding이라도
- dataFlow에 사용자 코드가 섞여 있으면
- 무조건 제거하지 않고 남긴다

이 사고방식은 “서드파티 코드는 무시”보다 훨씬 성숙합니다.  
외부 리뷰어도 이 개념 자체에는 호의적일 가능성이 큽니다.

### 4) SCA diff를 origin 태깅에 연결한 점이 좋습니다

`third-party` / `modified-third-party`를 구분해서  
후속 에이전트(S3)에게 “이 코드는 원본인지, 수정된 것인지”를 전달하는 설계는 실전적입니다.

이 부분은 단순 정보 제공을 넘어서,
- 분석 우선순위
- human review 우선순위
- CVE 해석 방식
까지 바꿀 수 있는 좋은 메타데이터입니다.

### 5) Semgrep taint는 “도구 포트폴리오의 약점 보완”이라는 위치가 적절합니다

C/C++ 전체를 Semgrep 하나로 해결하려는 태도가 아니라,  
**Juliet에서 비는 구멍(CWE-369, CWE-190)을 국소적으로 메운다**는 방식은 타당합니다.

즉 현재 Semgrep taint의 위치는
- “주력 엔진”이 아니라
- “포트폴리오의 recall patch”
에 가깝습니다.

이 포지셔닝은 옳습니다.

---

## 가장 중요한 피드백

## P0. 먼저 고쳐야 하는 것

### P0-1) 현재 Precision/F1은 통계적으로 섞여 있어서, 대외 지표로 쓰기 어렵습니다

이 부분이 이번 리뷰에서 가장 중요합니다.

현재 `juliet_runner.py`를 보면:

- `combined_tp` / `combined_fn`은 **파일 단위**로 집계됩니다.
  - 어떤 파일에서 target CWE가 한 건이라도 잡히면 `tp += 1`
- 반면 `combined_fp`는 **finding 단위**로 집계됩니다.
  - 같은 파일에서 target CWE와 무관한 finding이 여러 건 나오면 그 개수만큼 `fp += N`

즉 현재 Precision/F1은 다음처럼 계산됩니다.

- TP: “정답 파일 수”
- FP: “무관 finding 수”

이 두 단위는 서로 다릅니다.  
그래서 지금의 Precision/F1은 **정통 의미의 precision/F1이 아닙니다.**

예를 들어 한 파일에서:
- target CWE를 1건 맞게 잡고
- 무관 finding 10건이 나오면

현재 방식에서는:
- TP = 1
- FP = 10
- Precision = 1 / 11 = 9.1%

하지만 이것은
- “파일 탐지 precision”도 아니고
- “finding precision”도 아닙니다.

즉 현재 문서의
- “Precision ~7%”
- “F1”
- “품질 메트릭 체계 확립”
이라는 표현은 리뷰어에게 그대로 내보내기 위험합니다.

#### 왜 위험한가

외부 리뷰어는 이 수치를 보고 두 가지 중 하나로 해석합니다.

1. **정말 FP가 매우 심각한 시스템**
2. **지표 정의가 불안정한 시스템**

현재는 2번에 가깝습니다.  
문제는 리뷰어가 1번으로 받아들일 가능성도 높다는 점입니다.

#### 권장 수정

지표를 최소한 다음처럼 분리해야 합니다.

**A. 파일 단위 검출 지표**
- File-level Recall = 탐지된 취약 파일 / 전체 취약 파일
- File-level Coverage = CWE별 파일 탐지율

**B. finding 단위 노이즈 지표**
- Unmatched Findings per File
- Unmatched Findings per 1kLoC
- Tool/Rule별 noise count

**C. 진짜 finding precision이 필요하면**
- Juliet ground truth line/function annotation과 맞추는 별도 판정기를 둬서
- TP/FP를 둘 다 finding 단위로 계산

현재 상태에서는 **Recall만 전면에 두고, Precision/F1은 “내부 실험 지표(재정의 예정)”로 낮추는 것**이 맞습니다.

---

### P0-2) OOM 문제는 아직 “필터링”이 아니라 “사후 폐기” 수준입니다

현재 `orchestrator.py`의 흐름은:

1. 전체 파일 대상으로 도구 실행
2. findings 합산
3. `thirdPartyPaths`와 절대경로 기준으로 결과 제거

즉 서드파티 코드를 **실행 전에 제외하지 않고, 실행한 뒤 결과만 버립니다.**

이 구조에서는 다음이 성립합니다.

- 비용은 이미 지불됨
- 메모리도 이미 소비됨
- 프로세스 수도 이미 폭증함
- 마지막에 결과만 없어질 뿐

따라서 현재의 `thirdPartyPaths`는 **노이즈 필터**이지, **리소스 제어 장치**가 아닙니다.

리뷰 요청서가 이 문제를 정확히 짚고 있고, 그 판단은 맞습니다.

#### 특히 위험한 지점

`gcc_analyzer_runner.py`는 현재:

- C/C++ 파일 목록을 만든 뒤
- 파일마다 `_run_single(...)` task를 생성하고
- `asyncio.gather(*tasks)`로 한 번에 돌립니다.

즉 파일 수가 500개면 사실상 500개 subprocess를 동시에 열 수 있는 구조입니다.

이 방식은:
- Juliet처럼 파일 충돌이 있는 벤치마크에는 편리하지만
- 실제 vendored 라이브러리 묶음에는 매우 위험합니다.

#### 권장 방향

핵심은 **“filter late”를 “scope early”로 바꾸는 것**입니다.

즉 질문은 “결과를 남길 것인가?”가 아니라  
**“애초에 어떤 파일을 분석 프로세스에 넣을 것인가?”**가 되어야 합니다.

제가 권하는 분석 범위는 다음 3단계입니다.

1. **사용자 코드**
   - 항상 분석

2. **수정/추가된 third-party 파일**
   - 분석

3. **경계면 frontier**
   - 사용자가 직접 include/call 하는 서드파티 boundary 파일만 분석
   - 예: modified file의 1-hop include / 1-hop caller-callee / exported entry points

즉 “identical vendored tree 전체”를 돌릴 이유는 없습니다.  
외부 리뷰어에게도 이 설명이 훨씬 설득력 있습니다.

---

### P0-3) heavy analyzer에는 반드시 동시성 제한이 들어가야 합니다

`ast_dumper`에는 `Semaphore(16)`이 문서상 존재하는데,  
정작 가장 위험한 `clang-tidy`, `scan-build`, `gcc-fanalyzer`의 파일별 실행 쪽은 이번 첨부 코드 기준으로 제한이 보이지 않습니다.

이 경우 최소한 다음이 필요합니다.

- `asyncio.Semaphore(N)` 기반 동시 실행 제한
- 파일 큐 방식 실행
- per-tool timeout과 별개로 **global tool wall-time** 제한
- 메모리 사용량 모니터링 또는 cgroup/container ceiling
- “부분 완료(partial)” 상태 보고

#### `ulimit -v`에 대한 의견

`ulimit -v`를 **주된 해결책**으로 삼는 것은 권하지 않습니다.

이유는 다음과 같습니다.

- GCC/Clang 계열은 메모리 제한에 걸렸을 때 진단이 일관되지 않습니다.
- WSL2 환경에서는 실제 체감 동작이 더 불안정할 수 있습니다.
- 근본 해결은 “한 번에 너무 많이 띄우지 않는 것”이지, “죽게 두는 것”이 아닙니다.

따라서 `ulimit -v`는 써도 **최후의 안전장치** 정도가 맞고,  
기본 해법은 **scope reduction + semaphore + queue**입니다.

---

## P1. 리뷰어가 바로 물을 가능성이 높은 문제

### P1-1) ExecutionReport의 `elapsedMs`는 현재 의미가 부정확합니다

`orchestrator.py`를 보면 `t0`를 `gather()` 직전에 찍고,  
각 tool result를 조립할 때마다 `time.perf_counter() - t0`를 다시 계산합니다.

하지만 `results = await asyncio.gather(...)`가 끝난 뒤에 이 루프를 돌기 때문에,  
각 도구의 `elapsed_ms`는 사실상 **모두 전체 스캔 완료 시각 기준의 거의 같은 값**이 됩니다.

즉 현재 `toolResults[*].elapsedMs`는 **도구별 소요시간이 아니라 전체 벽시계 시간에 가까운 값**입니다.

#### 왜 문제인가

문서와 응답 예시는 `toolResults[*].elapsedMs`가
- 도구별 성능,
- 병목 분석,
- 재현성 추적
에 쓰일 것처럼 보입니다.

하지만 지금 구현으로는 그 해석이 어렵습니다.

#### 권장 수정

도구별 시간을 측정하려면 다음 둘 중 하나가 필요합니다.

- 각 `_run_*` 코루틴 내부에서 시작/종료 시각을 직접 측정해서 반환
- 공용 wrapper를 둬서 `(findings, elapsed_ms, partial_stats)` 형태로 받기

그리고 문서에도 다음을 분명히 써야 합니다.

- `toolResults[*].findingsCount`가 **pre-filter 기준인지 post-filter 기준인지**
- 최종 `findingsTotal`과 합이 왜 맞지 않을 수 있는지
- partial/timed-out 파일이 있을 때 어떤 필드에 반영되는지

지금처럼 이 의미가 불명확하면, 숫자 자체보다 **숫자의 해석 가능성**이 먼저 흔들립니다.

---

### P1-2) `gcc-fanalyzer`의 부분 실패가 현재 응답에서 숨겨집니다

`gcc_analyzer_runner.py`의 `_run_single()`은 timeout이 나면:

- 프로세스를 kill하고
- 빈 리스트 `[]`를 반환합니다.

그리고 상위 `run()`은 이 빈 리스트를 정상 결과처럼 합산합니다.

즉 실제로는:
- 몇 개 파일이 타임아웃되었고
- 일부 coverage가 빠졌는데도

최종 `ExecutionReport`에는 도구 상태가 그냥 `"ok"`로 보일 수 있습니다.

이건 **신뢰도 문제**입니다.

#### 권장 수정

도구 응답에 최소한 아래가 필요합니다.

- `timedOutFiles`
- `failedFiles`
- `partial: true/false`

가능하면 status도
- `ok`
- `partial`
- `failed`
로 나누는 것이 맞습니다.

---

### P1-3) 현재 filtering 구현은 문서가 설명하는 것보다 느슨합니다

`_filter_user_code_findings()` 시그니처는 `source_files`를 받지만,  
실제 본문에서는 `source_files`가 사용되지 않습니다.

즉 지금은 사실상:

- 절대경로 아니고
- thirdPartyPaths에도 안 걸리면

그 finding을 사용자 코드로 남깁니다.

#### 이게 왜 문제인가

문서 설명만 보면 “업로드한/분석 대상 파일만 남긴다”처럼 읽힙니다.  
하지만 실제 코드는 “상대경로이기만 하면 남길 수 있는” 구조입니다.

이 차이는 다음 상황에서 문제를 만듭니다.

- `files[]` 모드에서 업로드되지 않은 프로젝트 상대경로 파일 finding
- generated source
- scan_dir 내 보조 파일
- 상대경로 헤더

즉 **allowlist filtering**이 아니라 **relative-path heuristic filtering**입니다.

#### 추가로 보이는 문제

- `sdkNoiseRemoved`는 현재 third-party 제거까지 함께 포함할 수 있습니다.
  - 이름은 “SDK noise”인데 실제론 “외부 제거 총량”에 가깝습니다.
- `_is_third_party()`는 단순 `startswith` 기반이라 path boundary가 약합니다.
  - 예: `lib` vs `library` 같은 prefix 충돌 가능

#### 권장 수정

- `source_files` allowlist를 실제로 사용
- `sdkNoiseRemoved`와 `thirdPartyRemoved`를 분리
- path 비교는 문자열 prefix가 아니라 정규화된 path segment 기준으로 변경

---

### P1-4) Semgrep 자동 skip 기준은 프로젝트 단위로는 거칠고, profile 의존성이 큽니다

현재 `_select_tools()`는 `profile`이 있을 때만
- `detect_language_family(profile)`를 보고
- C++ 프로젝트면 Semgrep을 스킵합니다.

이 방식에는 두 가지 문제가 있습니다.

#### 1. `profile`이 없으면 `.cpp` 파일이어도 Semgrep이 돌 수 있습니다

즉 문서가 말하는 “C++면 자동 스킵”은  
현재 구현상 **BuildProfile이 주어진 경우에만** 보장됩니다.

#### 2. mixed C/C++ 프로젝트에서 과도하게 스킵될 수 있습니다

프로젝트 전체 profile이 C++로 잡히면,
실제로는 C 파일에도 유용한 C 규칙을 적용할 수 있는데 Semgrep 전체가 꺼질 수 있습니다.

#### 권장 수정

Semgrep skip은
- project-wide boolean이 아니라
- **file extension / compile_commands / ruleset language** 기반의 per-file 혹은 per-bucket 판단
이 더 적절합니다.

현재 기준은 “거칠지만 이해되는 휴리스틱” 수준이지,
“충분히 정교한 자동 선택”이라고 말하기는 어렵습니다.

---

### P1-5) `gcc-fanalyzer` 가용성 체크가 실제 실행 경로와 완전히 일치하지 않습니다

현재 `check_available()`는 호스트 `gcc --version`만 확인합니다.

그런데 실제 실행 경로는:
- 가능하면 SDK 크로스컴파일러 사용
- 아니면 호스트 gcc fallback

즉 호스트 gcc 기준 availability는 실제 capability와 일치하지 않을 수 있습니다.

예를 들어:

- 호스트 gcc는 9.x라서 unavailable로 판단
- SDK gcc는 10+/13+라서 실제로는 실행 가능

이런 경우 tool skip 판단이 잘못될 수 있습니다.

#### 권장 수정

availability 판단을 최소한 두 단계로 나누는 것이 좋습니다.

- host capability
- selected compiler capability (BuildProfile/sdkId 해석 후)

---

### P1-6) `gcc-fanalyzer` 파서는 non-analyzer diagnostics를 섞어 받을 가능성이 있습니다

`_parse_output()`는 현재:

- `flag`가 있고 `-Wanalyzer*`가 아니면 제외
- **flag가 없으면 그대로 통과**

즉 include 실패, 일반 컴파일 warning/error 등
non-analyzer diagnostics도 finding처럼 들어올 가능성이 있습니다.

이는 false positive뿐 아니라,
**도구 의미 왜곡** 문제입니다.

#### 권장 수정

다음 중 하나로 좁혀야 합니다.

- `-Wanalyzer*` flag가 있는 라인만 수집
- 혹은 explicit CWE + analyzer context가 있는 라인만 허용
- 일반 compile diagnostics는 별도 channel로 분리

---

## P2. 지금 당장 막 치명적이진 않지만, 품질을 끌어올릴 포인트

### P2-1) Semgrep taint 규칙은 현재 “recall 우선형”입니다

`divide-by-zero.yaml`, `integer-overflow.yaml`를 보면
현재 규칙은 Juliet recall 보강에 매우 효과적입니다.

다만 production 관점에서는 아직 다음 보완이 필요합니다.

#### 부족한 점

- `pattern-sanitizers`가 없습니다.
  - 예: `if (x != 0)`, bounds check, max-value guard
- overflow 쪽도 guard-aware suppression이 없습니다.
- function-level fallback(`fscanf`, `scanf`)은 coarse합니다.
- 일부 규칙은 “입력 source가 들어왔다”만으로 꽤 넓게 잡습니다.

즉 지금은 **benchmark recall patchset**으로는 좋지만,  
**운영 precision까지 입증된 ruleset**이라고 부르기는 이릅니다.

#### 이 점을 잘 보여주는 baseline noise

`v0.6.0-full.json`을 합산해 보면 unmatched finding이 특히 많이 나오는 룰은 다음 계열입니다.

- `semgrep:...cwe-338-rand`
- `flawfinder:random/srand`
- `clang-tidy:...DeprecatedOrUnsafeBufferHandling`
- `clang-tidy/scan-build:DeadStores`

이건 “시스템이 무조건 나쁘다”는 뜻은 아니고,  
현재 benchmark가 **target CWE recall 검증**과 **전체 ruleset noise**를 한꺼번에 측정하고 있다는 뜻입니다.

따라서 외부 리뷰어에게는 다음처럼 설명하는 것이 안전합니다.

> “Semgrep taint는 특정 CWE recall 보강에는 성공했지만, portfolio-level noise 정리는 아직 진행 중이다.”

---

### P2-2) 현재 benchmark는 “rule relevance”와 “portfolio noise”를 분리하지 못합니다

예를 들어 CWE-369 스위트를 돌릴 때도
전혀 다른 rule(CWE-338 등)이 함께 firing하면 unmatched finding으로 누적됩니다.

이건 두 가지를 섞습니다.

1. **타깃 CWE 검출 성능**
2. **전체 ruleset 포트폴리오 노이즈**

둘 다 의미는 있지만, 한 숫자로 뭉치면 해석이 흐려집니다.

#### 권장 수정

벤치마크를 최소 두 레이어로 분리하는 것이 좋습니다.

- **Targeted rule benchmark**
  - 해당 CWE와 직접 관련된 룰만 켜서 recall/coverage 측정
- **Portfolio benchmark**
  - 실제 운영 ruleset 전체를 켜고 noise density 측정

이렇게 분리하면
- 규칙 자체 성능
- 운영 포트폴리오 성능
을 따로 말할 수 있습니다.

---

### P2-3) `LibraryDiffer`는 유용하지만, 지금 형태로는 비용/계약이 불안정합니다

`library_differ.py`는 방향이 좋습니다.  
하지만 실제 서비스 계층으로 보기엔 아직 손볼 부분이 많습니다.

#### 1. `diff()`와 `find_closest_version()`의 반환 shape가 다릅니다

`diff()`는 대체로:
- `matchRatio`
- `identicalFiles`
- `modifiedFiles`
- `addedFilesList`
등을 반환합니다.

반면 `find_closest_version()` 경로는 `_compute_diff()` 결과를 그대로 쓰기 때문에:
- `matchRatio`가 없고
- `identicalFiles`가 없고
- `deletedFiles`/`addedFilesList`도 일관되지 않습니다.

즉 같은 API에서 “버전이 있느냐 없느냐”에 따라 응답 shape가 달라질 수 있습니다.

외부 리뷰어는 이런 부분을 민감하게 봅니다.

#### 2. `find_closest_version()`의 “최근 20개 태그”는 실제로는 version sort 상위 20개입니다

코드상 `git tag --sort=version:refname` 후 `tags[-20:]`를 쓰기 때문에,
이건 엄밀히 말해 “최근 20개”가 아니라 **버전 정렬상 뒤 20개**입니다.

문서 표현과 구현 의미가 다릅니다.

#### 3. quick diff heuristic이 source-only 정책과 완전히 일치하지 않습니다

최종 diff는 source ext와 test/example/doc skip을 고려하지만,
`_quick_diff_size()`는 디렉토리 전체 diff를 봅니다.

즉 best tag 선정 기준과 최종 상세 diff 기준이 다릅니다.

#### 4. clone cache가 없습니다

같은 repo/tag를 반복 비교할 때도 매번 temp clone을 새로 뜹니다.  
이건 `/v1/libraries`, `/v1/build-and-analyze`, 반복 스캔에서 비용이 큽니다.

#### 권장 수정

- stable response schema로 통일
- repo/tag/commit 기준 bare mirror cache 혹은 clone cache 도입
- quick diff도 source-only, skip path 정책과 맞추기
- best-tag 탐색은 “최신 20개”가 아니라 “후보 규칙”을 문서/코드에서 명확히 정의

---

## 리뷰 요청 질문에 대한 직접 답변

## Q1. 6도구 오케스트레이션 전략은 건전한가?

### 답: **예, 방향은 건전합니다. 다만 “실행 범위 통제”와 “보고 정확도”가 부족합니다.**

#### 좋은 점
- 각 도구의 강점이 다른 만큼 포트폴리오 접근은 맞습니다.
- enriched/original profile 분리는 현실적입니다.
- cross-boundary 개념도 좋습니다.

#### 보완이 필요한 점
- file-by-file heavy analyzer는 Juliet에는 유리하지만 실제 대형 프로젝트에선 위험합니다.
- Semgrep auto-skip은 현재 너무 거칩니다.
- `toolResults.elapsedMs`, partial timeout 보고가 부정확합니다.

#### 결론
**전략 자체는 유지하되, 운영 안전장치와 측정 신뢰도를 보강하는 쪽이 맞습니다.**

---

## Q2. Semgrep taint mode 활용은 적절한가?

### 답: **적절합니다. 그러나 현재는 “production-grade precision 입증”보다 “recall gap closing”에 가깝습니다.**

#### 적절한 이유
- Juliet의 외부입력 → arithmetic 계열 구멍을 잘 메웁니다.
- 포트폴리오 내 역할이 분명합니다.
- 규칙 유지보수가 전혀 불가능한 수준은 아닙니다.

#### 한계
- sanitizer 부재
- pointer/address-of 추적 한계
- safe-path suppression 부족
- 실제 프로젝트 precision은 Juliet recall과 별개

#### `fscanf(..., &$X)` 문제
이건 어느 정도는 Semgrep의 C pointer/dataflow 표현 한계로 봐야 합니다.  
현재처럼 function-level fallback을 두는 접근은 실용적입니다.

다만 더 밀어붙이려면
- Clang AST 기반 보조 검사
- 혹은 매우 좁은 custom matcher
가 더 적합할 수 있습니다.

#### 결론
**“좋은 보완재”이지 “핵심 증거 엔진”으로 과대포장하면 안 됩니다.**

---

## Q3. Juliet 83.7% Recall은 실제 프로젝트에도 유효한가?

### 답: **회귀 방지용 내부 지표로는 유효합니다. 하지만 실프로덕션 성능 대표치로는 부족합니다.**

이유는 다음과 같습니다.

- variant_01 중심
- 12 CWE subset
- Juliet 구조와 실제 프로젝트 구조 차이
- file-by-file 실행이 Juliet에 유리할 수 있음
- precision/F1 정의 재정리 필요

따라서 외부 리뷰어에게는 다음 수준으로 표현하는 것이 적절합니다.

> “Juliet 12-CWE subset에서 recall 83.7%를 달성했고, 이는 회귀 감지와 ruleset 개선의 내부 기준으로 사용 중이다.  
> 다만 실제 프로젝트 precision/generalization은 별도 실코드 평가로 보완 중이다.”

---

## Q4. “modified third-party file만 분석” 전략은 충분한가?

### 답: **그 자체만으로는 충분하지 않습니다. 하지만 core strategy로는 맞습니다.**

왜냐하면 identical 서드파티 코드 전체를 다 돌릴 필요는 없지만,  
다음 두 영역은 같이 봐야 하기 때문입니다.

1. **modified / added third-party**
2. **사용자 코드와 맞닿는 boundary frontier**

즉 충분한 전략은 이렇게 정리됩니다.

- identical third-party 전체 분석: **불필요**
- modified/added third-party 분석: **필수**
- user ↔ vendor 경계면 1-hop 분석: **필수**

그래서 권장 범위는:

- user files
- modified/added third-party files
- boundary headers / wrappers / direct callers / direct callees

이 정도면 OOM을 크게 줄이면서도 cross-boundary 손실을 완화할 수 있습니다.

---

## Q5. 파이프라인 순서를 바꾸는 게 나은가, API로 diff 정보를 받는 게 나은가?

### 답: **하이브리드가 가장 좋습니다.**

제가 권하는 인터페이스는 다음과 같습니다.

### 기본 원칙
- S4는 **자체적으로도 diff를 계산할 수 있어야** 합니다.
- 그러나 S2/S3가 이미 diff 정보를 갖고 있다면 **입력으로 받을 수 있어야** 합니다.

### 권장 API
예를 들어 `/v1/scan`에 다음을 optional로 추가합니다.

- `thirdPartyManifest`
- `modifiedThirdPartyFiles`
- `analysisScopeStrategy`: `full | smart | user-only`

#### 장점
- S4 독립성 유지
- 상위 서비스가 미리 계산했을 때 중복비용 제거
- 계약이 더 명시적이 됨

즉 **내부 완결성과 호출자 최적화를 둘 다 얻는 방향**입니다.

---

## Q6. 테스트 전략에서 무엇이 더 필요한가?

### 답: **현재 313개 테스트는 인상적이지만, subprocess-heavy 서비스 기준으로는 integration/load 측면이 아직 얇습니다.**

특히 부족한 것은 아래입니다.

### 1. 실제 도구 smoke/integration 확대
도구별로 최소 1~2개가 아니라, 다음 케이스가 필요합니다.

- 정상 실행
- compile error 혼입
- timeout
- partial result
- SDK path resolution
- third-party filtering
- mixed-language project

### 2. 성능/부하 테스트
최소 다음 시나리오는 자동화해야 합니다.

- 100 files
- 500 files
- 1000 files
- vendored library 다수 포함
- SDK include path 다수 포함

측정 항목:
- RSS peak
- subprocess count
- wall-clock
- timed-out files
- filtered findings

### 3. 문서-응답 contract test
특히 다음 필드는 golden test가 필요합니다.

- `toolResults.elapsedMs`
- `toolResults.status`
- `filtering.sdkNoiseRemoved`
- `filtering.crossBoundaryKept`
- `/libraries` diff shape

---

## 문서와 API 관점의 정리 필요 사항

## 1) S4 문서끼리 버전과 범위가 다릅니다

현재 첨부 문서 기준으로:

- `sast-runner-api.md`는 **v0.6.0**
- `sast-runner.md`는 **v0.5.0**

그런데 둘 사이에 차이가 꽤 큽니다.

### 대표 예시

- 엔드포인트 수: 12개 vs 10개
- 커스텀 룰 설명: 53개 vs 5종
- Juliet 결과: 83.7% vs 70.9%
- API 예시 중 `/health` 응답 버전은 또 `0.4.0`

외부 리뷰어 입장에서는  
“현재 기준 문서가 무엇인지”부터 헷갈릴 수 있습니다.

### 권장 수정
- **API spec 하나를 canonical source**로 삼기
- 기능 명세는 “해설 문서”로 낮추고, 오래된 수치에는 deprecated 표기
- 리뷰 요청서에는 “기준 문서: v0.6.0 API spec”을 명시

---

## 2) gcc-fanalyzer profile 설명이 문서 사이에서 일치하지 않습니다

리뷰 요청서 2.2에는
- `gcc-fanalyzer → original profile`

처럼 읽히지만,

실제 `gcc_analyzer_runner.py`는
- SDK compiler를 쓸 때는 `enriched_profile`을 사용합니다.

이건 좋은 구현일 수 있습니다.  
문제는 **문서 설명이 단순화되어 있어서** 리뷰어가 “설계 설명과 코드가 다르다”고 느낄 수 있다는 점입니다.

### 권장 수정
문서에 다음처럼 명시하는 편이 낫습니다.

> “기본 원칙은 original profile이지만, SDK cross-compiler를 실제 사용하는 경우에 한해 SDK include path를 포함한 enriched profile을 사용한다.”

---

## 3) CVE 책임 분리는 S4 문서에선 비교적 정리됐지만, S3 문서에는 잔여 표현이 남아 있습니다

S4 문서들에서는 대체로
- CVE 조회는 S5로 이관
- S4 `/v1/libraries`는 CVE를 포함하지 않음

으로 정리되어 있습니다.

하지만 `analysis-agent.md`에는 여전히
- `/v1/libraries` → vendored 라이브러리 식별, upstream diff, **CVE 조회**
처럼 읽히는 잔여 표현이 보입니다.

이건 S4 코드 문제라기보다 **cross-service 문서 정합성 문제**입니다.

리뷰어는 이런 문서 드리프트를 꽤 민감하게 봅니다.

### 권장 수정
- S3 문서에서 S4 `/v1/libraries` 설명을 S5 lookup 분리 기준으로 업데이트
- “CVE는 S5 실시간 조회”를 cross-service contract 표에 명시

---

## 이번 버전에서 특히 추천하는 수정 순서

## 1단계: 리뷰 패키지 방어력 확보
1. Precision/F1 설명 수정  
2. 문서 버전/수치/역할 드리프트 정리  
3. `toolResults.elapsedMs` 의미 수정  
4. `partial` / `timedOutFiles` 도입

## 2단계: 운영 리스크 완화
1. heavy analyzer semaphore 도입  
2. third-party pre-scope 분석 범위 축소  
3. `modifiedThirdPartyFiles` optional API 도입  
4. clone cache / diff cache 도입

## 3단계: 품질 고도화
1. Semgrep sanitizer 패턴 추가  
2. portfolio benchmark vs targeted benchmark 분리  
3. safe corpus / real-world corpus 평가 추가  
4. mixed C/C++ auto-skip 정교화

---

## 외부 리뷰어에게 보여줄 때 표현을 다듬으면 좋은 문장

### 지금 표현보다 더 안전한 표현

#### 기존 톤
- “Precision/F1 품질 메트릭 체계 확립”
- “C++ → Semgrep 자동 스킵”
- “toolResults에 도구별 시간 제공”

#### 추천 톤
- “Recall은 회귀 감지용 내부 지표로 안정화했으며, precision 정의는 finding-level 기준으로 재정비 중”
- “Semgrep은 BuildProfile/language 정보 기반으로 선택적으로 제외하며, mixed-language 세분화는 후속 개선 과제”
- “execution report는 도구 상태와 필터링 통계를 제공하며, partial/timed-out reporting을 강화 중”

즉 현재 구현보다 더 강하게 들리는 문장을 약간 눌러 주는 것이 좋습니다.

---

## 최종 판단

제 판단은 다음과 같습니다.

### 아키텍처 자체
**긍정적입니다.**  
S4를 deterministic preprocessor로 정의한 방향, 6도구 포트폴리오, profile split, cross-boundary, SCA/origin tagging은 모두 설득력 있습니다.

### 지금 상태의 리뷰 패키지
**조금 위험합니다.**  
그 이유는 core design이 아니라,
- benchmark semantics
- execution report accuracy
- resource-control story
- 문서 정합성
이 아직 리뷰어 질문을 완전히 방어하지 못하기 때문입니다.

### 따라서 추천하는 결론
S4는 “설계가 불안정한 서비스”가 아니라,  
**“핵심 방향은 맞지만 evidence package와 운영 제어를 한 단계 더 다듬어야 하는 서비스”**에 가깝습니다.

이 프레이밍으로 가져가면,
과도하게 방어적이지도 않고
과장되지도 않게 리뷰를 통과할 가능성이 높습니다.

---

## 짧은 실행 체크리스트

- [ ] Precision/F1 설명을 파일 단위 vs finding 단위로 재정의
- [ ] `toolResults.elapsedMs`를 실제 per-tool time으로 수정
- [ ] `gcc-fanalyzer` partial timeout을 응답에 노출
- [ ] heavy analyzer에 semaphore 도입
- [ ] third-party는 “실행 후 제거”가 아니라 “실행 전 scope 축소”로 변경
- [ ] `source_files` allowlist를 실제 filtering에 반영
- [ ] `sdkNoiseRemoved`를 외부 제거 총량과 분리
- [ ] `/libraries` diff response shape 통일
- [ ] S4 API/spec/S3 docs 버전 및 책임 분리 문구 동기화
- [ ] Juliet 외 safe corpus / real-project corpus 추가

---

## 참고한 첨부 범위

- 리뷰 요청서: `(WR)S4_sast_runner_review_request.md`
- 핵심 오케스트레이션: `orchestrator.py`
- heavy analyzer / cross-boundary: `gcc_analyzer_runner.py`
- SCA / upstream diff: `sca_service.py`, `library_differ.py`
- Semgrep taint rules: `divide-by-zero.yaml`, `integer-overflow.yaml`
- 벤치마크: `juliet_runner.py`, `metrics.py`, `compare.py`, `v0.6.0-full.json`
- S4 문서: `sast-runner-api.md`, `sast-runner.md`
- 연동 문서: `analysis-agent-api.md`, `analysis-agent.md`, `build-agent-api.md`
