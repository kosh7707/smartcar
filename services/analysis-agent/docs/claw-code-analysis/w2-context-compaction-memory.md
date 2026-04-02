# W2: 컨텍스트 압축 & 메모리 -- claw-code 분석 보고서

## 1. Executive Summary (200자 이내)

claw-code compact.rs는 LLM 없이 순수 휴리스틱으로 컨텍스트를 압축한다. 핵심은 구조화된 메타데이터 추출(도구명, 파일경로, 미완료 작업), 다단계 재압축(이전 요약과 신규 요약 병합), 최근 N개 메시지 원문 보존이다. AEGIS TurnSummarizer는 이미 핵심 패턴을 상당 부분 반영했으나, 타임라인 보존과 재압축 병합 품질에서 개선 여지가 있다.

---

## 2. claw-code 구현 분석

### 2.1 compact.rs -- 컴팩션 엔진 (702줄)

#### 2.1.1 전체 아키텍처

compact.rs는 **LLM 호출 없이** 순수 휴리스틱 기반으로 동작하는 컴팩션 엔진이다. 핵심 흐름:

```
should_compact() → compact_session() → summarize_messages() → merge_compact_summaries()
```

**설계 철학**: "요약의 정확성보다 구조적 메타데이터의 보존이 중요하다." LLM에게 요약을 위임하지 않고, 메시지에서 정형 정보(도구명, 파일경로, 미완료 작업 키워드)를 기계적으로 추출한다.

#### 2.1.2 압축 트리거 조건 (`should_compact`)

```rust
fn should_compact(session: &Session, config: CompactionConfig) -> bool {
    let start = compacted_summary_prefix_len(session);  // 이전 요약이 있으면 1, 없으면 0
    let compactable = &session.messages[start..];        // 이전 요약 제외

    compactable.len() > config.preserve_recent_messages  // 메시지 수 > 보존 수
        && compactable.iter()
            .map(estimate_message_tokens)
            .sum::<usize>() >= config.max_estimated_tokens  // 토큰 >= 임계값
}
```

두 가지 조건이 **AND**로 결합된다:
1. 압축 가능한 메시지 수가 보존 수보다 많아야 함
2. 해당 메시지들의 추정 토큰 합계가 임계값 이상이어야 함

기본값: `preserve_recent_messages = 4`, `max_estimated_tokens = 10,000`

핵심: 이전에 이미 압축된 요약 메시지(`System` role)는 압축 대상에서 **제외**한다. 이미 압축된 세션을 다시 평가할 때 요약 자체의 토큰이 재압축 트리거에 영향을 주지 않도록 하는 설계.

#### 2.1.3 토큰 추정 (`estimate_message_tokens`)

```rust
fn estimate_message_tokens(message: &ConversationMessage) -> usize {
    message.blocks.iter().map(|block| match block {
        ContentBlock::Text { text } => text.len() / 4 + 1,
        ContentBlock::ToolUse { name, input, .. } => (name.len() + input.len()) / 4 + 1,
        ContentBlock::ToolResult { tool_name, output, .. } => (tool_name.len() + output.len()) / 4 + 1,
    }).sum()
}
```

- **4바이트 = 1토큰** 근사. 영문 기준으로 합리적 (BPE 평균 ~4 chars/token).
- 블록별로 개별 계산 후 합산. 각 블록에 +1을 더해 구조적 오버헤드를 반영.
- 한국어는 UTF-8에서 3바이트/글자이므로 `len()/4`가 과소추정될 수 있음 (AEGIS 적용 시 주의).

#### 2.1.4 메시지 선택 알고리즘 (`compact_session`)

```
[이전요약(0~1)] [제거 대상: prefix..keep_from] [보존: 마지막 N개]
```

```rust
let keep_from = session.messages.len().saturating_sub(config.preserve_recent_messages);
let removed = &session.messages[compacted_prefix_len..keep_from];
let preserved = session.messages[keep_from..].to_vec();
```

