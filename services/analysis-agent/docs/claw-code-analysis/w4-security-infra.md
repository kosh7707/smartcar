# W4: 보안·권한·인프라 — claw-code 분석 보고서

## 1. Executive Summary

claw-code는 Linux unshare 기반 namespace/network 격리, 5단계 권한 모델(ReadOnly~Allow), PreToolUse/PostToolUse 훅 체인, 모델별 가격 자동 산정 UsageTracker, 3계층 설정 병합(User/Project/Local)을 제공한다. AEGIS는 BudgetManager의 tier별 예산과 감사 trace가 우수하나, 프로세스 격리·권한 승급 제어·훅 시스템이 부재하여 Build Agent의 bash 실행이 보안 취약점이다.

## 2. claw-code 구현 분석

### 2.1 sandbox.rs — 도구 실행 격리

**파일**: `rust/crates/runtime/src/sandbox.rs` (364줄)

#### 핵심 아키텍처

claw-code의 샌드박싱은 Linux `unshare` 명령어를 활용한 **namespace 기반 격리**를 채택한다. 컨테이너 런타임(Docker, Podman 등)에 의존하지 않고, 커널 수준의 경량 격리를 직접 구현한다.

#### 격리 계층 (3가지 독립 축)

| 격리 축 | 메커니즘 | 기본값 |
|---------|----------|--------|
| **Namespace** | `unshare --user --map-root-user --mount --ipc --pid --uts --fork` | 활성 |
| **Network** | `unshare --net` (추가 플래그) | 비활성 |
| **Filesystem** | `Off` / `WorkspaceOnly` (기본) / `AllowList` | WorkspaceOnly |

#### 동작 흐름

```
SandboxConfig → resolve_request() → SandboxRequest
                                          ↓
                          resolve_sandbox_status_for_request()
                                          ↓
                                    SandboxStatus
                                          ↓
                          build_linux_sandbox_command()
                                          ↓
                              LinuxSandboxCommand {
                                program: "unshare",
                                args: [--user, --map-root-user, --mount, ...],
                                env: [HOME=.sandbox-home, TMPDIR=.sandbox-tmp, ...]
                              }
```

#### 컨테이너 감지

이미 컨테이너 내부에서 실행 중인지를 자동 탐지한다:
- `/.dockerenv`, `/run/.containerenv` 파일 존재 확인
- 환경변수 `CONTAINER`, `DOCKER`, `PODMAN`, `KUBERNETES_SERVICE_HOST` 검사
- `/proc/1/cgroup` 에서 docker/containerd/kubepods/podman/libpod 문자열 탐색

컨테이너 내부에서는 nested unshare가 불가능할 수 있으므로, `fallback_reason`을 기록하고 graceful degradation한다.

#### 환경 격리 세부

sandbox 내부에서는 별도의 HOME과 TMPDIR을 할당한다:
- `HOME` → `{cwd}/.sandbox-home`
- `TMPDIR` → `{cwd}/.sandbox-tmp`
- `CLAW_SANDBOX_FILESYSTEM_MODE` / `CLAW_SANDBOX_ALLOWED_MOUNTS` 환경변수로 파일시스템 정책 전달

#### 설계 원칙: Override 체인

`SandboxConfig.resolve_request()`는 5개의 독립적 override를 지원한다:
```rust
fn resolve_request(
    &self,
    enabled_override: Option<bool>,          // 전체 on/off
    namespace_override: Option<bool>,        // namespace 격리
    network_override: Option<bool>,          // 네트워크 격리
    filesystem_mode_override: Option<...>,   // 파일시스템 모드
    allowed_mounts_override: Option<...>,    // 허용 마운트
) -> SandboxRequest
```

각 항목이 None이면 설정파일 값을 사용하고, 설정파일에도 없으면 하드코딩 기본값을 사용한다. 이 패턴은 CLI 인자 > 프로젝트 설정 > 글로벌 설정의 우선순위를 자연스럽게 표현한다.

---

### 2.2 permissions.rs — 권한 모델

**파일**: `rust/crates/runtime/src/permissions.rs` (232줄)

#### 5단계 권한 모드

```
ReadOnly < WorkspaceWrite < DangerFullAccess < Prompt < Allow
```

| 모드 | 의미 | 도구 접근 |
|------|------|----------|
| `ReadOnly` | 읽기 전용. 쓰기/실행 불가 | read_file만 가능 |
| `WorkspaceWrite` | 워크스페이스 내 파일 쓰기 가능 | write_file 가능, bash 불가 |
| `DangerFullAccess` | 모든 도구 제한 없이 사용 | 모두 가능 |
| `Prompt` | 매번 사용자 승인 요구 | 사용자 판단에 위임 |
| `Allow` | 모든 것 자동 승인 | 전부 허용 |

