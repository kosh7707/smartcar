# 외부 피드백: Agent Service 아키텍처 설계 개요

> **일시**: 2026-03-15
> **맥락**: 기존 "SAST → LLM 해석" 순차 파이프라인의 한계를 넘어, LLM이 능동적으로 SAST 도구를 지시하는 Agent 기반 정적 분석 고도화 방향 논의. 기존 MSA 구조를 최대한 유지하면서 Agent Service를 신규 서비스로 추가하는 방안.
> **논의 참여**: 프로젝트 오너 + Claude (외부 피드백)
> **담당**: S5(Agent Service)는 독립 서비스이나, **S4 세션이 겸임**한다. S4는 LLM Engine 운영 + Agent 개발을 함께 담당.

---

## 1. 문제 인식: 기존 정적 분석의 한계

### 현재 구조 (Hybrid 방식)

```
사용자 → S2(Backend) → SAST 룰 매칭 → S3(LLM Gateway) → S4(Qwen 3.5)
                           ↓                    ↓
                     룰 기반 탐지           탐지 결과 해석/보강
```

1. SAST 도구(룰 엔진)가 먼저 돌아서 취약점 후보를 탐지
2. 그 결과를 LLM에 넘겨서 의미 부여(설명, 심각도 제안, 수정 가이드 등)

### 한계

- **SAST가 탐지하지 못한 취약점은 LLM도 볼 수 없다.** LLM은 SAST 결과의 "후처리자"일 뿐, 탐색 주체가 아님.
- LLM이 코드를 직접 읽고 "여기 수상한데?"라고 가설을 세울 수 있는 능력이 있음에도, 현재 구조에서는 그 능력을 활용하지 못함.
- SAST 도구의 선택과 파라미터 조합이 사람의 판단에 의존 — 도구 조합의 최적화가 어려움.

### 전환 방향

**"SAST가 발견 → LLM이 해석"에서 "LLM이 가설 수립 → SAST로 검증 → LLM이 재판단"으로 주도권을 전환한다.**

이는 기존 외부 피드백(`S3_agentic_sast_design_feedback.md`)에서 권고한 **"Prepared Guided Agent"(선택지 B)** 방향과 일치하며, 본 문서는 이를 구현하기 위한 **서비스 아키텍처 설계**에 초점을 둔다.

---

## 2. 등장인물 (변경 없음)

| 구성요소 | 역할 |
|---------|------|
| **User** | 분석 요청 발행자 |
| **Agent (Orchestrator)** | LLM과 도구 사이에서 루프를 관리하는 중재자 |
| **LLM** | 코드 분석 가설 수립, 도구 호출 결정, 결과 해석, 최종 판정 |
| **MCP Servers (Tools)** | SAST 도구들을 표준화된 인터페이스로 래핑한 도구 서버 |

**추가 등장인물은 없다.** 정책 필터링, 종료 조건 판단, 컨텍스트 관리 등은 전부 Agent 내부의 책임이다.

---

## 3. 서비스 토폴로지 변경

### 기존 (4-서비스)

```
S1(Frontend) → S2(Backend) → S3(LLM Gateway) → S4(LLM Engine)
                                                  Qwen 3.5 (vLLM)
```

### 변경 후 (5-서비스, 2-다리 구조)

```
S1(Frontend) → S2(Backend) → S3(LLM Gateway) ──→ S4(LLM Engine)
                                  │                 Qwen 3.5 (vLLM)
                                  │                     ↑
                                  └──→ S5(Agent) ───────┘
                                         │
                                         ├──→ MCP Server A (Semgrep)
                                         ├──→ MCP Server B (CodeQL)
                                         └──→ MCP Server C (...)
```

> **서비스는 5개, 세션은 4개.** S5(Agent Service)는 독립 프로세스이나 S4 세션이 개발/운영을 겸임한다.

### 통신 경로 2개

| 경로 | 용도 |
|------|------|
| `S2 → S3 → S4` | 기존 Task 기반 분석 (hybrid fallback 포함) |
| `S2 → S3 → S5 → S4` | Agent 기반 능동적 분석 (신규) |

### 핵심 설계 결정

