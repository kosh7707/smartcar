# W1: 에이전트 루프 & 세션 -- claw-code 분석 보고서

## 1. Executive Summary

claw-code는 `conversation.rs`의 단일 `loop` + tool_call 유무 분기, `session.rs`의 불변 직렬화 세션, `compact.rs`의 결정론적 요약 압축으로 에이전트 루프를 구성한다. AEGIS 대비 Hook 시스템(PreToolUse/PostToolUse), Permission 계층(5단계), 누적 UsageTracker, 재압축 병합이 체계적이다. AEGIS는 도메인 특화 예산(tier별 도구 관리)이 우수하나, 세션 영속화/복원, Hook 인터셉터, 병렬 도구 실행 병합이 부재하다.

---

## 2. claw-code 구현 분석

### 2.1 conversation.rs -- 에이전트 루프

**파일**: `/home/kosh/references/claw-code-main/rust/crates/runtime/src/conversation.rs` (801줄)

#### 2.1.1 핵심 구조: `ConversationRuntime<C, T>`

```
ConversationRuntime {
    session: Session,            // 불변 메시지 히스토리
    api_client: C,               // trait ApiClient (stream 메서드)
    tool_executor: T,            // trait ToolExecutor (execute 메서드)
    permission_policy,           // 5단계 권한 정책
    system_prompt: Vec<String>,  // 멀티 세그먼트 시스템 프롬프트
    max_iterations: usize,       // 무한루프 방지 (기본값 usize::MAX)
    usage_tracker: UsageTracker, // 누적 토큰/비용 추적
    hook_runner: HookRunner,     // Pre/Post 도구 훅
}
```

(줄 91-100)

#### 2.1.2 루프 구조 (`run_turn`, 줄 153-263)

```
run_turn(user_input, prompter):
    1. session.messages <- user_text(input)    # 유저 메시지 추가
    2. loop {
        2a. iterations += 1
        2b. if iterations > max_iterations -> ERROR
        2c. API 호출 -> events (스트리밍 이벤트 벡터)
        2d. build_assistant_message(events) -> (message, usage)
        2e. usage_tracker.record(usage)
        2f. pending_tool_uses 추출 (ContentBlock::ToolUse 필터)
        2g. session.messages <- assistant_message
        2h. if pending_tool_uses.is_empty() -> BREAK  # 종료 조건!
        2i. for each tool_use:
            - permission_policy.authorize() -> Allow/Deny
            - if Allow:
                - hook_runner.run_pre_tool_use()  -> 거부 가능
                - tool_executor.execute()          -> Ok/Err
                - hook_runner.run_post_tool_use()  -> 거부/수정 가능
            - if Deny:
                - tool_result(is_error=true, reason)
            - session.messages <- tool_result
    3. return TurnSummary { assistant_messages, tool_results, iterations, usage }
```

**핵심 설계 결정**:

1. **종료 조건 = "tool_call이 없는 assistant 응답"** (줄 197-199). 명시적 stop_reason 파싱이 아니라, LLM이 도구를 요청하지 않으면 자연 종료.
2. **무한루프 방지 = `max_iterations` 하드캡** (줄 167-171). 기본값은 `usize::MAX`(사실상 무제한)이지만, `.with_max_iterations()`로 설정 가능.
3. **도구 실행은 순차적** (줄 201의 `for` 루프). 병렬 실행이 아님. 하나의 assistant 응답에 여러 tool_use가 있어도 순서대로 실행.
4. **에러 복구 = ToolError를 tool_result에 is_error=true로 주입** (줄 222-225). 도구 실패가 루프를 중단시키지 않고, LLM에게 에러 피드백으로 전달되어 자기 수정 기회 제공.

#### 2.1.3 스트리밍 처리 (`build_assistant_message`, 줄 291-328)

```rust
fn build_assistant_message(events: Vec<AssistantEvent>)
    -> Result<(ConversationMessage, Option<TokenUsage>), RuntimeError>
```

- `TextDelta` -> 텍스트 버퍼에 누적
- `ToolUse { id, name, input }` -> flush_text_block 후 ToolUse 블록 추가
- `Usage(value)` -> 토큰 사용량 기록
- `MessageStop` -> 종료 플래그 설정
- **검증**: `finished`가 false이면 에러, `blocks`가 비어있으면 에러 (줄 315-321)

`ApiClient::stream()`이 `Vec<AssistantEvent>`를 반환하므로, 실제로는 동기적으로 모든 이벤트를 수집한 후 파싱한다. 진정한 SSE 스트리밍은 아니지만, 이벤트 기반 파싱 구조를 갖추고 있어 확장이 용이하다.

#### 2.1.4 Hook 시스템 (Pre/Post ToolUse)

`hooks.rs` (358줄)의 `HookRunner`:

