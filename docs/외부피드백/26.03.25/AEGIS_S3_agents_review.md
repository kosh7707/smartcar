# S3 리뷰: Analysis Agent / Build Agent

## 검토 범위

- `docs/specs/analysis-agent.md`
- `docs/api/analysis-agent-api.md`
- `docs/api/build-agent-api.md`
- `services/analysis-agent/app/*`
- `services/analysis-agent/tests/*`
- `services/build-agent/app/*`
- `services/build-agent/tests/*`

---

## 한 줄 판단

S3는 **가장 공격적으로 어려운 문제를 건드린 서비스**다.  
그런데도 analysis-agent는 상당히 정제되어 있고, build-agent는 아직 잠재력이 더 큰 초기 단계다.  
즉, S3 전체 평가는 “방향은 매우 좋고, 두 하위 서비스의 성숙도 차이를 의식적으로 관리해야 한다”로 정리된다.

---

## 1. 공통 철학에 대한 평가

S3 문서와 코드에서 가장 좋았던 부분은, 에이전트를 무한 자율체로 보지 않는다는 점이다.

공통적으로 보이는 원칙:
- deterministic-first
- evidence-first
- analyst-first
- 모든 LLM 사용은 S7 경유
- tool budget, token budget, termination policy 존재
- 구조화된 출력 강제

이건 보안 분야에서 매우 올바른 태도다.  
에이전트가 “많이 할수록 좋다”가 아니라, **근거와 예산 안에서 제한적으로 행동해야 한다**는 점을 명확히 알고 있다.

---

## 2. Analysis Agent 상세 평가

### 한 줄 평가

analysis-agent는 공개 저장소 기준으로 봤을 때 **가장 연구 가치가 높은 서비스 중 하나**다.

### 무엇이 좋은가

#### 2.1 문서 수준에서 이미 phase 설계가 명확하다

단순히 “LLM으로 분석한다”가 아니라 다음처럼 분리돼 있다.

- Phase 1: 결정론적 수집/정리
- Phase 2: 제한된 agent loop
- structured output
- confidence breakdown
- audit 정보

이 구조는 매우 좋다.  
특히 “Phase 1에서 근거를 최대한 많이 만들고, Phase 2는 그 위에서만 판단한다”는 접근이 AEGIS 전체 철학과 일관된다.

#### 2.2 앱 구조가 모듈형이다

`budget`, `clients`, `pipeline`, `policy`, `rag`, `registry`, `tools`, `validators` 등으로 나뉜 구조는 단순 FastAPI 앱 이상의 설계다.  
이건 처음부터 agent system을 하나의 제품으로 생각했다는 뜻이다.

#### 2.3 테스트 축이 다양하다

테스트 디렉터리 구성만 봐도 다음을 신경 쓰고 있다.

- agent loop
- budget manager
- llm caller
- retry policy
- termination policy
- tool executor / registry / router
- schema / validators
- turn summarizer

이건 단순 endpoint 테스트보다 훨씬 값지다.  
즉, S3는 “에이전트가 왜 그렇게 행동했는가”를 분해 가능한 시스템으로 보고 있다.

#### 2.4 S5와 연결되는 project memory 적재는 좋은 선택이다

analysis 결과를 다시 KB의 project memory에 남기는 흐름은 매우 중요하다.  
이건 AEGIS를 stateless analyzer가 아니라 **맥락이 축적되는 플랫폼**으로 만든다.

### 리스크와 주의점

#### 2.5 복잡도 자체가 리스크다

analysis-agent는 설계가 좋은 만큼 복잡하다.  
복잡한 시스템은 “동작”보다 “의미 유지”가 더 어렵다.

특히 조심할 것:
- 프롬프트나 단계 의미가 문서와 미세하게 어긋나는 것
- tool budget이 늘어나면서 행동 범위가 넓어지는 것
- structured output은 유지되는데 내부 판단 기준이 흔들리는 것
- S1/S2가 기대하는 결과 의미와 agent 응답 의미가 어긋나는 것

#### 2.6 도구 수가 늘어날수록 위험이 커진다

지금처럼 tool set이 제한적일 때는 안전하다.  
하지만 이후에 파일 읽기, 명령 실행, 코드 패치 제안, 외부 조회 등이 늘어나면 agent는 급격히 불안정해진다.

따라서 analysis-agent는 기능 확장보다도 **도구 확장 통제 정책**이 더 중요하다.

### 권장 방향

- tool을 늘리기 전에 tool class를 정의하라  
  - read-only evidence tool
  - graph lookup tool
  - memory lookup tool
  - side-effect tool(가능하면 금지 또는 별도 계층)

- 출력 스키마는 외부 계약으로 강하게 고정하라
- confidence 산정 근거를 더 투명하게 기록하라
- `deep-analyze`의 성공 기준과 “불충분 근거로 보류” 기준을 명시적으로 나눠라

---

## 3. Build Agent 상세 평가

### 한 줄 평가

