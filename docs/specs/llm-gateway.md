# S3. LLM Gateway 기능 명세

> S3는 모델 서버를 감싸는 프록시가 아니라, AI 요청을 표준화하고,
> 입력 신뢰도와 출력 검증을 관리하며, provenance와 audit를 남기는 통제 계층이다.

---

## 1. S3의 역할

### 책임

- S2가 호출하는 안정적 Task API 제공
- Task type 기반 라우팅
- Prompt template versioning
- Model profile routing
- Context packaging + 입력 신뢰도 라벨링 (trusted / semi-trusted / untrusted)
- 구조화 출력 강제 + schema validation
- Confidence 산출 (grounding 기반)
- Provenance / audit metadata 생성
- Rate limit / token budget / timeout 관리
- Untrusted input 격리 (prompt injection 대응)
- Agent planner 출력의 제약 (test-plan-propose)

### 비책임

- ECU 직접 접근 또는 command 실행
- Finding 최종 확정 (finalSeverity, findingState)
- Quality gate / 승인 결정
- 정책 엔진 자체
- 프론트엔드 직접 대응

---

## 2. 핵심 원칙

### 2.1 LLM 결과는 Assessment

S3가 반환하는 것은 **판정(verdict)이 아니라 assessment(평가 제안)**이다.

허용:
- 취약점 설명, 이벤트 요약, anomaly 해석 가설
- 유사 finding 클러스터 제안, 테스트 시나리오 초안, 보고서 초안
- suggestedSeverity (제안형)

금지:
- "이것은 확정 취약점이다" 형태의 최종 판정
- evidence ref 없는 단정적 분석
- "이 액션을 즉시 실행해라" 같은 직접 제어 명령

### 2.2 입력 신뢰도 모델

| 수준 | 정의 | 예시 |
|------|------|------|
| trusted | S2가 정규화한 구조화 데이터 | structured finding, rule metadata, approved prompt variables |
| semi-trusted | 파싱/정규화된 로그 | parsed CAN logs, normalized evidence summary |
| untrusted | 원본 텍스트/바이너리 | raw logs, ECU payload dump, simulator text output, 사용자 자유 입력 |

- untrusted 입력은 system/policy instruction과 반드시 분리
- raw text를 system role에 섞지 않는다
- prompt injection 가능성을 전제로 설계

### 2.3 출력은 항상 구조화

- JSON object + JSON Schema validation
- 모든 응답에 provenance metadata 포함
- 실패 응답도 구조화 (텍스트 한 줄 에러 금지)

---

## 3. Task Type 체계

### V1 Allowlist

| Task Type | 목적 | 입력 핵심 | 출력 핵심 |
|-----------|------|----------|----------|
| `static-explain` | 정적 분석 finding 심층 설명 | finding summary, rule metadata, evidence refs, source snippet | 설명, 잠재 영향, 추가 검토 포인트, remediation 초안 |
| `static-cluster` | 유사 finding 그룹핑 제안 | finding 목록, 규칙/파일/모듈 메타데이터 | 유사 finding 묶음, 중복 가능성, 검토 우선순위 |
| `dynamic-annotate` | 동적 분석 이벤트 해석 | qualified event window, rule matches, baseline diff, evidence refs | 사건 요약, 원인 가설, 추가 확인 필요 신호, 인간 검토 필요 여부 |
| `test-plan-propose` | 테스트 시나리오 제안 | 목표, ECU capability, 현재 상태, 허용 action 범위, 정책 제약 | 실행 가능 시나리오 초안, 필요 승인, 예상 위험, evidence capture 목록 |
| `report-draft` | 보고서 초안 생성 | 확정 findings, gate results, evidence summaries, 승인/예외 기록 | 보고서 초안, 경영층 요약, 기술 부록 초안 |

### 운영 규칙

- unknown taskType → 4xx 거절
- taskType별 prompt template, output schema, validator를 분리
- 새 task type 추가 시 allowlist 등록 + schema + validator + 평가셋 필수

### 의도적 제외

| Task Type | 제외 사유 |
|-----------|----------|
| dynamic-cluster | stable event identity / dedupe 기준 미확립 |
| static-annotate | static-explain과 기능 중복 |
| severity-finalize | 최종 판정은 S2/policy 영역 |
| remediation-patch | 코드/명령 생성 리스크 |
| command-gen / payload-gen / script-gen | 금지 |
| freeform chat analyst mode | 범위 급팽창 |

### 향후 후보

- evidence-gap-detect
- finding-merge-suggest
- variant-delta-summary
- triage-note-draft

---

## 4. Assessment 모델

### 4.1 출력 최소 집합

