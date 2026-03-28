# S3 에이전트 아키텍처 종합 피드백

검토 대상:
- `S3_agent_architecture_review_request.md`
- 첨부 소스 전체 (`agent.py`, `caller.py`, `message_manager.py`, `turn_summarizer.py`, `executor.py`, `retry.py`, `errors.py`, `result_assembler.py`, `phase_one.py`, `phase_zero.py`, `tasks.py`, `try_build.py`, `list_files.py`, `read_file.py`, `build_error_classifier.py`, 각 `agent_loop.py`, `router.py`)
- 이전에 검토한 `S5 Knowledge Base / ETL overview` 문서 및 그 피드백 내용(교차 서비스 정합성 관점 반영)

검토 목적:
- 외부 리뷰어 관점에서 현재 S3 아키텍처가 얼마나 건전한지 평가
- 소스코드 수준에서 실제로 드러나는 설계 강점/위험요소를 문서의 주장과 대조
- “이 상태로 괜찮은가?”와 “어떻게 더 나아질 수 있는가?”에 대한 구체적 답변 제시

---

## 1. 총평

전체적으로 보면, S3는 **방향이 좋은 에이전트 시스템**이다. 특히 다음 세 가지는 분명히 강점이다.

1. **결정론적 단계와 LLM 단계를 분리**한 점이 좋다.  
   Analysis Agent의 Phase 1, Build Agent의 Phase 0는 모두 “LLM이 하기 애매한 탐색/수집/분류”를 먼저 수행하게 만들고 있다. 이 방향은 맞다.

2. **공통 프레임워크 분리 수준이 높다.**  
   `caller / message_manager / turn_summarizer / executor / retry / schemas`로 나눈 구조는 이후 실험과 하드닝 모두에 유리하다.

3. **도구 기반 루프를 제어하려는 의도**가 명확하다.  
   예산, 종료 조건, 중복 차단, timeout, exchange logging, build 실패 분류기까지 들어가 있어 “아무 제한 없는 agent”가 아니라는 점이 분명하다.

다만, 코드까지 포함해 보면 현재 상태를 다음처럼 평가하는 것이 정확하다.

> **연구/프로토타입 관점에서는 매우 괜찮다.**  
> **프로덕션/공격적 운영 관점에서는 아직 중요한 결함이 남아 있다.**

그 결함은 단순히 “성능을 더 올리면 된다” 수준이 아니라, 아래와 같은 **아키텍처 핵심부의 불일치**다.

- 경로 스코프와 워크스페이스 경계가 완전히 잠기지 않았다.
- 중복 호출 차단이 상태 변화를 고려하지 않아, 빌드 복구 루프 자체를 깨뜨릴 수 있다.
- Build/SDK 출력 계약과 ResultAssembler가 실제로 맞물리지 않는다.
- prompt 토큰이 주비용인데 예산 모델은 completion 중심이다.
- 안전성 검사가 `build_command` 문자열에만 걸려 있고, 실제 실행되는 스크립트 내용에는 걸리지 않는다.
- 동시 요청/버전 스코프/KB namespace가 아직 1차 시민(first-class) 개념이 아니다.

한 문장으로 정리하면 다음과 같다.

> **Analysis Agent는 지금의 방향을 유지하면서 정교화하면 된다. Build Agent는 “완전한 자유형 agent”보다 “결정론적 생성기 + 제한된 repair loop” 쪽으로 더 밀어붙이는 것이 맞다.**

---

## 2. 가장 잘된 점

### 2.1 Phase 분리 자체는 옳다

리뷰 요청서에서 가장 자신 있게 내세운 설계 원칙인 **결정론 → LLM** 분리는, 첨부 코드 기준으로도 실제 구현되고 있다.

- Analysis Agent는 `phase_one.py`에서 SAST / code graph / SCA / CVE lookup / threat query / dangerous callers / project memory를 먼저 수집한다.
- Build Agent는 `phase_zero.py`에서 build system / build files / project tree / SDK registry / language / existing script를 먼저 수집한다.

이 구조는 “LLM이 도구를 안 써도 된다고 오판하는 문제”를 줄이는 데 효과적이다. 이 원칙은 유지하는 것이 맞다.

### 2.2 agent-shared 분리가 좋다

`agent.py`, `caller.py`, `message_manager.py`, `turn_summarizer.py`, `executor.py`, `retry.py`, `errors.py`는 공통 프레임워크로서 역할 경계가 비교적 명확하다.

특히 좋은 점은 다음과 같다.

- DTO 분리 (`ToolCallRequest`, `ToolResult`, `LlmResponse`, `BudgetState`, `AgentAuditInfo`)
- LLM caller 분리와 adaptive timeout 도입
- Tool executor와 retry 정책 분리
- Message management와 compaction 분리
- JSONL exchange 로그와 dump 파일 기록

즉, 단일 monolith loop가 아니라 **교체 가능한 부품으로 조립된 agent runtime**에 가깝다. 이건 이후 실험/운영 모두에 강한 구조다.

### 2.3 Build Agent 개선 포인트가 실제 비용 절감으로 연결되고 있다

리뷰 요청서에 적은 최근 변경 중 `list_files`, `TurnSummarizer`, `read_file 8KB`, `Phase 0`, `BuildErrorClassifier`는 코드상으로도 실제 반영되어 있다. 특히 `list_files`와 `BuildErrorClassifier`는 단순한 리팩터링이 아니라 **agent가 쓸데없이 토큰을 태우는 면적을 줄이는 개선**이다.

