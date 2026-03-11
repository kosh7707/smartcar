# S3 작업 지침서 — LLM-Gateway

## 1. 문서 목적

이 문서는 S3가 담당하는 **LLM-Gateway** 영역의 책임 범위, 반드시 구현해야 할 기능, 안전 요구사항, 구조화 출력 규칙, agent 확장 방향, 협업 규칙을 정의하기 위한 작업 지침서다.

S3의 핵심 역할은 "AI를 붙이는 것"이 아니라, **AI를 시스템 안에서 통제 가능한 형태로 바꾸는 것**이다.

핵심 문장:

> **S3는 모델 서버를 감싸는 프록시가 아니라, AI 요청을 표준화하고, 입력 신뢰도와 출력 검증을 관리하며, provenance와 audit를 남기는 통제 계층이다.**

---

## 2. S3의 시스템 내 역할

S3는 아래를 책임진다.

- S2가 호출하는 안정적 AI API 제공
- task type 기반 라우팅
- prompt template versioning
- model profile routing
- context packaging
- 입력 신뢰도 라벨링(trusted / untrusted)
- 구조화 출력(JSON 등) 강제
- schema validation
- provenance / audit metadata 생성
- rate limit / token budget / timeout 관리
- secret / PII scrubbing
- agent planner 출력의 제약 및 정책 연계

S3는 아래를 책임지지 않는다.

- ECU 직접 접근
- 실제 ECU command 실행
- findings 최종 확정
- quality gate 최종 결정
- 승인 결정
- 정책 엔진 자체
- 프론트 직접 대응

즉, S3는 **AI를 위한 안전한 경계 계층**이다.

---

## 3. S3의 성공 기준

S3가 잘 되었다고 볼 수 있는 기준은 아래와 같다.

1. S2는 실제 모델이 무엇이든 상관없이 **일관된 task API** 를 호출할 수 있어야 한다.
2. 모든 AI 응답은 **구조화되고 검증 가능**해야 한다.
3. 어떤 모델, 어떤 프롬프트, 어떤 입력 근거로 응답이 나왔는지 추적 가능해야 한다.
4. 비신뢰 입력(raw logs, simulator output, 외부 문장)이 system instruction을 오염시키지 못해야 한다.
5. Agent를 도입하더라도, S3가 곧 실행 권한이 되는 구조가 되면 안 된다.
6. 실패 모드(schema invalid, timeout, empty result, unsafe output)가 정상 플로우처럼 숨겨지지 않아야 한다.

---

## 4. S3의 핵심 원칙

## 4.1 LLM 결과는 "판정"이 아니라 "Assessment"

S3가 반환하는 것은 finding truth가 아니다.  
반환물은 **assessment** 또는 **proposal** 이어야 한다.

예:
- 취약점 설명
- 이벤트 요약
- anomaly 해석 가설
- 유사 finding 클러스터 제안
- 테스트 시나리오 초안
- 보고서 초안

금지:
- "이것은 확정 취약점이다" 형태의 최종 판정
- "이 액션을 즉시 실행해라" 같은 직접 제어 명령
- evidence ref 없는 단정적 분석

## 4.2 입력은 신뢰도 수준을 가져야 한다

S3는 입력 컨텍스트를 최소 아래로 구분해야 한다.

- `trusted`
  - S2가 정규화한 structured finding
  - internal canonical metadata
  - approved prompt variables
- `semi-trusted`
  - parsed logs
  - normalized evidence summary
- `untrusted`
  - raw logs
  - ECU payload dump
  - simulator text output
  - 외부 문서 원문
  - 사용자 자유 입력

중요:
- untrusted 입력은 system/policy instruction과 분리해 넣어야 한다.
- raw text를 system role에 섞지 않는다.
- prompt injection 가능성을 전제로 설계한다.

## 4.3 출력은 항상 구조화되어야 한다

권장 출력 포맷:
- JSON object
- JSON Schema validation
- 불가피할 때만 text 부가 필드 허용

필수:
- schema version
- task type
- model profile
- prompt version
- evidence refs
- summary
- claims
- caveats
- confidence
- recommended next actions (있다면)
- validator result

---

## 5. 반드시 지원해야 할 Task Type

S3는 task 단위를 명시적으로 구분해야 한다.  
한 endpoint에서 자유 텍스트를 받아 아무 일이나 하게 만들면 유지보수성이 무너진다.

권장 task type:

## 5.1 `static-explain`

입력:
- finding summary
- rule metadata
- evidence refs
- source snippet (제한적)

출력:
- 설명
- 잠재 영향
- 추가 검토 포인트
- remediation 초안

## 5.2 `static-cluster`

입력:
- finding 목록
- 규칙/파일/모듈 메타데이터

출력:
- 유사 finding 묶음 제안
- 중복 가능성
- 검토 우선순위

## 5.3 `dynamic-annotate`

입력:
- qualified event window
- rule matches
- baseline diff
- related evidence refs

출력:
- 사건 요약
- 가능한 원인 가설
- 추가 확인이 필요한 신호
- 인간 검토 필요 여부