#### 도구별 요구 권한 매핑

`PermissionPolicy`는 각 도구에 필요한 최소 권한 수준을 BTreeMap으로 관리한다:

```rust
PermissionPolicy::new(PermissionMode::WorkspaceWrite)
    .with_tool_requirement("read_file", PermissionMode::ReadOnly)
    .with_tool_requirement("write_file", PermissionMode::WorkspaceWrite)
    .with_tool_requirement("bash", PermissionMode::DangerFullAccess)
```

등록되지 않은 도구의 기본 요구 수준은 `DangerFullAccess`이다 -- **허용 목록 방식(allowlist)**으로, 명시적으로 등록하지 않으면 최고 권한을 요구한다.

#### 승인 흐름 (authorize)

```
authorize(tool_name, input, prompter)
    ├── current_mode == Allow           → 무조건 Allow
    ├── current_mode >= required_mode   → Allow (권한 충분)
    ├── current_mode == Prompt          → Prompter에게 위임
    ├── current_mode == WorkspaceWrite
    │   └── required == DangerFullAccess → Prompter에게 위임 (에스컬레이션)
    └── 그 외                            → Deny (이유 메시지 포함)
```

핵심 설계: **WorkspaceWrite 모드에서 DangerFullAccess 도구를 사용하려 하면, Prompter를 통해 사용자에게 승인을 요청**한다. 이것이 "자동 허용도 아니고, 완전 차단도 아닌" 중간 경로이다.

#### PermissionPrompter 트레이트

```rust
pub trait PermissionPrompter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision;
}
```

이 트레이트를 구현하면 UI 프롬프트, 정책 파일 기반 자동 판단, 감사 로그 기록 등 다양한 전략을 주입할 수 있다.

---

### 2.3 hooks.rs — 도구 훅 시스템

**파일**: `rust/crates/runtime/src/hooks.rs` (357줄)

#### 이벤트 모델

```
PreToolUse  — 도구 실행 전. 거부(deny) 가능
PostToolUse — 도구 실행 후. 감사/결과 변조 가능
```

#### 훅 실행 프로토콜

훅은 **외부 셸 명령어**로 구성된다. 각 명령어는:

1. **stdin**: JSON payload (hook_event_name, tool_name, tool_input, tool_output 등)
2. **환경변수**: `HOOK_EVENT`, `HOOK_TOOL_NAME`, `HOOK_TOOL_INPUT`, `HOOK_TOOL_IS_ERROR`, `HOOK_TOOL_OUTPUT`
3. **exit code로 판정**:

| Exit Code | 의미 | 동작 |
|-----------|------|------|
| 0 | Allow | stdout를 메시지로 캡처 후 계속 진행 |
| 2 | Deny | 도구 실행을 **거부**. stdout가 거부 메시지 |
| 기타 | Warn | 경고 로그 기록 후 실행 계속 (fail-open) |

#### 체인 실행

```rust
for command in commands {
    match run_command(command, request) {
        Allow { message }  => messages.push(message),
        Deny { message }   => return HookRunResult { denied: true, messages },
        Warn { message }   => messages.push(message),
    }
}
```

**첫 번째 Deny에서 즉시 중단**하고 이후 훅은 실행하지 않는다. Allow/Warn은 메시지만 축적하며 계속 진행한다.

#### 활용 예시

```json
// settings.json
{
  "hooks": {
    "PreToolUse": [
      "/usr/local/bin/audit-logger",
      "/usr/local/bin/sensitive-file-guard"
    ],
    "PostToolUse": [
      "/usr/local/bin/output-scanner"
    ]
  }
}
```

- **감사 로깅**: 모든 도구 호출을 외부 시스템에 기록
- **민감 파일 보호**: 특정 경로 접근 시 거부
- **출력 스캔**: 비밀 정보 유출 감지
- **비용 제한**: 과도한 API 호출 차단

---

### 2.4 usage.rs — 사용량/비용 추적

**파일**: `rust/crates/runtime/src/usage.rs` (310줄)

#### 모델별 가격 체계

```rust
ModelPricing {
    input_cost_per_million: f64,
    output_cost_per_million: f64,
    cache_creation_cost_per_million: f64,   // prompt caching 생성 비용
    cache_read_cost_per_million: f64,       // prompt caching 읽기 비용
}
```

모델명 문자열에서 haiku/opus/sonnet을 자동 감지하여 해당 가격을 적용한다. 알 수 없는 모델은 Sonnet 기본 가격으로 폴백하되 `pricing=estimated-default` 라벨을 붙인다.