- **PreToolUse**: 도구 실행 전 외부 스크립트 실행. exit code 2 = 거부, 0 = 허용, 기타 = 경고
- **PostToolUse**: 도구 실행 후 결과 수정/거부 가능. 출력에 피드백 병합
- **환경변수 전달**: `HOOK_EVENT`, `HOOK_TOOL_NAME`, `HOOK_TOOL_INPUT`, `HOOK_TOOL_OUTPUT`, `HOOK_TOOL_IS_ERROR`
- **JSON payload**: stdin으로 전달 (줄 118-126)

`merge_hook_feedback()` (conversation.rs 줄 346-362)은 훅 메시지를 도구 출력에 병합하여 LLM이 볼 수 있게 한다:
```
[원본 도구 출력]

Hook feedback:
[훅 메시지들]
```

### 2.2 session.rs -- 세션 관리

**파일**: `/home/kosh/references/claw-code-main/rust/crates/runtime/src/session.rs` (436줄)

#### 2.2.1 데이터 모델

```rust
Session {
    version: u32,                      // 스키마 버전 (현재 1)
    messages: Vec<ConversationMessage>, // 전체 대화 히스토리
}

ConversationMessage {
    role: MessageRole,        // System | User | Assistant | Tool
    blocks: Vec<ContentBlock>,// 멀티 블록 (텍스트 + 도구 혼합)
    usage: Option<TokenUsage>,// assistant 메시지에만 존재
}

ContentBlock = Text | ToolUse { id, name, input } | ToolResult { tool_use_id, tool_name, output, is_error }
```

**핵심 특징**:

1. **assistant 메시지 = 멀티 블록** (줄 22-37). 하나의 assistant 응답에 Text와 ToolUse가 섞일 수 있다. AEGIS는 tool_calls가 있으면 content=null로 분리하는데, claw-code는 "Let me calculate that" + ToolUse를 하나의 메시지에 담는다.
2. **usage가 메시지에 임베딩** (줄 43). `assistant_with_usage()`로 생성 시 usage를 메시지에 직접 저장. 세션 복원 시 `UsageTracker::from_session()`으로 재구성 가능 (conversation.rs 줄 134).
3. **JSON 직렬화/역직렬화** (줄 92-139). `save_to_path()` / `load_from_path()`로 파일 영속화. 커스텀 JSON 렌더러 사용 (serde 미사용, BTreeMap 기반).

#### 2.2.2 세션 영속화/복원

```rust
session.save_to_path("session.json")?;  // 파일 저장
let restored = Session::load_from_path("session.json")?;  // 파일 복원
```

- `SessionError` 열거형: `Io`, `Json`, `Format` 3종 에러 타입
- 테스트에서 round-trip 검증 완료 (줄 391-435)

#### 2.2.3 compact.rs -- 컨텍스트 압축

**파일**: `/home/kosh/references/claw-code-main/rust/crates/runtime/src/compact.rs` (702줄)

```
compact_session(session, config) -> CompactionResult:
    1. should_compact() 검사: preserve 이후 메시지가 충분하고, 토큰 추정치가 임계치 초과?
    2. 기존 압축 요약 감지 (첫 메시지가 System + 마커 포함)
    3. 제거 대상 메시지에서 summarize_messages():
       - 메시지 카운트 (user/assistant/tool)
       - 도구 이름 수집 (dedup)
       - 최근 유저 요청 3개
       - 펜딩 작업 추론 (todo/next/pending/remaining 키워드)
       - 주요 파일 참조 추출 (경로 패턴 + 확장자 필터)
       - 현재 작업 추론
       - 키 타임라인 (모든 메시지의 역할 + 160자 요약)
    4. merge_compact_summaries(): 이전 요약 + 새 요약 병합
       - "Previously compacted context:" + "Newly compacted context:"
    5. CompactionResult 반환: System 메시지 (요약) + 보존된 최근 메시지
```

**AEGIS 대비 우월점**:

| 기능 | claw-code compact.rs | AEGIS TurnSummarizer |
|------|---------------------|---------------------|
| 재압축 병합 | 이전 요약을 감지하여 계층적 병합 | 이전 요약 추출 후 병합 (동일) |
| 파일 참조 추출 | 경로 패턴 + 확장자 필터링 | 없음 |
| 펜딩 작업 추론 | 키워드 기반 자동 추출 | 없음 |
| 토큰 추정 | 블록 타입별 정밀 계산 | 4자=1토큰 단순 추정 |
| 직접 이어가기 지시 | "Resume directly" 프롬프트 포함 | 없음 |

### 2.3 Python 레퍼런스 (runtime.py, context.py)

**파일**: `/home/kosh/references/claw-code-main/src/runtime.py` (193줄)

#### 2.3.1 PortRuntime & RuntimeSession

`PortRuntime`은 claw-code의 Python 포트로, Rust 구현의 미러링:

- **`bootstrap_session(prompt)`** (줄 109-152): 전체 세션 부트스트랩
  - `build_port_context()`: 소스/테스트/에셋 루트, 파일 카운트
  - `route_prompt()`: 프롬프트를 커맨드/도구에 토큰 매칭으로 라우팅
  - `build_execution_registry()`: 커맨드/도구 실행 레지스트리
  - `engine.stream_submit_message()`: 스트리밍 이벤트 생성
  - `engine.submit_message()`: 동기 턴 실행
  - `engine.persist_session()`: 세션 영속화

- **`run_turn_loop(prompt, max_turns=3)`** (줄 154-167): 멀티턴 루프
  ```python
  for turn in range(max_turns):
      turn_prompt = prompt if turn == 0 else f'{prompt} [turn {turn + 1}]'
      result = engine.submit_message(turn_prompt, ...)
      results.append(result)
      if result.stop_reason != 'completed':
          break
  ```

- **`HistoryLog`**: 단계별 이벤트 기록 (context/registry/routing/execution/turn/session_store)

#### 2.3.2 QueryEnginePort (query_engine.py)

- **턴 제한**: `max_turns` (기본 8), `max_budget_tokens` (기본 2000)
- **자동 압축**: `compact_after_turns` (기본 12) 초과 시 오래된 메시지 절삭
- **스트리밍**: `stream_submit_message()`가 generator로 이벤트 yield (message_start, command_match, tool_match, permission_denial, message_delta, message_stop)
- **세션 저장/복원**: `persist_session()` / `from_saved_session(session_id)` -- 파일 기반 영속화

#### 2.3.3 context.py

- `PortContext`: 소스 루트, 테스트 루트, 에셋 루트, 아카이브 루트, 파일 카운트
- `build_port_context()`: 디렉토리 구조를 스캔하여 자동 감지
- `render_context()`: 마크다운 형식 출력

### 2.4 usage.rs -- 토큰 추적 & 비용 산출

**파일**: `/home/kosh/references/claw-code-main/rust/crates/runtime/src/usage.rs` (311줄)

```rust
UsageTracker {
    latest_turn: TokenUsage,  // 직전 턴
    cumulative: TokenUsage,   // 전체 누적
    turns: u32,               // 턴 수
}
```

- **4종 토큰 분류**: input, output, cache_creation, cache_read
- **모델별 가격표**: Haiku/Opus/Sonnet 자동 판별 (줄 56-78)
- **비용 추정**: `estimate_cost_usd_with_pricing()` -- 모델 이름으로 자동 가격 선택
- **세션 복원**: `UsageTracker::from_session()` -- 기존 세션의 assistant 메시지에서 usage를 복원

### 2.5 permissions.rs -- 5단계 권한 체계

**파일**: `/home/kosh/references/claw-code-main/rust/crates/runtime/src/permissions.rs` (233줄)

```
PermissionMode 계층:
  ReadOnly < WorkspaceWrite < DangerFullAccess < Prompt < Allow
```

- **도구별 필요 권한**: `tool_requirements` BTreeMap으로 개별 설정
- **에스컬레이션 프롬프트**: WorkspaceWrite에서 DangerFullAccess 필요 도구를 호출할 때 `PermissionPrompter`로 사용자에게 확인
- **거부 사유**: denied 시 구체적 이유 문자열 반환 -> tool_result에 is_error=true로 주입

---

## 3. AEGIS 현재 구현과의 비교

### 3.1 구조적 차이

| 측면 | claw-code | AEGIS Analysis Agent | AEGIS Build Agent |
|------|-----------|---------------------|-------------------|
| **루프 구조** | `loop { api_call -> tool_check -> break if no tools }` | `while not should_stop: { llm_call -> branch(tool/content) -> return if content }` | 동일 구조 |
| **종료 조건** | tool_use 없음 = 종료 + max_iterations 하드캡 | TerminationPolicy 5종 (max_steps, budget, timeout, no_evidence, all_tiers) + content 반환 시 종료 | 동일 + build_success/failure 감지 |
| **에러 복구** | ToolError -> is_error=true tool_result (루프 계속) | S3Error 재시도 (RetryPolicy) + 부분 결과 fallback | 동일 |
| **상태 추적** | Session (messages + usage per message) | AgentSession (turns, trace, budget, extra_allowed_refs) | 동일 구조 |
| **세션 영속화** | save_to_path/load_from_path (JSON) | 없음 (메모리 only) | 없음 |
| **컨텍스트 압축** | compact.rs (결정론적, 파일/펜딩 추출, 재압축 병합) | TurnSummarizer (도구 이력, evidence refs, 시스템 지시, 재압축 병합) | 동일 |
| **권한 관리** | 5단계 PermissionPolicy + PermissionPrompter | 없음 (모든 도구 허용) | 없음 |
| **Hook** | PreToolUse/PostToolUse (외부 스크립트, 거부/수정 가능) | 없음 | 없음 |
| **토큰 추적** | UsageTracker (4종 분류 + 비용 산출 + 세션 복원) | TokenCounter + BudgetState (completion_tokens 중심) | 동일 |
| **도구 실행** | 순차 (for 루프) | 비동기 (ToolRouter.execute) -- 내부적으로 순차 | 동일 |
| **시스템 프롬프트** | Vec<String> (멀티 세그먼트) | 단일 string | 단일 string |