- `list_files`는 “프로젝트 구조 파악을 위해 read_file 연타”하는 비효율을 줄인다.
- `BuildErrorClassifier`는 raw stderr 전체를 다시 LLM에게 먹이는 대신 구조화된 진단을 덧붙일 수 있게 한다.

이 방향은 맞다.

### 2.4 S3와 S5의 역할 경계가 코드상으로는 꽤 잘 맞는다

이전 S5 문서 피드백에서 핵심 이슈였던 것이 “CVE는 ETL에서 제외하고 런타임에서 조회한다”는 점의 일관성이었다. 이번 S3 코드를 보면 Analysis Agent의 Phase 1이 실제로 `POST /v1/cve/batch-lookup`를 호출하고, threat search / code graph ingest / dangerous callers / project memory도 런타임 연계로 사용한다.

즉, **플랫폼 전체 방향은 ‘정적 KB + 런타임 enrichment’** 쪽으로 이미 굳어져 있다. 이건 좋은 신호다.

다만 이 장점은 곧바로 다음 과제를 의미한다.

> S3가 기대하는 S5 payload 필드와 namespace semantics를 이제는 문서/스키마 수준에서도 canonical하게 고정해야 한다.

---

## 3. 가장 우선순위가 높은 문제들 (P0)

아래 항목들은 단순 개선이 아니라, 현재 구조의 안전성과 정확성을 직접 흔드는 이슈들이다.

---

### P0-1. `targetPath` / 작업 루트 스코프가 충분히 잠기지 않았다

#### 문제

Build Agent와 Analysis Agent 모두 `targetPath`를 사용하지만, 경계 검사가 충분히 강하지 않다.

- Build Agent (`tasks.py`, `phase_zero.py`)
  - `effective_root = os.path.join(project_path, target_path)`
  - `Phase0Executor`도 `os.path.join(project_path, target_path)`를 그대로 사용
  - 시작 시 `build-aegis/`를 `shutil.rmtree()`로 삭제
- Analysis Agent (`phase_one.py`)
  - `combined = normpath(f"{project_path}/{target_path}")`
  - 이후 `combined.startswith(project_path.rstrip("/"))`로 traversal 차단 시도

이 검사는 prefix 기반이라 안전하지 않다. 예를 들어 `project_path=/tmp/proj`일 때, `combined=/tmp/project_evil` 같은 경로도 문자열 prefix 기준으로는 통과할 수 있다. Build Agent 쪽은 아예 `commonpath`/`resolve()` 계열 검사가 없고, `effective_root` 밖 삭제까지 연결될 수 있다.

#### 왜 중요한가

이 이슈는 단순한 correctness 문제가 아니라 **실제 안전성 문제**다.

- build 서브프로젝트 범위를 넘어 다른 디렉토리에 `build-aegis/`를 만들거나 삭제할 수 있다.
- 동일 호스트의 다른 프로젝트/워크스페이스를 건드릴 수 있다.
- `targetPath` 기반 서브프로젝트 빌드가 “프롬프트 상 권고”일 뿐 “실제 정책”이 아니다.

#### 추가로 더 문제인 점

Build Agent에서 실제 툴 루트도 일관되지 않다.

- `write/edit/delete`는 `effective_root`를 사용
- 하지만 `list_files`, `read_file`, `try_build`는 여전히 `project_path`를 루트로 받는다

즉, LLM은 target subproject만 다루라는 지시를 받지만, 실제 도구는 프로젝트 전체를 읽고 빌드할 수 있다.

#### 권장 수정

1. **단일 path resolution 함수**를 만들고, 모든 agent/tool이 그것만 쓰게 해야 한다.  
   예: `resolve_scoped_path(root, rel)` -> `Path(root).resolve()` + `Path(...).resolve().is_relative_to(root)` 또는 `os.path.commonpath`
2. `targetPath`가 프로젝트 루트 밖으로 나가면 **무조건 거부**해야 한다.
3. `list_files`, `read_file`, `try_build`도 target-scoped root를 사용하도록 맞춰야 한다.
4. `build-aegis` cleanup도 request-scoped working dir로 바꾸는 것이 안전하다.

#### 한 줄 평가

> 현재 코드 기준으로는 “경로 순회 차단”을 완전히 달성했다고 보기 어렵다.

---

### P0-2. 중복 호출 차단이 상태 변화를 고려하지 않아, 빌드 복구 루프를 깨뜨릴 수 있다

#### 문제

현재 `args_hash`는 `tool name + arguments`만으로 계산되고, Router는 이 해시를 세션 전체에서 중복 차단에 사용한다.

이 방식은 **순수 함수형 tool**에는 적절할 수 있지만, **stateful tool**에는 잘 맞지 않는다.

대표적 사례가 Build Agent다.

1. `write_file(build-aegis/aegis-build.sh, ...)`
2. `try_build("bash build-aegis/aegis-build.sh")` 실패
3. `edit_file(build-aegis/aegis-build.sh, ...)`
4. 다시 `try_build("bash build-aegis/aegis-build.sh")`

여기서 4번은 인자가 같으므로 **중복 호출**로 차단될 가능성이 높다. 하지만 실제로는 3번에서 스크립트 내용이 바뀌었으므로, 동일한 `build_command`라 해도 **의미적으로는 다른 실행**이다.

#### 왜 중요한가

이건 Build Agent의 핵심 가치 제안인 `read → write/edit → try_build → repair` 루프를 정면으로 훼손한다. 즉, 설계 문서와 코드 정책이 충돌한다.

#### 권장 수정

중복 차단을 다음처럼 재정의하는 것이 좋다.