- 마지막 `preserve_recent_messages`개를 **원문 그대로** 보존
- 그 앞의 메시지들은 구조화 요약으로 대체
- 결과: `[System(요약)] + [보존된 최근 메시지들]`

**AEGIS와의 차이점**: claw-code는 tool_call/tool 쌍 경계를 고려하지 않고 단순히 마지막 N개를 자른다. AEGIS의 TurnSummarizer는 tool 메시지에서 시작하면 해당 assistant까지 후퇴하여 쌍을 보존하는데, 이것이 **더 안전한 설계**이다.

#### 2.1.5 구조화 요약 생성 (`summarize_messages`)

제거되는 메시지들로부터 다음 메타데이터를 기계적으로 추출한다:

| 추출 항목 | 함수 | 설명 |
|-----------|------|------|
| **메시지 통계** | 직접 계산 | user/assistant/tool 메시지 수 |
| **도구명 목록** | `tool_names` 수집 | ToolUse/ToolResult 블록에서 중복 제거 |
| **최근 사용자 요청** | `collect_recent_role_summaries` | 마지막 3개 user 메시지의 첫 텍스트 블록 (160자 절단) |
| **미완료 작업** | `infer_pending_work` | "todo", "next", "pending", "follow up", "remaining" 키워드 포함 메시지 (최대 3개) |
| **참조 파일** | `collect_key_files` | 경로 패턴 + 확장자 필터 (rs/ts/tsx/js/json/md), 최대 8개 |
| **현재 작업** | `infer_current_work` | 마지막 비공백 텍스트 블록 (200자 절단) |
| **키 타임라인** | 전체 순회 | 모든 메시지를 `role: block_summary` 형태로 나열 |

생성되는 요약 구조:
```
<summary>
Conversation summary:
- Scope: 12 earlier messages compacted (user=4, assistant=5, tool=3).
- Tools mentioned: Bash, Read, Grep.
- Recent user requests:
  - Fix the compilation error in main.rs
  - Add tests for the new feature
- Pending work:
  - Next: update tests and follow up on remaining CLI polish.
- Key files referenced: src/compact.rs, src/session.rs
- Current work: Working on regression coverage now.
- Key timeline:
  - user: Fix the compilation error in main.rs
  - assistant: I will inspect the compact flow.
  - tool: tool_result bash: ok file content...
</summary>
```

#### 2.1.6 다단계 재압축 (`merge_compact_summaries`)

**가장 정교한 부분.** 이미 압축된 세션을 다시 압축할 때:

```rust
fn merge_compact_summaries(existing_summary: Option<&str>, new_summary: &str) -> String {
    // existing_summary가 None이면 new_summary만 반환
    // 있으면:
    //   1. 기존 요약에서 highlights 추출 (타임라인 제외)
    //   2. 새 요약에서 highlights + timeline 추출
    //   3. 병합:
    //      - Previously compacted context: [기존 highlights]
    //      - Newly compacted context: [새 highlights]
    //      - Key timeline: [새 timeline만]
}
```

핵심 설계 결정:
- **타임라인은 가장 최근 것만 보존**: 이전 압축의 타임라인은 버리고, 새로 압축되는 메시지의 타임라인만 남긴다. 이는 타임라인이 가장 토큰을 많이 소비하기 때문.
- **Highlights는 계층적 누적**: "Previously compacted context" 아래에 이전 요약의 핵심 정보가 중첩 보존된다.
- 재압축을 반복하면 "Previously > Previously > ..." 가 깊어질 수 있으나, 각 단계에서 타임라인을 제거하므로 기하급수적 증가는 없다.

#### 2.1.7 기존 요약 인식 (`extract_existing_compacted_summary`)

```rust
fn extract_existing_compacted_summary(message: &ConversationMessage) -> Option<String> {
    if message.role != MessageRole::System { return None; }
    let text = first_text_block(message)?;
    let summary = text.strip_prefix(COMPACT_CONTINUATION_PREAMBLE)?;
    // COMPACT_RECENT_MESSAGES_NOTE, COMPACT_DIRECT_RESUME_INSTRUCTION 제거
    Some(summary.trim().to_string())
}
```