모든 task의 응답 `result`에 포함되어야 하는 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| summary | string | 분석 요약 |
| claims | Claim[] | 증거가 지지하는 주장 |
| caveats | string[] | 한계, 불확실성 |
| usedEvidenceRefs | string[] | 분석에 사용된 evidence ref ID |
| suggestedSeverity | string? | 제안 심각도 (optional) |
| confidence | number | 0~1 운영용 신뢰 지표 |
| confidenceBreakdown | object | confidence 산출 내역 |
| needsHumanReview | boolean | 인간 검토 필요 여부 |
| recommendedNextSteps | string[] | 후속 조치 제안 |
| policyFlags | string[] | 정책 관련 플래그 |

### 4.2 Claim / Caveat

**Claim** — 증거가 실제로 지지하는 말:
- "관측 구간에서 SID 0x27 시도 후 반복된 부정 응답이 나타났으며, 이는 접근 거부 또는 잠금 상태와 일치하는 패턴이다."
- "해당 소스 스니펫에서 외부 입력 길이 검증 없이 복사 연산이 수행된다."

**Caveat** — 부족한 것, 말할 수 없는 것:
- "실 ECU 내부 로그가 없어 reset의 직접 원인은 확인되지 않았다."
- "시뮬레이터 환경에서만 재현되었으므로 하드웨어 타깃 일반화는 불가하다."
- "증거는 비정상 패턴을 시사하지만 exploitability를 입증하지는 않는다."

### 4.3 Confidence 산출

S3가 계산한다. LLM self-score에 맡기지 않는다.

```
confidence =
    0.45 × grounding
  + 0.30 × deterministicSupport
  + 0.15 × consistency
  + 0.10 × schemaCompliance
```

| 항목 | 산출 기준 |
|------|----------|
| grounding | claim이 valid evidenceRefs에 연결되는 정도 |
| deterministicSupport | S2가 준 rule hits / anomaly score와의 부합도 |
| consistency | 동일 입력 2회 low-temp 실행 결과의 semantic consistency |
| schemaCompliance | JSON 파싱 성공 + 필수 필드 완전성 |

**강한 규칙:**
- unknown evidence ref가 하나라도 있으면 → reject 또는 confidence=0
- evidenceRefs가 없으면 → confidence 상한 제한
- test-plan-propose → confidence 상한 제한 (본질적으로 advisory)
- report-draft의 confidence → "grounded draft quality"로 해석

**반환 필드:**
- confidence, confidenceBreakdown
- selfReportedConfidence (optional, 모델이 줄 경우)
- needsHumanReview

### 4.4 Evidence Refs

**입력 측 — S2가 제공하는 안정적 식별자:**

| 필드 | 타입 | 설명 |
|------|------|------|
| refId | string | evidence 참조 ID |
| artifactId | string | 원본 아티팩트 ID |
| artifactType | string | raw-source, raw-can-window, test-result 등 |
| locatorType | string | lineRange, frameWindow, requestResponsePair 등 |
| locator | object | 위치 지정 (타입별 상이) |
| hash | string? | 원본 해시 (가능하면) |
| label | string? | 사람이 읽을 수 있는 라벨 |

**출력 측 규칙:**
- S3는 새 evidence identity를 발명하면 안 된다
- 입력으로 받은 refId를 그대로 인용
- 같은 artifactId 아래 더 좁은 locator 제안은 허용
- usedEvidenceRefs로 subset 반환

**Hallucination 대응:**
- validator가 allowed refId set을 보유
- 응답 파싱 후 refId 유효성 검사
- unknown ref → invalid_grounding 처리
- 모델에게 evidence refs를 enum/list로 제공 (자유 텍스트 인용 대신 refId 선택)

---

## 5. API 설계

상세 스키마는 [API 명세서](../api/llm-gateway-api.md)를 참조한다. 여기서는 설계 원칙만 기술한다.

### 5.1 엔드포인트

```
GET  /v1/health
GET  /v1/models
GET  /v1/prompts
POST /v1/tasks
```

자유 텍스트 엔드포인트를 만들지 않는다. 모든 요청은 taskType 기반으로 라우팅된다.

### 5.2 응답 구조 원칙

모든 응답은 다음을 포함한다:
- taskId, taskType, status
- modelProfile, promptVersion, schemaVersion
- validation (valid + errors)
- result (assessment 본문)
- audit (inputHash, latencyMs, tokenUsage, createdAt)

### 5.3 실패 모드

| status | 의미 |
|--------|------|
| completed | 정상 완료 |
| validation_failed | 출력 스키마/시맨틱 검증 실패 |
| timeout | 시간 초과 |
| model_error | LLM 호출 실패 |
| budget_exceeded | 토큰 예산 초과 |
| unsafe_output | 안전하지 않은 출력 감지 |
| empty_result | 빈 결과 |