- **pure/read-only tool** (`list_files`, `read_file`, `knowledge.search` 등)에만 강하게 적용
- **stateful/side-effect tool** (`try_build`, `write_file`, `edit_file`, `delete_file`)은 별도 정책 사용
- 또는 **workspace revision** 개념을 도입해서, 파일이 바뀌면 duplicate set을 invalidate
- 또는 “같은 args라도 **mutating tool 이후**에는 다시 허용”하는 규칙 적용

#### 한 줄 평가

> 현재 duplicate suppression은 안전장치이면서 동시에, Build Agent의 정상 재시도를 막는 잠재적 기능 장애다.

---

### P0-3. Build / SDK 결과 계약과 `ResultAssembler`가 실제로 맞지 않는다

#### 문제

Build Agent 프롬프트는 최종 JSON에 `buildResult`를 요구하고, SDK Analyze는 `sdkProfile`을 요구한다. 그런데 `result_assembler.py`는 공통 경로에서 결국 `AssessmentResult`만 조립하며, build-specific / sdk-specific 필드를 명시적으로 옮기지 않는다.

즉, LLM이 JSON을 잘 출력해도 다음 필드는 실제 API 응답에서 유실될 가능성이 높다.

- `buildResult`
- `buildScript`
- `sdkProfile`

추가로 `allowed_refs = {ref.refId for ref in session.request.evidenceRefs}`로 검증하기 때문에, tool 실행 중 생성된 `new_evidence_refs`는 최종 grounding 모델에서 1차 시민이 아니다.

#### 왜 중요한가

이건 단순 구현 디테일이 아니라 **API 계약 위반 가능성**이다.

리뷰 요청서와 프롬프트는 Build Agent가 `buildResult + buildScript`를 돌려준다고 설명하지만, 실제 조립 코드는 공통 `AssessmentResult` 위주로 설계돼 있다. 이 상태에서는 “프롬프트는 맞는데 API는 다른 것”이 된다.

#### 권장 수정

1. `taskType`별 결과 조립기를 분리해야 한다.
   - `AnalysisResultAssembler`
   - `BuildResultAssembler`
   - `SdkAnalyzeResultAssembler`
2. 또는 discriminated union 기반 response model을 둬서 task type별 필수 필드를 명확히 강제해야 한다.
3. `new_evidence_refs`를 세션 수준 evidence registry로 올리고, 최종 validation의 allowed set에 포함시켜야 한다.
4. build/sdk task에서는 schema invalid도 fail-closed로 다루는 편이 낫다.

#### 한 줄 평가

> 현재 구조는 “LLM 출력 형식”과 “API 응답 형식”이 완전히 같은지 보장하지 못한다.

---

### P0-4. Build 안전성 검사가 `build_command`에만 걸려 있고, 실제 스크립트 내용은 충분히 통제되지 않는다

#### 문제

`TryBuildTool`은 금지 명령어를 `build_command` 문자열에서만 검사한다. 그러나 실제 실행되는 것은 대부분 `bash build-aegis/aegis-build.sh`다. 즉, 금지 명령어가 스크립트 내부에 들어 있으면 상위 command 검사는 아무 의미가 없다.

예를 들어 다음이 가능하다.

- `build_command = "bash build-aegis/aegis-build.sh"`  → 허용
- 스크립트 내부에 `rm -rf ...`, `curl ...`, `patch ...`  → 실제 실행

경로 정책은 파일 생성 위치를 제한하지만, **스크립트 내용 정책**은 별도로 보이지 않는다.

#### 왜 중요한가

Build Agent는 파일을 생성할 수 있는 agent다. 이 구조에서는 “명령어 문자열 필터링”보다 **스크립트 내용 검증 + 실행 환경 격리**가 훨씬 중요하다.

#### 추가로 드러난 모순

`BuildErrorClassifier`는 `Permission denied`에 대해 `chmod +x`를 제안한다. 하지만 `TryBuildTool`은 `chmod`를 금지한다. 즉, **분류기가 정책상 불가능한 수정을 권장**한다.

#### 권장 수정

1. `write_file` / `edit_file` 시점에 스크립트 내용에 대한 static policy scan을 추가해야 한다.
   - 금지 command
   - 절대 경로 파괴성 명령
   - 네트워크/패키지 설치/권한 변경
   - source tree 수정
2. S4 build worker는 가능하면 다음을 적용해야 한다.
   - source tree read-only mount
   - 쓰기 가능 영역은 request-scoped build dir만 허용
   - network off
   - low-privilege user / container / seccomp / mount namespace
3. `Permission denied -> chmod +x` 제안은 정책과 맞는 형태로 바꿔야 한다.  
   예: “`bash script.sh`로 실행하거나, 생성 스크립트를 실행 권한 없이도 호출 가능한 방식으로 유지하라.”

#### 한 줄 평가

> 현재 build safety는 “툴 이름 기준”으로는 제한돼 있지만, “실행 내용 기준”으로는 아직 충분히 닫혀 있지 않다.

---

### P0-5. 동시 요청과 버전 스코프가 아직 아키텍처 1차 개념이 아니다

#### 문제

리뷰 요청서에서도 “동시 요청 처리 미검증”을 언급했는데, 코드 기준으로 보면 이건 실제 우려다.

- Build Agent는 매 요청마다 고정된 `build-aegis/`를 지운다.
- 같은 프로젝트에 동시 요청이 들어오면 서로의 산출물을 삭제/수정할 수 있다.
- Analysis Agent는 code graph를 `project_id` namespace에 ingest한다.
- `project_memory`도 `project_id` 기준이다.