첫 번째 메시지가 System이고 `COMPACT_CONTINUATION_PREAMBLE`으로 시작하면, 이전 압축 결과로 인식. 프리앰블과 후미 지시문을 제거하고 순수 요약 본문만 추출한다.

#### 2.1.8 출력 포맷팅

- `format_compact_summary`: `<analysis>` 태그 제거, `<summary>` 태그를 "Summary:" 헤더로 변환
- `collapse_blank_lines`: 연속 빈 줄 제거
- `get_compact_continuation_message`: 프리앰블 + 요약 + "Recent messages are preserved verbatim." + "Continue the conversation... without asking further questions."

마지막 지시문이 핵심: **압축 후 LLM이 "이전 내용을 요약하겠습니다"라고 시작하는 것을 명시적으로 금지**한다.

### 2.2 Python 레퍼런스 (transcript.py, history.py, session_store.py)

#### 2.2.1 transcript.py -- TranscriptStore

```python
@dataclass
class TranscriptStore:
    entries: list[str] = field(default_factory=list)
    flushed: bool = False

    def compact(self, keep_last: int = 10) -> None:
        if len(self.entries) > keep_last:
            self.entries[:] = self.entries[-keep_last:]
```

극도로 단순한 윈도우 잘라내기. 마지막 N개 엔트리만 보존하고 나머지는 삭제. **요약 생성 없음**. Rust 구현의 정교한 메타데이터 추출과 대조적이다.

이것은 "전체 대화 기록"이 아닌 "사용자에게 보여주는 트랜스크립트 로그"의 관리용으로 보인다. Rust compact.rs가 LLM 컨텍스트 윈도우 관리를, Python TranscriptStore가 UI 로그 관리를 담당하는 분리 구조.

#### 2.2.2 history.py -- HistoryLog

```python
@dataclass(frozen=True)
class HistoryEvent:
    title: str
    detail: str

@dataclass
class HistoryLog:
    events: list[HistoryEvent] = field(default_factory=list)

    def as_markdown(self) -> str:
        lines = ['# Session History', '']
        lines.extend(f'- {event.title}: {event.detail}' for event in self.events)
        return '\n'.join(lines)
```

구조화된 이벤트 로그. 압축과 무관하게 세션의 모든 이벤트를 `title: detail` 형태로 누적. compact.rs의 "Key timeline"과 유사한 역할이지만, 이것은 **압축되지 않는 영속 로그**이다.

#### 2.2.3 session_store.py -- StoredSession

```python
@dataclass(frozen=True)
class StoredSession:
    session_id: str
    messages: tuple[str, ...]
    input_tokens: int
    output_tokens: int

def save_session(session: StoredSession, directory: Path | None = None) -> Path:
    path = target_dir / f'{session.session_id}.json'
    path.write_text(json.dumps(asdict(session), indent=2))
```

JSON 파일 기반 세션 영속화. `messages`는 `tuple[str, ...]`로 직렬화 가능한 형태. 토큰 사용량도 함께 저장하여 비용 추적이 가능하다.

---

## 3. AEGIS 현재 구현과의 비교

### 3.1 구조적 차이