#### 4분류 토큰 추적

```rust
TokenUsage {
    input_tokens: u32,
    output_tokens: u32,
    cache_creation_input_tokens: u32,   // 캐시 미스 → 새로 캐싱
    cache_read_input_tokens: u32,       // 캐시 히트
}
```

AEGIS의 `prompt_tokens + completion_tokens` 2분류 대비, **캐시 생성/읽기를 별도로 추적**하여 실제 비용 산정 정확도가 높다.

#### UsageTracker — 누적/턴별 추적

```rust
UsageTracker {
    latest_turn: TokenUsage,    // 현재 턴
    cumulative: TokenUsage,     // 전체 누적
    turns: u32,                 // 총 턴 수
}
```

`from_session()` 메서드로 세션의 전체 메시지에서 사용량을 재구성할 수 있다 -- 세션 복구/이어하기 시 유용하다.

#### 비용 요약 출력

```
usage: total_tokens=1800000 input=1000000 output=500000
       cache_write=100000 cache_read=200000
       estimated_cost=$54.6750 model=claude-sonnet-4-6
  cost breakdown: input=$15.0000 output=$37.5000
                  cache_write=$1.8750 cache_read=$0.3000
```

---

### 2.5 Python 레퍼런스 (cost_tracker.py, permissions.py)

#### cost_tracker.py — 최소 비용 추적기

```python
@dataclass
class CostTracker:
    total_units: int = 0
    events: list[str] = field(default_factory=list)

    def record(self, label: str, units: int) -> None:
        self.total_units += units
        self.events.append(f'{label}:{units}')
```

극도로 단순한 이벤트 로그 방식. `label:units` 형태로 모든 비용 이벤트를 문자열 리스트에 축적한다. Rust 쪽의 정교한 모델별 가격 산정과 대조적이며, 이는 Python 구현이 프로토타입/레퍼런스 수준임을 시사한다.

#### permissions.py — 도구 차단 정책

```python
@dataclass(frozen=True)
class ToolPermissionContext:
    deny_names: frozenset[str]       # 정확한 이름 매칭 차단
    deny_prefixes: tuple[str, ...]   # 접두사 매칭 차단

    def blocks(self, tool_name: str) -> bool:
        lowered = tool_name.lower()
        return (lowered in self.deny_names or
                any(lowered.startswith(prefix) for prefix in self.deny_prefixes))
```

Rust의 5단계 권한 모델과 달리, Python 레퍼런스는 **이진 차단(block/allow)** 만 구현한다. `frozen=True`로 불변성을 보장하여 실행 중 정책 변조를 방지한다.

---

### 2.6 config.rs — 설정 관리 (보안 관련 발췌)

**파일**: `rust/crates/runtime/src/config.rs` (1294줄)

#### 3계층 설정 병합

```
User (~/.claw/settings.json)
  ↓ deep_merge
Project ({cwd}/.claw/settings.json)
  ↓ deep_merge
Local ({cwd}/.claw/settings.local.json)   ← gitignore 대상
```

| 계층 | 소스 | 용도 |
|------|------|------|
| `User` | `~/.claw/settings.json` | 글로벌 기본 권한, 모델 선택 |
| `Project` | `.claw/settings.json` | 프로젝트별 훅, 샌드박스 설정 |
| `Local` | `.claw/settings.local.json` | 개인별 오버라이드 (비밀 포함) |

#### deep_merge 알고리즘

```rust
fn deep_merge_objects(target, source) {
    for (key, value) in source {
        if target[key]와 value가 모두 Object → 재귀 병합
        else → source가 target을 덮어씀
    }
}
```

**후순위 설정이 선순위를 덮어쓴다.** Local > Project > User 순으로 우선순위가 높다.

#### 보안 관련 설정 파싱

- `permissionMode`: `"read-only"` / `"workspace-write"` / `"danger-full-access"`
- `sandbox`: `{ enabled, namespaceRestrictions, networkIsolation, filesystemMode, allowedMounts }`
- `hooks`: `{ PreToolUse: [...commands], PostToolUse: [...commands] }`

이 세 가지가 settings.json에서 병합되어 `RuntimeFeatureConfig`를 구성하고, 런타임 전반의 보안 정책으로 작동한다.

---

## 3. AEGIS 현재 구현과의 비교

### 3.1 구조적 차이

