# S7 리뷰: LLM Gateway / LLM Engine

## 검토 범위

- `docs/specs/llm-gateway.md`
- `docs/specs/llm-engine.md`
- `docs/api/llm-gateway-api.md`
- `docs/s7-handoff.md`
- `services/llm-gateway/app/*`
- `services/llm-gateway/tests/*`
- `services/llm-gateway/README.md`

---

## 한 줄 판단

S7은 “LLM 프록시”가 아니라 **정책 장치(policy appliance)**에 가깝다.  
이건 매우 좋은 설계다.  
AEGIS 같은 보안 분석 시스템에서는 LLM을 편하게 쓰는 것보다, **어떻게 제한하고 추적하느냐**가 훨씬 중요하기 때문이다.

---

## 지금 이미 잘 된 점

### 1. 모든 LLM 사용을 단일 게이트웨이로 모으는 결정이 옳다

이건 AEGIS 전체에서 가장 중요한 원칙 중 하나다.

왜 좋은가:
- 추적 지점이 하나다
- 정책 강제가 쉽다
- 감사 로그를 남기기 좋다
- task type별 제한을 두기 쉽다
- model routing과 timeout 관리가 중앙화된다

즉, S7은 편의 기능이 아니라 **통제 지점**이다.

### 2. 문서가 사용 허용 범위와 금지 범위를 모두 명시한다

매우 좋은 부분이다.  
특히 다음과 같은 원칙이 좋다.

- assessment, not verdict
- freeform chat 금지
- remediation patch generation 제외
- 근거 없는 생성 금지
- trusted / semi-trusted / untrusted 구분

이건 “LLM을 뭘 할 수 있게 할까”보다 “무엇을 절대 하지 못하게 할까”를 먼저 생각한 설계다.

### 3. validators와 evidence 통제가 좋다

`evidence_validator`가 허용된 evidence ref만 사용하게 제한하는 구조는 매우 인상적이다.  
이건 보안 도메인에서 정말 중요한 장치다.

LLM이 뭔가 그럴듯하게 말하는 것보다,  
**말한 내용이 허용된 증거 집합 안에 있는가**를 검증하는 게 훨씬 중요하다.

### 4. circuit breaker, token tracker, metrics가 있다

이 역시 좋다.  
S7은 단순 기능 서비스가 아니라 운영 위험을 가진 인프라 성격의 서비스다.  
그 점을 인식하고 회로 차단기, 사용량 추적, Prometheus 메트릭을 둔 것은 좋다.

### 5. 테스트 면에서도 설계 의도가 보인다

contract, input validation, task success/failure, circuit breaker, parser, prompt builder, registry, threat search 등이 나뉘어 있는 것은  
S7이 단순 라우터가 아니라 **운영 가능한 게이트웨이**라는 뜻이다.

---

## 서비스 경계 / 계약 관점 피드백

### 강한 점

S7의 서비스 경계는 아주 분명하다.

- S7만 LLM을 안다
- 다른 서비스는 task를 요청한다
- 출력은 구조화되어야 한다
- 증거와 모델 사용 흔적이 남아야 한다

이건 “서로 코드를 안 본다”는 프로젝트 철학과도 매우 잘 맞는다.  
하위 서비스들이 LLM 세부 구현에 기대지 않게 만들기 때문이다.

### 더 좋아질 점

S7이 강하면 강할수록, 다른 서비스는 자꾸 더 많은 것을 S7에 부탁하고 싶어진다.  
여기서 선을 지키는 것이 중요하다.

예:
- 자유형 질의응답
- 코드 자동 수정
- 명령/스크립트 생성
- 직접적인 보안 판단 확정

이런 요청은 지금 문서처럼 계속 막는 편이 좋다.

---

## 코드 레벨 상세 피드백

### 1. `main.py`의 운영 감각이 좋다

startup 시 threat search 초기화, circuit breaker, token tracker, real client warmup, 오래된 dump 파일 정리 등은  
S7을 실제 운영될 서비스처럼 보고 있다는 뜻이다.

### 2. `/v1/chat`과 `/v1/tasks`를 함께 두는 구조는 좋다