### 3.2 AEGIS가 이미 잘 하고 있는 것

1. **도메인 특화 예산 시스템** (`BudgetManager`, `BudgetState`)
   - cheap/medium/expensive 3-tier 도구 분류
   - tier별 예산 소진 시 해당 도구만 비활성화 (`get_available_schemas`)
   - 연속 무증거 턴 감지 (`consecutive_no_evidence_turns`)
   - claw-code에는 이런 세분화된 도구 예산 개념이 없다 (max_iterations만 있음)

2. **종료 정책의 풍부함** (`TerminationPolicy`)
   - 5가지 독립적 종료 조건: max_steps, budget_exhausted, timeout, no_new_evidence, all_tiers_exhausted
   - claw-code는 "tool_call 없음" + "max_iterations"만 있어, 비용 폭주나 무한 도구 루프에 취약

3. **LLM 재시도 정책** (`RetryPolicy`)
   - 에러 타입별 차별화된 대기: CB OPEN 30초, 429 Retry-After 준수, Pool 소진 5초, 기타 지수 백오프
   - claw-code는 `ApiClient::stream()`이 `Result`를 반환하지만, 재시도 로직이 런타임에 없음 (호출자 책임)

4. **보고서 강제 메커니즘**
   - Analysis Agent: 도구 4회 경고 -> 6회 도달 시 도구 제거 + 보고서 강제 (agent_loop.py 줄 82-126)
   - Build Agent: build 성공/연속 실패 감지 -> 도구 제거 + 보고서 강제 (agent_loop.py 줄 89-119)
   - claw-code에는 이런 "도구 예산 소진 시 graceful degradation" 개념이 없다

5. **구조화 Evidence 추적** (`AgentSession.trace`, `ToolTraceStep`)
   - 도구 실행마다 trace step 기록: 도구명, 성공 여부, 새 evidence refs
   - `analysis_state_summary()`로 현재 분석 상태를 구조화하여 압축 시 전달
   - claw-code는 도구 결과를 session.messages에만 저장, 별도 구조화 추적 없음

6. **컨텍스트 압축의 도메인 특화** (`TurnSummarizer`)
   - evidence ref (`eref-*`) 패턴 추출 보존
   - `[시스템]` 지시 메시지 추출 보존
   - tool_call/tool 쌍 깨짐 방지 (절단점 후퇴 로직, 줄 41-42)
   - claw-code의 compact.rs보다 AEGIS 도메인에 맞게 특화되어 있다

### 3.3 AEGIS에 없는 것 (Gap)

#### Gap 1: 세션 영속화/복원 -- 심각도: 높음

claw-code는 `Session::save_to_path()` / `Session::load_from_path()`로 세션을 JSON 파일로 저장/복원한다 (session.rs 줄 92-99). `UsageTracker::from_session()`으로 usage까지 복원된다 (usage.rs 줄 177-185).

AEGIS의 `AgentSession`은 메모리 전용이다. 분석 중 프로세스 재시작/충돌 시 모든 진행 상황이 소실된다. 특히 비용이 큰 SAST 결과와 KB 질의 결과가 모두 사라진다.

#### Gap 2: Hook/인터셉터 시스템 -- 심각도: 중간

claw-code의 `HookRunner`는 도구 실행 전후에 외부 스크립트를 실행하여:
- 도구 실행을 거부할 수 있고 (exit code 2)
- 도구 결과를 수정/보강할 수 있고 (stdout 피드백 병합)
- 감사 로그를 남길 수 있다

AEGIS에는 이런 인터셉터가 없다. 도구 실행은 `ToolRouter.execute()`에서 바로 수행된다. 예를 들어:
- SAST 결과가 특정 패턴이면 자동으로 추가 분석 트리거
- 특정 파일 경로 접근 시 KB에서 관련 규칙 자동 주입
- 도구 실행 비용 로깅/제한

#### Gap 3: Permission 계층 -- 심각도: 낮음 (서버사이드 에이전트)

claw-code는 5단계 권한 체계로 도구 접근을 제어한다. AEGIS는 서버사이드 자동화 에이전트이므로 CLI 도구의 인터랙티브 권한 확인은 불필요하다. 그러나, 도구별 "위험 등급" 개념은 AEGIS의 tier 시스템과 유사하며, 권한 거부 사유를 tool_result에 주입하는 패턴은 채용할 가치가 있다.

