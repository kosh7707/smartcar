# S3. Build Agent 기능 명세

> **소유자**: S3
> **최종 업데이트**: 2026-03-28

> Build Agent는 자동차 임베디드 C/C++ 프로젝트의 **결정론적 빌드 생성 + 제한된 repair loop**를 수행하는 서비스다.
> Phase 0(결정론적 사전 분석)과 LLM 에이전트 루프(빌드 스크립트 작성 + 복구)를 분리하여,
> 재현 가능하고 안전한 빌드 자동화를 제공한다.

---

## 1. 핵심 설계 원칙

1. **결정론적 빌드 생성기 + 제한된 repair loop** — Build Agent는 자유로운 탐색기가 아니다. Phase 0에서 결정론적으로 프로젝트 구조를 파악하고, LLM은 빌드 스크립트 작성과 실패 복구만 담당한다.
2. **Phase 0 결정론적 우선** — 빌드 시스템 탐지, SDK 조회, 언어 탐지, 프로젝트 트리 생성은 LLM 없이 실행. LLM에게 정제된 컨텍스트를 제공한다.
3. **LLM은 repair만** — LLM의 역할은 `edit_file -> try_build` 복구 루프에 한정된다. `list_files`로 과도한 `read_file` 사용을 방지한다.
4. **프로젝트 원본 불변** — 소스 코드 수정 금지. 모든 쓰기는 `build-aegis-{shortId}/` 하위로 제한된다.
5. **LLM 접근은 S7 경유** — 모든 LLM 호출은 S7 Gateway(`POST /v1/chat`)를 통해 수행. LLM Engine 직접 호출 금지.
6. **Request-scoped 격리** — 빌드 워크스페이스(`build-aegis-{requestId[:8]}/`)는 요청별 격리. 동시 요청 충돌 방지.
7. **경로 스코프 강제** — 모든 도구가 `resolve_scoped_path()`로 경로 검증. prefix confusion 방지.

---

## 2. 기술 스택

| 항목 | 기술 | 버전 |
|------|------|------|
| 언어 | Python | 3.12 |
| 프레임워크 | FastAPI | 0.115.0 |
| ASGI 서버 | uvicorn | 0.30.0 |
| HTTP 클라이언트 | httpx | 0.27.0 |
| 데이터 검증 | pydantic | 2.9.0 |
| 설정 | pydantic-settings | 2.5.0 |
| 로깅 | python-json-logger | 2.0.7 |

---

## 3. 엔드포인트

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | `/v1/tasks` | `build-resolve` taskType — Phase 0 + 에이전트 루프 자동 실행 |
| GET | `/v1/health` | 서비스 상태 + 에이전트 설정 + S7 Gateway 연결 상태 |

---

## 4. Phase 0 아키텍처

`Phase0Executor`가 LLM 개입 없이 프로젝트를 결정론적으로 분석한다. 모든 탐지는 파일 시스템 탐색과 S4 API 호출로만 수행된다.

```
POST /v1/tasks (taskType: "build-resolve")
  │
  ├── Phase 0: 결정론적 (LLM 없이)
  │   ├── 빌드 시스템 탐지  → 파일 존재 여부 기반
  │   ├── 빌드 파일 탐색    → glob 패턴 매칭 (depth 4 이내)
  │   ├── 프로젝트 트리 생성 → os.walk (depth 2)
  │   ├── SDK 레지스트리 조회 → S4 GET /v1/sdk-registry
  │   ├── 언어 탐지         → 파일 확장자 기반
  │   └── 기존 빌드 스크립트 탐지 → 후보 경로 순회
  │
  ├── 에이전트 루프: LLM 빌드 + 복구
  │   ├── Phase 0 결과를 시스템 프롬프트에 주입
  │   ├── 도구: list_files, read_file, write_file, edit_file, delete_file, try_build
  │   ├── LLM 호출은 S7 Gateway 경유 (POST /v1/chat)
  │   └── 빌드 성공 또는 3회 연속 실패 시 보고서 출력
  │
  └── 응답: TaskSuccessResponse (API 계약 준수)
```