| 관점 | claw-code compact.rs | AEGIS TurnSummarizer + MessageManager |
|------|---------------------|--------------------------------------|
| **압축 방식** | 순수 휴리스틱 (LLM 미사용) | 순수 휴리스틱 (LLM 미사용) |
| **요약 내용** | 통계 + 도구명 + 사용자요청 + 미완료작업 + 파일 + 타임라인 | 도구이력 + evidence refs + 시스템지시 + 세션상태 |
| **tool 쌍 보존** | 미고려 (단순 N개 절단) | assistant->tool 쌍 후퇴 보존 |
| **재압축** | merge_compact_summaries로 계층적 병합 | _extract_previous_summary로 이전 요약 전체 보존 |
| **토큰 추정** | `len()/4+1` (블록별) | `len(str())/4` (메시지별, tool_calls JSON 포함) |
| **세션 영속성** | session_store.py (JSON 파일) | 없음 (인메모리) |
| **압축 후 지시** | "Continue without asking questions" | 없음 |
| **파일 경로 추출** | 확장자 필터 + 경로 패턴 | 없음 |
| **미완료 작업 추론** | 키워드 기반 (todo/next/pending) | 없음 |
| **타임라인** | 전체 메시지 role:content 나열 | 없음 |
| **요약 마커** | COMPACT_CONTINUATION_PREAMBLE (영문) | _SUMMARY_MARKER (한국어) |

### 3.2 AEGIS가 이미 잘 하고 있는 것

1. **tool_call/tool 쌍 보존**: claw-code는 단순히 마지막 N개를 자르기 때문에 tool_call 뒤에 tool result가 없는 상태가 될 수 있다. AEGIS의 `while cut_idx > prefix_len and messages[cut_idx].get("role") == "tool": cut_idx -= 1` 로직이 더 견고하다.

2. **Evidence Ref 추출**: AEGIS는 `eref-` 패턴으로 evidence reference를 명시적으로 추출하고 보존한다. 보안 분석 에이전트에서 이전 분석의 증거를 추적하는 것은 핵심 요구사항이며, claw-code에는 이 개념이 없다.

3. **세션 상태 주입**: `state_summary` 매개변수를 통해 `analysis_state_summary()`(사용된 도구, 수집된 evidence refs, 실패한 도구)를 압축 시 함께 전달한다. 이는 도메인 특화된 컨텍스트 보존으로, 범용 도구인 claw-code보다 분석 작업에 적합하다.

4. **시스템 지시 보존**: `[시스템]` 프리픽스 메시지를 감지하여 요약에 포함한다. 에이전트 루프에서 주입하는 "도구 예산 경고", "보고서 강제 지시" 등의 시스템 메시지가 압축 후에도 맥락으로 남는다.

5. **도구 호출 결과 요약의 정밀도**: 각 tool_call에 대해 인자 요약(60자), 성공/실패 판단, evidence ref 추출까지 수행한다. claw-code는 블록을 160자로 절단할 뿐이다.

### 3.3 AEGIS에 없는 것 (Gap)

#### Gap 1: 키 타임라인 (Key Timeline)

claw-code는 제거되는 **모든 메시지**를 `role: content_summary` 형태로 시간순 나열한다. AEGIS는 도구 이력만 추출하고, 일반 assistant/user 텍스트 메시지의 흐름은 버린다.

**영향**: LLM이 "이전에 어떤 순서로 무슨 대화가 오갔는지"를 알 수 없다. 도구를 사용하지 않은 추론 턴의 맥락이 유실된다.

#### Gap 2: 미완료 작업 추론 (Pending Work Inference)

claw-code는 "todo", "next", "pending", "follow up", "remaining" 키워드가 포함된 메시지를 자동 추출한다. AEGIS는 이를 하지 않는다.

**영향**: 압축 후 LLM이 "아직 해야 할 일"을 잊을 수 있다. 특히 다단계 분석에서 "finding 3은 아직 미분석" 같은 정보가 유실될 위험.

#### Gap 3: 참조 파일 경로 추출 (Key Files Referenced)

claw-code는 모든 메시지 텍스트에서 파일 경로 패턴을 추출하여 요약에 포함한다 (확장자 필터, 최대 8개). AEGIS는 이를 하지 않는다.

**영향**: 분석 대상 코드 파일의 경로가 압축 후 사라진다. `read_file("/path/to/vuln.c")` 결과는 도구 이력에 인자로 남지만, 사용자가 텍스트로 언급한 파일은 유실.

#### Gap 4: 최근 사용자 요청 보존 (Recent User Requests)