1. **S3(LLM Gateway)의 인터페이스는 변경하지 않는다.** S2 입장에서는 기존과 동일하게 S3만 호출하면 됨. Agent 호출은 S3 내부에서 라우팅.
2. **S5(Agent Service)는 독립 서비스다.** Agent 루프의 상태 관리 복잡도가 높아 S3에 내장하기엔 너무 큼. MSA 원칙 유지.
3. **S5는 S4(Qwen 3.5)를 직접 호출한다.** S3을 경유하지 않음. LLM 인스턴스는 하나(vLLM 서버)이고, S3과 S5가 같은 엔드포인트를 호출.

---

## 4. LLM 리소스 공유

### 물리 구성

```
DGX Spark (128GB unified memory)
  └── vLLM 서버 (1개 인스턴스)
        └── Qwen 3.5-35B-A3B FP8
              ↑
              ├── S3(LLM Gateway)가 호출  ← 기존 Task 처리
              └── S5(Agent Service)가 호출 ← Agent 루프
```

- LLM 인스턴스를 2개 올리지 않는다. 단일 vLLM 서버가 두 클라이언트의 요청을 받음.
- vLLM의 continuous batching이 요청 큐잉을 처리.

### 기존 Semaphore(1) 제거 필요

현재 S3의 `task_pipeline.py`에 `asyncio.Semaphore(1)`이 있음. 이는 이전 ollama 환경(동시 요청 시 성능 저하)을 위한 것으로, vLLM 전환 후에는 불필요. Agent 루프가 LLM을 여러 번 호출하는 동안 다른 요청이 블로킹되는 것을 방지하기 위해 **제거해야 한다.**

### 경합 관리

- Agent 루프가 LLM을 점유하는 동안 일반 Task 요청의 응답 지연 가능성 있음
- vLLM의 continuous batching + DGX Spark의 VRAM 여유(~36GB)로 실무상 큰 문제는 아닐 것으로 판단
- 필요 시 Agent 요청에 낮은 우선순위를 부여하는 방안 고려 가능

---

## 5. Agent 루프 설계

### 기본 흐름

```
1. User가 정적 분석을 요청한다
2. S2 → S3 → S5로 분석 요청이 전달된다
3. Agent가 LLM에 시스템 프롬프트(사용 가능한 도구 및 파라미터 목록)와
   유저 프롬프트(분석 대상 코드/컨텍스트)를 묶어서 던진다
4. LLM이 tool_call(구조화된 JSON)로 도구 호출을 지시한다
5. Agent는 정책 필터링을 수행한 뒤, MCP Server에 도구 호출을 전달한다
6. MCP Server가 도구 실행 결과를 반환하면, Agent가 이를 LLM 컨텍스트에 추가한다
7. 위 과정을 LLM이 tool_call 없이 최종 답변을 생성할 때까지 반복한다
8. 종료 시 결과를 S3 → S2 → S1으로 돌려준다
```

### 종료 조건 (3중)

| 조건 | 설명 |
|------|------|
| **LLM 자발적 종료** | LLM이 tool_call 없이 최종 assessment를 생성 |
| **루프 횟수 초과** | 최대 step limit 도달 (기존 피드백 권장값: 6) |
| **새 발견 없음** | 연속 2회 이상 새로운 evidence가 나오지 않음 |

### 컨텍스트 관리

- 매 LLM 호출 시 이전 대화 히스토리(질의 + 도구 응답)를 함께 전송
- 루프가 길어지면 컨텍스트 윈도우 소진 위험 → 요약 또는 선택적 잘라내기 전략 필요
- 이는 Agent Service 내부에서 관리할 책임

---

## 6. 정책 레이어

Agent가 LLM의 지시를 "무조건 수행"하는 게 아니라 **"필터링해서 수행"**하는 구조. 이 정책 레이어가 Agent를 단순 프록시가 아닌 Orchestrator로 만드는 핵심이며, **차량 보안 특화 Agent**라는 연구 기여점을 만드는 지점.

### 6.1 안전 정책

- 등록된 MCP Server에 있는 도구만 허용 (화이트리스트)
- LLM이 hallucination으로 존재하지 않는 도구를 호출하려 하면 차단
- 파일 삭제/수정 등 부작용이 있는 행위 차단 (읽기 전용 원칙)

### 6.2 효율 정책