| 관점 | claw-code | AEGIS |
|------|-----------|-------|
| **프로세스 격리** | Linux unshare namespace 격리 | 없음. S4로 빌드 위임하지만 격리 없음 |
| **권한 모델** | 5단계(ReadOnly~Allow) + 도구별 요구 수준 | 없음. 모든 도구가 등록되면 호출 가능 |
| **사전/사후 훅** | PreToolUse/PostToolUse 외부 명령 체인 | 없음. ToolRouter에서 예산 검사만 수행 |
| **비용 추적** | 4분류 토큰 + 모델별 USD 가격 자동 산정 | 2분류 토큰(prompt/completion) + tier별 횟수 |
| **설정 계층** | 3계층 deep merge (User/Project/Local) | 하드코딩 BudgetState 기본값 |
| **중복 호출** | 없음 (훅으로 구현 가능) | BudgetManager.is_duplicate_call() |
| **감사 추적** | 없음 내장 (훅으로 위임) | ToolTraceStep + AgentAuditInfo 내장 |
| **입력 검증** | 없음 내장 (권한 모델로 위임) | TryBuildTool._FORBIDDEN_PATTERNS 정규식 |

### 3.2 AEGIS가 이미 잘 하고 있는 것

#### (1) Tier 기반 예산 관리 -- claw-code에 없는 개념

AEGIS의 `ToolCostTier(CHEAP/MEDIUM/EXPENSIVE)` + `BudgetManager.can_make_call()`은 claw-code에 없는 독자적 강점이다. claw-code는 전체 토큰/비용만 추적하지, "SAST 호출은 비싼 도구이므로 1회로 제한" 같은 세분화된 예산 정책이 없다.

#### (2) 중복 호출 차단

`args_hash` 기반 중복 호출 차단은 claw-code에 내장되어 있지 않다. LLM이 같은 도구를 같은 인자로 반복 호출하는 루프에 빠지는 것을 방지하는 실용적 안전장치이다.

#### (3) 내장 감사 추적

```python
ToolTraceStep(step_id, turn_number, tool, args_hash, cost_tier,
              duration_ms, success, new_evidence_refs, error)
```

claw-code는 감사를 외부 훅에 위임하지만, AEGIS는 ToolRouter 내부에 구조화된 trace를 내장한다. 이는 분석 결과의 재현성과 디버깅에 유리하다.

#### (4) 금지 명령어 정규식 검증 (Build Agent)

`TryBuildTool._FORBIDDEN_PATTERNS`는 `rm`, `dd`, `curl`, `wget`, `git`, `docker` 등 위험 명령어를 워드 바운더리 정규식으로 차단한다. claw-code에서는 이런 세분화된 입력 검증이 권한 모델의 상위 계층에서 처리되지만, AEGIS는 도구 구현 수준에서 직접 방어한다.

#### (5) 연속 무증거 턴 감지

`consecutive_no_evidence_turns` 카운터는 에이전트가 도구를 호출하되 유용한 증거를 생성하지 못하는 "공회전" 상태를 감지한다. 이는 비용 절감과 품질 보장을 위한 AEGIS 고유의 메커니즘이다.

### 3.3 AEGIS에 없는 것 (Gap)

#### Gap 1: 프로세스 수준 격리 (Critical)

Build Agent는 S4를 통해 실제 빌드 명령어를 실행한다. `_FORBIDDEN_PATTERNS` 정규식은 1차 방어선이지만:
- 정규식 우회가 가능하다 (예: `$(rm -rf /)`를 변수 치환으로 숨기기)
- S4 자체에 프로세스 격리가 없으면 빌드 명령어가 호스트 파일시스템에 접근 가능
- 네트워크 격리 없이 빌드 중 외부 데이터 유출 가능

#### Gap 2: 권한 에스컬레이션 모델 (High)

현재 AEGIS에서는 도구가 레지스트리에 등록되면 예산 내에서 자유롭게 호출 가능하다. "SAST 도구는 허용하되, 파일 쓰기 도구는 승인 필요"와 같은 권한 계층이 없다. Build Agent의 `edit_file`, `write_file`, `delete_file`이 Analysis Agent의 `read_source`와 같은 권한 수준에서 실행된다.

#### Gap 3: 도구 실행 훅 시스템 (High)

ToolRouter의 `_execute_single()`은 예산 검사 후 바로 실행으로 넘어간다. 사이에 끼어들 수 있는 확장 지점이 없다:
- 민감 파일 경로 접근 차단
- 실행 전 외부 감사 시스템 통보
- 실행 결과에서 비밀 정보 필터링
- 조직 정책에 따른 동적 차단

#### Gap 4: 비용 산정 정확도 (Medium)