즉, branch / commit / request isolation이 아직 뚜렷하지 않다.

#### 왜 중요한가

- 같은 프로젝트의 다른 commit 분석 결과가 KB에서 섞일 수 있다.
- 같은 프로젝트에 대한 build 요청이 서로 영향을 줄 수 있다.
- 장기 기억(project memory)이 어느 시점 코드에 대응하는지 흐려진다.

#### 권장 수정

1. Build 작업 디렉토리를 `build-aegis/<taskId>` 또는 `build-aegis-runs/<requestId>` 형태로 바꾸기
2. KB namespace를 최소한 `project_id + revision(commit sha)`까지 확장하기
3. project memory도 `project_id` 단독이 아니라 `project_id + branch/commit + semantic scope`로 세분화하기
4. concurrent request integration test를 반드시 추가하기

#### 한 줄 평가

> 지금 구조는 단일 요청 기준으로는 잘 굴러갈 수 있어도, 멀티-tenant / 동시성 / revision-aware 운영에는 아직 취약하다.

---

## 4. 높은 우선순위 개선 사항 (P1)

---

### 4.1 현재 예산 모델은 실제 비용 구조와 맞지 않는다

리뷰 요청서에 나온 24시간 토큰 비율이 `Prompt : Completion = 60 : 1`인데, `BudgetState`는 사실상 **completion budget만 추적**한다.

이건 매우 중요한 지점이다.

현재 병목은 completion이 아니라 prompt다. 그런데 제어 변수는 completion 중심이면, 실제 비용/지연을 가장 많이 만드는 부분이 예산 모델 밖에 남는다.

#### 같이 봐야 할 코드 레벨 문제

- `MessageManager.get_token_estimate()`는 `content` 길이만 센다.
- `assistant tool_calls` 메시지의 JSON payload는 거의 반영되지 않는다.
- `content=None`인 경우 `str(None)` 길이만 더한다.
- `LlmCaller._estimate_timeout()`도 `content` 길이만 보고 timeout을 계산한다.

즉,

- compaction trigger도 부정확하고,
- adaptive timeout도 tool-heavy turn에서 과소추정될 수 있다.

#### 권장 수정

1. `prompt budget`를 독립 변수로 추가
2. `prompt + completion + tool output chars`를 모두 보는 total budget 추가
3. token estimate는 최소한 message role / tool_calls JSON / tool content까지 포함하도록 보정
4. 가능하면 실제 tokenizer 또는 upstream usage 기반 calibration 도입

#### 판단

> 60:1 자체가 항상 비정상은 아니지만, 현재 구조에서는 “모니터링 대상”과 “제어 대상”이 어긋나 있다는 뜻이다.

---

### 4.2 현재 compaction은 응급장치로는 괜찮지만, 장기 전략으로는 부족하다

`TurnSummarizer`는 지금 단계에서 단순 truncation을 한다. 그 자체는 나쁘지 않다. 오히려 Evidence-first 시스템에서 성급히 LLM 요약을 도입하면 hallucination이 들어갈 수 있으므로, 초기에는 보수적 truncation이 더 낫다.

문제는 현재 구현이 **“대화를 잊는 방식”**은 있어도 **“상태를 남기는 방식”**은 약하다는 점이다.

특히 다음이 아쉽다.

- 생략 메시지가 `role=user`로 들어간다.
- 구조화된 state summary가 없다.
- build loop의 현재 상태(현재 script path, 마지막 build command, 마지막 error class, 이미 읽은 파일, 이미 시도한 전략)가 별도 scratchpad로 유지되지 않는다.

#### 권장 수정

LLM 요약으로 바로 가지 말고, 먼저 **구조화 상태 요약**을 넣는 것이 더 좋다.

예시:

- `files_read`
- `candidate_build_system`
- `current_build_command`
- `current_generated_files`
- `last_build_error_classification`
- `tools_already_attempted`
- `phase1 evidence summary`

그 다음에야 선택적으로 LLM summary를 붙이는 편이 Evidence-first에 더 맞다.

---

### 4.3 Analysis Phase 2 프롬프트에 상충하는 지시가 있다

`build_phase2_prompt()`의 도구 사용 지침은 의도는 좋지만, 실제 agent 행동 공간을 불필요하게 왜곡할 수 있다.

대표적으로 다음 조합이 충돌한다.

- “최소 1회 이상 도구를 호출하라”
- “위험 함수 호출자 체인은 반드시 `code_graph.callers`로 확인하라”
- “위협 지식이 부족하면 `knowledge.search`로 보강하라”
- “도구를 호출한 후에는 반드시 보고서를 작성하라. 또 다른 도구를 호출하지 마라”

이 규칙을 있는 그대로 따르면,

- 첫 tool이 `knowledge.search`이면 `code_graph.callers`를 못 쓴다.
- 첫 tool이 `code_graph.callers`이면 부족한 지식을 보강할 여지가 없다.
- 이미 Phase 1에서 dangerous callers가 있더라도 또 호출하도록 강제된다.

#### 권장 수정

도구 사용 지침은 다음처럼 바꾸는 편이 자연스럽다.

- 기본 원칙: “추가 불확실성이 있을 때만 도구를 호출하라”
- 권장 규칙: “dangerous caller 정보가 Phase 1에 없거나 불충분하면 `code_graph.callers`를 호출하라”
- 상한 규칙: “추가 tool call은 최대 1~2회”

즉, **무조건성**보다 **불확실성 기반 호출 조건**이 더 낫다.

