# S3 외부 피드백: Agentic SAST 설계 방향

> **일시**: 2026-03-12
> **맥락**: S3 v0 완료 후, v1 정적 분석 접근법을 Hybrid → Agentic으로 전환하는 방향에 대해 외부 자문 요청
> **논의 원본**: `docs/discussion-agentic-sast.md` (S3가 작성한 질문서)

---

## 1. 결론: "Prepared Guided Agent" (선택지 B)

A(Hybrid), B(Guided Agent), C(Full Agent) 중 **B를 기본선**으로 권고.
정확히는 **"Prepared Guided Agent"** 구조:

| 계층 | 설명 |
|------|------|
| **Prepared** | 스냅샷 고정, CodeQL DB 생성, 심볼 인덱스 등 **무거운 준비는 비에이전트·결정적 파이프라인**으로 미리 수행 |
| **Guided** | LLM은 **읽기 전용, 고수준, 스키마화된 도구**만 호출 |
| **Agent** | LLM이 어떤 증적을 더 볼지, 어떤 도구 계열이 필요한지 결정하되 **예산·정책·중단 조건 안에서만** |
| **Assessment-only** | 최종 산출물은 판정이 아니라 **assessment** |

### 핵심 근거

- CodeQL은 "즉흥적 매 스텝 실행"보다 **버전 스냅샷 기준으로 준비 → 질의**하는 구조에 적합
- MCP tool annotations는 **힌트일 뿐** 신뢰 기반이 아님
- OWASP prompt injection + excessive agency 위험 → "CLI를 자유롭게 쓰는 자율 에이전트"보다 **"정책으로 둘러싼 질의형 에이전트"**

### A/B/C 포지셔닝

- **A**: 버리면 안 됨. baseline이자 **fallback**
- **B**: v1 **운영 기본 경로**
- **C**: **연구/실험 트랙** (오프라인 batch만 허용)

> "Guided Agent는 임시 우회가 아니라 장기적으로도 유효한 제품 구조이다."

---

## 2. 권고 아키텍처

### S2/SAST-prep (에이전트 루프 밖, 결정적)

- source snapshot 고정
- compile context / compile_commands 준비
- symbol index 생성
- CodeQL DB 생성
- baseline rule results 저장
- artifact / evidence 등록

### Read-only MCP Tools (LLM에 노출)

| 도구 | 용도 |
|------|------|
| `source.get_span` | 소스 코드 구간 조회 |
| `symbol.find` | 심볼 검색 |
| `preproc.expand_region` | 매크로 전개 (스냅샷/파일/구간 기준) |
| `ast.summarize_node` | AST 노드 요약 |
| `sast.get_alerts` | SAST 알림 조회 |
| `flow.find_taint_paths` | 데이터 플로우 / taint 경로 |
| `callgraph.get_callers` | 콜 그래프 조회 |
| `include.resolve` | 인클루드 해결 |

**핵심 원칙**: LLM에게 `gcc -E <arbitrary path>` 같은 저수준 CLI를 노출하지 않고, `preproc.expand_region(snapshotId, fileRef, spanRef)` 같은 **도메인 도구**만 노출. 이래야 안전성, 재현성, 캐시 적중률, provenance가 전부 좋아짐.

### S3 (오케스트레이터)

- plan-lite 생성
- budget / policy 검증
- 한 번에 한 개씩 tool call 허용
- 결과 스키마 검증
- provenance 기록
- assessment 생성

### Fallback

- 루프 실패 / 예산 초과 시 **기존 hybrid(A) 결과로 폴백**

---

## 3. Q1 답변: Agentic 루프 통제

### 권장 기본값

| 항목 | 값 |
|------|-----|
| 총 step limit | **6** |
| expensive tool 최대 | **1회** |
| medium tool 최대 | **2회** |
| cheap tool 최대 | **3회** |
| tool failure auto-retry | idempotent read-only만 **1회** |
| 총 생성 토큰 예산 | **1,200 ~ 2,000** |
| 동일 tool+args hash 재호출 | **차단** |
| 연속 새 evidence 없음 | **2회 → 중단** |
| 예산 초과 시 | finalize 또는 hybrid fallback |

### 도구 분류

| 등급 | 예시 |
|------|------|
| **cheap** | source span 조회, symbol 검색, alert 조회 |
| **medium** | file-level preprocessor, AST 요약, local callgraph |
| **expensive** | global taint path, whole-TU heavy query, full-pack analysis |

### 중단 기준: step count가 아니라 evidence gain

- 같은 tool + 같은 논리 인자 + 같은 scope → 재호출 금지
- `newEvidenceRefs == 0`이 2회 연속 → 중단
- confidence가 안 오르는데 expensive tool을 더 쓰려 하면 → 차단
- mandatory tool 실패 시 → 해당 claim만 포기, caveat으로 내림