AEGIS는 `total_prompt_tokens + total_completion_tokens`만 추적한다. Anthropic API의 prompt caching(cache_creation/cache_read)을 구분하지 않으므로:
- 실제 비용 대비 과대/과소 추정 가능
- 캐시 효율성을 측정할 수 없음
- 모델별 가격 차이를 반영하지 않음 (S7 Gateway가 여러 모델을 지원하므로 중요)

#### Gap 5: 계층적 설정 관리 (Medium)

BudgetState의 기본값이 하드코딩되어 있다 (`max_steps=6`, `max_completion_tokens=2000`). 프로젝트별, 사용자별 오버라이드가 불가능하다. S2(Backend)에서 task 생성 시 주입할 수 있지만, 에이전트 자체의 설정 계층이 없다.

#### Gap 6: 파일시스템 경로 제한 (Medium)

Analysis Agent의 SAST 도구나 Knowledge 도구가 접근할 수 있는 파일 경로에 제한이 없다. claw-code의 `FilesystemIsolationMode::WorkspaceOnly`처럼 워크스페이스 외부 접근을 차단하는 메커니즘이 필요하다.

---

## 4. AEGIS 적용 제안

### 4.1 즉시 적용 가능 (Low effort, High impact)

#### 제안 1: ToolRouter에 PreExecute/PostExecute 훅 포인트 추가

현재 ToolRouter의 `_execute_single()`에 훅 호출 지점을 삽입한다. 외부 명령어 방식이 아닌, Python callable 체인으로 구현하면 간단하다.

**구현 위치**: `agent_runtime/tools/hook.py` (신규) + `ToolRouter._execute_single()` (수정)

```python
# agent_runtime/tools/hook.py
from dataclasses import dataclass
from enum import Enum
from typing import Protocol

class HookDecision(Enum):
    ALLOW = "allow"
    DENY = "deny"
    WARN = "warn"

@dataclass
class HookContext:
    tool_name: str
    arguments: dict
    turn: int
    session_id: str
    tool_output: str | None = None  # PostExecute에서만 존재
    is_error: bool = False

class ToolHook(Protocol):
    def __call__(self, ctx: HookContext) -> tuple[HookDecision, str]:
        """(decision, message)를 반환."""
        ...

class HookChain:
    def __init__(self, hooks: list[ToolHook] | None = None):
        self._hooks = hooks or []

    def add(self, hook: ToolHook) -> None:
        self._hooks.append(hook)

    def run(self, ctx: HookContext) -> tuple[HookDecision, list[str]]:
        messages = []
        for hook in self._hooks:
            decision, msg = hook(ctx)
            if msg:
                messages.append(msg)
            if decision == HookDecision.DENY:
                return HookDecision.DENY, messages
        return HookDecision.ALLOW, messages
```

**ToolRouter 수정**: 단계 5(디스패치)와 6(실행) 사이에 PreExecute 훅을, 단계 6과 7 사이에 PostExecute 훅을 삽입.

**즉시 활용 가능한 훅**:
- `SensitivePathGuard`: `/etc`, `/root`, 프로젝트 외부 경로 접근 차단
- `SecretScanner`: 도구 출력에서 API 키, 토큰 패턴 마스킹
- `AuditLogger`: 외부 감사 시스템(S2 Backend)에 모든 도구 호출 기록

**영향 범위**: Analysis Agent, Build Agent 모두 동일한 ToolRouter를 사용하므로 agent-runtime에 구현하면 양쪽에 즉시 적용된다.

#### 제안 2: 4분류 토큰 추적 도입

TokenCounter를 확장하여 cache_creation/cache_read를 별도 추적한다.

**구현 위치**: `agent_runtime/schemas/agent.py` (BudgetState 수정)

```python
class BudgetState(BaseModel):
    # 기존
    total_completion_tokens: int = 0
    total_prompt_tokens: int = 0
    # 신규: 캐시 분류
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0
    # 신규: 비용 추정
    estimated_cost_usd: float = 0.0
```

S7 Gateway가 응답에 cache 토큰 정보를 포함하면 즉시 활용 가능하다.

#### 제안 3: Build Agent 금지 패턴 강화

현재 `_FORBIDDEN_PATTERNS`는 단순 워드 바운더리만 검사한다. 셸 확장을 통한 우회를 방지하려면:

```python
# 추가 금지 패턴
_FORBIDDEN_PATTERNS += [
    re.compile(r"\$\("),           # command substitution $(...)
    re.compile(r"`"),              # backtick substitution
    re.compile(r"\beval\b"),       # eval 명령어
    re.compile(r"\bsource\b"),     # source 명령어
    re.compile(r"\b\.\s+/"),       # dot sourcing
    re.compile(r"[|&;]\s*\brm\b"), # 파이프/체인 뒤의 rm
    re.compile(r">\s*/dev/sd"),    # 디스크 직접 쓰기
    re.compile(r"\bmkfs\b"),       # 포맷
    re.compile(r"\bsudo\b"),       # 권한 상승
]
```

### 4.2 중기 과제 (Medium effort)

#### 제안 4: ToolPermissionPolicy 도입 — 도구별 권한 수준

claw-code의 5단계 모델을 Python으로 적용한다. AEGIS의 에이전트는 서버 측에서 실행되므로 "사용자 프롬프트" 대신 "정책 기반 자동 판정"으로 변형한다.

**구현 위치**: `agent_runtime/policy/permission.py` (신규)

```python
from enum import IntEnum

class PermissionLevel(IntEnum):
    READ_ONLY = 1        # 읽기 전용 도구
    WORKSPACE_WRITE = 2  # 파일 쓰기 (프로젝트 내)
    EXTERNAL_CALL = 3    # 외부 서비스 호출 (S4, S5)
    DANGEROUS = 4        # 빌드 실행, 파일 삭제

class ToolPermissionPolicy:
    def __init__(self, agent_level: PermissionLevel,
                 tool_requirements: dict[str, PermissionLevel] | None = None):
        self._agent_level = agent_level
        self._requirements = tool_requirements or {}
        self._default_requirement = PermissionLevel.DANGEROUS  # allowlist 방식

    def authorize(self, tool_name: str) -> tuple[bool, str]:
        required = self._requirements.get(tool_name, self._default_requirement)
        if self._agent_level >= required:
            return True, ""
        return False, (
            f"Tool '{tool_name}' requires {required.name} permission; "
            f"agent has {self._agent_level.name}"
        )
```

**에이전트별 적용**:
- Analysis Agent → `PermissionLevel.EXTERNAL_CALL` (SAST/KB 호출 가능, 파일 삭제 불가)
- Build Agent → `PermissionLevel.DANGEROUS` (빌드 실행 가능, but 훅으로 사전 검증)

#### 제안 5: 파일시스템 경로 제한

도구가 접근할 수 있는 경로를 워크스페이스로 제한한다.

**구현 위치**: 훅으로 구현 (제안 1의 HookChain에 등록)

```python
class WorkspacePathGuard:
    """워크스페이스 외부 경로 접근을 차단하는 PreExecute 훅."""

    def __init__(self, workspace_root: str, allowed_extras: list[str] | None = None):
        self._root = os.path.realpath(workspace_root)
        self._allowed = [os.path.realpath(p) for p in (allowed_extras or [])]

    def __call__(self, ctx: HookContext) -> tuple[HookDecision, str]:
        # 도구 인자에서 경로를 추출
        path = ctx.arguments.get("path") or ctx.arguments.get("file_path") or ""
        if not path:
            return HookDecision.ALLOW, ""

        real = os.path.realpath(path)
        if real.startswith(self._root):
            return HookDecision.ALLOW, ""
        if any(real.startswith(a) for a in self._allowed):
            return HookDecision.ALLOW, ""

        return HookDecision.DENY, f"Path '{path}' is outside workspace '{self._root}'"
```

#### 제안 6: 계층적 설정 관리

BudgetState 기본값을 설정 파일에서 로드하도록 변경한다.

```yaml
# config/agent-defaults.yaml
analysis_agent:
  budget:
    max_steps: 6
    max_completion_tokens: 2000
    max_cheap_calls: 3
  permissions:
    level: EXTERNAL_CALL

build_agent:
  budget:
    max_steps: 10
    max_completion_tokens: 3000
    max_expensive_calls: 3
  permissions:
    level: DANGEROUS