claw-code는 마지막 3개 user 메시지를 160자로 절단하여 별도 섹션에 보존한다. AEGIS는 이를 하지 않는다.

**영향**: 원래 사용자의 분석 요청 의도가 압축 후 희석된다.

#### Gap 5: 압축 후 행동 지시 (Continuation Instruction)

claw-code는 압축된 요약 뒤에 명시적으로 추가한다:
> "Continue the conversation from where it left off without asking the user any further questions. Resume directly -- do not acknowledge the summary, do not recap what was happening, and do not preface with continuation text."

AEGIS는 이러한 지시가 없다.

**영향**: LLM이 압축 후 "이전 대화를 요약하면..." 식으로 토큰을 낭비할 수 있다.

#### Gap 6: 재압축 시 타임라인 분리 관리

claw-code의 `merge_compact_summaries`는 이전 요약의 highlights와 새 요약의 highlights를 **분리**하여 "Previously compacted context" / "Newly compacted context"로 구분한다. 그리고 타임라인은 **최신 것만** 보존한다.

AEGIS의 `_extract_previous_summary`는 이전 요약 **전체**를 그대로 보존하므로, 재압축이 반복되면 요약이 기하급수적으로 커질 수 있다.

#### Gap 7: 세션 영속성

claw-code는 `session_store.py`로 세션을 JSON 파일에 저장/복원한다. AEGIS의 MessageManager는 인메모리만 지원하며, 프로세스 재시작 시 대화 컨텍스트가 유실된다.

---

## 4. AEGIS 적용 제안

### 4.1 즉시 적용 가능 (Low effort, High impact)

#### 4.1.1 압축 후 행동 지시 추가

**구현 위치**: `TurnSummarizer._build_structured_summary` 끝부분

현재 요약 텍스트 끝에 다음을 추가:
```
\n[지시] 이전 대화의 요약을 반복하지 마라. 즉시 분석을 계속하라.
```

**예상 효과**: 압축 직후 턴에서 LLM이 "이전 대화를 요약하면..."으로 시작하는 토큰 낭비 제거. 추정 50-200 토큰 절약/압축.

#### 4.1.2 미완료 작업 추론 추가

**구현 위치**: `TurnSummarizer._build_structured_summary`에 새 섹션

```python
def _extract_pending_work(self, messages: list[dict]) -> list[str]:
    keywords = ["todo", "다음", "미분석", "남은", "pending", "아직"]
    pending = []
    for msg in reversed(messages):
        content = msg.get("content", "") or ""
        lowered = content.lower()
        if any(kw in lowered for kw in keywords):
            pending.append(content[:160])
        if len(pending) >= 3:
            break
    return list(reversed(pending))
```

한국어 키워드("다음", "미분석", "남은", "아직")를 추가하여 AEGIS 도메인에 맞춤. 요약의 "## 미완료 작업" 섹션으로 포함.

**예상 효과**: 다단계 분석에서 "finding 5는 아직 미분석" 같은 작업 상태가 압축 후에도 보존.

#### 4.1.3 최근 사용자 요청 보존

**구현 위치**: `TurnSummarizer._build_structured_summary`에 새 섹션

제거 대상 메시지 중 마지막 3개 user 메시지의 content를 160자로 절단하여 보존.

```python
recent_user = [
    m["content"][:160] for m in reversed(removed_messages)
    if m.get("role") == "user" and m.get("content")
][:3]
```

### 4.2 중기 과제 (Medium effort)

#### 4.2.1 재압축 병합 개선 -- 타임라인 분리

현재 AEGIS의 `_extract_previous_summary`는 이전 요약 전체를 `## 이전 압축 요약` 아래에 넣는다. 재압축이 3회 발생하면:

```
## 이전 압축 요약
[컨텍스트 압축: 이전 8개 메시지 요약]
## 도구 호출 이력
- ...
## 이전 압축 요약
[컨텍스트 압축: 이전 5개 메시지 요약]
## 도구 호출 이력
- ...
```