### 4.1 빌드 시스템 탐지

파일 존재 여부로 빌드 시스템 유형을 결정론적으로 판별한다.

| 우선순위 | 탐지 조건 | 분류 |
|---------|----------|------|
| 1 | `CMakeLists.txt` 존재 | `cmake` |
| 2 | `Makefile` / `GNUmakefile` / `makefile` 존재 | `make` |
| 3 | `configure` / `configure.ac` / `configure.in` 존재 | `autotools` |
| 4 | `*.sh`에 `build` 포함 (루트 또는 `scripts/`) | `shell` |
| 5 | 하위 1레벨 디렉토리에서 1~2 재탐색 | `cmake` / `make` |
| 6 | 없음 | `unknown` |

### 4.2 빌드 파일 탐색

- 패턴: `**/CMakeLists.txt`, `**/Makefile`, `**/*.sh`, `**/*.cmake`
- 제한: depth 4 이내, 노이즈 디렉토리 제외, 최대 20개
- 노이즈 디렉토리: `build`, `build-wsl`, `build-aegis`, `CMakeFiles`, `.git`, `__pycache__`, `test`, `tests`, `doc`, `docs`, `third_party`, `vendor`, `external`, `deps` 등

### 4.3 SDK 레지스트리 조회

- S4 `GET /v1/sdk-registry` 호출
- SDK 경로 자동 추출 (`setupScript`에서 `/linux-devkit/` 기준 분리)
- 실패 시 무시 (빌드는 SDK 없이도 시도 가능)

### 4.4 언어 탐지

- 파일 확장자 기반: `.c`, `.h` -> `c` / `.cpp`, `.cc`, `.cxx`, `.hpp` -> `cpp`
- depth 3 이내 탐색, 노이즈 디렉토리 제외

### 4.5 기존 빌드 스크립트 탐지

후보 경로를 순서대로 탐색하여 기존 빌드 스크립트를 찾는다.

```
scripts/cross_build.sh → scripts/build.sh → build.sh →
scripts/compile.sh → compile.sh → Makefile
```

### Phase 0 결과

```python
@dataclass
class Phase0Result:
    build_system: str        # "cmake", "make", "autotools", "shell", "unknown"
    build_files: list[str]   # 발견된 빌드 관련 파일 (최대 20개)
    project_tree: str        # 컴팩트 트리 (depth 2, 최대 80 항목)
    sdk_info: dict           # S4 sdk-registry 응답
    sdk_dir: str             # SDK 루트 경로
    has_existing_build_script: bool
    existing_script_path: str
    detected_languages: list[str]  # ["c", "cpp"] 등
    duration_ms: int
```

Phase 0 완료 후 `generate_initial_script()`가 빌드 시스템 유형에 따라 **초기 빌드 스크립트를 결정론적으로 생성**한다 (cmake/make/autotools → 템플릿, unknown/shell → None). 생성된 스크립트는 `build-aegis-{shortId}/aegis-build.sh`에 기록되며, LLM은 이 스크립트를 검토·수정하는 repair 역할만 담당한다.

`_build_system_prompt()`가 Phase 0 결과를 시스템 프롬프트에 주입한다. 빌드 시스템 유형별 **권장 전략 힌트**도 자동 생성된다.

| 빌드 시스템 | 권장 전략 |
|------------|----------|
| `cmake` | CMakeLists.txt를 read_file로 읽고, cmake 기반 빌드 스크립트 작성 |
| `make` | Makefile를 read_file로 읽고, make 기반 빌드 스크립트 작성 |
| `autotools` | ./configure 실행 후 make 호출 스크립트 작성 |
| `shell` | 기존 빌드 스크립트를 참고하여 build-aegis/aegis-build.sh 작성 |
| `unknown` | list_files로 프로젝트 구조를 탐색 후 빌드 방법 추론 |

