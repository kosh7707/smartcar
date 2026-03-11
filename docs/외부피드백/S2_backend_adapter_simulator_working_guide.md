# S2 작업 지침서 — Backend + ECU Adapter + ECU Simulator

## 1. 문서 목적

이 문서는 S2가 담당하는 **Backend, ECU Adapter, ECU Simulator** 영역의 책임 범위, 필수 구현 항목, 아키텍처 원칙, 데이터 모델, 협업 규칙, 안전 요구사항을 명확히 정의하기 위한 작업 지침서다.

S2는 사실상 이 플랫폼의 코어다.  
S1이 표현 계층이고, S3가 AI 경계 계층이라면, S2는 **플랫폼의 진실원(source of truth)** 을 만든다.

핵심 문장:

> **S2의 최우선 목표는 "분석을 수행하는 것"이 아니라, 분석/테스트/LLM 결과를 Evidence, Findings, Policy, Quality Gate, Approval 구조로 관리 가능하게 만드는 것이다.**

---

## 2. S2의 시스템 내 역할

S2는 아래를 책임진다.

### Backend
- 프로젝트 / ECU / firmware / run 관리
- findings 라이프사이클 관리
- evidence / artifact 메타데이터 관리
- quality gate 평가
- approval workflow 관리
- S1에 제공되는 REST API 및 WebSocket 스트림 제공
- 실시간 이벤트 fan-out
- 분석/테스트 job orchestration

### ECU Adapter
- 실제 ECU 또는 외부 툴(CANoe 등)과 연결되는 **정규화된 인터페이스 계층**
- capability discovery
- diagnostic / capture / stimulus / replay / fault injection 요청의 정규화
- 안전 제어(safety arm/disarm, permission level)
- 실제 장비 연결 이전에도 백엔드가 동일한 계약을 소비하도록 보장

### ECU Simulator
- 임시 mock이 아니라 **계약 시뮬레이터 + fault model simulator + replay bench**
- 실제 ECU 연결 전 개발/테스트 환경 제공
- 정상 흐름뿐 아니라 오류/지연/비정상 응답/재부팅/락아웃 상태 재현
- 회귀 테스트와 재현 테스트의 기준 환경 제공

---

## 3. S2의 성공 기준

S2가 잘 되어 있다고 볼 수 있는 기준은 다음과 같다.

1. 특정 finding이 생기면 **어떤 run, 어떤 artifact, 어떤 evidence ref, 어떤 엔진/규칙/모델 버전에서 나왔는지 추적 가능**해야 한다.
2. 정적 분석 / 동적 분석 / 동적 테스트 결과를 **하나의 findings lifecycle** 로 다룰 수 있어야 한다.
3. LLM이나 agent가 들어오더라도, **직접 ECU를 제어하지 못하고 정책/승인 경계를 통과해야 한다.**
4. Backend가 ECU 벤더 도구 의미론에 종속되지 않아야 한다.
5. Simulator만으로도 frontend 및 LLM-Gateway 개발을 상당 부분 진행할 수 있어야 한다.
6. 실시간 경로에서 이벤트 누락, backlog, reconnect, validation failure가 **숨겨지지 않고 드러나야 한다.**

---

## 4. 내부 아키텍처 원칙

S2 내부는 한 덩어리로 보이더라도, 논리적으로 아래 5개를 분리해서 생각해야 한다.

## 4.1 Control Plane

역할:
- 프로젝트/리소스 CRUD
- run 생성
- findings 조회 및 triage
- quality gate 조회
- approval 요청/결정
- 설정/정책 조회

권장 인터페이스:
- REST API

## 4.2 Data Plane

역할:
- 실시간 packet / event / log 수집
- rule match 생성
- qualified event 생성
- stream fan-out
- backpressure 및 drop 관리

권장 인터페이스:
- WebSocket 이벤트 스트림
- 내부적으로는 queue/event bus 가능

## 4.3 Orchestration Plane

역할:
- run 상태머신
- job scheduling
- long-running task 상태 관리
- 단계별 artifact 생성 추적

## 4.4 Adapter Plane

역할:
- ECU / 외부 툴과의 통신 정규화
- capability 기반 접근
- 세션/안전 관리

## 4.5 Simulation Plane

역할:
- 계약 검증용 시뮬레이션
- replay
- fault injection
- deterministic test environment