- 동일 도구 + 동일 파라미터 재호출 차단 (args hash 캐싱)
- 이전 호출 결과를 캐시에서 반환하여 불필요한 도구 실행 방지
- 루프가 길어질수록 LLM이 이전 호출을 까먹고 중복 호출하는 것을 방어

### 6.3 도메인 정책 (연구 핵심)

- **취약점 유형 → 도구 우선순위 매핑**: 예) CWE-119(버퍼 오버플로우) 의심 시 CodeQL 우선, CWE-78(OS 커맨드 인젝션) 의심 시 Semgrep 우선
- **코드 특성 → 도구 선택 보정**: 예) AUTOSAR 코드면 MISRA C 룰셋 우선 적용
- **도구 조합 유효성 검증**: 의미 없는 도구 조합 차단
- LLM이 도구 선택을 잘못해도 도메인 정책이 보정해주는 구조

### 6.4 자원 정책

- 루프 최대 횟수 (기존 피드백 권장: 6 steps)
- 단일 분석당 최대 토큰 소비량 (기존 피드백 권장: 1,200 ~ 2,000)
- expensive tool 최대 호출 횟수 (기존 피드백 권장: 1회)
- 전체 타임아웃

---

## 7. MCP Servers 설계

### 기본 원칙

기존 외부 피드백의 핵심 원칙을 그대로 따른다:

> **"LLM은 raw CLI가 아니라 semantic MCP tools만 본다."**

각 SAST 도구의 CLI를 직접 LLM에 노출하지 않고, MCP Server로 래핑하여 **도메인 도구** 인터페이스를 제공한다.

### MCP Server 후보

| MCP Server | 래핑 대상 | 역할 |
|-----------|----------|------|
| `sast-semgrep` | Semgrep CLI | 패턴 기반 정적 분석 |
| `sast-codeql` | CodeQL CLI | 의미론적 정적 분석 (data flow, taint) |
| `source-reader` | 파일 시스템 | 소스 코드 구간 조회, 심볼 검색 |
| `ast-analyzer` | Tree-sitter 등 | AST 노드 요약, 구조 분석 |

- 이미 오픈소스 MCP Server가 존재하는 경우(예: Semgrep MCP) 우선 활용
- 없는 경우 MCP Python SDK로 CLI 래핑하여 자체 구현
- 모든 MCP Server는 **읽기 전용** 도구만 제공

### 기존 피드백의 Read-only MCP Tools와의 관계

기존 피드백에서 정의한 도구 목록(`source.get_span`, `symbol.find`, `sast.get_alerts`, `flow.find_taint_paths` 등)은 **논리적 도구 인터페이스**이며, 물리적으로는 위 MCP Server들이 이를 구현한다.

---

## 8. 기존 시스템과의 통합 포인트

### S3(LLM Gateway) 변경사항

| 항목 | 변경 |
|------|------|
| `POST /v1/tasks` | Agent 대상 task type 추가 (예: `static-agent-explain`) |
| 라우팅 로직 | task type에 따라 기존 파이프라인 vs Agent Service 호출 분기 |
| Semaphore(1) | **제거** (vLLM 전환 후 불필요, Agent 경합 방지) |
| Fallback | Agent 실패 시 기존 hybrid(A) 파이프라인으로 폴백 |

### S2(Backend) 변경사항

- **없음 (이상적).** S2는 기존과 동일하게 S3의 `/v1/tasks`만 호출. Agent 존재를 알 필요 없음.
- 단, Agent 분석 결과의 새로운 필드(tool trace, step count 등)를 저장하려면 Finding/Run 모델 확장 필요 가능.

### S4(LLM Engine) 변경사항

- **없음.** vLLM 서버는 그대로. S5가 같은 엔드포인트를 호출할 뿐.

---

## 9. 기술 스택 권장

### Agent Service (S5)

| 항목 | 권장 | 근거 |
|------|------|------|
| 언어 | Python | LLM 생태계 + S3와 통일 |
| 프레임워크 | FastAPI | S3와 동일한 패턴 유지 |
| Agent 프레임워크 | **LangGraph** | 상태 기계 기반 Agent 루프 정의. MCP 공식 지원. LLM 벤더 비종속 |
| MCP 연동 | MCP Python SDK | 표준화된 도구 호출 인터페이스 |

### LangGraph 선택 근거