---

## 5. 에이전트 루프

`AgentLoop`이 멀티턴 LLM 루프를 실행한다.

### 5.1 루프 흐름

```
1. Phase 0 결과 → 프롬프트 조립 (system + user)
2. while not should_stop():
   a. S7 Gateway POST /v1/chat 호출 (messages + tools)
   b. 응답 분기:
      - tool_calls → ToolRouter로 실행 → 결과를 메시지에 추가 → 다음 턴
      - content → ResultAssembler로 파싱 → 응답 반환
      - content가 빈 문자열 → TaskFailureResponse(MODEL_UNAVAILABLE, retryable=true)
   c. 컨텍스트 압축: 토큰 추정 초과 시 TurnSummarizer + build_state_summary() 주입
3. 예산 초과 시 TaskFailureResponse 반환
```

`ResultAssembler`는 `allowed_refs`에 입력 제공 refs + **도구 생성 refs** (`session.trace[].new_evidence_refs`) 합집합을 사용한다.

### 5.2 force_report 메커니즘

빌드 결과에 따라 도구를 제거하고 LLM에게 최종 보고서 작성을 강제한다.

| 트리거 | 동작 |
|--------|------|
| `try_build` 성공 (`eref-build-success`) | `force_report=True`, 도구 제거, 성공 보고서 지시 메시지 주입 |
| `try_build` 3회 연속 실패 | `force_report=True`, 도구 제거, 진단 보고서 지시 메시지 주입 |
| 모든 tier 예산 소진 | 도구 제거, 예산 소진 응답 반환 |

### 5.3 연속 빌드 실패 추적

- `consecutive_build_failures` 카운터가 `try_build` 실패마다 증가
- `try_build` 성공 시 0으로 리셋
- 임계값(`max_build_failures=3`) 도달 시 보고서 작성 강제
- 진단 보고서에는 실패 원인과 필요 조치(누락 라이브러리, SDK 문제 등)를 명시

### 5.4 LLM 호출

- `LlmCaller`가 S7 Gateway `POST /v1/chat`을 호출
- OpenAI chat completion 포맷 (messages, model, tools, tool_choice)
- 재시도: `RetryPolicy` 기반 (`agent_llm_retry_max=1`)
- 컨텍스트 압축: 토큰 추정치가 16,000을 초과하면 `TurnSummarizer`로 오래된 턴 제거 (최근 4턴 유지)
- 교환 로그: `logs/llm-exchange.jsonl` + `logs/llm-dumps/{requestId}_turn-{nn}_{ts}.json`

---

## 6. 도구 시스템

### 6.1 도구 목록

| 도구 | cost tier | 용도 | 제한 |
|------|-----------|------|------|
| `list_files` | CHEAP | 프로젝트 디렉토리 구조를 트리 형태로 반환 | depth 최대 5, 항목 최대 500, 노이즈 디렉토리 제외 |
| `read_file` | CHEAP | 프로젝트 내 파일 읽기 (읽기 전용) | 8,000자 제한, path traversal 차단 |
| `write_file` | CHEAP | `build-aegis/` 안에 파일 생성 | `build-aegis/` 하위만 허용, 내용 안전성 검사 |
| `edit_file` | CHEAP | `build-aegis/` 내 에이전트가 생성한 파일 수정 | 전체 덮어쓰기, 에이전트 생성 파일만, 내용 안전성 검사 |
| `delete_file` | CHEAP | `build-aegis/` 내 에이전트가 생성한 파일 삭제 | 에이전트 생성 파일만 |
| `try_build` | EXPENSIVE | S4에 빌드 명령어 전송하여 실행 | 금지 명령어 검사, bear 자동 제거, 실패 시 에러 분류, 부분 빌드 감지 (`userEntries > 0`) |

> `list_files`를 도구로 제공하여 과도한 `read_file` 사용을 방지한다. LLM은 프로젝트 전체 구조를 한 번의 호출로 파악할 수 있다.