실패 응답도 구조화된 JSON으로 반환한다 (failureCode, failureDetail, audit 포함).

---

## 6. Prompt / Model / Provenance 관리

### 6.1 Prompt Template Versioning

각 prompt template에 필요한 메타데이터:

| 필드 | 설명 |
|------|------|
| promptId | 고유 식별자 |
| version | 버전 (semver) |
| taskType | 대응하는 task type |
| description | 설명 |
| expectedInputSchema | 기대 입력 스키마 |
| expectedOutputSchema | 기대 출력 스키마 |
| changeLog | 변경 이력 |

금지:
- 운영 중인 prompt 덮어쓰기
- 버전 없는 수동 수정
- task type과 무관한 재사용

### 6.2 Model Profile

| 필드 | 설명 |
|------|------|
| profileId | 프로필 식별자 (예: `Qwen/Qwen3.5-35B-A3B-FP8-default`) |
| provider | 제공자/서버 |
| modelName | 모델명 |
| build | 빌드/버전 |
| contextLimit | 컨텍스트 토큰 한도 |
| timeoutPolicy | 타임아웃 정책 |
| costClass | 비용 등급 |
| allowedTaskTypes | 허용 task type 목록 |

### 6.3 Provenance 메타데이터

응답마다 반드시 기록:

- taskId, taskType
- model profile / build
- prompt version
- input hash
- evidence refs
- validator status
- createdAt, latencyMs
- token usage (가능하면)
- retry count
- failure code (실패 시)

민감정보 주의:
- 원문 전체를 무조건 로그에 남기지 않는다
- 해시 / 샘플 / redacted 저장 전략 사용

---

## 7. 입력 보호

### 7.1 컨텍스트 분리

프롬프트 구성은 최소 다음으로 분리:

1. system/policy instructions (trusted)
2. structured context (trusted / semi-trusted)
3. untrusted raw evidence (경계 표시 포함)
4. output schema contract

금지:
- raw logs를 system instruction에 포함
- simulator 자유 텍스트를 정책 문장과 혼합
- 사용자 텍스트를 prompt 상단 권한 문장과 같은 계층에 배치

### 7.2 Untrusted 블록 경계

untrusted 구간에 delimiter를 표시한다:

```
BEGIN_UNTRUSTED_EVIDENCE
(원본 데이터)
END_UNTRUSTED_EVIDENCE
```

이 delimiter는 **보조 수단**이지 보안 경계가 아니다.

### 7.3 실질적 방어 (LLM 밖 코드)

1. task allowlist (unknown task 거절)
2. strict JSON schema validation
3. evidence ref whitelist
4. deterministic policy layer (S2)
5. tool execution authority를 S3 밖으로 분리
6. prompt에 sensitive secret/permission logic 미포함
7. untrusted content를 가능한 한 구조화된 object로 변환 후 제공

---

## 8. Agent Planner (test-plan-propose)

### 8.1 역할 분리

- **S3 (Planner)**: 무엇을 시험할지 제안
- **S2 (Executor)**: 어떻게 wire-level payload로 구현할지 담당

### 8.2 허용되는 출력 수준 (중수준 structured plan)

- 목표, 가설
- 대상 프로토콜/서비스 이름
- 필요 전제조건, 관측해야 할 evidence
- 안전 제약, 중단 조건
- executor template ID, 우선순위, 예상 위험도

### 8.3 금지되는 출력

- 실제 CAN frame 바이트열
- shell command, ECU write payload
- seed/key 계산 결과
- 바로 실행 가능한 스크립트

### 8.4 Planner 출력 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| objective | string | 테스트 목표 |
| hypotheses | string[] | 검증할 가설 |
| targetProtocol | string | 대상 프로토콜 |
| targetServiceClass | string | 대상 서비스 분류 |
| preconditions | string[] | 전제 조건 |
| dataToCollect | string[] | 수집할 데이터 |
| stopConditions | string[] | 중단 조건 |
| safetyConstraints | string[] | 안전 제약 |
| suggestedExecutorTemplateIds | string[] | 제안 executor 템플릿 |
| suggestedRiskLevel | string | 예상 위험 수준 |

### 8.5 정책 연동

planner 결과는 S2에서 다음을 거친다:

1. schema validation
2. policy evaluation
3. approval check
4. deterministic executor 변환
5. 실행

S3가 행동을 "제안"하는 것은 가능하지만, 시스템 행동을 "결정"하면 안 된다.

---

## 9. 출력 검증

### 9.1 Schema Validation

- task별 output schema 정의
- validation result를 응답에 포함
- invalid output → 재시도 또는 graceful failure

### 9.2 Semantic Guard

- evidenceRefs가 allowed set에 존재하는지
- confidence 범위 0~1
- task type과 result field 일치
- forbidden field 부재
- action proposal이 허용 capability 내

