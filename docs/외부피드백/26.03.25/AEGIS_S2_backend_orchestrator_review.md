# S2 리뷰: Backend / Main Orchestrator

## 검토 범위

- `docs/specs/backend.md`
- `docs/AEGIS.md`
- `docs/api/shared-models.md`
- `services/backend/src/index.ts`
- `services/backend/src/controllers/*`
- `services/backend/src/services/*`
- `services/backend/src/tests/*`
- `scripts/start.sh`, `scripts/stop.sh`

---

## 한 줄 판단

S2는 AEGIS의 **실질적인 플랫폼 커널**이다.  
좋은 의미에서 모든 흐름이 여기서 만나고, 나쁜 의미로는 시간이 지나면 모든 책임이 여기로 쏠릴 위험도 있다.  
지금은 설계가 매우 강하지만, 다음 단계의 핵심 과제는 **강한 오케스트레이터를 god service로 만들지 않는 것**이다.

---

## 지금 이미 잘 된 점

### 1. “source of truth” 역할이 문서뿐 아니라 코드에서 실제로 보인다

많은 프로젝트가 백엔드를 “중심”이라고 말만 하고 실제로는 단순 API 게이트웨이 수준에 머무른다.  
AEGIS의 S2는 그렇지 않다.

S2는 실제로 다음을 담당한다.

- 프로젝트/파일/타깃/런 관리
- 정적/동적 분석 흐름 시작
- 결과 정규화
- 품질 게이트 평가
- 승인/보고서 워크플로
- 하위 서비스 호출 조정
- 웹소켓 진행 상태 방송

즉, S2는 단순 CRUD 서버가 아니라 **시스템 상태 관리자**다.

### 2. 도메인 모델이 꽤 좋다

`runs`, `findings`, `evidence_refs`, `gate_results`, `approvals` 같은 개체는 이 프로젝트가 어디를 향하는지 잘 보여준다.  
이 모델은 단순 “도구 결과 저장소”가 아니라, **분석 근거와 인간 판단을 함께 관리하는 시스템**에 가깝다.

### 3. 오케스트레이션이 진짜로 존재한다

`analysis-orchestrator.ts`, `pipeline-orchestrator.ts`, `result-normalizer.ts`, `quality-gate.service.ts` 등을 보면 S2는 하위 서비스를 그냥 부르기만 하는 것이 아니라, **흐름의 단계와 결과 의미를 통제**한다.

이건 프로젝트의 품격을 결정하는 부분이다.

### 4. 운영 스크립트까지 포함해 전체 경험을 묶고 있다

`start.sh`/`stop.sh`가 단순 실행 스크립트를 넘어
- 순차 기동
- 포트 확인
- 실패 시 정리
- PID 관리
를 하고 있다는 점은 좋다.

즉, S2는 코드뿐 아니라 **전체 로컬 플랫폼 실행 경험**에도 관여한다.

---

## 서비스 경계 / 계약 관점 피드백

### 강한 점

S2는 정말로 중앙 허브 역할을 한다.  
S1은 S2만 바라보고, S3/S4/S5/S6/S7은 S2 또는 위임받은 호출자와 계약으로 연결된다.

이 구조는 매우 설득력 있다.  
특히 `docs/AEGIS.md`, `shared-models`, `backend.md`의 조합은 “누가 무엇을 소유하는가”를 꽤 명확히 만든다.

### 주의할 점

중앙 허브가 잘 작동할수록, 팀은 자꾸 S2에 새로운 책임을 밀어넣고 싶어진다.  
이건 자연스러운 현상이다. 하지만 AEGIS에서는 조심해야 한다.

S2에 계속 들어오기 쉬운 것들:
- 임시 변환 로직
- 화면 편의용 집계
- 하위 서비스별 예외 처리 특례
- 배포/설정 잡무
- 이벤트 포맷 임시 보정
- “일단 여기서 맞추자” 식의 호환 코드

이런 코드가 쌓이면 S2는 빠르게 무거워진다.  
따라서 앞으로는 “중앙에서 해야 할 일”과 “중앙에서 하면 안 되는 일”을 더 엄격히 나눠야 한다.

---

## 코드 레벨 상세 피드백

### 1. `src/index.ts`의 조립 범위가 크다

현재 composition root가 상당히 많은 의존성을 한 곳에서 묶는 구조로 보인다.  
초기에는 괜찮지만, 서비스가 더 커지면 아래 문제가 생긴다.

- 신규 개발자가 전체 구조를 파악하기 어려워짐
- 테스트 대체 구성(mock wiring)이 번거로워짐
- 설정/조립/라우팅/부트스트랩 책임이 한곳에 섞임
- 코드 리뷰 단위가 커짐

권장:
- `bootstrap/`
- `composition/`
- `routes/`
- `infrastructure/`
- `application/`
정도로 분리해서 “무엇을 어떻게 조립하는가”를 더 명시하라.

### 2. Quick → Deep 분석 설계는 좋지만, 상태 모델을 더 명시적으로 고정할 필요가 있다

`analysis-orchestrator.ts`는 좋은 설계다.  
빠른 정적 근거를 만들고, 그 뒤에 깊은 분석을 붙이는 구조는 AEGIS 철학과도 맞다.