### 6.2 도구 프레임워크

| 컴포넌트 | 역할 |
|----------|------|
| `ToolRegistry` | ToolSchema 등록 (name, description, cost_tier, **side_effect**), OpenAI function calling 포맷 생성 |
| `ToolRouter` | tool_call 디스패치, 예산 차감, 중복 차단 (args_hash), `side_effect==WRITE` 시 hash 무효화 |
| `ToolExecutor` | 단건 실행 + `asyncio.wait_for` 타임아웃 (180초) |
| `ToolImplementation` (Protocol) | 각 도구의 `execute(arguments) -> ToolResult` |
| `ToolFailurePolicy` | 실행 실패 시 LLM에게 에러를 알리는 ToolResult 생성 |

### 6.3 구현체

| 파일 | 도구명 | 호출 대상 |
|------|--------|-----------|
| `list_files.py` | `list_files` | 로컬 파일 시스템 (os.walk) |
| `read_file.py` | `read_file` | 로컬 파일 시스템 (파일 읽기) |
| `write_file.py` | `write_file` | 로컬 파일 시스템 (build-aegis/ 쓰기) |
| `edit_file.py` | `edit_file` | 로컬 파일 시스템 (build-aegis/ 수정) |
| `delete_file.py` | `delete_file` | 로컬 파일 시스템 (build-aegis/ 삭제) |
| `try_build.py` | `try_build` | S4 `POST /v1/build` |

### 6.4 빌드 전략 (프롬프트 지시)

LLM에게 4단계 전략을 시스템 프롬프트로 지시한다:

```
1단계: 탐색 (list_files -> read_file, 최대 2턴)
  - 첫 동작은 반드시 list_files
  - 핵심 빌드 파일 1~2개만 read_file

2단계: 빌드 스크립트 작성 (write_file)
  - 3턴째에는 반드시 write_file 실행
  - build-aegis/aegis-build.sh에 완전한 셸 스크립트 작성

3단계: 빌드 실행 (try_build)
  - write_file 직후 즉시 try_build 실행

4단계: 실패 복구 (edit_file -> try_build)
  - 에러 분석 후 edit_file로 스크립트 수정
  - edit_file + try_build를 한 턴에 동시 호출
  - 같은 명령 반복 금지, 다른 전략 시도
```

---

## 7. 정책 엔진

### 7.1 FilePolicy (경로 접근 정책)

능력 기반 파일 접근 정책으로, 프로젝트 원본을 보호한다.

| 대상 | 권한 | 판정 메서드 |
|------|------|-----------|
| 프로젝트 내 모든 파일 | read-only | `can_read(path)` |
| `build-aegis/` 하위 | write | `can_write(path)` |
| `build-aegis/` 내 에이전트 생성 파일 | edit/delete | `can_edit(path)` / `can_delete(path)` |
| `build-aegis/` 외부 | 쓰기 금지 | - |
| `build-aegis/` 내 에이전트 미생성 파일 | read-only | `can_edit()` -> False |

- `record_created(path)`: 에이전트가 파일 생성 시 추적 세트에 등록
- `record_deleted(path)`: 삭제 시 추적 세트에서 제거
- 세션 단위로 추적 (서로 다른 요청 간 격리)

### 7.2 스크립트 내용 안전성 검사

`write_file`과 `edit_file` 실행 시 `FilePolicy.scan_content()`가 금지 패턴을 검사한다.

| 금지 패턴 | 이유 |
|----------|------|
| `rm -rf` / `rm -f` | 파일 삭제 방지 |
| `curl` / `wget` | 네트워크 다운로드 방지 |
| `git clone` / `git push` / `git pull` | Git 조작 방지 |
| `docker` | 컨테이너 실행 방지 |
| `chmod` / `chown` | 권한 변경 방지 |
| `sudo` | 권한 상승 방지 |
| `apt-get` / `yum` / `pip install` | 패키지 설치 방지 |