#### Gap 4: 스트리밍 이벤트 파싱 구조 -- 심각도: 중간

claw-code는 `AssistantEvent` 열거형으로 스트리밍 이벤트를 구조화한다:
```
TextDelta(String) | ToolUse { id, name, input } | Usage(TokenUsage) | MessageStop
```

`build_assistant_message()`가 이벤트 스트림을 파싱하여 `ConversationMessage`로 변환한다. 이 구조는 향후 SSE/WebSocket 스트리밍 전환 시 핵심이 된다.

AEGIS는 `LlmCaller.call()`이 완전한 `LlmResponse`를 반환하는 동기 구조이다. Backend SSE 전달을 고려하면 이벤트 기반 구조로의 전환이 필요하다.

#### Gap 5: 멀티 블록 assistant 메시지 -- 심각도: 낮음

claw-code의 `ConversationMessage.blocks`는 하나의 assistant 메시지에 Text + ToolUse를 혼합할 수 있다. AEGIS는 `has_tool_calls()` / `content` 이분법으로, assistant가 텍스트와 도구 호출을 동시에 반환하는 케이스를 별도 처리하지 않는다.

#### Gap 6: 누적 Usage + 비용 산출 -- 심각도: 낮음

claw-code의 `UsageTracker`는 4종 토큰 (input, output, cache_creation, cache_read)을 분류 추적하고, 모델별 가격으로 USD 비용을 실시간 산출한다. AEGIS의 `BudgetState`는 completion_tokens 중심이며, 비용 산출 기능이 없다. AEGIS는 S7 Gateway 경유이므로 캐시 토큰 분류는 S7에서 처리하나, 에이전트 레벨 비용 가시성은 향상할 가치가 있다.

---

## 4. AEGIS 적용 제안

### 4.1 즉시 적용 가능 (Low effort, High impact)

#### P1: 도구 에러를 LLM 피드백으로 전환 (이미 부분 구현)

**현재**: `ToolRouter.execute()`의 실패 결과가 `ToolResult(success=False, content=error_msg)`로 반환되어 LLM에게 전달된다. 이 부분은 이미 claw-code 패턴과 유사하다.

**개선점**: claw-code는 도구 에러 시 `is_error: true` 플래그를 명시적으로 설정한다 (conversation.rs 줄 224). AEGIS의 `ToolResult.success`가 이 역할을 하지만, OpenAI 호환 messages에서 `role: "tool"` 메시지에 에러 표시가 누락된다.

**적용 대상**: `agent_shared/llm/message_manager.py` 줄 53-60 (`add_tool_results`)
```python
# 현재
self._messages.append({
    "role": "tool",
    "tool_call_id": result.tool_call_id,
    "content": result.content,
})

# 제안: 에러 시 prefix 추가로 LLM에게 명시적 에러 신호
content = result.content
if not result.success:
    content = f"[ERROR] {content}"
```

#### P2: build_assistant_message 검증 강화

**현재**: `agent_loop.py` 줄 162에서 `response.has_tool_calls()`와 줄 210의 `response.content` 체크로 분기하지만, 둘 다 없는 "빈 응답" 케이스를 줄 211에서야 감지한다.

**claw-code 패턴**: `build_assistant_message()`가 `finished` 플래그 미설정, `blocks` 비어있음을 즉시 에러로 반환 (conversation.rs 줄 315-321).

**적용**: `LlmCaller.call()` 반환 직후, `response.content`와 `response.tool_calls`가 모두 비어있으면 재시도 대상으로 분류.

#### P3: 컨텍스트 압축에 "직접 이어가기" 지시 추가

**claw-code 패턴** (compact.rs 줄 6):
```
"Continue the conversation from where it left off without asking the user
any further questions. Resume directly -- do not acknowledge the summary,
do not recap what was happening, and do not preface with continuation text."
```

**적용 대상**: `agent_shared/llm/turn_summarizer.py`의 `_build_structured_summary()` 끝에 추가:
```python
sections.append(
    "\n## 지시\n"
    "위 요약은 컨텍스트 압축의 결과이다. "
    "요약을 확인(acknowledge)하지 말고, 이전 작업을 그대로 이어가라. "
    "다음 도구 호출 또는 보고서 작성을 즉시 진행하라."
)
```

### 4.2 중기 과제 (Medium effort)

#### M1: 세션 영속화/복원 (2-3일)

**목표**: 에이전트 프로세스 재시작/충돌 시 진행 상황 복원