```

S2 Backend가 task 생성 시 프로젝트별 오버라이드를 주입하고, 에이전트가 기본값과 병합하는 구조.

### 4.3 장기 과제 (High effort)

#### 제안 7: Linux namespace 기반 빌드 격리

Build Agent가 S4에 빌드를 위임할 때, S4가 `unshare` 기반 namespace 격리 내에서 빌드를 실행하도록 한다. claw-code의 `build_linux_sandbox_command()` 패턴을 직접 차용할 수 있다.

**요구사항**:
- S4(SAST Runner)에 sandbox 모듈 추가
- 빌드 명령어를 `unshare --user --map-root-user --mount --pid --fork -- sh -lc "{build_cmd}"` 로 래핑
- 네트워크 격리 (`--net`)는 빌드 의존성 다운로드가 필요할 수 있으므로 선택적
- 파일시스템은 프로젝트 디렉토리 + SDK 경로만 마운트

**AEGIS 특수 고려사항**:
- WSL2 환경에서 `unshare`가 제한될 수 있음 → 컨테이너 감지 로직 필요
- 임베디드 크로스 컴파일러(arm-linux-gnueabihf-gcc 등)의 경로를 `allowed_mounts`에 포함해야 함
- DGX 서버에서 실행되는 LLM Engine과는 별개 — 빌드 격리는 S4 호스트에서 수행

#### 제안 8: 실시간 감사 스트리밍

현재 ToolTraceStep은 세션 종료 후 일괄 반환된다. 실시간으로 S2 Backend에 스트리밍하면:
- 장시간 실행 중인 에이전트의 진행 상황 모니터링
- 이상 행동(과도한 도구 호출, 예상 외 경로 접근) 즉시 감지
- 필요 시 세션 강제 종료 명령 전달

WebSocket 또는 SSE 기반으로 `tool_dispatch` → `tool_complete` 이벤트를 S2에 푸시하는 구조.

---

## 5. 코드 스니펫 — 핵심 패턴

### 패턴 1: Override 체인 (sandbox.rs에서 차용)

claw-code의 `resolve_request()` 패턴을 Python으로 변환. "CLI 인자 > 태스크 설정 > 에이전트 기본값"의 3단계 fallback.

```python
from dataclasses import dataclass, fields
from typing import TypeVar, Optional

T = TypeVar("T")

def _resolve(override: Optional[T], config: Optional[T], default: T) -> T:
    """override > config > default 순으로 첫 번째 non-None 값 반환."""
    if override is not None:
        return override
    if config is not None:
        return config
    return default

@dataclass
class ResolvedBudget:
    max_steps: int
    max_completion_tokens: int
    max_prompt_tokens: int
    max_cheap_calls: int
    max_medium_calls: int
    max_expensive_calls: int

    @classmethod
    def resolve(cls, task_override: dict | None, agent_config: dict | None,
                defaults: "ResolvedBudget") -> "ResolvedBudget":
        t = task_override or {}
        a = agent_config or {}
        return cls(
            max_steps=_resolve(t.get("max_steps"), a.get("max_steps"), defaults.max_steps),
            max_completion_tokens=_resolve(
                t.get("max_completion_tokens"),
                a.get("max_completion_tokens"),
                defaults.max_completion_tokens,
            ),
            # ... 나머지 필드 동일 패턴
            max_prompt_tokens=_resolve(
                t.get("max_prompt_tokens"), a.get("max_prompt_tokens"),
                defaults.max_prompt_tokens),
            max_cheap_calls=_resolve(
                t.get("max_cheap_calls"), a.get("max_cheap_calls"),
                defaults.max_cheap_calls),
            max_medium_calls=_resolve(
                t.get("max_medium_calls"), a.get("max_medium_calls"),
                defaults.max_medium_calls),
            max_expensive_calls=_resolve(
                t.get("max_expensive_calls"), a.get("max_expensive_calls"),
                defaults.max_expensive_calls),
        )
```

### 패턴 2: HookChain + Exit Code 프로토콜 (hooks.rs에서 차용)

claw-code의 "첫 번째 Deny에서 즉시 중단" 체인 실행을 Python으로 변환.

```python
# ToolRouter._execute_single() 내부 수정안 (의사코드)

async def _execute_single(self, call, session):
    # ... 기존 1~4단계 (존재확인, 구현확인, 중복차단, 예산확인) ...

    # 4.5 PreExecute 훅 체인
    if self._pre_hooks:
        ctx = HookContext(
            tool_name=call.name,
            arguments=call.arguments,
            turn=session.turn_count + 1,
            session_id=session.request.taskId,
        )
        decision, messages = self._pre_hooks.run(ctx)
        if decision == HookDecision.DENY:
            deny_reason = "; ".join(messages) or f"PreExecute hook denied {call.name}"
            agent_log(logger, "훅에 의한 도구 차단",
                      component="tool_router", phase="tool_blocked_hook",
                      turn=turn, tool=call.name, reason=deny_reason)
            return ToolResult(
                tool_call_id=call.id, name=call.name, success=False,
                content=json.dumps({"error": deny_reason}),
                error="hook_denied",
            )

    # 5~6. 디스패치 + 실행 (기존 코드)
    result = await self._executor.execute(impl, call, turn=turn)

    # 6.5 PostExecute 훅 체인
    if self._post_hooks:
        ctx = HookContext(
            tool_name=call.name, arguments=call.arguments,
            turn=turn, session_id=session.request.taskId,
            tool_output=result.content, is_error=not result.success,
        )
        _, post_messages = self._post_hooks.run(ctx)
        # PostExecute는 deny하지 않고 메시지만 축적 (감사/필터링 용도)

    # ... 기존 7~10단계 ...