> 금지 패턴이 발견되면 `_content_warnings` 필드로 LLM에 경고를 반환한다. 쓰기 자체는 차단하지 않는다 (경고만).

### 7.3 빌드 명령어 금지 패턴

`try_build` 실행 시 `build_command`에 대해 정규식 워드 바운더리 기반 검사를 수행한다.

| 금지 패턴 | 비고 |
|----------|------|
| `\brm\b` | 파일 삭제 |
| `\bdd\b` | 디스크 쓰기 |
| `\bcurl\b` / `\bwget\b` | 네트워크 접근 |
| `\bgit\b` | Git 조작 |
| `\bdocker\b` | 컨테이너 |
| `\bchmod\b` / `\bchown\b` | 권한 변경 |
| `\bpatch\b` | 소스 패치 |
| `\bsed -i\b` | 파일 인플레이스 수정 |

> 금지 패턴 매칭 시 도구 실행이 **차단**된다 (경고가 아닌 실패 반환).
> `arm-linux-gnueabihf-gcc` 등 크로스 컴파일 접두사의 오탐을 워드 바운더리(`\b`)로 방지한다.

### 7.4 bear 자동 제거

LLM이 `build_command`에 `bear --`를 포함시킬 경우 자동 제거한다. S4가 후속 처리에서 자동으로 `bear`를 감싸므로 이중 적용을 방지한다.

---

## 8. BuildErrorClassifier

빌드 실패 시 에러 출력을 **결정론적으로 분류**하고 복구 제안을 생성한다. LLM 없이 정규식으로 동작한다.

### 8.1 에러 카테고리

| 카테고리 | 매칭 패턴 예시 | 복구 제안 |
|----------|--------------|----------|
| `missing_header` | `fatal error: foo.h: No such file` | `-I<include_path>` 추가 |
| `toolchain_not_found` | `arm-none-linux-gnueabihf-gcc: not found` | SDK 환경 설정(`source environment-setup-*`) 추가 |
| `undefined_symbol` | `undefined reference to 'foo'` | 링커 플래그 `-l<library>` 추가 |
| `missing_library` | `cannot find -lfoo` | `-L<library_path>` 추가 또는 해당 기능 비활성화 |
| `cmake_config_error` | `CMake Error at ...` | CMakeLists.txt의 누락 패키지/경로 수정 |
| `permission_denied` | `Permission denied` | `bash script.sh` 형태로 실행 |
| `syntax_error` | `syntax error` / `parse error` | 스크립트 문법 확인 |
| `file_not_found` | `foo: No such file or directory` | 경로 확인, `PROJECT_ROOT` 설정 점검 |

### 8.2 분류 로직

```python
def classify_build_error(output: str) -> list[BuildErrorClassification]:
    """빌드 출력을 분석하여 에러를 분류한다. 순수 함수, LLM 없음."""
```

- `try_build` 실패 시 자동 호출 (`stderr` + `stdout` + `output` 결합)
- 카테고리별 중복 방지 (같은 카테고리는 첫 매치만)
- 정규식 캡처 그룹으로 suggestion 내 `{0}`, `{1}` 등을 동적 치환
- 분류 결과는 `_error_classification` 필드로 LLM에 제공 → LLM이 구조화된 복구 제안을 받아 `edit_file`로 수정

---

## 9. 예산 시스템

3-tier 예산으로 LLM 루프의 무한 실행을 방지한다.

```python
BudgetState:
    max_steps: 10              # 총 턴 수
    max_completion_tokens: 20000  # LLM 생성 토큰 한도
    max_prompt_tokens: 100000  # prompt 토큰 한도 (80% 초과 시 경고 로그)
    max_cheap_calls: 20        # list_files, read_file, write_file, edit_file, delete_file
    max_medium_calls: 0        # (미사용)
    max_expensive_calls: 5     # try_build
    max_consecutive_no_evidence: 6  # 증거 없는 턴 연속 한도
```