---

### 4.4 upstream contract가 여전히 stringly-typed 하다

S3는 S4/S5/S7과 활발히 상호작용하지만, 실제로는 dict field 접근이 매우 많다.

예:

- S4 build-and-analyze 응답 파싱
- S5 CVE lookup 필드 (`version_match`, `kev`, `epss_score`, `affected_versions`, `related_cwe`)
- code graph origin 필드 (`origin`, `original_lib/originalLib`, `original_version/originalVersion`)
- project memory payload shape
- LLM response 구조 parsing

이 상태에서는 upstream이 필드명을 조금만 바꿔도 **조용히 깨질 수 있다**.

#### 권장 수정

1. 각 upstream 별 `Adapter + Pydantic model`을 두기
2. S4/S5/S7과 **contract test**를 별도로 만들기
3. response versioning을 문서화하기
4. snake_case/camelCase 혼용 필드는 정리하기

---

### 4.5 관측성은 좋지만, 몇 군데는 더 정교해야 한다

좋은 점:

- request id 전달
- exchange log + dump
- structured agent_log
- audit trace/turns

보강할 점:

- `ToolTraceStep.turn_number`가 실제 `turn`보다 1 늦을 가능성이 있다.
- exchange dump는 prompt/tool output/source code를 그대로 담을 수 있어 보안/보존 정책이 필요하다.
- build agent는 `force_report` 상황에서 `MessageManager` 내부 배열에 직접 접근한다.

#### 권장 수정

- `MessageManager.add_user_message()` 같은 API 추가
- trace turn numbering 정합성 재검증
- dump redaction / retention / access policy 문서화

---

## 5. subsystem별 상세 피드백

---

### 5.1 agent-shared

#### 긍정 평가

- DTO 구성이 비교적 깔끔하다.
- `LlmCaller`가 단순 transport와 parse를 담당하고, loop 판단을 하지 않는 점이 좋다.
- `ToolExecutor`와 `RetryPolicy`가 분리돼 있어 테스트와 교체가 쉽다.

#### 개선 포인트

1. **BudgetState가 completion 중심**이다.  
   지금 시스템 병목은 prompt-heavy loop인데, budget primitive가 이를 반영하지 못한다.

2. **token estimate가 너무 단순하다.**  
   `tool_calls`, `role`, structured JSON, tool outputs의 기여를 충분히 반영하지 못한다.

3. **TurnSummarizer의 placeholder role이 부적절하다.**  
   생략 사실을 `user` message로 주입하면 모델이 사용자 지시처럼 해석할 수 있다.

4. **LLM parse failure에 대한 fail-soft가 너무 조용할 수 있다.**  
   malformed tool call이 있으면 경고만 남기고 넘어가는데, content도 없으면 빈 응답이 최종 보고서 경로로 들어갈 수 있다.

5. **shared abstraction에 상태 분류가 없다.**  
   tool purity(순수/읽기/쓰기/실행), scope(rooted path), side-effect class, retryability, duplicate semantics가 타입 수준으로 드러나지 않는다.

#### 제안

향후 `ToolSchema` 또는 별도 capability manifest에 아래를 포함하는 것이 좋다.

- `side_effect_level`
- `scope_type` (project / subproject / request_workspace / remote)
- `duplicate_policy`
- `evidence_behavior` (produces refs / mutates workspace / reads only)
- `safety_class`

도구 확장 정책을 외부화하려면 단순히 YAML로 빼는 것보다, 이런 **능력(capability) 메타데이터**를 먼저 정의하는 것이 더 중요하다.

---

### 5.2 Analysis Agent

#### 긍정 평가

- Analysis Agent가 agent여야 할 이유는 충분하다.  
  보안 분석은 본질적으로 open-ended reasoning이 필요하고, Phase 1 증거 위에 추가 탐색/해석이 붙는 구조가 적절하다.

- `Phase1Executor`가 상당히 강하다.  
  SAST / code graph / SCA / KB query / dangerous callers / project memory까지 한 번에 엮는 건 좋다.

- third-party / modified-third-party까지 프롬프트에 반영한 점은 실제 현업 분석에 가깝다.

#### 우려 포인트

1. **경로 검증 취약점**  
   앞서 지적한 `startswith` 기반 targetPath 검증은 수정이 필요하다.

2. **hard-coded relevance filters**  
   `src/`로 시작하는 파일만 ingest 대상으로 삼는 로직은 레이아웃 의존적이다.

3. **silent truncation**  
   CVE는 20개 라이브러리, threat query는 10개 CWE까지만 보는 식인데, 이 상한이 결과 의미에 큰 영향을 줄 수 있다. 현재는 정책이라기보다 내부 구현 디테일처럼 보인다.

4. **dangerous function 추출이 substring 기반**  
   `if func in msg`는 false positive가 생길 수 있다. 가능하면 SAST metadata, AST-based tag, 정규식 boundary를 쓰는 편이 낫다.

5. **project memory의 revision semantics 불명확**  
   과거 세션 기억을 넣는 건 좋은데, 어떤 commit/branch 기준 기억인지 명확하지 않다. 잘못하면 false positive가 아니라 false carry-over가 생긴다.

#### 판단

Analysis Agent는 지금 구조를 “버려야 하는” 것이 아니라, **안전성과 contract를 다듬으면 충분히 강한 형태**다.

---

### 5.3 Build Agent

#### 긍정 평가

- Build Agent는 최근 개선이 가장 눈에 띈다.  
  `list_files`, `Phase 0`, `BuildErrorClassifier`, `force_report`는 모두 실용적이다.

