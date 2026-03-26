# S1 리뷰: Frontend / QA

## 검토 범위

- `docs/specs/frontend.md`
- `docs/s1-handoff.md`
- `services/frontend/src/main/*`
- `services/frontend/src/renderer/*`
- `services/frontend/src/renderer/api/client.ts`
- `services/frontend/src/renderer/hooks/*`
- `services/frontend/src/renderer/App.tsx`
- 관련 테스트 파일(`client.test.ts`, hook test들)

---

## 한 줄 판단

S1은 **분석가 경험을 어떻게 만들어야 하는지 가장 잘 이해하고 있는 서비스**다.  
특히 문서 품질과 상태 모델링이 좋다. 다만 현재는 “이미 준비된 화면/훅”과 “실제 라우팅/제품 표면” 사이에 약간의 간극이 보인다.

---

## 지금 이미 잘 된 점

### 1. 문서가 단순 UI 목록이 아니라 제품 철학을 담고 있다

`frontend.md`는 화면 나열 수준이 아니라 다음을 분명히 한다.

- evidence-first
- analyst-first
- 재현성/감사 가능성
- LLM은 보조일 뿐이라는 원칙
- finding 상태와 검토 흐름

이 점이 중요하다.  
대부분의 프론트 명세는 “무슨 버튼이 있다”에 그치는데, S1 문서는 **왜 이 UI가 존재해야 하는가**를 먼저 말한다.  
이건 제품 설계 감각이 있다는 뜻이다.

### 2. Electron 브릿지가 작고 보수적이다

`src/main/preload.ts`가 최소한의 값만 노출하는 방식은 좋다.  
보안 툴의 데스크톱 프런트엔드에서 preload를 작게 유지하는 것은 장기적으로 매우 유리하다.

### 3. renderer 구조가 기능별로 꽤 잘 분해돼 있다

`api`, `components`, `contexts`, `hooks`, `layouts`, `pages` 분리가 명확하다.  
특히 `useAnalysisWebSocket`, `useAsyncAnalysis`, `usePipelineProgress`, `useStaticDashboard` 같은 훅 이름만 봐도 S1이 “페이지 렌더링”보다 **워크플로 관리**를 중요하게 보고 있다는 점이 드러난다.

### 4. 단순 목록형 UI를 넘어서 분석 흐름을 고려하고 있다

페이지 구성이 프로젝트 개요, 정적 분석, 파일, 취약점, 분석 이력, 보고서, 설정 등으로 나뉘어 있는 것은 좋다.  
즉 S1은 단순 스캐너 결과 브라우저가 아니라 **분석 세션 중심 UI**를 만들고 있다.

---

## 서비스 경계 / 계약 관점 피드백

### 강한 점

S1이 “S2만 바라본다”는 규칙은 꽤 잘 지켜진 것으로 보인다.  
공개 구조상 프론트는 백엔드 URL을 대상으로 API 클라이언트를 두고 있고, 다른 서비스의 세부 구현을 직접 끌어오지 않는다.

이건 매우 중요하다.  
S1이 S4/S5/S7을 직접 알고 싶어지기 시작하는 순간 UI는 빠르게 깨진다.  
현재 구조는 그 유혹을 잘 막고 있다.

### 더 좋아질 점

문서 수준에서는 계약 중심 문화가 잘 드러나지만, QA 리더십은 아직 저장소 자산으로 충분히 드러나지 않는다.  
사용자 설명대로 S1이 QA를 지휘한다면, 그 역할은 앞으로 다음 자산으로 더 명시되면 좋다.

- 화면 단위 acceptance scenario
- workflow regression test
- backend contract mock 기반 UI smoke test
- 핵심 사용자 시나리오 golden flow

즉, “S1이 QA를 지휘한다”는 운영 개념을 테스트 자산으로 끌어내리는 작업이 필요하다.

---

## 코드 레벨 상세 피드백

### 1. `App.tsx`의 실제 라우트와 존재하는 페이지 파일이 완전히 일치하지 않는다

`pages` 아래에는 `DynamicAnalysisPage.tsx`, `DynamicTestPage.tsx` 같은 파일이 보이는데, 실제 `App.tsx` 라우트 트리에서는 정적 분석 중심의 경로만 분명히 연결되어 있고 동적 분석 페이지가 최종 제품 표면에 완전히 반영된 흔적은 약하다.

이건 나쁜 신호라기보다, **개발 속도가 매우 빨랐을 때 흔히 생기는 “준비된 화면 > 연결된 사용자 흐름” 간극**이다.

권장:
- 페이지 파일 존재 여부와 실제 route tree를 1:1로 정렬
- 숨겨진/미완성 화면은 feature flag나 “준비 중” 구조로 명시
- 라우팅 기준을 기능 단위가 아니라 사용자 여정 단위로 재점검

### 2. `api/client.ts`는 지금 시점에서 너무 커질 가능성이 높다

중앙 API 클라이언트는 초기에는 편하지만, 현재 정도의 기능 폭이면 금방 비대해진다.  
특히 AEGIS는 프로젝트, 파일, 분석, 빌드 타깃, 품질 게이트, 보고서, 동적 분석, 어댑터 상태까지 다루기 때문에 클라이언트가 하나의 거대한 서비스처럼 변할 위험이 있다.