## 5.4 `test-plan-propose`

입력:
- 목표
- ECU capability
- 현재 상태
- 허용된 action 범위
- 정책 제약

출력:
- 실행 가능한 시나리오 초안
- 필요한 승인
- 예상 위험
- 필요한 evidence capture 목록

주의:
- 이 task는 "제안"만 한다.
- 실제 실행은 S2 정책/승인/executor를 거쳐야 한다.

## 5.5 `report-draft`

입력:
- 확정 findings
- gate results
- evidence summaries
- 승인/예외 기록

출력:
- 보고서 초안
- 경영층 요약
- 기술 부록 초안

---

## 6. API 계약 원칙

S3는 S2가 항상 일관된 인터페이스를 보게 해야 한다.

## 6.1 권장 엔드포인트

```text
GET  /v1/health
GET  /v1/models
GET  /v1/prompts
POST /v1/tasks/assess
POST /v1/tasks/plan
POST /v1/tasks/report
```

또는 task 통합 endpoint:

```text
POST /v1/tasks
```

어느 형태든 중요한 것은 **자유 텍스트 endpoint를 만들지 않는 것**이다.

## 6.2 요청 본문 예시

```json
{
  "taskType": "dynamic-annotate",
  "taskId": "task-001",
  "context": {
    "trusted": {},
    "untrusted": {}
  },
  "constraints": {
    "maxTokens": 4096,
    "timeoutMs": 15000,
    "allowedOutputSchema": "dynamic-annotate-v1"
  },
  "metadata": {
    "runId": "run-420",
    "promptVersion": "dyn-annotate-v3",
    "modelProfile": "qwen32b-default"
  }
}
```

## 6.3 응답 본문 예시

```json
{
  "taskId": "task-001",
  "taskType": "dynamic-annotate",
  "status": "completed",
  "modelProfile": "qwen32b-default",
  "modelBuild": "2026-02-10",
  "promptVersion": "dyn-annotate-v3",
  "schemaVersion": "dynamic-annotate-v1",
  "validation": {
    "valid": true,
    "errors": []
  },
  "result": {
    "summary": "....",
    "claims": [],
    "caveats": [],
    "confidence": 0.61,
    "recommendedNextActions": [],
    "evidenceRefs": ["evr-201", "evr-202"]
  },
  "audit": {
    "inputHash": "sha256:...",
    "createdAt": "..."
  }
}
```

---

## 7. Prompt / Model / Provenance 관리

S3는 prompt와 model을 운영 자산으로 관리해야 한다.

## 7.1 Prompt Template Versioning

필수:
- prompt id
- version
- description
- expected input schema
- expected output schema
- task type
- change log

금지:
- 운영 중인 prompt를 덮어쓰기
- 버전 없는 수동 프롬프트 수정
- task type과 무관한 재사용

## 7.2 Model Profile

필수:
- profile id
- provider/server
- model name
- build/version
- context limit
- timeout policy
- cost class
- allowed task types

예:
- `qwen32b-default`
- `qwen32b-longctx`
- `local-small-fast`

## 7.3 Provenance 메타데이터

응답마다 반드시 남길 것:

- taskId
- taskType
- model profile / build
- prompt version
- input hash
- evidence refs
- validator status
- createdAt
- latency
- token usage(가능하면)

---

## 8. 입력 보호와 Prompt Injection 대응

이 부분은 S3의 핵심 중 하나다.

## 8.1 컨텍스트 분리

입력 구성은 최소 아래처럼 분리할 것:

- system/policy instructions
- trusted structured context
- untrusted raw evidence excerpt
- output schema contract

금지:
- raw logs를 system instruction에 포함
- simulator의 자유 텍스트를 정책 문장과 혼합
- 사용자 텍스트를 prompt 상단의 권한 문장과 같은 계층에 두기

## 8.2 escape / delimit / label

untrusted 블록은 항상 명확히 경계를 둘 것.

예:
- `BEGIN_UNTRUSTED_EVIDENCE`
- `END_UNTRUSTED_EVIDENCE`

## 8.3 도구 사용 제한

향후 agent 확장 시에도:
- 모델이 임의 HTTP 호출을 직접 하지 못하게 할 것
- allowlist된 tool만 사용
- tool arguments는 schema validation
- tool result도 untrusted로 취급

---

## 9. Agent 확장 지침

사용자는 추후 agent 도입을 계획하고 있다.  
S3는 그 기반이 될 수 있지만, **planner까지만** 책임지는 것이 맞다.

## 9.1 Planner vs Executor 분리

S3는:
- 목표를 받아
- 실행 계획 초안(Scenario Proposal)을 생성할 수 있다.

S3가 해서는 안 되는 것:
- ECU에 직접 액션 실행
- 승인 우회
- 정책 위반 action 생성 후 자동 실행
- stateful long-running control loop를 단독 수행

## 9.2 Planner 출력은 DSL 또는 구조화 명령이어야 한다

예시 필드:
- steps[]
- requiredCapabilities[]
- requiredApprovals[]
- expectedEvidence[]
- stopConditions[]
- riskFlags[]