중요:
- 하나의 Express 서버에 다 넣을 수는 있어도, **논리 경계는 반드시 코드 구조로 분리**되어야 한다.
- `Controller -> Service -> DAO` 수준으로만 끝내지 말고, 도메인 경계를 명시해야 한다.

---

## 5. 반드시 도입해야 할 핵심 도메인 모델

S2는 아래 엔티티를 1급 시민으로 다뤄야 한다.

## 5.1 Project / ECU / Firmware

- `Project`
- `ECU`
- `ECUVariant`
- `Firmware`
- `Build`
- `Environment` (simulator / real ECU / lab profile)

필수 필드 예시:

```json
{
  "ecuId": "ecu-abs-01",
  "variant": "ABS-v2",
  "firmwareVersion": "1.4.8",
  "buildHash": "sha256:...",
  "environment": "simulator"
}
```

## 5.2 Run

분석/테스트 실행 단위다.

필수 필드:

- runId
- runType: `static-analysis | dynamic-analysis | dynamic-test`
- target ECU / firmware
- environment
- requestedBy
- startedAt / endedAt
- status
- rulePackVersion
- promptVersion (있다면)
- modelProfile (있다면)

권장 상태:

- queued
- running
- waiting_approval
- paused
- failed
- completed
- aborted
- needs_revalidation

## 5.3 Artifact

원시 또는 파생 산출물 저장 단위다.

필수 필드:

- artifactId
- runId
- artifactType
- contentType
- uri
- sha256
- size
- sourceComponent
- createdAt
- immutable flag
- retention policy

artifact type 예시:

- source-snapshot
- sarif-report
- raw-capture
- parsed-capture
- log-window
- rule-match-set
- replay-seed
- llm-request
- llm-response
- simulator-state-dump

## 5.4 EvidenceRef

finding이 참조하는 근거 위치 정보다.

예시:

```json
{
  "evidenceRefId": "evr-203",
  "artifactId": "art-102",
  "locatorType": "line-range",
  "locator": {
    "startLine": 141,
    "endLine": 159
  }
}
```

locatorType 예시:
- line-range
- byte-range
- packet-range
- timestamp-window
- json-path
- request-response-pair

## 5.5 Finding

시스템이 관리하는 최종 이슈 단위다.

필수 필드:

- findingId
- title
- summary
- sourceType: `static-analyzer | rule-engine | llm-assist | human`
- category
- severity
- confidence
- status
- runId
- ecuId
- firmwareId
- evidenceRefs[]
- createdAt / updatedAt

권장 상태:

- Open
- Needs Review
- Accepted Risk
- False Positive
- Fixed
- Needs Revalidation
- Sandbox

중요:
- `llm-assist`만 근거인 finding은 기본적으로 `Sandbox` 또는 `Needs Review`에서 시작해야 한다.

## 5.6 Assessment / Approval / GateResult

추가 도메인 모델:

- `Assessment`: 분석 엔진 또는 LLM이 내린 구조화된 해석
- `ApprovalRequest`: 고위험 action 또는 override 승인 요청
- `ApprovalDecision`: 승인/거부/만료 기록
- `GateResult`: 정책 평가 결과

---

## 6. 증적(Evidence) 관리 원칙

S2는 evidence-first 원칙을 강제해야 한다.

## 6.1 원시 증적과 파생 증적 구분

원시 증적:
- raw packet capture
- raw logs
- 원본 analyzer output
- fuzz seed input
- source snapshot
- simulator raw trace

파생 증적:
- parsed capture
- rule match result
- anomaly cluster
- normalized SARIF-like result
- LLM annotation

원칙:
- 파생 결과는 원시 증적으로 역추적 가능해야 한다.
- finding은 evidenceRef를 반드시 하나 이상 가져야 한다.
- evidence 없는 finding 생성은 예외적이어야 하며, 이 경우 명시적으로 `evidenceMissing=true` 같은 플래그를 둔다.

## 6.2 무결성

필수:

- artifact SHA-256 저장
- 생성 시각 기록
- source component 기록
- 변경 불가 저장 전략 또는 append-only 메타 기록
- 삭제/만료 정책 명시

## 6.3 재현성

특히 동적 테스트에서는 아래를 남겨야 한다.