**설계**:
```python
# agent_session.py에 추가
class AgentSession:
    def save_to_path(self, path: Path) -> None:
        """세션 상태를 JSON으로 저장."""
        data = {
            "version": 1,
            "request": self.request.model_dump(),
            "budget": self.budget.model_dump(),
            "turns": [t.model_dump() for t in self.turns],
            "trace": [s.model_dump() for s in self.trace],
            "extra_allowed_refs": list(self.extra_allowed_refs),
            "elapsed_ms": self.elapsed_ms(),
        }
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    @classmethod
    def load_from_path(cls, path: Path) -> "AgentSession":
        """저장된 세션을 복원."""
        data = json.loads(path.read_text())
        session = cls(
            request=TaskRequest(**data["request"]),
            budget=BudgetState(**data["budget"]),
        )
        session.turns = [TurnRecord(**t) for t in data["turns"]]
        session.trace = [ToolTraceStep(**s) for s in data["trace"]]
        session.extra_allowed_refs = set(data["extra_allowed_refs"])
        return session
```

**messages 복원**: `MessageManager`에도 messages 직렬화/역직렬화 추가 필요. claw-code처럼 Session에 messages를 포함하는 구조가 이상적.

**저장 시점**: 각 턴 종료 후 (`session.record_tool_turn()` / `session.record_content_turn()` 직후).

#### M2: Pre/Post 도구 Hook 인터셉터 (3-4일)

**목표**: 도구 실행 전후에 커스텀 로직을 주입할 수 있는 확장점

**설계**:
```python
# app/tools/hooks.py (신규)
from dataclasses import dataclass
from typing import Protocol

@dataclass
class HookResult:
    allowed: bool = True
    feedback: str = ""      # LLM에게 전달할 추가 피드백
    modified_input: str | None = None  # 도구 입력 수정 (선택)

class ToolHook(Protocol):
    def on_pre_execute(self, tool_name: str, arguments: dict, session: AgentSession) -> HookResult: ...
    def on_post_execute(self, tool_name: str, result: ToolResult, session: AgentSession) -> HookResult: ...

class HookRunner:
    def __init__(self, hooks: list[ToolHook]) -> None:
        self._hooks = hooks

    def run_pre(self, tool_name: str, arguments: dict, session: AgentSession) -> HookResult:
        for hook in self._hooks:
            result = hook.on_pre_execute(tool_name, arguments, session)
            if not result.allowed:
                return result
        return HookResult()

    def run_post(self, tool_name: str, result: ToolResult, session: AgentSession) -> HookResult:
        for hook in self._hooks:
            hook_result = hook.on_post_execute(tool_name, result, session)
            if hook_result.feedback:
                result.content += f"\n\n[Hook feedback: {hook_result.feedback}]"
        return HookResult()
```

**구체적 Hook 사례**:
- `KbAutoEnrichHook`: SAST 결과에서 CWE 번호 감지 -> KB에서 관련 규칙 자동 조회 -> tool_result에 컨텍스트 주입
- `CostGuardHook`: 도구 실행 비용이 예산의 80%를 초과하면 경고 피드백 추가
- `AuditLogHook`: 도구 실행 이력을 외부 저장소에 기록

**통합 지점**: `ToolRouter.execute()` 내부에서 `HookRunner.run_pre()` -> `tool.execute()` -> `HookRunner.run_post()` 순서로 호출.

#### M3: 컨텍스트 압축에 파일 참조 & 펜딩 작업 추출 추가 (1-2일)

**claw-code 패턴** (compact.rs):
- `collect_key_files()`: 메시지에서 파일 경로 패턴 추출, 확장자 필터링, 최대 8개 (줄 321-335)
- `infer_pending_work()`: todo/next/pending/remaining 키워드로 미완료 작업 추론 (줄 300-319)

**적용 대상**: `agent_shared/llm/turn_summarizer.py`의 `_build_structured_summary()`에 추가:

```python
# 파일 참조 추출
import re
_FILE_PATTERN = re.compile(r'[\w/.-]+\.(c|h|cpp|py|java|rs|go|js|ts|json|yaml|xml|cmake|mk)')

def _extract_key_files(messages: list[dict]) -> list[str]:
    files: set[str] = set()
    for msg in messages:
        content = msg.get("content", "") or ""
        files.update(_FILE_PATTERN.findall_with_context(content))  # 의사코드
    return sorted(files)[:8]

# 펜딩 작업 추론
def _extract_pending_work(messages: list[dict]) -> list[str]:
    keywords = ("todo", "next", "pending", "remaining", "남은", "다음")
    pending = []
    for msg in reversed(messages):
        content = (msg.get("content", "") or "").lower()
        if any(kw in content for kw in keywords):
            pending.append(content[:160])
    return pending[:3]
```

### 4.3 장기 과제 (High effort)

#### L1: 이벤트 기반 스트리밍 파이프라인 (1-2주)

**목표**: LLM 응답을 이벤트 스트림으로 전환, Backend SSE 전달 지원