```

### 패턴 3: 권한 에스컬레이션 판정 (permissions.rs에서 차용)

claw-code의 "current_mode >= required_mode → Allow, 그 외 → 조건부 프롬프트/거부" 패턴.

```python
class PermissionLevel(IntEnum):
    READ_ONLY = 1
    WORKSPACE_WRITE = 2
    EXTERNAL_CALL = 3
    DANGEROUS = 4

# 도구별 요구 권한 테이블
TOOL_REQUIREMENTS: dict[str, PermissionLevel] = {
    # Analysis Agent 도구
    "read_source": PermissionLevel.READ_ONLY,
    "search_knowledge": PermissionLevel.EXTERNAL_CALL,
    "run_sast": PermissionLevel.EXTERNAL_CALL,
    # Build Agent 도구
    "read_file": PermissionLevel.READ_ONLY,
    "list_files": PermissionLevel.READ_ONLY,
    "edit_file": PermissionLevel.WORKSPACE_WRITE,
    "write_file": PermissionLevel.WORKSPACE_WRITE,
    "delete_file": PermissionLevel.DANGEROUS,
    "try_build": PermissionLevel.DANGEROUS,
}
# 미등록 도구 기본값: DANGEROUS (allowlist 방식)
```

### 패턴 4: 모델별 비용 산정 (usage.rs에서 차용)

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class ModelPricing:
    input_per_million: float
    output_per_million: float
    cache_write_per_million: float
    cache_read_per_million: float

MODEL_PRICING: dict[str, ModelPricing] = {
    "qwen": ModelPricing(0.0, 0.0, 0.0, 0.0),       # 셀프호스팅 (DGX)
    "sonnet": ModelPricing(3.0, 15.0, 3.75, 0.30),
    "opus": ModelPricing(15.0, 75.0, 18.75, 1.50),
    "haiku": ModelPricing(0.25, 1.25, 0.30, 0.03),
}

def estimate_cost(usage: dict, model_hint: str = "") -> float:
    """토큰 사용량과 모델명으로 USD 비용 추정."""
    pricing = None
    hint_lower = model_hint.lower()
    for key, p in MODEL_PRICING.items():
        if key in hint_lower:
            pricing = p
            break
    if pricing is None:
        pricing = MODEL_PRICING["sonnet"]  # fallback

    return (
        usage.get("input_tokens", 0) / 1_000_000 * pricing.input_per_million
        + usage.get("output_tokens", 0) / 1_000_000 * pricing.output_per_million
        + usage.get("cache_creation_tokens", 0) / 1_000_000 * pricing.cache_write_per_million
        + usage.get("cache_read_tokens", 0) / 1_000_000 * pricing.cache_read_per_million
    )
```

**AEGIS 특수사항**: S7 Gateway가 Qwen(DGX 셀프호스팅)을 사용하는 경우 비용이 0이다. 이를 pricing 테이블에 반영하면 "셀프호스팅 vs 클라우드 API" 비용 비교가 가능해진다.

### 패턴 5: 컨테이너 감지 + Graceful Degradation (sandbox.rs에서 차용)

S4가 Docker/Podman 내부에서 실행 중이면 nested unshare가 불가능하다. 이를 사전에 감지하여 격리 수준을 자동 조정한다.

```python
import os
from pathlib import Path
from dataclasses import dataclass, field

@dataclass
class ContainerEnvironment:
    in_container: bool = False
    markers: list[str] = field(default_factory=list)

def detect_container() -> ContainerEnvironment:
    markers = []
    if Path("/.dockerenv").exists():
        markers.append("/.dockerenv")
    if Path("/run/.containerenv").exists():
        markers.append("/run/.containerenv")
    for key in ("CONTAINER", "DOCKER", "PODMAN", "KUBERNETES_SERVICE_HOST"):
        val = os.environ.get(key, "")
        if val:
            markers.append(f"env:{key}={val}")
    try:
        cgroup = Path("/proc/1/cgroup").read_text()
        for needle in ("docker", "containerd", "kubepods", "podman"):
            if needle in cgroup:
                markers.append(f"cgroup:{needle}")
    except (FileNotFoundError, PermissionError):
        pass
    return ContainerEnvironment(in_container=bool(markers), markers=markers)
```

이 감지 결과에 따라:
- 컨테이너 외부 → unshare 기반 전체 격리
- 컨테이너 내부 → 파일시스템 경로 제한만 적용 (소프트웨어 수준 격리)
- 감지 불가 → 보수적으로 소프트웨어 수준 격리 + 경고 로그