- seed
- mutation profile
- request sequence
- timing
- session state
- simulator / adapter / lab profile

---

## 7. Backend API 책임

## 7.1 S1이 보게 될 주 API 범주

- Projects API
- ECU / Firmware API
- Runs API
- Findings API
- Artifacts / Evidence API
- Quality Gates API
- Approvals API
- Stream Subscription API (보조 또는 WS 핸드셰이크용)

예시 엔드포인트:

```text
GET    /api/projects
GET    /api/ecus/:ecuId
GET    /api/runs/:runId
POST   /api/runs
GET    /api/runs/:runId/events
GET    /api/findings
GET    /api/findings/:findingId
PATCH  /api/findings/:findingId/status
GET    /api/artifacts/:artifactId
GET    /api/quality-gates/:scopeId
POST   /api/approvals
POST   /api/approvals/:approvalId/decision
```

중요:
- 프론트는 S2 백엔드만 바라본다.
- 프론트가 adapter나 simulator를 직접 호출하게 두지 않는다.
- 프론트가 S3 LLM-Gateway를 직접 호출하게 두지 않는다.

---

## 8. WebSocket / 실시간 경로 요구사항

사용자가 이미 WebSocket을 사용 중이므로, S2는 실시간 경로를 **운영 가능한 스트림**으로 만들어야 한다.

## 8.1 이벤트 envelope 표준화

최소 구조 예시:

```json
{
  "eventId": "evt-001",
  "runId": "run-420",
  "sequence": 1024,
  "timestamp": "2026-03-09T10:11:12.000Z",
  "source": "adapter",
  "type": "capture.frame.received",
  "payload": {}
}
```

필수 필드:
- eventId
- runId
- sequence
- timestamp
- source
- type
- payload

## 8.2 이벤트 타입 계층

이벤트 타입은 최소 다음 범주를 가진다.

- run
- capture
- rule
- finding
- approval
- adapter
- simulator
- llm
- system

예:
- `run.status.changed`
- `capture.frame.received`
- `capture.backpressure.notice`
- `rule.matched`
- `finding.created`
- `approval.required`
- `adapter.connection.changed`
- `simulator.fault.injected`
- `llm.annotation.completed`
- `system.validation.failed`

## 8.3 실시간 경로에서 반드시 처리해야 할 것

- sequence gap detection
- reconnect
- idempotent event handling
- backpressure metric
- drop count event
- stream health reporting

중요:
- drop이 생기면 조용히 버리지 말 것
- "drop이 생겼다" 자체가 시스템 이벤트로 남아야 함

---

## 9. Findings 라이프사이클

S2는 정적/동적/테스트 결과를 하나의 lifecycle로 관리해야 한다.

권장 상태 전이:

- Open → Needs Review
- Needs Review → Accepted Risk
- Needs Review → False Positive
- Needs Review → Fixed
- Fixed → Needs Revalidation
- Sandbox → Needs Review

주의:
- 상태 변경에는 actor, reason, timestamp를 남길 것
- LLM이 상태를 직접 바꾸지 못하게 할 것
- bulk triage도 audit trail 남길 것

필수 감사 로그:

```json
{
  "findingId": "f-10",
  "fromStatus": "Needs Review",
  "toStatus": "Accepted Risk",
  "by": "user:alice",
  "reason": "Known supplier limitation",
  "at": "..."
}
```

---

## 10. Quality Gate

Quality Gate는 단순 집계가 아니라 정책 엔진이다.

필수 요구사항:

- run 단위, firmware 단위, ECU 단위로 평가 가능
- pass / fail / warning / blocked 구분
- 어떤 규칙 때문에 실패했는지 설명
- override가 있으면 남길 것
- AI-only finding은 기본적으로 gate 미반영 또는 별도 규칙으로 처리

예시 규칙:
- 신규 Critical finding 1건 이상이면 fail
- 승인되지 않은 active-test finding이 존재하면 blocked
- evidence missing finding이 존재하면 warning 또는 fail
- raw artifact hash 누락 시 fail
- LLM-only finding은 review 전 gate 미반영

---

## 11. Approval / Policy Engine

이 부분은 매우 중요하다.  
현재 사용자가 요약한 핵심 문제 중 하나가 바로 "LLM/Agent 권한 명세 부재"이므로, S2는 이를 **정책 + 승인 모델**로 고정해야 한다.