이것은 토큰을 기하급수적으로 소비한다. claw-code 패턴을 적용하여:

1. 이전 요약에서 **핵심 정보(highlights)**만 추출 (도구 이력, evidence refs, 시스템 지시)
2. 타임라인(메시지 흐름)은 **최신 압축분만** 보존
3. 이전 highlights는 "## 이전 컨텍스트" 아래에 평탄화

```python
def _merge_summaries(self, prev_summary: str, new_sections: list[str]) -> str:
    prev_highlights = self._extract_highlights(prev_summary)  # 타임라인 제외
    merged = [f"{_SUMMARY_MARKER} 병합 압축]"]
    if prev_highlights:
        merged.append("\n## 이전 컨텍스트 (요약)")
        merged.extend(prev_highlights)
    merged.extend(new_sections)  # 새 도구이력/evidence/타임라인
    return "\n".join(merged)
```

**예상 효과**: 3회 이상 재압축 시 요약 크기가 O(n^2)에서 O(n)으로 감소.

#### 4.2.2 키 타임라인 추가

모든 제거 메시지를 `role: content_summary(160자)` 형태로 나열하는 경량 타임라인 섹션 추가:

```python
def _build_timeline(self, messages: list[dict]) -> list[str]:
    lines = ["## 대화 타임라인"]
    for msg in messages:
        role = msg.get("role", "?")
        if role == "tool":
            content = f"tool_result({msg.get('tool_call_id', '?')}): {(msg.get('content') or '')[:80]}"
        elif msg.get("tool_calls"):
            names = [tc["function"]["name"] for tc in msg.get("tool_calls", [])]
            content = f"tool_call: {', '.join(names)}"
        else:
            content = (msg.get("content") or "")[:160]
        lines.append(f"- {role}: {content}")
    return lines
```

**예상 효과**: 도구를 사용하지 않는 추론 턴의 맥락이 보존됨. LLM이 이전 분석 흐름을 더 정확하게 파악.

#### 4.2.3 참조 파일 경로 추출

```python
import re

_FILE_PATH_PATTERN = re.compile(
    r'(?:^|[\s"\'`(,])(/[\w./-]+\.(?:c|h|cpp|py|rs|ts|js|json|yaml|toml))\b'
)

def _extract_key_files(self, messages: list[dict]) -> list[str]:
    files = set()
    for msg in messages:
        content = msg.get("content") or ""
        files.update(_FILE_PATH_PATTERN.findall(content))
        for tc in msg.get("tool_calls", []):
            args = tc.get("function", {}).get("arguments", "")
            files.update(_FILE_PATH_PATTERN.findall(args))
    return sorted(files)[:10]
```

AEGIS 도메인에 맞게 `.c`, `.h`, `.cpp` 등 임베디드 관련 확장자를 추가.

### 4.3 장기 과제 (High effort)

#### 4.3.1 세션 영속화

현재 AEGIS의 에이전트 세션은 단일 HTTP 요청 내에서 실행되고 종료된다. 그러나 장기 분석(대규모 코드베이스)에서 세션을 중단/재개할 필요가 생길 수 있다.

claw-code의 `session_store.py` 패턴을 참고하여:

```python
@dataclass
class PersistedAgentSession:
    task_id: str
    messages: list[dict]          # MessageManager 상태
    trace: list[ToolTraceStep]    # 도구 실행 이력
    budget_state: BudgetState     # 예산 상태
    evidence_refs: list[str]      # 수집된 evidence
    input_tokens: int
    output_tokens: int
    created_at: str
    compaction_count: int         # 압축 횟수

def save_session(session: PersistedAgentSession, path: Path) -> None:
    path.write_text(json.dumps(asdict(session), indent=2, ensure_ascii=False))