- Agent 루프를 **그래프 노드(상태)와 엣지(전이)**로 선언적으로 정의 가능
- 기존 피드백의 Plan-lite → NextAction → Tool Call → Evaluate 흐름을 자연스럽게 표현
- MCP 연동 공식 지원
- Qwen 3.5 등 OpenAI-compatible 엔드포인트 연결 가능
- 논문 figure로 그리기에도 적합 (그래프 = 시각화 용이)

### 구현 전략

**Phase 1**: 직접 while 루프로 프로토타입 구현하여 동작 검증
**Phase 2**: 루프가 복잡해지는 시점에 LangGraph로 마이그레이션

"바퀴를 다시 만들지 마라" 원칙 — Agent 루프의 뼈대는 LangGraph가 제공하고, 직접 구현하는 것은 **도메인 정책 레이어**와 **기존 Fahrex 시스템과의 연동**에 집중.

### 담당 세션

S5는 독립 서비스이나, **S4 세션이 겸임**한다. 근거:

- S4는 vLLM 세팅 완료 후 운영/모니터링 외 여유 있음
- S4가 LLM 엔드포인트(Qwen 3.5)의 성능 특성, API 형식, 제약사항을 가장 잘 파악하고 있음
- Agent가 LLM을 직접 호출하는 구조이므로 S4와의 도메인 지식 연속성이 중요
- S4 인수인계서(`docs/s4-handoff/README.md`)에 Agent 역할 확장을 명시할 것

---

## 10. 연구 기여점 정리

| 기여 | 설명 |
|------|------|
| **분석 주도권 전환** | SAST 도구 주도 → LLM 주도로의 전환. 기존 hybrid의 "SAST가 못 찾으면 끝" 한계 극복 |
| **도메인 특화 정책** | 차량 보안 도메인의 취약점-도구 매핑, AUTOSAR/MISRA 규칙 등을 정책 레이어로 체계화 |
| **Prepared Guided Agent** | 무거운 준비(스냅샷, DB 생성)는 결정적 파이프라인에서 수행, LLM은 읽기 전용 도구만 호출하는 안전한 구조 |
| **실제 시스템에서의 검증** | Fahrex 프레임워크 내에서 end-to-end 동작하는 실증 |

### 논문 스토리라인

```
기존 SAST + LLM 순차 파이프라인의 한계
  → Agent 기반 능동적 탐색으로 전환
  → 차량 보안 도메인 특화 정책 레이어 설계
  → Fahrex 프레임워크에서 실제 검증
```

---

## 11. 다음 단계

### 즉시 (S3 세션)

- [ ] `task_pipeline.py`의 `asyncio.Semaphore(1)` 제거
- [ ] Agent 대상 task type 라우팅 로직 설계
- [ ] S3 → S5 통신 인터페이스 정의

### 단기 (S4 세션 — Agent 겸임)

- [ ] S4 인수인계서에 Agent 역할 확장 명시
- [ ] Agent Service 프로젝트 스켈레톤 생성 (`services/agent/`)
- [ ] Agent 루프 프로토타입 구현 (while 루프 → LangGraph 전환)
- [ ] MCP Server 1개 이상 구현 (Semgrep 우선)
- [ ] S4(vLLM) 직접 호출 클라이언트 구현

### 중기

- [ ] 도메인 정책 레이어 구현 (CWE → 도구 매핑)
- [ ] 기존 hybrid 파이프라인과 A/B 비교 평가
- [ ] Provenance / ToolTraceStep 기록 구현

---

## 12. 관련 문서

| 문서 | 경로 | 관계 |
|------|------|------|
| 기존 Agentic SAST 피드백 | `docs/외부피드백/S3_agentic_sast_design_feedback.md` | 본 문서의 이론적 근거. Prepared Guided Agent 상세 설계 |
| S3 인수인계서 | `docs/s3-handoff/README.md` | 현재 LLM Gateway 구현 상태 |
| S4 인수인계서 | `docs/s4-handoff/README.md` | vLLM + Qwen 3.5 서빙 환경 |
| 전체 기술 개요 | `docs/specs/technical-overview.md` | MSA 구조 및 서비스 간 통신 |

---

> **이 문서의 위치**: `docs/외부피드백/agent_service_architecture_overview.md`
> **이 문서의 소비자**: S3(LLM Gateway) 세션, S4(LLM Engine + Agent 겸임) 세션, 프로젝트 오너