**claw-code 패턴**:
```rust
enum AssistantEvent {
    TextDelta(String),
    ToolUse { id, name, input },
    Usage(TokenUsage),
    MessageStop,
}
```

**AEGIS 적용 설계**:
```python
# agent_shared/llm/events.py (신규)
from dataclasses import dataclass
from typing import Union

@dataclass
class TextDeltaEvent:
    text: str

@dataclass
class ToolUseEvent:
    id: str
    name: str
    arguments: dict

@dataclass
class UsageEvent:
    prompt_tokens: int
    completion_tokens: int

@dataclass
class MessageStopEvent:
    stop_reason: str  # "end_turn" | "tool_use"

AgentEvent = Union[TextDeltaEvent, ToolUseEvent, UsageEvent, MessageStopEvent]
```

**효과**:
- Backend -> Frontend SSE로 분석 진행 상황 실시간 전달
- 부분 응답 처리 (타임아웃 시 수신된 TextDelta까지 활용)
- 토큰 사용량 실시간 모니터링

**통합**: `LlmCaller`가 `AsyncGenerator[AgentEvent, None]`을 반환하도록 변경. `AgentLoop.run()`이 이벤트를 소비하면서 `MessageManager`에 누적.

#### L2: 세션 복원 + 이어가기 (1주)

**목표**: 에이전트 실패/재시작 후 이전 세션을 로드하여 분석을 이어가기

M1의 영속화를 전제로:
1. Backend가 taskId로 세션 파일 조회
2. `AgentSession.load_from_path()`로 복원
3. `MessageManager`를 복원된 messages로 초기화
4. claw-code의 `get_compact_continuation_message()` 패턴으로 "이어가기 프롬프트" 주입
5. `AgentLoop.run(session)` 재진입

**주의**: tool_call/tool 쌍이 깨진 상태에서 복원하면 LLM이 혼란. 마지막 완전한 턴까지만 복원해야 한다 (TurnSummarizer의 절단점 후퇴 로직과 동일).

---

## 5. 코드 스니펫 -- 핵심 패턴

### 패턴 1: claw-code의 루프 핵심 -- "도구 없으면 종료"

```rust
// conversation.rs 줄 166-255
loop {
    iterations += 1;
    if iterations > self.max_iterations {
        return Err(RuntimeError::new("exceeded max iterations"));
    }

    let events = self.api_client.stream(request)?;
    let (assistant_message, usage) = build_assistant_message(events)?;

    let pending_tool_uses = assistant_message.blocks.iter()
        .filter_map(|block| match block {
            ContentBlock::ToolUse { id, name, input } => Some((id, name, input)),
            _ => None,
        })
        .collect::<Vec<_>>();

    self.session.messages.push(assistant_message);

    if pending_tool_uses.is_empty() {
        break;  // <-- 종료 조건: 도구 요청 없음
    }

    // 도구 실행 (순차)
    for (tool_use_id, tool_name, input) in pending_tool_uses {
        // permission check -> hook pre -> execute -> hook post -> record
    }
}
```

**AEGIS 비교**: AEGIS는 `while not should_stop(session)` + content 반환 시 `return result`로 이중 종료 구조. claw-code의 단순한 `break` 패턴이 더 명확하지만, AEGIS의 5가지 종료 조건이 더 안전하다. 두 접근법을 결합하는 것이 최적.

### 패턴 2: claw-code의 Hook 피드백 병합

```rust
// conversation.rs 줄 346-362
fn merge_hook_feedback(messages: &[String], output: String, denied: bool) -> String {
    if messages.is_empty() {
        return output;
    }
    let mut sections = Vec::new();
    if !output.trim().is_empty() {
        sections.push(output);
    }
    let label = if denied { "Hook feedback (denied)" } else { "Hook feedback" };
    sections.push(format!("{label}:\n{}", messages.join("\n")));
    sections.join("\n\n")
}
```

**AEGIS 적용 의사코드**:
```python
def merge_hook_feedback(tool_output: str, hook_messages: list[str], denied: bool) -> str:
    if not hook_messages:
        return tool_output
    sections = []
    if tool_output.strip():
        sections.append(tool_output)
    label = "Hook feedback (denied)" if denied else "Hook feedback"
    sections.append(f"{label}:\n" + "\n".join(hook_messages))
    return "\n\n".join(sections)
```

### 패턴 3: claw-code의 재압축 병합

```rust
// compact.rs 줄 230-263
fn merge_compact_summaries(existing: Option<&str>, new: &str) -> String {
    let previous_highlights = extract_summary_highlights(existing);
    let new_highlights = extract_summary_highlights(new);
    let new_timeline = extract_summary_timeline(new);

    lines = ["<summary>", "Conversation summary:"];
    if previous_highlights:
        lines += ["- Previously compacted context:", ...previous_highlights]
    if new_highlights:
        lines += ["- Newly compacted context:", ...new_highlights]
    if new_timeline:
        lines += ["- Key timeline:", ...new_timeline]
    lines += ["</summary>"]
}
```

