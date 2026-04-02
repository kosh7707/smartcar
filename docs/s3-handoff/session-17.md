# S3 세션 17 — 2026-04-02

## 세션 요약

claw-code(Claude Code 클린룸 포트) 분석 + 시스템 프롬프트 고도화 + 예외처리 강화 + 품질 평가 시스템 구축 + claw-code 패턴 6개 구현. 역대 최대 규모 세션.

---

## 완료된 작업

### 1. 시스템 프롬프트 고도화 (9개 항목)

레퍼런스 분석(Claude Code, GPT-5.3 Codex, Jules, Gemini CLI, Warp)을 토대로 Analysis Agent + Build Agent 시스템 프롬프트 전면 개선.

**Analysis Agent (`phase_one.py`):**
- 분석 워크플로우 4단계 (Phase A~D) 명시
- 도구 예산 동적 주입 (BudgetState 기반)
- 도구 선호 순서 + 도구 실패 대응 가이드
- 인젝션 방어 + 출력 분리 + 분석 범위 제한
- FP 판별 규칙 (NULL 체크, bounds 체크, style finding 등)
- 비밀 마스킹 (처음 4자만 표시)

**Build Agent (`tasks.py`):**
- 빌드 전 사전 체크리스트 (SDK/toolchain, 의존성, 특수 요구)
- "read_file 없이 write_file 금지" 규칙
- 에러 유형별 복구 가이드 (누락 헤더, 미정의 심볼 등)

**agent_loop.py (양쪽):**
- Plan-before-act 넛지 (첫 턴 후)
- 예산 경고 시 핵심 규칙 리마인더
- LLM 실패 시 부분 결과 fallback
- Build Agent: `classify_build_error()` 힌트 주입

**prompt_registry.py:**
- 5개 태스크 타입에 역할 범위 제한
- 4개 assessment 태스크에 증거 없는 claim 금지 + severity 근거 의무화

### 2. 예외 처리 강화

**agent_shared/errors.py:**
- `LlmPoolExhaustedError` 신규 (HTTP 연결 풀 소진)
- `LlmHttpError.retry_after` 필드 추가

**agent_shared/policy/retry.py:**
- max_retries 1→2, 429 Retry-After 헤더 존중, Pool 소진 5s 고정, 백오프 2s 시작

**agent_shared/llm/caller.py:**
- `httpx.PoolTimeout` 전용 catch, Retry-After 헤더 파싱

### 3. 품질 평가 시스템 (eval harness)

**신규 모듈 4개:**
- `eval/scorer.py` — 7개 메트릭 자동 채점 (recall, precision, fp_rejection 등)
- `eval/eval_runner.py` — S7 Gateway 직접 호출 평가 실행기
- `eval/compare.py` — A/B 비교 도구 (regression 감지)
- `eval/judge_prompt.py` — Claude-as-Judge 프롬프트 생성기

**골든셋 8개:**
- 기본 5개: CWE-78 getenv/system, CWE-120 gets BOF, CWE-134 format string, CWE-362 TOCTOU, safe_snprintf FP
- 고난도 3개: multifile indirect chain, macro hidden sprintf, UAF callback

**Baseline 결과:** Composite 0.92, Recall 1.00, Precision 0.94 (8/8 Pass)
**A/B 실험:** FP 판별 프롬프트 개선 → 고난도 케이스 0.91→0.99 (regression 없음)

### 4. claw-code 분해 및 패턴 적용

**분석 보고서 4개** (`docs/claw-code-analysis/`):
- W1 에이전트 루프 & 세션 (746줄) — conversation.rs, session.rs
- W2 컨텍스트 압축 & 메모리 (630줄) — compact.rs
- W3 프롬프트 & 도구 시스템 (709줄) — prompt.rs, tools/lib.rs
- W4 보안 & 인프라 (838줄) — sandbox.rs, permissions.rs, hooks.rs

**구현 6개 스토리** (PRD 6/6 완료):