---

## 4. Q2 답변: Plan-lite + NextAction (2계층)

**MCP tool_use 자체는 planner DSL을 대체하지 못함.** 실행 primitive로는 충분하지만 목표/예산/중단조건/claim-tool 매핑이 빠짐.

### 계층 1: Plan-lite

```json
{
  "objective": "Assess whether external input can reach unsafe copy operations in handle_uds_request",
  "candidateToolFamilies": ["source", "alerts", "preproc", "flow"],
  "requiredEvidenceKinds": ["source-span", "flow-path"],
  "budget": { "maxSteps": 6, "maxExpensiveCalls": 1 },
  "stopCriteria": ["sufficient_grounding", "no_new_evidence_twice", "budget_exhausted"]
}
```

### 계층 2: NextAction

```json
{
  "action": "call_tool",
  "toolName": "preproc.expand_region",
  "args": { "snapshotId": "vs_123", "fileRef": "file_77", "spanRef": "span_9" },
  "expectedEvidenceKinds": ["preprocessed-span"],
  "shortReason": "Macro expansion is required before making claims about COPY_BUFFER"
}
```

**tool_use = 실행 포맷, Plan-lite/NextAction = 통제 계약.**

권고 흐름: `LLM → NextAction 출력 → S3 검증 → MCP 호출` (직접 MCP 난사 금지)

---

## 5. Q3 답변: 4단계 신뢰도 모델

기존 3단계(trusted/semi-trusted/untrusted)에서 **4단계**로 확장:

| 수준 | 내용 | 예시 |
|------|------|------|
| **trusted control** | 시스템 통제 영역 | prompt template, policy, tool registry, budget state |
| **trusted metadata** | 도구 실행 메타 | tool name/version, args hash, exit code, artifact hash, timestamp |
| **semi-trusted structured** | 스키마 검증된 도구 결과 | AST node id, CodeQL path object, symbol table entry |
| **untrusted content** | 원본 텍스트 | raw source, comments, string literals, preprocessed code, SARIF message text |

**"우리 도구가 만든 결과"라고 해서 전부 trusted가 아님.** 소스코드는 주석/문자열/식별자가 prompt injection carrier가 될 수 있으므로 untrusted evidence.

### 실무 권장

- 소스 조회 기본값: `strip_comments=true`
- raw snippet은 필요 시에만 별도 필드로
- tool result는 자연어 stdout 대신 **typed JSON**으로 축소
- 각 artifact에 `trustLevel`, `schemaValidated`, `containsRawSourceText` 부착
- trust label은 **artifact마다 동적으로 부착**

---

## 6. Q4 답변: Provenance — 전부 기록

Agentic에서 provenance는 "입력→프롬프트→출력"이 아니라 **도구 호출 trace**.

### 최소 단위: ToolTraceStep

```json
{
  "stepId": "step_04",
  "parentStepId": "step_03",
  "tool": "flow.find_taint_paths",
  "toolVersion": "codeql-pack-2026.03",
  "argsHash": "sha256:...",
  "inputArtifactRefs": ["art_12", "art_31"],
  "outputArtifactRefs": ["art_44"],
  "policyClass": "expensive-readonly",
  "cacheHit": true,
  "durationMs": 1820,
  "exitStatus": "ok",
  "newEvidenceRefs": ["eref_120", "eref_121"]
}
```

### Assessment와 연결

```json
{
  "traceId": "trace_88",
  "usedEvidenceRefs": ["eref_120", "eref_121"],
  "supportingStepIds": ["step_02", "step_04"],
  "templateVersion": "static-agent-v1",
  "modelVersion": "qwen-32b-...",
  "claims": [],
  "caveats": []
}
```

### 재현성 3층

| 수준 | 설명 |
|------|------|
| **hard reproducibility** | 같은 snapshot/tool versions/policy로 replay 가능 |
| **evidence reproducibility** | 같은 종류의 증적을 다시 확보 가능 |
| **assessment comparability** | 최종 claims/caveats가 실질적으로 같은지 비교 가능 |

> "C로 갈수록 exact replay는 약해지고, B에서 훨씬 관리가 쉽다. 이 점도 B를 권하는 이유."

---

## 7. Q5 답변: 점진적 전환 경로

### v1

- A 유지 + B 추가
- 기본 경로 = B
- 실패 시 A로 fallback

### v1.5

- tool family별 mandatory/optional 규칙 추가
- 일부 finding class에 한해 agentic 강화
  - macro-heavy
  - interprocedural suspicion
  - ambiguous rule results

### v2

- C를 연구용 feature flag로
- 오프라인 batch만 허용
- 운영 기본값은 여전히 B

---

## 8. Q6 답변: 3층 평가 체계