- 특히 `build error -> structured suggestion`은 좋은 방향이다. 이는 빌드 복구를 완전히 자유형 reasoning에 맡기지 않겠다는 뜻이기 때문이다.

#### 하지만 구조적으로는 더 결정론적이어야 한다

현재 Build Agent는 여전히 “탐색형 agent” 성격이 남아 있다. 그런데 코드를 보면 이미 상당 부분이 결정론화돼 있다.

- build system detection
- build file discovery
- SDK registry fetch
- language detection
- project tree generation
- existing script detection
- error classification

즉, Build Agent는 사실상 **agent라기보다 constrained synthesizer + repair loop**에 더 가깝다.

#### 내가 권하는 방향

Build Agent는 다음 형태가 가장 적절하다.

1. **Phase 0**: build system / target scope / SDK / existing script / important files 확정
2. **Deterministic generator**: build system별 템플릿으로 초기 `aegis-build.sh` 생성
3. **Run**: `try_build`
4. **Repair step**: LLM은 “현재 script + classified error + allowed edit surface”만 보고 patch/diff 제안
5. **Apply + rerun**
6. **N회 후 종료**

즉, LLM이 처음부터 프로젝트 전체를 탐험하게 하기보다, **수정 가능한 작은 표면** 안에서만 일하게 해야 한다.

#### 왜 이게 더 좋은가

- prompt 토큰 급감
- duplicate semantics 단순화
- 성공률 측정이 쉬움
- tool safety 하드닝이 쉬움
- failure mode가 예측 가능해짐

#### 한 줄 평가

> Build Agent를 “더 agent답게” 만들기보다, “더 compiler-driver답게” 만드는 것이 맞다.

---

### 5.4 S3 ↔ S4 / S5 / S7 인터페이스

#### S3 ↔ S5

좋은 점:

- Analysis Agent가 S5를 실제 런타임 enrichment 계층으로 잘 사용한다.
- CVE lookup / threat search / code graph / project memory 역할 분담이 명확하다.

개선점:

- S3가 기대하는 필드 집합을 S5 문서가 명시적으로 보장해야 한다.
- `origin`, `originalLib`, `originalVersion`, `kev`, `epss_score`, `graph_relations`, `project_memory.type/data` 같은 필드는 사실상 계약인데 문서상 canonical하지 않다.
- code graph ingest의 overwrite/merge semantics가 명확해야 한다.

#### S3 ↔ S4

좋은 점:

- build-and-analyze fallback 구조는 현실적이다.
- try_build / sdk-registry / build-and-analyze의 역할 구분도 합리적이다.

개선점:

- S4 build success 기준을 exitCode만 볼지, artifact 존재까지 볼지 정해야 한다.
- build-and-analyze 실패 시 어떤 경우 개별 fallback을 타는지 policy를 문서화하는 편이 좋다.
- SDK registry가 여러 SDK를 돌려줄 때, 첫 번째 SDK를 쓰는 휴리스틱은 약하다.

#### S3 ↔ S7

좋은 점:

- Gateway를 single choke point로 두는 건 운영상 유리하다.

개선점:

- adaptive timeout이 tool-heavy prompt의 실제 크기를 충분히 반영하지 못한다.
- 400 too large 처리에서 chars/limit를 실제 값으로 남기면 운영성이 더 좋아진다.

---

## 6. 리뷰 요청서의 핵심 질문에 대한 직접 답변

---

### Q1. 에이전트, 이 상태로 괜찮은가?

#### 답: “방향은 맞다. 하지만 그대로 production-ready라고 하긴 이르다.”

좀 더 세분화하면 다음과 같다.

#### Analysis Agent

- **예, 꽤 괜찮다.**
- 다만 path scope, evidence registry, prompt/tool policy, upstream contract validation을 먼저 다듬어야 한다.

#### Build Agent

- **부분적으로만 괜찮다.**
- 현재 형태는 이미 절반 이상 결정론적이므로, 자유형 agent보다는 constrained repair system으로 더 밀어야 한다.

#### 공통 프레임워크

- **뼈대는 좋다.**
- 그러나 token budget, duplicate semantics, task-specific response assembly는 재설계가 필요하다.

---

### Q2. 어떻게 하면 더 나은 에이전트가 될 수 있는가?

핵심은 “더 똑똑한 agent”보다 **더 좁고, 더 typed되고, 더 상태 인지적인 agent**로 가는 것이다.

내가 보는 우선순위는 아래와 같다.

1. **안전한 scope / workspace / namespace부터 고치기**
2. **stateful duplicate policy 도입**
3. **task-specific result model 정리**
4. **prompt budget을 1차 제어변수로 승격**
5. **Build Agent의 초기 생성 단계를 더 결정론화**
6. **session-level structured state summary 도입**
7. **S4/S5 contract model과 integration test 강화**

---

## 7. 아키텍처 수준 제안

---

### 7.1 Build Agent는 “완전한 LLM 에이전트”여야 하는가?

내 판단은 **아니다**에 가깝다.

정확히는,

- **Analysis Agent는 agent여야 한다.**
- **Build Agent는 agent-like repairer면 충분하다.**

Build는 reasoning보다 **규칙 기반 제약과 실행 피드백**이 강한 문제다. 이미 Phase 0와 error classifier가 있기 때문에, 남은 자유도는 꽤 좁다.

따라서 추천 구조는 다음과 같다.

- 초기 script 생성: deterministic/template-driven
- 실패 복구: LLM patch generation
- 실행 여부 판단: deterministic
- 종료 판단: deterministic