### 9.3 실패 처리

모든 실패는 구조화된 응답으로 반환한다. 텍스트 한 줄 에러로 끝내지 않는다.

---

## 10. 운영 제어

| 항목 | 설명 |
|------|------|
| timeout | task별 시간 제한 |
| max tokens | 요청/응답별 토큰 한도 |
| request size limit | 요청 본문 크기 제한 |
| rate limit | 단위 시간당 요청 수 제한 |
| concurrency limit | 동시 처리 수 제한 |
| cache policy | 동일 evidence hash 재사용 검토 |
| retry policy | 실패 시 재시도 전략 |

---

## 11. 평가 체계

### 11.1 Golden Set

task별 최소 규모:

| Task Type | 최소 건수 |
|-----------|----------|
| static-explain | 10 |
| dynamic-annotate | 10 |
| test-plan-propose | 10 |
| static-cluster | 5~10 (여력 시) |
| report-draft | 5 (여력 시) |

rubric 기반 평가 (정답 문장 고정이 아님):
- 반드시 언급해야 할 key point
- 절대 주장하면 안 되는 point
- 허용 evidence refs
- 최소 caveat 요구사항
- schema validity 기대

### 11.2 평가 항목

| 항목 | 설명 | 비고 |
|------|------|------|
| schema validity | JSON 파싱 + 스키마 적합 | **배포 차단 기준** |
| evidence grounding | 근거 없는 주장 비율 | **품질 1순위** |
| hallucination rate | grounding failure 하위 범주로 관리 | |
| overclaim 빈도 | 과도한 단정 비율 | |
| unsafe action suggestion rate | 위험 실행 정보 생성 비율 | |
| latency | 응답 소요 시간 | |
| token cost | 토큰 사용량 | |

### 11.3 회귀 감지

prompt/model/parser 변경 시:
- 기존 golden set 재평가
- 성능/안전 변화 문서화
- task별 승격 기준 마련

---

## 12. 구현 로드맵

### 1단계: Task API 뼈대

- task type enum + allowlist
- `POST /v1/tasks` 엔드포인트
- prompt registry 구조
- model profile registry 구조
- schema validation 프레임워크

### 2단계: 핵심 Task 구현

- static-explain
- dynamic-annotate
- report-draft

### 3단계: Provenance / Audit / Trust

- provenance metadata 생성
- budget / timeout / cache
- input trust labeling
- confidence 산출

### 4단계: Planner + Safety

- test-plan-propose
- planner output DSL
- static-cluster
- safety / policy integration

### 5단계: Evaluation

- evaluation harness
- golden set 관리
- regression 검증
- model 비교 실험

---

## 13. 성공 기준

### 초기 성공 기준 (3대 원칙)

1. 항상 파싱 가능할 것
2. 항상 supplied evidence 안에서만 말할 것
3. 위험한 구체 실행정보를 내놓지 않을 것

### 완료 기준 (Definition of Done)

- S2가 stable task API를 사용할 수 있다
- task별 prompt/version/schema가 분리되어 있다
- 응답은 구조화되고 검증된다
- untrusted input이 명확히 분리된다
- provenance와 audit가 남는다
- planner 출력이 executor 권한이 되지 않는다
- 실패 모드가 구조화되어 있다
- 평가셋 기반 회귀 검증이 가능하다

---

## 14. 현재 구현 상태 (as-is)

v0 코드는 완전 제거됨 (2026-03-13). 현재 v1 Task API만 운영 중.

### API

- `POST /v1/tasks` — Task 기반 AI 분석 요청 (5개 taskType)
- `GET /v1/health` — 서비스 상태 + vLLM 백엔드 연결 상태
- `GET /v1/models` — 등록된 model profile 목록
- `GET /v1/prompts` — 등록된 prompt template 목록

### LLM 백엔드

- **vLLM + Qwen3.5-35B-A3B FP8** (DGX Spark, 포트 8000)
- OpenAI-compatible `/v1/chat/completions` 프로토콜
- `RealLlmClient`: thinking 제어(`chat_template_kwargs`), structured output(`response_format: json_object`), 토큰 캡처
- `Semaphore(1)` — 단일 GPU 환경에서 순차 처리

### LLM 모드

| 모드 | 클라이언트 | 용도 |
|------|-----------|------|
| `mock` | V1MockDispatcher | 개발/테스트 |
| `real` | RealLlmClient | **운영** (vLLM) |

---

## 관련 문서

- [전체 개요](technical-overview.md)
- [S2. Core Service](backend.md)
- [S3 API 명세](../api/llm-gateway-api.md)
- [외부 피드백 원본](../외부피드백/S3_llm_gateway_working_guide.md)