```

저장 시점: 각 턴 종료 시 + 압축 발생 시.
복원 시점: 동일 `task_id`로 재요청 시.

**예상 효과**: 프로세스 크래시/타임아웃 후 분석 재개 가능. 특히 DGX에서 LLM 호출이 길어질 때 유용.

#### 4.3.2 토큰 추정 정밀도 개선 (한국어 보정)

현재 `len()/4` 방식은 영문 기준이다. 한국어는:
- UTF-8: 3 bytes/char
- BPE 토큰화: 약 1.5-2 chars/token (한국어는 토큰당 문자 수가 적음)

따라서 한국어 비중이 높으면 `len()/4`가 **50% 이상 과소추정**할 수 있다.

```python
def estimate_tokens(text: str) -> int:
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    non_ascii_chars = len(text) - ascii_chars
    # 영문: ~4 chars/token, 한국어: ~1.5 chars/token
    return ascii_chars // 4 + int(non_ascii_chars / 1.5) + 1
```

**예상 효과**: 한국어 프롬프트가 많은 AEGIS에서 압축 트리거 타이밍이 더 정확해짐.

#### 4.3.3 하이브리드 압축 (휴리스틱 + LLM)

현재 claw-code와 AEGIS 모두 LLM 없이 압축한다. 장기적으로, 예산이 허용될 때 LLM을 활용한 "의미적 요약"을 추가할 수 있다:

1. 1차: 현재의 휴리스틱 압축 (항상 실행, 빠름)
2. 2차 (선택적): 1차 요약을 LLM에게 보내 "분석 맥락에서 핵심 발견 사항을 3줄로 요약하라"
3. 2차 결과를 요약 상단에 추가

이 접근은 S7 Gateway를 통해 저비용 모델(예: cheap tier)로 실행 가능. 단, 현재 에이전트의 도구 호출 예산이 6회로 극히 제한되어 있으므로, 실제 압축이 발생하는 빈도가 낮아 우선순위는 낮다.

---

## 5. 코드 스니펫 -- 핵심 패턴

### 패턴 1: 이전 요약 인식 및 재압축 방지 (compact.rs)

```rust
// 핵심: 이전 압축 결과를 인식하여 재압축 대상에서 제외
fn compacted_summary_prefix_len(session: &Session) -> usize {
    usize::from(
        session.messages.first()
            .and_then(extract_existing_compacted_summary)
            .is_some(),
    )
}

// should_compact에서 이전 요약을 건너뛴 후의 메시지만 평가
let start = compacted_summary_prefix_len(session);
let compactable = &session.messages[start..];
```

**AEGIS 적용 의사코드**:
```python
# MessageManager.compact()에서 이전 요약을 인식
def _is_compacted_summary(self, msg: dict) -> bool:
    return (msg.get("role") == "system"
            and (msg.get("content") or "").startswith(_SUMMARY_MARKER))

def should_compact(self) -> bool:
    skip = 1 if self._is_compacted_summary(self._messages[0]) else 0
    # 시스템 프롬프트도 건너뜀
    if self._messages[0].get("role") == "system" and not self._is_compacted_summary(self._messages[0]):
        skip = max(skip, 1)
    compactable = self._messages[skip:]
    return (len(compactable) > _COMPACT_KEEP_LAST_N
            and self._estimate_tokens(compactable) >= _COMPACT_TOKEN_THRESHOLD)
```

### 패턴 2: 계층적 요약 병합 (compact.rs)

```rust
fn merge_compact_summaries(existing: Option<&str>, new: &str) -> String {
    let previous_highlights = extract_summary_highlights(existing);  // 타임라인 제외
    let new_highlights = extract_summary_highlights(new);
    let new_timeline = extract_summary_timeline(new);  // 최신 것만

    // "Previously compacted context:" + "Newly compacted context:" + "Key timeline:"
}
```

**AEGIS 적용 의사코드**:
```python
def _merge_summaries(self, prev_summary: str, new_sections: str) -> str:
    # 이전 요약에서 타임라인 제거하고 핵심만 추출
    prev_lines = []
    in_timeline = False
    for line in prev_summary.split("\n"):
        if line.strip().startswith("## 대화 타임라인"):
            in_timeline = True
            continue
        if in_timeline:
            if line.strip().startswith("##"):
                in_timeline = False
            else:
                continue
        if line.strip():
            prev_lines.append(line)

    return (
        f"{_SUMMARY_MARKER} 병합 압축]\n"
        f"## 이전 컨텍스트\n" + "\n".join(prev_lines) + "\n\n"
        + new_sections
    )