다만 장기적으로는 의미를 더 분리할 필요가 있다.

- `/v1/chat`: OpenAI 호환 프록시/하위 호환 목적
- `/v1/tasks`: AEGIS 내부 작업용 구조화 호출

장기적으로 AEGIS 본체는 `/v1/tasks`를 중심으로 가고,  
`/v1/chat`은 호환/디버깅/전환 계층으로 두는 편이 더 안정적일 수 있다.

### 3. model override와 timeout 전달 방식은 유용하다

하지만 이것도 결국 “누가 최종 정책을 결정하는가” 문제로 이어진다.  
권장하는 방향은 다음과 같다.

- 호출자가 요청할 수 있는 것은 제한된 힌트 수준
- 실제 허용 모델/timeout/task policy는 S7이 최종 결정
- 응답에는 최종 선택된 모델/프롬프트 버전/정책 버전을 남김

### 4. 내부 운영 정보는 공개 표면에서 분리할 필요가 있다

README와 문서에 내부 엔진 주소, 하드웨어, 운영 세부정보가 드러나는 부분은 개발 과정에서는 이해되지만, 공개 저장소 기준으로는 정리할 가치가 있다.

이건 보안 문제이기도 하지만, 동시에 프로젝트 인상 문제이기도 하다.  
“서비스가 성숙하다”는 느낌은 정보 통제에서 온다.

### 5. permissive CORS는 지금 단계에서 조정하는 편이 좋다

S7은 가장 위험한 서비스 중 하나다.  
비록 내부망 전제일 수 있어도, 기본 정책은 더 보수적인 편이 맞다.

---

## 아키텍처 방향 제안

S7은 앞으로 다음 네 가지를 더 강하게 가져가면 좋다.

### 1. Task Registry 중심화
- 어떤 task가 허용되는가
- 어떤 입력 스키마를 갖는가
- 어떤 evidence 제약을 갖는가
- 어떤 prompt template를 쓰는가
- 어떤 model class를 쓰는가

### 2. Prompt / Model Versioning
- 응답에 prompt version 남기기
- model version 남기기
- task revision 남기기
- 평가셋 결과와 연결 가능하게 만들기

### 3. Failure Budget / Degraded Mode
- upstream engine timeout 시 어떻게 할 것인가
- 회로 차단기 open 시 어떤 task를 바로 실패시킬 것인가
- fallback model 허용 범위는 어디까지인가

### 4. Evaluation Harness
- task type별 golden set
- schema validity rate
- evidence citation validity
- abstain / insufficient-evidence 품질 평가

S7은 기능보다 **정책, 평가, 추적**이 더 중요한 서비스다.

---

## 우선순위 제안

### 바로 할 것

1. 공개 문서에서 내부 운영 세부정보 분리  
2. CORS/보안 기본값 정리  
3. task registry 문서화 강화  
4. 응답 메타데이터에 prompt/model/version 노출 정교화

### 다음 단계

1. golden evaluation pack  
2. abstain policy 정교화  
3. failure budget 정의  
4. `/v1/chat`와 `/v1/tasks`의 역할 차이 문서화

---

## 팀 내부에서 바로 토론할 질문

1. S7의 본질은 “프록시”인가, “정책 엔진”인가?  
2. AEGIS 내부에서 장기적으로 `/v1/chat`를 직접 호출해야 하는 서비스가 남아 있어야 하는가?  
3. evidence validator를 통과한 응답이라도, 어떤 경우에는 반드시 abstain 해야 하는가?

---

## 최종 판단

S7은 지금 방향이 맞다.  
그리고 이 서비스가 얇은 프록시가 아니라 **통제된 LLM 사용의 유일한 관문**이라는 점이 아주 중요하다.

앞으로의 방향도 분명하다.

- 더 자유롭게 만들지 말고
- 더 추적 가능하게 만들고
- 더 평가 가능하게 만들고
- 더 제한적으로 유지하라

그렇게 해야 AEGIS 전체가 “LLM을 쓰지만 LLM에 지배되지 않는 시스템”으로 남을 수 있다.