금지:
- 자연어 명령만 반환
- 실행 가능한 shell/ECU write command 그대로 반환

## 9.3 정책 연동

planner 결과는 S2에서 다음을 거쳐야 한다.

1. schema validation
2. policy evaluation
3. approval check
4. deterministic executor 변환
5. 실행

즉, S3가 행동을 "제안"하는 것은 가능하지만, 시스템 행동을 "결정"하면 안 된다.

---

## 10. 출력 검증

S3는 출력 검증 없이는 운영 투입하면 안 된다.

## 10.1 Schema Validation

필수:
- task별 output schema
- validation result 기록
- invalid output 재시도 또는 graceful failure 정책

## 10.2 semantic guard

가능하면 추가 검증:

- evidenceRefs가 실제 존재하는지
- confidence 범위가 0~1인지
- task type과 result field가 일치하는지
- forbidden field가 없는지
- action proposal이 허용 capability 안에 있는지

## 10.3 실패 처리

상태 예시:
- completed
- validation_failed
- timeout
- model_error
- budget_exceeded
- unsafe_output
- empty_result

중요:
- 실패 응답도 구조화되어야 한다.
- 텍스트 한 줄 에러로 끝내지 않는다.

---

## 11. 비용 / 성능 / 운영 제어

S3는 모델이 무한히 자원을 쓰지 못하게 해야 한다.

필수:
- timeout
- max tokens
- request size limit
- batch policy
- rate limit
- concurrency limit
- cache policy
- retry policy

권장:
- 동일 evidence hash에 대한 재사용 가능성 검토
- static explain / report draft 등 반복 작업 캐시
- long context 사용은 명시적 profile로 분리

---

## 12. S2와의 인터페이스 규칙

S3는 S2와 문서 기반 계약을 유지해야 한다.

## 12.1 입력 계약

S2가 보내야 하는 것:
- task type
- runId / findingId 등 상관관계 식별자
- evidence refs
- structured context
- policy constraints
- desired output schema

S3가 요구하면 안 되는 것:
- ECU 직접 연결 정보
- 인증 토큰 원문
- 백엔드 내부 DB 비밀값
- 프론트 화면 상태

## 12.2 응답 계약

S3가 반드시 반환해야 하는 것:
- 구조화된 assessment/proposal
- provenance
- validation result
- failure reason(실패 시)
- model/prompt metadata

---

## 13. 평가(Evaluation) 체계

S3는 모델이 붙었다고 끝나지 않는다.  
반드시 사내 평가 루프를 가져야 한다.

## 13.1 task별 golden set

최소 아래에 대해 평가셋을 만든다.

- static explain
- dynamic annotate
- cluster proposal
- test plan propose

## 13.2 평가 항목

- schema validity
- evidence grounding
- hallucination rate
- overclaim 빈도
- unsafe action suggestion rate
- latency
- token cost

## 13.3 회귀 감지

prompt 버전 또는 model profile 변경 시:
- 기존 golden set 재평가
- 성능/안전 변화 문서화
- task별 승격 기준 마련

---

## 14. 로깅 / 감사 / 관측성

S3는 아래를 남겨야 한다.

- request id / task id
- task type
- prompt version
- model profile / build
- latency
- token usage
- validation result
- retry 횟수
- failure code
- input hash
- evidence refs

민감정보 주의:
- 원문 전체를 무조건 로그에 남기지 않는다.
- 해시 / 샘플 / redacted 저장 전략 사용

---

## 15. 구현 우선순위

### 1단계
- task API 뼈대
- task type enum
- prompt registry
- model profile registry
- schema validation

### 2단계
- static-explain
- dynamic-annotate
- report-draft

### 3단계
- provenance / audit
- budget / timeout / cache
- input trust labeling

### 4단계
- test-plan-propose
- planner output DSL
- safety / policy integration 강화

### 5단계
- evaluation harness
- regression dashboard
- model 비교 실험 지원

---

## 16. 완료 기준 (Definition of Done)

S3 기능은 아래를 만족할 때 완료로 본다.

- S2가 stable task API를 사용할 수 있다.
- task별 prompt/version/schema가 분리되어 있다.
- 응답은 구조화되고 검증된다.
- untrusted input이 명확히 분리된다.
- provenance와 audit가 남는다.
- planner 출력이 executor 권한이 되지 않는다.
- 실패 모드가 구조화되어 있다.
- 평가셋 기반 회귀 검증이 가능하다.

---

## 17. S3에게 요구하는 태도

S3는 "모델이 똑똑하니 알아서 하겠지"라는 태도를 버려야 한다.

우선해야 할 것은 다음이다.

1. AI의 자유도를 줄일 것
2. 입력 신뢰도와 출력 검증을 강제할 것
3. provenance를 남길 것
4. planner와 executor를 분리할 것
5. 최종 판단권을 갖지 않을 것

S3의 목표는 가장 화려한 AI 기능이 아니라, **시스템이 AI를 통제 가능한 부품으로 사용할 수 있게 만드는 것**이다.