### 1) 계약 준수

- schema valid
- 허용된 tool만 사용
- 금지된 args 없음
- budget 준수

### 2) 도구 충분성

- macro 확장을 말했으면 preprocessor/AST 근거가 있었는가
- interprocedural taint를 말했으면 flow tool 근거가 있었는가
- local issue면 expensive global query를 남발하지 않았는가

### 3) 최종 품질

- grounding
- claim correctness
- caveat adequacy
- severity suggestion quality
- hallucination rate

### Golden set 구성

정답 = "이 문장을 그대로 말하라"가 아니라:

- required evidence kinds
- allowed tool families
- forbidden claims
- must-have caveats
- acceptable assessment bands

**exact tool sequence를 golden으로 박는 것은 비권장.** 대신 "이 claim을 하려면 최소한 이 tool family는 지나가야 한다" → **tool sufficiency rubric**.

---

## 9. Q7 답변: 동적/퍼징 적용 범위

**정적 분석만 Agentic 본체.** 동적/퍼징은 읽기 전용 보조 또는 계획 보조.

| 분석 유형 | 적용 수준 | 허용 범위 |
|-----------|----------|----------|
| **static-explain** | B (Guided Agent) | 읽기 전용 도구 자율 호출 |
| **dynamic-annotate** | B-lite | 읽기 전용 trace/decoder/baseline diff/packet-window 질의 |
| **test-plan-propose** | B only | simulator capability 조회, 과거 실패 조회, bounded template 제안. 실행은 deterministic executor |
| **live fuzz / injection** | **C 금지** | LLM은 계획까지만. 실행은 승인 후 별도 executor |

동적 분석 관련 도구 기반:
- `python-can`: CAN 송수신 + 공통 abstraction
- Scapy automotive: UDSonCAN/UDSonIP, DoIP, SOME/IP, XCP, UDS scanner/enumerator
- Wireshark: UDS/DoIP display filter
- Boofuzz: fuzzing 데이터 생성, failure detection, target reset

**이 도구들을 LLM에 직접 쥐어주는 건 excessive agency.** 저장된 캡처/로그를 읽고 해석하는 agentic retrieval만 허용.

---

## 10. 인프라 권고

### 추론 서버: vLLM 1순위

| 근거 | 상세 |
|------|------|
| Qwen 공식 호환 | Qwen 문서가 vLLM 기반 OpenAI-compatible 서비스 예시 직접 제공 |
| Qwen-Agent MCP | Qwen-Agent가 vLLM 같은 OpenAI-compatible endpoint + MCP config 전제 |
| Tool calling 지원 | `tool_choice='required'`, structured outputs, tool calling 문서화 |

TGI, NIM도 대안이지만, **Qwen + 도구 호출 + 로컬 MCP + 세밀한 제어** 조합에서 vLLM이 마찰 최소.

### 성능 팁

- 모든 턴을 thinking 모드로 돌리면 너무 느림
- **control turn은 non-thinking**, **최종 synthesis만 더 큰 budget**
- 5턴 루프 × 250토큰/턴 → 8 tok/s면 ~156초, 15 tok/s면 ~80초 (생성만)
- 도구 실행 시간 + 컨텍스트 재주입 비용 추가됨

---

## 11. 최종 요약

> **"가야 할 방향은 'Hybrid에서 Agentic으로'가 아니라, 'Deterministic SAST substrate 위에 Guided Agent를 얹는 방향'이다."**

세 원칙:

1. **LLM은 raw CLI가 아니라 semantic MCP tools만 본다**
2. **CodeQL DB 생성, 인덱싱, 스냅샷 준비는 agent loop 밖에서 미리 끝낸다**
3. **tool_use 위에 plan-lite / budget / provenance / policy 계층을 한 겹 더 둔다**

---

## 참고 링크

- [CodeQL C/C++ Data Flow Analysis](https://codeql.github.com/docs/codeql-language-guides/analyzing-data-flow-in-cpp/)
- [vLLM Tool Calling](https://docs.vllm.ai/en/latest/features/tool_calling/)
- [MCP Schema Reference](https://modelcontextprotocol.io/specification/2025-06-18/schema)
- [OWASP LLM01: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Qwen Function Calling](https://qwen.readthedocs.io/en/latest/framework/function_call.html)
- [Qwen vLLM Deployment](https://qwen.readthedocs.io/en/latest/deployment/vllm.html)
- [Qwen-Agent](https://qwen.readthedocs.io/en/latest/framework/qwen_agent.html)
- [python-can](https://python-can.readthedocs.io/)
- [Boofuzz](https://boofuzz.readthedocs.io/)
- [TGI Guidance](https://huggingface.co/docs/text-generation-inference/en/basic_tutorials/using_guidance)