다만 지금부터 중요한 것은 “흐름이 있다”가 아니라 “흐름이 계약으로 고정되어 있다”는 상태다.

예를 들면 다음은 명시적으로 고정될 가치가 있다.

- quick_sast
- quick_complete
- deep_submitting
- deep_analyzing
- deep_complete
- error

이런 단계 이름과 의미가 프런트, 백엔드, 에이전트, 보고서에서 조금씩 달라지기 시작하면 이후 유지보수가 매우 어려워진다.

### 3. `pipeline-orchestrator.ts`는 강하지만 더 플랫폼화될 수 있다

subproject, build target, code graph ingest까지 이어지는 흐름은 매우 좋다.  
특히 S4와 S5를 연결해 “스캔하고 끝”이 아니라 코드 그래프까지 적재하는 점이 좋다.

다만 이 로직은 나중에 다음 방향으로 정리할 가치가 있다.

- 실행 단계별 event schema 고정
- target별 결과 아카이브 구조화
- 실패와 부분 성공의 의미 정리
- 재실행 정책(idempotency) 명확화
- run과 target 사이의 참조 무결성 강화

즉, “동작하는 오케스트레이터”에서 “재실행 가능한 파이프라인 플랫폼”으로 가는 단계가 남아 있다.

### 4. `result-normalizer.ts`와 `quality-gate.service.ts`는 AEGIS의 중심 자산이다

이 둘은 과소평가하면 안 된다.  
SAST, 에이전트, KB, LLM이 아무리 좋아도 결과를 일관된 형태로 저장하고 판정하지 못하면 플랫폼은 무너진다.

좋은 점:
- finding, evidence, confidence, source를 정리하는 중심 계층이 존재한다
- false positive / accepted risk / sandbox 등을 severity 계산에서 다르게 취급하려는 설계 의도가 보인다
- 승인/보고서와 연결될 수 있는 도메인 기반이 이미 있다

권장:
- 이 영역을 가장 보수적으로 변경할 것
- unit/integration/contract test를 가장 두텁게 둘 것
- 가능한 한 shared model과 문서의 정합성을 자동 검증할 것

### 5. CORS와 운영 기본값은 지금 단계에서 정리해야 한다

연구용 로컬 환경에서는 이해되지만, 현재 형태는 서비스 간 호출을 내부 신뢰망 전제로 둔 구조다.  
이 방향 자체는 맞을 수 있으나, 공개 저장소 기준에서는 하드닝이 필요하다.

특히 다음은 빨리 정리할 가치가 있다.

- permissive CORS 기본값
- 내부 서비스 URL의 공개 노출 방식
- 환경 변수 기본값 문서화
- request timeout / retry / circuit policy의 표준화

---

## 데이터 모델 관점 피드백

S2는 AEGIS 전체 의미론을 가장 많이 가진 서비스다.  
따라서 다음 개체는 더 강하게 중심 모델이 되어야 한다.

- Project
- BuildTarget
- Run
- Finding
- EvidenceRef
- GateResult
- Approval
- ReportArtifact

그리고 각 개체에 대해 반드시 합의해야 하는 질문이 있다.

### Run
- Run은 사용자 요청 1회를 뜻하는가?
- target별 하위 실행을 포함하는 상위 개체인가?
- quick/deep/dynamic을 어떻게 묶는가?

### Finding
- finding identity는 어떻게 유지되는가?
- 재분석 시 같은 취약점의 동일성을 무엇으로 판단하는가?
- agent claim과 scanner finding을 같은 테이블로 섞는 방식이 최선인가?

### EvidenceRef
- 인용 가능한 최소 단위는 무엇인가?
- source file/line/function/CVE/graph node를 어떻게 통일하는가?

이 질문에 대한 답을 S2가 가장 명확히 가져야 한다.

---

## 우선순위 제안

### 바로 할 것

1. `index.ts` 조립 책임 분리  
2. run/progress/event 공유 모델 고정  
3. websocket 이벤트 명세를 shared contract로 승격  
4. CORS/환경설정 정리  
5. 하위 서비스 호출 client에 대한 contract test 강화

### 다음 단계

1. run journal 또는 event log 개념 정리  
2. partial success / retry / resume semantics 문서화  
3. target/subproject/run 관계를 더 명시적으로 모델링  
4. 보고서/승인 흐름을 플랫폼 수준의 state machine으로 승격

---

## 팀 내부에서 바로 토론할 질문

1. S2가 “source of truth”인 것은 맞다. 그런데 어디까지가 truth이고 어디부터는 단순 orchestration detail인가?  
2. `result-normalizer`와 `quality-gate`를 shared business core로 볼 것인가, 아니면 backend 내부 정책으로 둘 것인가?  
3. 현재 quick/deep/dynamic 세 흐름을 장기적으로 하나의 Run 모델 안에 어떻게 수렴시킬 것인가?

---

## 최종 판단

S2는 이미 단순 백엔드가 아니다.  
좋은 의미로 **플랫폼 커널**이다.

앞으로의 방향은 S2를 더 똑똑하게 만드는 것이 아니라,
**더 적은 책임으로도 더 중심적인 역할을 하게 만드는 것**이다.

즉:
- 상태는 더 강하게
- 조립은 더 얇게
- 계약은 더 엄격하게

이 방향으로 가면 S2는 오래 버티는 중심이 될 수 있다.