## 11.1 승인 필요한 액션 예시

- 실제 ECU 대상 active diagnostic write
- fuzzing 시작
- fault injection
- programming session 진입
- replay to real ECU
- gate override
- accepted risk 확정

## 11.2 ApprovalRequest 필수 필드

- approvalId
- actionType
- requestedBy
- targetScope
- riskLevel
- reason
- expiresAt
- linkedEvidenceRefs
- status

## 11.3 정책 엔진 최소 기능

- 대상 환경이 simulator인지 real ECU인지
- action type이 허용된 것인지
- 현재 시간/랩 상태/사용자 role이 허용하는지
- kill switch armed 상태인지
- ECU capability가 실제로 있는지

중요:
- S3 또는 LLM이 "이 액션을 하라"고 제안할 수는 있어도, **S2 정책 엔진을 통과하지 못하면 실행되면 안 된다.**

---

## 12. ECU Adapter 설계 지침

Adapter의 목표는 외부 툴/장비의 차이를 숨기는 것이지, 백엔드가 특정 벤더 의미론을 배우게 만드는 것이 아니다.

## 12.1 Adapter가 제공해야 할 핵심 capability

- `health.status`
- `capability.list`
- `session.open`
- `session.close`
- `capture.start`
- `capture.stop`
- `stream.subscribe`
- `stream.unsubscribe`
- `diag.request`
- `stimulus.send`
- `replay.start`
- `replay.stop`
- `fault.inject`
- `safety.arm`
- `safety.disarm`

각 capability는 아래 권한 수준을 가져야 한다.

- read-only
- diagnostic
- active-test
- programming

## 12.2 Backend가 알아야 하는 것은 capability이지 벤더 API가 아니다

금지:
- backend service 내부에 CANoe 전용 개념 직접 매핑
- 특정 벤더 오류 코드를 그대로 UI로 노출
- 벤더별 분기문이 backend 전역에 퍼지는 것

필수:
- adapter 응답을 canonical error / canonical status로 정규화
- capability discovery 제공
- 연결 상태 heartbeat 제공

## 12.3 안전 제어

실제 ECU 연결 시 필수:
- dry-run mode
- safety guard
- session timeout
- max request rate
- emergency stop
- replay confirmation

---

## 13. ECU Simulator 설계 지침

Simulator는 "가짜 ECU 응답 몇 개 주는 서버"가 아니다.  
아래 네 역할을 동시에 수행해야 한다.

1. 계약 시뮬레이터
2. fault model simulator
3. replay bench
4. 회귀 테스트 환경

## 13.1 반드시 지원해야 할 시나리오

정상:
- 기본 request-response
- 세션 전환
- 상태 조회

비정상:
- timeout
- delayed response
- malformed frame
- negative response burst
- security access failure
- ECU reset
- watchdog reboot
- session lockout
- intermittent failure
- partial stream drop

## 13.2 replay 기능

필수:
- 저장된 raw capture 또는 normalized sequence를 재생
- deterministic seed 지원
- 동일 재현을 위한 timing profile 제공
- replay id / replay artifact 남김

## 13.3 Simulator 상태 공개

프론트/백엔드가 볼 수 있어야 할 상태:
- current profile
- fault mode
- session state
- reset count
- injected anomalies
- last action
- deterministic seed

---

## 14. 정적 분석 흐름 (S2 관점)

기본 파이프라인:

1. 소스 / 빌드 메타 수집
2. analyzer 실행 또는 import
3. analyzer 결과 원본 artifact 저장
4. canonical finding schema로 정규화
5. evidence ref 생성
6. finding 생성/병합
7. quality gate 반영
8. 필요 시 S3에 설명/클러스터링 요청

주의:
- S3가 finding truth를 만들지 않는다.
- analyzer 원본 결과를 항상 보존할 것
- baseline/delta 비교를 고려할 것

---

## 15. 동적 분석 흐름 (S2 관점)

기본 파이프라인:

1. adapter/simulator capture 시작
2. raw event / frame ingest
3. raw artifact 저장
4. rule engine / threshold / correlation 처리
5. qualified event 생성
6. finding 후보 생성
7. evidence ref 연결
8. 필요 시 S3에 annotation 요청
9. quality gate / notifications 갱신