| # | 스토리 | 파일 | 테스트 |
|---|--------|------|--------|
| US-001 | SystemPromptBuilder 빌더 패턴 | `agent_shared/llm/prompt_builder.py` (신규) | 13 |
| US-002 | 컴팩션 고도화 (파일참조/미완료/사용자요청) | `agent_shared/llm/turn_summarizer.py` | 14 |
| US-003 | Continuation Preamble | `agent_shared/llm/turn_summarizer.py` | 1 |
| US-004 | Pre/Post ToolUse 훅 프레임워크 | `agent_shared/tools/hooks.py` (신규) | 12 |
| US-005 | 도구 결과 Truncation (max 8000자) | `agent_shared/tools/hooks.py` + 양쪽 router | 4 |
| US-006 | 재압축 병합 개선 (highlights 분리) | `agent_shared/llm/turn_summarizer.py` | 5 |

---

## 변경 파일 목록

### 신규
- `services/agent-shared/agent_shared/llm/prompt_builder.py`
- `services/agent-shared/agent_shared/tools/hooks.py`
- `services/analysis-agent/tests/test_prompt_builder.py`
- `services/analysis-agent/tests/test_tool_hooks.py`
- `services/analysis-agent/docs/claw-code-analysis/w1-agent-loop-session.md`
- `services/analysis-agent/docs/claw-code-analysis/w2-context-compaction-memory.md`
- `services/analysis-agent/docs/claw-code-analysis/w3-prompt-tool-system.md`
- `services/analysis-agent/docs/claw-code-analysis/w4-security-infra.md`
- `eval/scorer.py`, `eval/eval_runner.py`, `eval/compare.py`, `eval/judge_prompt.py`
- `eval/golden/*.json` (8개 골든셋)

### 수정
- `services/agent-shared/agent_shared/llm/turn_summarizer.py` — 구조화 압축 + preamble + 3개 추출 함수
- `services/agent-shared/agent_shared/llm/caller.py` — Pool timeout + Retry-After
- `services/agent-shared/agent_shared/errors.py` — LlmPoolExhaustedError
- `services/agent-shared/agent_shared/policy/retry.py` — 재시도 고도화
- `services/analysis-agent/app/core/phase_one.py` — SystemPromptBuilder + 프롬프트 전면 개선
- `services/analysis-agent/app/core/agent_loop.py` — nudge + 부분 결과 fallback
- `services/analysis-agent/app/core/agent_session.py` — analysis_state_summary()
- `services/analysis-agent/app/core/result_assembler.py` — build_from_exhaustion()
- `services/analysis-agent/app/routers/tasks.py` — budget 파라미터 전달
- `services/analysis-agent/app/tools/router.py` — 훅 + truncation
- `services/analysis-agent/app/tools/implementations/knowledge_tool.py`
- `services/analysis-agent/app/tools/implementations/sast_tool.py`
- `services/analysis-agent/app/registry/prompt_registry.py` — 역할 범위 제한
- `services/analysis-agent/tests/test_turn_summarizer.py` — 15개 테스트 추가
- `services/analysis-agent/tests/test_llm_caller.py`
- `services/build-agent/app/routers/tasks.py` — SystemPromptBuilder + 프롬프트 개선
- `services/build-agent/app/core/agent_loop.py` — error classifier + 부분 결과
- `services/build-agent/app/tools/router.py` — 훅 + truncation

### 테스트 결과
- analysis-agent: **263 passed**
- build-agent: **207 passed**

---

## 미완료 / 다음 세션 과제

1. **RE100 리테스트** — S4 하트비트 + stall detection 적용 후 4개 프로젝트 재실행 (세션 16부터 이월)
2. **골든셋 확장** — 현재 8개. Juliet Test Suite 기반 고난도 케이스 추가 필요
3. **세션 영속화** — claw-code session.rs 패턴. 에이전트 세션을 디스크에 저장/복원하여 중단 후 재개 가능
4. **프로세스 격리** — W4 보고서 Critical Gap. Build Agent의 bash 실행에 namespace 격리 필요
5. **claw-code 잔여 패턴** — 보고서에 제안된 중기/장기 과제 (스트리밍 파이프라인, 병렬 도구 실행 등)

---

## 참고

- claw-code 분석 보고서: `services/analysis-agent/docs/claw-code-analysis/`
- PRD: `services/analysis-agent/.omc/prd.json` (6/6 완료)
- eval 결과: `eval/results/` (baseline-v1, ab-fp-improvement)