이렇게 해야 prompt 토큰도 줄고, 안전성도 올라가며, 테스트 가능성도 좋아진다.

---

### 7.2 도구 확장 정책이 필요한가?

필요는 하지만, **지금 가장 시급한 문제는 아니다.**

현재 hard-coded registration은 초기 단계에서 오히려 장점도 있다. 도구가 안전하게 분류되기 전까지는 런타임 확장이 위험할 수 있기 때문이다.

다만 장기적으로는 다음 조건을 충족하는 방식이 바람직하다.

- 단순 이름/설명 등록이 아니라 capability-based manifest
- tool별 purity / side-effect / scope / retry / evidence metadata 포함
- 승인된 manifest만 로딩
- 환경별 allowlist

즉, “도구를 쉽게 늘리는 것”보다 “도구를 안전하게 분류하는 것”이 먼저다.

---

### 7.3 컨텍스트 압축을 LLM 기반으로 전환해야 하는가?

당장 전환할 필요는 없다.

지금 단계에서 바로 LLM 요약으로 가면 다음 문제가 생긴다.

- hallucinated state summary
- evidence-first 원칙 약화
- 요약비용 자체 증가

순서는 다음이 더 낫다.

1. structured state compaction
2. extractive summary
3. 필요 시에만 LLM summary

즉, **LLM 요약은 2차 개선**이고, **상태 모델링이 1차 개선**이다.

---

### 7.4 Prompt:Completion 비율 60:1은 정상인가?

완전히 비정상이라고 하긴 어렵다. tool-using agent는 원래 prompt-heavy해지기 쉽다.

하지만 현재는 이 비율이 단순 특성이라기보다 다음 문제를 시사한다.

- tool output과 file content가 너무 많은 비중을 차지한다.
- budget이 completion 중심이라 실제 병목을 못 잡는다.
- compaction trigger와 token estimate가 부정확하다.

즉, 이 비율은 “그럴 수도 있음”이 아니라 **지금 구조에서 최적화 대상이 맞다**고 보는 편이 옳다.

---

## 8. 추천 실행 로드맵

---

### 8.1 바로 해야 할 것 (우선순위 최고)

1. **path scope 고정**
   - `resolve_scoped_path()` 공통화
   - `targetPath` 검증 강화
   - 모든 build tool root 정렬

2. **duplicate policy 수정**
   - stateful tool 예외 처리
   - mutation 이후 재호출 허용

3. **task-specific result assembler 분리**
   - build/sdk/analysis 결과 모델 분리
   - dynamic evidence refs registry 도입

4. **script content safety 추가**
   - write/edit 시 static scan
   - 실행 환경 read-only / sandbox 강화

5. **request-scoped workspace 도입**
   - `build-aegis/<taskId>` 또는 별도 run dir

---

### 8.2 그 다음 단계

6. **prompt budget / total budget 도입**
7. **structured state summary 도입**
8. **upstream payload adapter + contract test 추가**
9. **revision-aware KB namespace 설계**
10. **Build Agent 초기 script 생성 deterministic화**

---

### 8.3 이후 단계

11. **evaluation harness 정교화**
    - build first-pass success rate
    - repair success rate
    - average prompt tokens per success
    - invalid grounding rate
    - duplicate suppression false-positive rate

12. **운영 문서화**
    - dump retention/redaction policy
    - degraded mode 문서화
    - multi-request isolation 문서화

---

## 9. 테스트 전략에서 추가해야 할 것

현재 테스트 수가 많은 것은 강점이지만, 아래 테스트는 반드시 들어가야 한다.

### 9.1 보안/스코프 테스트

- `targetPath=../../..` 경로 탈출 시도
- prefix confusion (`/tmp/proj` vs `/tmp/project_evil`) 케이스
- target subproject 외부 파일 read/list/build 차단 여부
- build script 내부 금지 명령어 탐지 여부

### 9.2 상태/동시성 테스트

- `edit_file` 후 동일 `try_build` 명령 재실행 허용 여부
- 동일 프로젝트 동시 build 요청 시 workspace 충돌 여부
- 동일 project_id 다른 revision 분석 시 KB 섞임 여부

### 9.3 계약 테스트

- Build Agent 응답에 `buildResult` 보존 여부
- SDK Analyze 응답에 `sdkProfile` 보존 여부
- tool-generated evidence refs가 final validation에 반영되는지 여부
- S4/S5 field rename에 대한 adapter failure detection

### 9.4 토큰/컨텍스트 테스트

- `tool_calls`가 많은 turn에서 token estimate 정확도
- compaction 후 필수 상태 손실 여부
- timeout estimate가 large prompt/tool turn에서 충분한지 여부

---

## 10. 최종 결론

이 S3는 **좋은 방향으로 만들어지고 있는 시스템**이다. 설계자의 문제의식도 정확하고, 실제 코드도 그 문제를 해결하려는 흔적이 분명하다. 특히 Analysis Agent 쪽은 “Phase 1 deterministic evidence collection + limited agent reasoning”이라는 골격이 꽤 강하다.

하지만 동시에, 현재는 다음 이유로 아직 “안심하고 확장 가능한 production-grade agent runtime”이라고 보기는 어렵다.

- scope/workspace isolation이 완전히 잠기지 않았고,
- duplicate suppression이 stateful tool에 맞지 않으며,
- 결과 계약이 task별로 정리되어 있지 않고,
- prompt-heavy 구조를 budget이 제대로 제어하지 못하며,
- build safety가 script content 수준까지 닫혀 있지 않다.