핵심 원칙:
- raw stream과 qualified stream을 구분할 것
- LLM은 raw flood를 직접 먹지 않음
- event window 단위로 annotation 요청할 것

---

## 16. 동적 테스트 / 퍼징 흐름 (S2 관점)

기본 파이프라인:

1. 시나리오 정의 또는 S3 planner 제안 수신
2. 정책 검증
3. 승인 필요 시 waiting_approval
4. deterministic executor 실행
5. request/response/state/evidence 수집
6. anomaly / crash / reset 분석
7. finding 생성
8. replay 가능한 artifact 저장

중요:
- executor는 deterministic해야 한다.
- 자유 텍스트 명령 실행 금지
- fuzzing payload와 결과를 재현 가능하게 남길 것

---

## 17. S2와 S1/S3 협업 규칙

## 17.1 S1과의 관계

- S1은 S2 API/WS를 통해서만 상태를 본다.
- shared 변경 시 반드시 문서화
- 이벤트 타입 변경 시 migration note 작성
- mock payload 샘플 제공

## 17.2 S3와의 관계

- S2가 S3에게 보내는 것은 "정제된 과업(task)"이어야 한다.
- raw uncontrolled log dump를 바로 던지지 않는다.
- S3의 응답은 구조화되어야 하며 검증 후 저장
- S3 응답은 assessment로 저장하고, 즉시 finding 확정으로 승격하지 않는다.

---

## 18. 테스트 전략

## 18.1 단위 테스트

대상:
- domain service
- policy evaluator
- gate evaluator
- evidence locator builder
- finding dedupe
- adapter response mapper
- simulator state machine

## 18.2 계약 테스트

필수:
- backend REST contract
- websocket event contract
- adapter canonical contract
- simulator contract
- S3 request/response schema contract

## 18.3 통합 테스트

최소 시나리오:
1. 정적 분석 import → finding 생성 → gate 반영
2. simulator 동적 분석 → rule match → finding 생성
3. approval required → run paused → 승인 후 재개
4. S3 annotation → validation → assessment 저장
5. replay seed 기반 재현 성공

## 18.4 회귀 테스트

- event type compatibility
- shared schema compatibility
- rule pack version upgrade 영향
- simulator profile 변경 영향

---

## 19. 우선 구현 순서

### 1단계: 코어 도메인 확정
- Run / Artifact / EvidenceRef / Finding / Gate / Approval 모델 정의
- 공통 enum/status 확정
- 문서화 체계 확정

### 2단계: Backend MVP
- Projects / Runs / Findings / Artifacts / Gate / Approval API
- WebSocket event envelope
- audit log 기초

### 3단계: Adapter MVP
- capability.list
- capture.start/stop
- diag.request
- stimulus.send
- health.status

### 4단계: Simulator MVP
- normal flow
- timeout / delay / negative response
- reset / reboot / security access failure
- replay

### 5단계: Rule / Policy / Orchestration 강화
- rule engine
- gate evaluator
- approval workflow
- kill switch

---

## 20. 완료 기준 (Definition of Done)

S2 기능은 아래를 만족할 때 완료로 본다.

- finding이 evidenceRef 없이 생성되지 않는다.
- run / artifact / finding / approval / gate 관계가 추적 가능하다.
- WebSocket 이벤트에 sequence, timestamp, type이 있다.
- drop/backpressure가 드러난다.
- adapter 계약이 canonical capability 중심으로 정리되어 있다.
- simulator가 정상/비정상/재현 시나리오를 지원한다.
- S3가 제안한 action은 정책/승인 경계를 통과해야만 실행된다.
- shared 변경이 문서화된다.
- 감사 로그가 남는다.

---

## 21. S2에게 요구하는 태도

S2는 "빨리 동작하게 만드는 것"보다 아래를 우선해야 한다.

1. 진실원과 추적성을 만들 것
2. 벤더 의존을 canonical contract 뒤로 숨길 것
3. 실시간 경로의 누락/과부하를 감추지 않을 것
4. AI/Agent 권한을 정책/승인으로 고정할 것
5. 시뮬레이터를 버릴 코드로 만들지 않을 것

이 시스템의 코어는 결국 S2가 만드는 **Evidence + Findings + Quality Gate + Policy + Approval** 구조다.