권장 분리:
- `projectsClient`
- `filesClient`
- `analysisClient`
- `pipelineClient`
- `findingsClient`
- `reportClient`
- `dynamicClient`
- `settingsClient`

그리고 이들을 묶는 façade를 하나 두는 구조가 좋다.

### 3. 설정 주입 방식이 더 명시적이어야 한다

preload와 client에서 기본 백엔드 URL이 사실상 고정값처럼 보이는 부분은 지금은 편하지만 나중에 불편해진다.

권장:
- 환경별 설정 파일
- 런타임 주입 가능한 backend base URL
- “현재 연결 대상” 표시
- 테스트/데모/실서비스 환경을 구분하는 배지

AEGIS는 로컬 실험 환경에서 시작하더라도, 나중에는 재현 가능한 데모 환경과 연구실 배포 환경이 분리될 가능성이 높다.

### 4. S1은 이미 “뷰”보다 “상태 흐름”을 많이 갖고 있다. 그만큼 view-model 계층이 중요해진다

현재 훅 분해는 좋은데, 서비스가 더 커지면 페이지 컴포넌트와 훅만으로는 상태 의미가 흐려질 수 있다.  
특히 아래 영역은 selector/view-model 계층이 있으면 더 좋아진다.

- 프로젝트 개요 대시보드
- 정적 분석 진행 상태
- 취약점 목록과 필터링
- 보고서 생성/승인 상태
- build target과 subproject 관계

즉, S1은 단순 React UI가 아니라 사실상 **운영 콘솔**이므로, 화면용 가공 상태 계층을 명시적으로 두는 편이 좋다.

### 5. 웹소켓 진행 표시 훅은 아주 좋은 방향이다

`useAnalysisWebSocket`, `usePipelineProgress` 계열은 AEGIS의 본질과 잘 맞는다.  
이 프로젝트는 요청-응답형 CRUD보다 “긴 분석 작업의 상태 변화”가 중요하므로, S1이 이를 먼저 모델링한 것은 좋다.

다만 여기서 중요한 것은 UI와 S2가 같은 이벤트 언어를 쓰는 것이다.  
따라서 S1은 앞으로 S2와 함께 다음을 고정해야 한다.

- stage 이름
- stage 순서
- 실패 시 표시 방식
- 재시도/취소/부분 완료 표현
- quick vs deep 구분 방식

---

## 제품 관점 피드백

### 무엇이 인상적인가

S1은 “보안 도구 UI는 결국 근거를 보여줘야 한다”는 사실을 잘 이해하고 있다.  
그래서 단순히 취약점 숫자만 보여주는 UI가 아니라, 결과의 맥락과 검토 가능성을 함께 담으려는 방향이 보인다.

### 무엇이 부족한가

현재 공개 표면만 보면, 정적 분석 흐름은 꽤 선명한 반면 동적 분석은 아직 제품 서사상 비중이 낮다.  
그 자체는 괜찮다. 문제는 이 차이가 명확히 드러나야 한다는 점이다.

권장:
- “현재 완성된 범위”와 “예정 범위”를 UI에 명확히 구분
- 미완성 영역을 숨기지 말고 roadmap surface로 표현
- 정적 분석 중심 UX를 더 완결시킨 뒤 동적 분석 UX를 붙이기

---

## 우선순위 제안

### 바로 할 것

1. route tree와 page 파일 정렬  
2. API client 도메인 분리  
3. 환경/엔드포인트 설정 주입 구조 정리  
4. 화면 단위 workflow test 추가  
5. build target / run / report / approval 흐름의 deep link 강화

### 다음 단계

1. 사용자 여정 기준 상태 다이어그램 정리  
2. UI acceptance fixture 도입  
3. “증거 보기 → triage → 승인/보류 → 보고서 반영”의 end-to-end 시나리오 고정  
4. 동적 분석 영역을 feature flag 또는 명시적 beta surface로 편입

---

## 팀 내부에서 바로 토론할 질문

1. S1이 QA를 지휘한다면, 그 역할이 현재 저장소에서 가장 잘 드러나는 자산은 무엇인가?  
2. `App.tsx` 라우트와 `pages/` 폴더의 관계를 지금 상태 그대로 유지해도 되는가?  
3. 프런트가 앞으로 가장 먼저 소비해야 할 “고정 계약”은 무엇인가?  
   - RunStage인가  
   - ProgressEvent인가  
   - FindingDisposition인가

---

## 최종 판단

S1은 “예쁜 프런트”보다 “분석가가 실제로 쓰는 작업 표면”에 더 가깝다.  
그 방향은 매우 좋다.

지금 필요한 것은 화면을 더 많이 만드는 것이 아니라,
**이미 있는 분석 흐름을 더 제품답게 닫는 것**이다.

특히:
- 라우트 정렬
- API 클라이언트 분할
- QA 자산화

이 세 가지만 해도 S1의 완성도는 한 단계 더 올라간다.