**AEGIS TurnSummarizer와 비교**: AEGIS도 `_extract_previous_summary()`로 재압축 병합을 구현하고 있다 (turn_summarizer.py 줄 108-115). 그러나 claw-code는 "highlights"와 "timeline"을 분리하여 보존하는 반면, AEGIS는 이전 요약 전체를 그대로 병합한다. claw-code 방식이 토큰 효율이 더 좋다.

### 패턴 4: claw-code의 세션 복원 + Usage 재구성

```rust
// usage.rs 줄 177-185
pub fn from_session(session: &Session) -> Self {
    let mut tracker = Self::new();
    for message in &session.messages {
        if let Some(usage) = message.usage {
            tracker.record(usage);
        }
    }
    tracker
}
```

**AEGIS 적용 의사코드**:
```python
# agent_session.py
@classmethod
def from_saved_state(cls, data: dict) -> "AgentSession":
    session = cls(
        request=TaskRequest(**data["request"]),
        budget=BudgetState(**data["budget"]),
    )
    # turns와 trace 복원
    session.turns = [TurnRecord(**t) for t in data["turns"]]
    session.trace = [ToolTraceStep(**s) for s in data["trace"]]
    # budget 누적값은 turns에서 재계산
    for turn in session.turns:
        session.budget.total_steps += 1
        session.budget.total_completion_tokens += turn.completion_tokens
    return session
```

### 패턴 5: claw-code의 스트리밍 이벤트 파싱

```rust
// conversation.rs 줄 291-328
fn build_assistant_message(events: Vec<AssistantEvent>)
    -> Result<(ConversationMessage, Option<TokenUsage>), RuntimeError>
{
    let mut text = String::new();
    let mut blocks = Vec::new();
    let mut finished = false;

    for event in events {
        match event {
            AssistantEvent::TextDelta(delta) => text.push_str(&delta),
            AssistantEvent::ToolUse { id, name, input } => {
                flush_text_block(&mut text, &mut blocks);  // 텍스트 버퍼 flush
                blocks.push(ContentBlock::ToolUse { id, name, input });
            }
            AssistantEvent::Usage(value) => usage = Some(value),
            AssistantEvent::MessageStop => finished = true,
        }
    }
    flush_text_block(&mut text, &mut blocks);  // 잔여 텍스트 flush

    if !finished { return Err("stream ended without message stop"); }
    if blocks.is_empty() { return Err("stream produced no content"); }
    Ok((ConversationMessage::assistant(blocks), usage))
}
```

**핵심 인사이트**: `flush_text_block` 패턴. TextDelta가 ToolUse 전에 누적되면 하나의 Text 블록으로 flush. 이 패턴은 SSE 스트리밍 전환 시 그대로 적용 가능하다.

---

## 부록: 파일 인덱스

| 파일 | 줄 수 | 역할 |
|------|------|------|
| `references/claw-code-main/rust/crates/runtime/src/conversation.rs` | 801 | 에이전트 루프 핵심 |
| `references/claw-code-main/rust/crates/runtime/src/session.rs` | 436 | 세션 데이터 모델 + 영속화 |
| `references/claw-code-main/rust/crates/runtime/src/compact.rs` | 702 | 컨텍스트 압축 |
| `references/claw-code-main/rust/crates/runtime/src/usage.rs` | 311 | 토큰 추적 + 비용 산출 |
| `references/claw-code-main/rust/crates/runtime/src/hooks.rs` | 358 | Pre/Post 도구 훅 |
| `references/claw-code-main/rust/crates/runtime/src/permissions.rs` | 233 | 5단계 권한 체계 |
| `references/claw-code-main/src/runtime.py` | 193 | Python 포트 런타임 |
| `references/claw-code-main/src/context.py` | 48 | Python 포트 컨텍스트 |
| `references/claw-code-main/src/query_engine.py` | 194 | Python 포트 쿼리 엔진 |
| `services/analysis-agent/app/core/agent_loop.py` | 293 | AEGIS Analysis Agent 루프 |
| `services/analysis-agent/app/core/agent_session.py` | 77 | AEGIS Analysis Agent 세션 |
| `services/build-agent/app/core/agent_loop.py` | 314 | AEGIS Build Agent 루프 |
| `services/analysis-agent/app/policy/termination.py` | 83 | AEGIS 종료 정책 |
| `services/agent-shared/agent_shared/policy/retry.py` | 51 | AEGIS 재시도 정책 |
| `services/agent-shared/agent_shared/llm/message_manager.py` | 88 | AEGIS 메시지 관리 |
| `services/agent-shared/agent_shared/llm/turn_summarizer.py` | 198 | AEGIS 턴 요약/압축 |