```

### 패턴 3: 키워드 기반 미완료 작업 추론 (compact.rs)

```rust
fn infer_pending_work(messages: &[ConversationMessage]) -> Vec<String> {
    messages.iter().rev()
        .filter_map(first_text_block)
        .filter(|text| {
            let lowered = text.to_ascii_lowercase();
            lowered.contains("todo") || lowered.contains("next")
                || lowered.contains("pending") || lowered.contains("follow up")
                || lowered.contains("remaining")
        })
        .take(3)
        .map(|text| truncate_summary(text, 160))
        .collect()
}
```

**AEGIS 적용 의사코드** (한국어 키워드 추가):
```python
_PENDING_KEYWORDS = [
    "todo", "next", "pending", "follow up", "remaining",
    "다음", "미분석", "남은", "아직", "추가 분석", "미완료",
]

def _extract_pending_work(messages: list[dict]) -> list[str]:
    results = []
    for msg in reversed(messages):
        content = (msg.get("content") or "").lower()
        if any(kw in content for kw in _PENDING_KEYWORDS):
            results.append((msg.get("content") or "")[:160])
        if len(results) >= 3:
            break
    return list(reversed(results))
```

### 패턴 4: 파일 경로 추출 (compact.rs)

```rust
fn extract_file_candidates(content: &str) -> Vec<String> {
    content.split_whitespace()
        .filter_map(|token| {
            let candidate = token.trim_matches(|c| matches!(c, ',' | '.' | ':' | ';' | ')' | '('));
            if candidate.contains('/') && has_interesting_extension(candidate) {
                Some(candidate.to_string())
            } else { None }
        })
        .collect()
}
```

**핵심 설계**: 정규식 대신 whitespace split + trim + 조건 필터. 간단하면서도 대부분의 경우에 동작한다. 확장자 화이트리스트로 노이즈를 제거.

### 패턴 5: 압축 후 즉시 재개 지시 (compact.rs)

```
const COMPACT_DIRECT_RESUME_INSTRUCTION: &str =
    "Continue the conversation from where it left off without asking the user
     any further questions. Resume directly -- do not acknowledge the summary,
     do not recap what was happening, and do not preface with continuation text.";
```

이 한 줄의 지시문이 LLM의 "요약 반복" 행동을 효과적으로 억제한다. AEGIS에 즉시 적용할 수 있는 가장 영향력 있는 패턴이다.

---

## 부록: 질문별 답변 요약

| 질문 | 답변 |
|------|------|
| **압축 전략** | 순수 휴리스틱. LLM 요약 없음. 구조화된 메타데이터 추출 + 최근 N개 원문 보존. |
| **보존 우선순위** | 최근 N개 원문 > 도구명/파일경로 > 사용자요청/미완료작업 > 타임라인. System(이전요약)은 별도 보호. tool_call/tool 쌍은 고려하지 않음(AEGIS가 더 우수). |
| **토큰 추정** | `byte_len / 4 + 1`. 영문 기준 합리적, 한국어에서 과소추정 위험. |
| **다단계 압축** | 가능. `merge_compact_summaries`로 이전 highlights + 새 highlights + 최신 타임라인 병합. |
| **세션 영속성** | Python측 `session_store.py`로 JSON 파일 저장/복원. Rust측은 Session 구조체 직렬화. |
| **증거 보존** | 파일 경로는 `collect_key_files`로 보존. 명시적 evidence ref 시스템은 없음 (AEGIS가 eref- 패턴으로 더 우수). |
