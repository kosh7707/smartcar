# Non-vLLM hypotheses for empty tool_calls under tool_choice="required"

가정: vLLM 0.20.0 + qwen3 reasoning + qwen3_coder tool + MTP=1 stack는 정상 동작. caller 측 또는 prompt/request 구성에 결함이 있다.

| ID | 가설 | 코드 위치 | 변경할 변수 | 가설이 맞다면 예측 |
|---|---|---|---|---|
| H1 | **system prompt가 "tool 호출"과 "JSON content 출력"을 동시 지시하여 모순.** tool_choice="required"가 도구 호출 강제하는데 "최종 content는 순수 JSON" 지시가 양립 불가능 신호로 작용 | build-agent system prompt 후반 "출력 형식" 섹션 (dump request.messages[0].content 마지막 ~30 lines) | system prompt에서 "JSON 출력" 부분 제거 후 동일 호출 | failure rate 75%→낮아짐 |
| H2 | **temperature=1.0이 guided decoding 통과 못 시키는 토큰 분포 만듦.** 첫 턴 preset이 THINKING_GENERAL(T=1.0)인데 코드 path는 build이므로 THINKING_CODING(T=0.6)이 맞음 | build-agent agent_loop.py:370 `controls_from_constraints(THINKING_GENERAL, ...)` | temperature=0.3 또는 0.6으로 변경 후 동일 호출 | failure rate 낮아짐 |
| H3 | **enable_thinking=true + tool_choice="required" 모순.** thinking template이 `<think>` block 강제 emit, guided decoding은 tool_call schema 강제. transition에서 깨짐 | controls.to_gateway_fields() chat_template_kwargs | enable_thinking=false로 동일 호출 | failure rate 낮아짐 (또는 0) |
| H4 | **6개 tool 정의 schema가 복잡해서 guided decoding 실패.** `additionalProperties` 등 nested schema. tool_choice="required"가 가장 적합한 tool 선택할 때 grammar 분기 폭이 넓음 | dump request.tools (6 tools, nested schema) | tools=[list_files만 1개] 로 줄이고 동일 호출 | failure rate 낮아짐 |
| H5 | **max_tokens=16384이 너무 커서 guided decoding 안정성 영향.** 일부 vLLM 버전에서 large max_tokens + guided decoding 조합 불안정 보고 있음 | LlmCaller default_max_tokens / config.agent_llm_max_tokens | max_tokens=2048로 줄이고 동일 호출 | failure rate 낮아짐 |
| H6 | **system prompt 길이/복잡도 자체가 모델 첫 응답 분포를 흐트러뜨림.** 3000+ 토큰 system prompt이 짧은 user message와 결합하여 모델이 thinking에만 시간 쓰고 tool_call grammar 진입 못함 | build-agent system prompt 전체 길이 | minimal prompt(1 줄) + tool_choice="required"로 변경 | failure rate 낮아짐 |
| H7 | **단순 stochastic, 어느 변수도 결정적 영향 없음.** sampling stochasticity로 25% 자연 실패 | — | 모든 변수 동일하게 두고 N=20+ 반복 | 모든 variant 실패율 비슷 |

## 실험 design

| Exp | tool_choice | temperature | enable_thinking | tools | max_tokens | system prompt | N |
|---|---|---|---|---|---|---|---|
| V0 baseline | required | 1.0 | true | 6 (full) | 16384 | full (3000 toks) | 15 |
| V1 auto control | auto | 1.0 | true | 6 (full) | 16384 | full | 10 |
| V2 temp 0.3 | required | 0.3 | true | 6 (full) | 16384 | full | 10 |
| V3 no thinking | required | 1.0 | false | 6 (full) | 16384 | full | 10 |
| V4 single tool | required | 1.0 | true | 1 (list_files) | 16384 | full | 10 |
| V5 min prompt | required | 1.0 | true | 6 (full) | 16384 | minimal (~50 toks) | 10 |
| V6 small max_tokens | required | 1.0 | true | 6 (full) | 2048 | full | 10 |

Total ≈ 75 LLM 호출.

지표:
- `messageToolCallsLen` — 추출된 tool_call 개수
- `finishReason`
- `contentLen` — message.content 길이
- `reasoningLen` — message.reasoning 길이
- `completion_tokens`
- `failure` boolean = `messageToolCallsLen == 0` (P10 의도 기준 실패 = 첫 턴 tool 호출 0개)

가설 평가:
- H1 confirmed: V5 failure rate << V0
- H2 confirmed: V2 failure rate << V0
- H3 confirmed: V3 failure rate << V0
- H4 confirmed: V4 failure rate << V0
- H5 confirmed: V6 failure rate << V0
- H6 confirmed: V5 failure rate << V0 (overlap with H1; differential is "what part of prompt — length vs content?")
- H7 confirmed: all variants ≈ V0