### 종료 조건 (TerminationPolicy)

5가지 종료 조건을 검사하여 루프 중단 여부를 결정한다.

| 조건 | 설명 | status | failureCode |
|------|------|--------|-------------|
| `max_steps` | 총 턴 수 초과 | `budget_exceeded` | `MAX_STEPS_EXCEEDED` |
| `budget_exhausted` | 토큰 한도 도달 | `budget_exceeded` | `TOKEN_BUDGET_EXCEEDED` |
| `timeout` | 전체 시간 초과 | `timeout` | `TIMEOUT` |
| `no_new_evidence` | 연속 N턴 새 증거 없음 | `budget_exceeded` | `INSUFFICIENT_EVIDENCE` |
| `all_tiers_exhausted` | 모든 tier의 도구 호출 한도 소진 | `budget_exceeded` | `ALL_TOOLS_EXHAUSTED` |

### 중복 호출 차단 + mutation 무효화

`ToolRouter`가 `args_hash`로 동일 인자 도구 호출을 차단한다.

단, `side_effect == ToolSideEffect.WRITE`인 도구 (`write_file`, `edit_file`, `delete_file`)가 성공하면 duplicate hash 세트를 전체 초기화한다. 이는 상태가 변경되었으므로 동일 인자의 `try_build` 재시도가 의미 있기 때문이다. (기존 `_MUTATING_TOOLS` 하드코딩 → ToolSchema 메타데이터 기반으로 전환)

```
1. write_file("aegis-build.sh", content_v1) → 성공 → duplicate hashes 초기화
2. try_build("bash aegis-build.sh") → 실패 → hash 등록
3. edit_file("aegis-build.sh", content_v2) → 성공 → duplicate hashes 초기화
4. try_build("bash aegis-build.sh") → 허용됨 (hash가 초기화되어 중복 아님)
```

---

## 10. 출력 구조

### TaskSuccessResponse

```python
TaskSuccessResponse:
    taskId, taskType, status="completed"
    modelProfile: "agent-loop"
    promptVersion: "agent-v1"
    schemaVersion: "agent-v1"
    validation: ValidationInfo
    result: AssessmentResult
        summary: str
        claims: list[Claim]            # statement + supportingEvidenceRefs + location
        caveats: list[str]
        usedEvidenceRefs: list[str]
        confidence: float [0.0-1.0]
        confidenceBreakdown: dict
        needsHumanReview: bool
        recommendedNextSteps: list[str]
        policyFlags: list[str]
        buildResult: BuildResult       # 빌드 에이전트 전용
            success: bool
            buildCommand: str           # 실제 사용한 빌드 명령어
            buildScript: str            # "build-aegis/aegis-build.sh"
            buildDir: str               # "build-aegis"
            errorLog: str | None
        sdkProfile: SdkProfile | None  # SDK 분석 결과 (sdk-analyze 전용)
    audit: AuditInfo
        inputHash, latencyMs, tokenUsage, createdAt
        agentAudit: {turn_count, tool_call_count, termination_reason, trace}
```

### TaskFailureResponse

```python
TaskFailureResponse:
    taskId, taskType
    status: validation_failed | timeout | model_error | budget_exceeded | unsafe_output | empty_result
    failureCode: INVALID_SCHEMA | INVALID_GROUNDING | TIMEOUT | MODEL_UNAVAILABLE | ...
    failureDetail: str
    retryable: bool
    audit: AuditInfo
```

### 고정 산출물 경로

빌드 성공 시 스크립트는 항상 고정 경로에 생성된다:

```
targetPath 있음: {projectPath}/{targetPath}/build-aegis/aegis-build.sh
targetPath 없음: {projectPath}/build-aegis/aegis-build.sh
```

S4가 이후 `bear -- bash build-aegis/aegis-build.sh`로 `compile_commands.json`을 추출한다.

---

## 11. Observability