build-agent는 아이디어가 좋다.  
특히 “빌드 문제를 해결하기 위한 매우 좁고 통제된 에이전트”라는 발상은 맞다.  
다만 현재 공개 저장소 기준으로는 analysis-agent보다 훨씬 덜 성숙하다.

### 무엇이 좋은가

#### 3.1 문제 정의가 좋다

보안 분석에서 build 실패는 치명적 병목이다.  
이를 별도 에이전트로 떼어낸 것은 매우 좋은 판단이다.

#### 3.2 행동 제한이 명확하다

좋은 점:
- `build-aegis/` 내부로 제한
- 원본 소스 수정 금지
- 위험한 명령 차단
- build file 탐지와 SDK 정보 수집을 먼저 수행
- 결과를 구조화된 task로만 반환

즉, build-agent는 “뭐든 하는 shell agent”가 아니라 **아주 좁은 build resolution assistant**다.  
이 방향은 유지해야 한다.

### 리스크와 주의점

#### 3.3 테스트 두께가 지금 설계 수준을 못 따라간다

build-agent도 내부 구조는 꽤 있는데, 공개 테스트 표면은 상대적으로 얇다.  
이 상태에서는 설계가 좋아도 실제 신뢰도를 설명하기 어렵다.

우선 필요한 테스트:
- CMake 프로젝트
- Makefile 프로젝트
- autotools/configure 프로젝트
- cross-compilation/SDK env setup 프로젝트
- 실패 케이스(헤더 미탐지, 잘못된 toolchain, 권한 문제)
- agent가 위험한 수정 제안을 하지 않는지 검증

#### 3.4 analysis-agent와 framework가 유사한데, 중복 유지보수 위험이 있다

둘 다 budget/policy/llm/pipeline/router 구조를 가진다.  
이는 현재는 빠른 개발에 유리했을 수 있으나, 시간이 지나면 drift가 생길 수 있다.

S3가 혼자 두 서비스를 다 소유하는 만큼, 공통 커널을 어느 정도 정리할 가치가 있다.

### 권장 방향

- build-agent는 analysis-agent보다 더 보수적으로 유지하라
- LLM fallback 전에 deterministic heuristics를 더 강화하라
- 결과물에 build provenance를 남겨라  
  - 어떤 파일을 읽었는지  
  - 어떤 가설을 세웠는지  
  - 어떤 명령을 제안/실행했는지  
  - 왜 성공/실패했는지

이건 단순 로그가 아니라, 이후 S2/S1이 사용자에게 설명할 수 있는 근거가 된다.

---

## 4. S3 전체에 대한 구조적 피드백

### S3가 증명한 것

S3는 “에이전트는 위험하다”는 사실을 알고 있는 팀이 만든 코드에 가깝다.  
이게 매우 중요하다.

많은 에이전트 프로젝트는 자유도와 데모력을 우선시한다.  
반면 AEGIS의 S3는
- 예산,
- 종료 조건,
- 구조화 출력,
- 증거 인용 제한,
- 역할 분리
를 먼저 생각했다.

이건 보안 분석 에이전트에서 매우 올바른 출발점이다.

### S3의 다음 과제

S3의 진짜 과제는 에이전트를 더 똑똑하게 만드는 것이 아니다.  
다음 세 가지다.

1. **행동 범위를 더 명확히 고정한다.**
2. **결과 의미를 더 설명 가능하게 만든다.**
3. **build-agent의 신뢰도를 analysis-agent 수준으로 끌어올린다.**

---

## 우선순위 제안

### 바로 할 것

1. build-agent 테스트 대폭 확장  
2. S3 공통 커널(정책/예산/도구 실행)의 중복 여부 정리  
3. output schema drift 방지용 golden test 도입  
4. analysis-agent의 “근거 부족” 종료 조건을 더 명시화

### 다음 단계

1. build provenance 아티팩트 표준화  
2. agent tool class / capability registry 도입  
3. confidence 산정 기준의 문서-코드 일치 검증  
4. project memory 적재 정책(versioning, deduplication) 정교화

---

## 팀 내부에서 바로 토론할 질문

1. analysis-agent와 build-agent는 얼마나 같은 프레임워크를 공유해야 하는가?  
2. build-agent는 정말 LLM agent여야 하는가, 아니면 deterministic resolver + bounded fallback 구조가 더 맞는가?  
3. analysis-agent의 최종 산출물은 “결론”인가, “근거가 충분한 가설”인가?

---

## 최종 판단

S3는 AEGIS에서 가장 어렵고 위험한 문제를 다룬다.  
그런데도 analysis-agent는 이미 상당히 잘 통제되어 있다. 이건 큰 장점이다.

다만 전체적으로 보면:
- analysis-agent는 강하다
- build-agent는 가능성이 크지만 아직 더 검증되어야 한다

따라서 S3의 다음 방향은  
**자율성을 늘리는 것보다, 통제와 설명가능성을 더 강하게 만드는 것**이다.