따라서 내 최종 평가는 다음과 같다.

> **아키텍처의 방향성은 좋다.**  
> **다만 지금은 “더 똑똑한 agent”로 가기 전에, “더 좁고 더 안전하고 더 typed된 agent”로 먼저 가야 한다.**

특히 Build Agent는 앞으로 다음 문장으로 재정의하는 것이 가장 좋다.

> “LLM이 모든 것을 탐험하는 빌드 agent”가 아니라,  
> **“결정론적 빌드 생성기 위에서 제한된 패치를 수행하는 repair loop”**

이 방향으로 가면 성공률, 안전성, 토큰 효율, 테스트 가능성이 동시에 좋아질 가능성이 높다.

---

## 11. 파일별 짧은 메모

이 섹션은 “전체 소스를 실제로 다 봤는가?”에 대한 확인용으로, 파일별 핵심 의견을 짧게 적은 것이다.

### 11.1 `agent.py`
- DTO 분리는 깔끔하다.
- 다만 `BudgetState`가 completion 중심이고, duplicate set이 stateful tool semantics를 반영하지 못한다.

### 11.2 `caller.py`
- adaptive timeout, exchange dump, request-id 전달은 좋다.
- 그러나 timeout 추정이 `content` 길이 위주라 tool-heavy turn에서 과소추정될 수 있다.

### 11.3 `message_manager.py`
- 역할이 단순하고 좋다.
- 하지만 token estimate가 너무 단순하며, `add_user_message()` 부재가 build loop의 private field 접근으로 이어졌다.

### 11.4 `turn_summarizer.py`
- tool/tool_call pair를 깨지 않으려는 의도는 좋다.
- 다만 생략 사실을 `user` role로 넣는 것은 역할 의미상 부적절하다.

### 11.5 `executor.py`
- `asyncio.wait_for` 기반 timeout 래핑은 적절하다.
- 다만 side-effect tool 취소 semantics는 별도 운영 가정이 필요하다.

### 11.6 `retry.py`
- 단순하고 보수적이라 좋다.
- 현재 단계에서는 충분하지만, 장기적으로는 error class별 jitter/backoff 세분화 여지가 있다.

### 11.7 `errors.py`
- 계층은 명확하다.
- `LlmInputTooLargeError`에 실제 chars/limit가 들어오지 않는 경로는 보완 가치가 있다.

### 11.8 `result_assembler.py`
- Analysis Agent 용으로는 어느 정도 정리돼 있다.
- 하지만 Build/SDK 결과를 공통 `AssessmentResult`로 수렴시키는 구조는 계약 불일치 위험이 크다.

### 11.9 Analysis `phase_one.py`
- 이번 첨부물에서 가장 중요한 파일 중 하나다. 설계 의도가 잘 살아 있다.
- 동시에 path scope, hard-coded caps, dangerous func 추출, project memory namespace에서 보완 포인트가 가장 많이 보인다.

### 11.10 Analysis `agent_loop.py`
- 루프 구조는 정돈돼 있다.
- no-tool mode에 들어갈 때 명시적 “이제 보고서를 써라” 지시가 없다는 점은 다소 아쉽다.

### 11.11 Analysis `router.py`
- unknown/budget/duplicate/tool dispatch 흐름은 좋다.
- 다만 duplicate semantics와 `turn_number=session.turn_count` 기록은 수정하는 편이 좋다.

### 11.12 `phase_zero.py`
- Build Agent에서 매우 유용한 결정론 단계다.
- 그러나 targetPath validation, multi-SDK 선택, heuristic 범위는 지금보다 강해져야 한다.

### 11.13 Build `agent_loop.py`
- `force_report` 아이디어는 실용적이다.
- 다만 private `_messages` 접근과, force_report 지시를 message API로 다루지 않는 점은 shared abstraction을 약화시킨다.

### 11.14 `tasks.py`
- 실질적으로 Build Agent의 orchestration 중심 파일이다.
- target scope 일관성, helper duplication, tool root 불일치, sdk-analyze/read_file 제한 mismatch가 핵심 이슈다.

### 11.15 `list_files.py`
- 매우 유용한 도구다.
- 다만 target subproject scope를 실제로 강제하려면 root를 더 좁게 잡아야 한다.

### 11.16 `try_build.py`
- 금지 명령어 필터, S4 연동, error classifier 연계는 좋다.
- 그러나 상위 command만 검사하고 스크립트 내부를 못 본다는 점이 현재 가장 큰 한계다.

### 11.17 `read_file.py`
- 8KB 절삭 자체는 prompt 보호에 의미가 있다.
- 다만 SDK analyze 설명(50KB)과 실제 구현이 어긋나며, tail access 부재는 장기적으로 보완이 필요하다.

### 11.18 `build_error_classifier.py`
- 아주 좋은 보조기다. build failure를 구조화하는 첫 단계로서 가치가 크다.
- 다만 `chmod +x` 제안은 현 policy와 충돌한다.

### 11.19 Build `router.py`
- Analysis router와 거의 동일한 장단점을 가진다.
- duplicate suppression과 trace turn numbering은 두 쪽 모두 같이 손봐야 한다.

### 11.20 `S3_agent_architecture_review_request.md`
- 리뷰 요청서 자체는 매우 잘 쓰였다.
- 다만 코드까지 보면, 문서에 적힌 설계 원칙 중 일부는 이미 잘 구현돼 있지만, 일부는 아직 “의도” 단계에 머물러 있다. 이번 피드백의 핵심은 바로 그 간극을 줄이는 것이다.