| 항목 | 값 |
|------|-----|
| 로그 파일 | `logs/s3-build-agent.jsonl` |
| 교환 로그 | `logs/llm-exchange.jsonl` (LLM 호출 요약) |
| LLM 전문 덤프 | `logs/llm-dumps/{requestId}_turn-{nn}_{ts}.json` |
| 형식 | JSON structured, `time` epoch ms |
| 요청 추적 | `contextvars` 기반 `requestId` + `X-Request-Id` 전파 |
| 컴포넌트 태깅 | `agent_log()` helper — component, phase, turn 필드 |

### 주요 로그 이벤트

| phase | 설명 |
|-------|------|
| `phase0_done` | Phase 0 결정론적 분석 완료 |
| `session_start` | 에이전트 세션 시작 (도구 수, 예산 설정) |
| `turn_start` / `turn_end` | 턴 시작/종료 (예산 스냅샷) |
| `turn_branch` | 분기 판단 (tool_calls / content) |
| `force_report` | 보고서 작성 지시 메시지 주입 |
| `build_success_detected` | try_build 성공 감지 |
| `build_failure_threshold` | 연속 빌드 실패 임계값 도달 |
| `tool_dispatch` / `tool_complete` | 도구 실행 시작/완료 |
| `tool_blocked_duplicate` | 중복 호출 차단 |
| `tool_blocked_budget` | tier 예산 소진 차단 |
| `budget_update` | 예산 갱신 |
| `policy_triggered` | 종료 정책 트리거 |
| `context_compact` | 컨텍스트 압축 실행 |
| `session_end` | 세션 종료 (총 턴, 토큰, 종료 사유) |

### 교차 서비스 추적

```bash
grep '{request-id}' logs/*.jsonl  # Agent + SAST + Gateway 한번에 추적
```

---

## 12. 서비스 의존

```
Build Agent (:8003)
  ├── S7 Gateway (:8000)       POST /v1/chat              에이전트 루프 LLM
  └── S4 SAST Runner (:9000)   GET  /v1/sdk-registry      Phase 0 SDK 조회
                               POST /v1/build             try_build 실행
```

---

## 13. 환경변수

`pydantic-settings` 기반. 환경변수 접두사 `AEGIS_`.

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `AEGIS_LLM_MODE` | `mock` | LLM 모드 (`mock` / `real`) |
| `AEGIS_LLM_ENDPOINT` | `http://localhost:8000` | S7 Gateway 주소 |
| `AEGIS_LLM_MODEL` | `qwen-14b` | LLM 모델명 |
| `AEGIS_LLM_API_KEY` | `""` | API 키 |
| `AEGIS_LLM_CONCURRENCY` | `4` | 동시 LLM 호출 수 |
| `AEGIS_SAST_ENDPOINT` | `http://localhost:9000` | S4 SAST Runner 주소 |
| `AEGIS_AGENT_MAX_STEPS` | `10` | 최대 턴 수 |
| `AEGIS_AGENT_MAX_COMPLETION_TOKENS` | `20000` | LLM 생성 토큰 한도 |
| `AEGIS_AGENT_MAX_CHEAP_CALLS` | `20` | CHEAP tier 호출 한도 |
| `AEGIS_AGENT_MAX_MEDIUM_CALLS` | `0` | MEDIUM tier 호출 한도 (미사용) |
| `AEGIS_AGENT_MAX_EXPENSIVE_CALLS` | `5` | EXPENSIVE tier 호출 한도 |
| `AEGIS_AGENT_NO_EVIDENCE_THRESHOLD` | `6` | 연속 무증거 턴 한도 |
| `AEGIS_AGENT_TOOL_TIMEOUT_MS` | `180000` | 도구 실행 타임아웃 (ms) |
| `AEGIS_AGENT_LLM_MAX_TOKENS` | `16384` | LLM 응답 최대 토큰 |
| `AEGIS_AGENT_LLM_RETRY_MAX` | `1` | LLM 호출 재시도 횟수 |
