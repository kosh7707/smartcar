# S1 작업 지침서 — Frontend (Electron + React + TypeScript)

## 1. 문서 목적

이 문서는 S1이 담당하는 **Frontend 영역**의 책임 범위, 반드시 구현해야 할 기능, 협업 규칙, 기술적 제약, 완료 기준을 명확히 정의하기 위한 작업 지침서다.  
이 시스템의 프론트엔드는 단순 대시보드가 아니라, **정적 분석 / 동적 분석 / 동적 테스트 / LLM 분석 결과를 증적 중심으로 탐색하고, triage 하고, 승인 흐름을 처리하는 운영 콘솔**이다.

핵심 원칙은 다음 한 문장으로 요약된다.

> **프론트는 "판단을 만들어내는 곳"이 아니라, 백엔드가 관리하는 Findings / Evidence / Quality Gate / Approval 상태를 정확하고 재검증 가능하게 보여주는 곳이다.**

---

## 2. S1의 시스템 내 역할

S1은 아래를 책임진다.

- Electron 기반 데스크톱 애플리케이션 구성
- React + TypeScript 기반 화면 구성
- MVVM + Service 패턴에 따른 View / ViewModel / Service 분리
- 백엔드 REST API 및 WebSocket 이벤트 소비
- 분석 결과, 원시 증적, 품질 게이트, 승인 큐 시각화
- LLM 결과에 대한 provenance(근거 정보) 표시
- 사용자의 triage 작업을 빠르고 안전하게 할 수 있는 UX 제공

S1은 아래를 책임지지 않는다.

- 분석 로직의 실제 수행
- ECU 통신 처리
- LLM 호출 로직 및 프롬프트 생성
- Findings의 최종 판정 규칙
- Quality Gate 평가 로직의 실제 결정
- 승인 정책의 결정 자체

즉, **프론트는 표현 계층**이며, 시스템의 상태 진실원(source of truth)은 S2 백엔드다.

---

## 3. 성공 기준

S1이 잘 만들어졌다고 볼 수 있는 기준은 아래와 같다.

1. 사용자가 특정 finding을 열었을 때, **왜 이 finding이 생겼는지 끝까지 따라갈 수 있어야 한다.**
2. LLM이 생성한 설명은 표시하되, **LLM 출력이 사실 그 자체처럼 보이지 않아야 한다.**
3. 실시간 동적 분석 화면에서, 사용자는 **이벤트, 경고, 드롭, 상태 변화, 재연 가능 정보**를 구분해서 볼 수 있어야 한다.
4. 승인 필요한 작업(고위험 동적 테스트, active diagnostic, fuzzing)은 **명확한 승인 상태**로 드러나야 한다.
5. shared 모델 변경 시 프론트가 조용히 깨지지 않고, **명시적 계약 위반으로 드러나야 한다.**
6. Electron 보안 구성이 안전해야 한다. 프론트는 데스크톱 셸이므로 일반 웹앱보다 더 보수적으로 설계해야 한다.

---

## 4. 프론트엔드 설계 원칙

## 4.1 Evidence-first UI

모든 주요 화면은 "요약 → 판단 → 근거" 순서가 아니라, 다음 순서를 따라야 한다.

1. 현재 객체가 무엇인지
2. 어떤 상태인지
3. 어떤 결과가 나왔는지
4. 그 결과의 근거가 무엇인지
5. 누가 / 무엇이 / 어떤 버전으로 그 결과를 냈는지

즉, finding 상세 화면에 반드시 보여야 하는 것은 아래와 같다.

- Finding 제목 / 심각도 / 상태
- 관련 ECU / Firmware / Run
- Finding 생성 주체(정적 분석기, 룰엔진, LLM 보조, 수동 생성 등)
- EvidenceRef 목록
- 관련 Artifact 목록
- LLM 응답이 있다면 prompt version / model version / validation status
- 승인 / 재검증 / false positive / accepted risk 상태
- 관련 run timeline

## 4.2 LLM 결과는 항상 "보조 정보"로 표시

LLM이 생성한 설명, 가설, 클러스터링, remediation draft는 모두 UI에서 명확히 라벨링해야 한다.

표시 원칙:

- "AI 요약", "AI 가설", "AI 보조 설명"처럼 구분
- deterministic rule 결과와 시각적으로 동일하게 보이지 않게 함
- confidence가 있다면 표시하되, confidence를 사실 보증처럼 표현하지 않음
- 검증 실패(schema invalid, evidence ref missing, prompt mismatch)는 눈에 띄게 노출
- LLM만 근거인 경우 badge로 표시: `AI-only`, `Needs Review`

금지:

- LLM 텍스트를 finding 제목으로 그대로 승격
- LLM이 severity를 판단한 결과를 확정값처럼 강조
- 원시 evidence 없이 AI 설명만 먼저 보여주는 구성

## 4.3 실시간 화면은 "스트림 뷰어"이지 "채팅창"이 아니다

동적 분석 / 동적 테스트 화면은 채팅형 UI가 아니라 운영 콘솔이어야 한다.

반드시 보여야 하는 것:

- run 상태
- 수신 이벤트 수 / 드롭 수 / backlog
- rule match 수
- anomaly 수
- approval required 이벤트
- adapter / simulator 연결 상태
- raw event feed와 qualified event feed의 차이
- stop / pause / kill switch 상태

---

## 5. 아키텍처 가이드 (S1 내부)

## 5.1 권장 디렉터리 구조

```text
src/
  app/
  modules/
    findings/
      views/
      viewmodels/
      services/
      components/
      models/
    runs/
    evidence/
    approvals/
    dashboard/
  shared-client/
    api/
    ws/
    mappers/
    guards/
  electron/
    main/
    preload/
```

원칙:

- `views`: 렌더링 담당
- `viewmodels`: 화면 상태 조합, 사용자 액션 orchestration
- `services`: API/WS 호출, 캐싱, DTO 변환
- `models`: 화면 전용 모델(도메인 원본 DTO를 그대로 뿌리지 않음)
- `mappers`: shared DTO → 화면 모델 변환

## 5.2 MVVM + Service 경계

- View는 최대한 dumb하게 유지
- ViewModel은 화면 로직만 담당
- API 호출과 WebSocket 연결은 Service에서 담당
- DTO 가공은 mapper를 통해 명시적으로 수행
- ViewModel 내부에 raw fetch 코드를 직접 넣지 않음
- Electron IPC 호출은 반드시 별도 service 레이어 뒤로 숨김

## 5.3 상태 관리

권장:

- 서버 상태: Query 계열 라이브러리 또는 명시적 cache layer
- 실시간 이벤트 상태: run별 event stream store
- 화면 상태: 각 module viewmodel 내부 상태

주의:

- WebSocket 이벤트를 전역 상태에 무제한 누적하지 않음
- raw 이벤트는 페이지네이션/윈도잉 필요
- event feed는 `tail`, `window`, `search`, `pin` 개념이 있어야 함

---

## 6. 반드시 구현해야 할 화면

## 6.1 프로젝트 / ECU / 펌웨어 탐색 화면

필수 기능:

- 프로젝트 목록
- ECU 목록
- ECU variant / firmware version / build hash 표시
- 최신 분석 run 요약
- 정적/동적/테스트별 최근 상태
- quality gate 결과

## 6.2 Run 목록 및 상세 화면

필수 기능:

- run type: static / dynamic-analysis / dynamic-test
- run status: queued / running / waiting_approval / paused / failed / completed / aborted
- 시작/종료 시간
- 대상 ECU / firmware / environment(simulator / real ECU)
- rule pack / prompt version / model profile
- artifact 생성 현황
- live stream summary

상세 화면 필수 패널:

- run header
- timeline
- event stream
- artifacts
- findings created in this run
- approvals related to this run
- system notices (drop, schema mismatch, adapter reconnect, validation failure)

## 6.3 Finding 목록 / 상세 화면

필수 기능:

- severity, status, source별 필터링
- static/dynamic/test 출처 필터
- ECU, firmware, run, time 범위 필터
- search
- bulk triage action
- finding diff 보기(이전 firmware 대비 신규/해결/상태 변화)

상세 화면 필수 필드:

- finding id
- title
- summary
- severity
- status
- source engine
- createdAt / updatedAt
- evidence refs
- linked artifacts
- LLM analysis panel
- rule match / correlation info
- comments / review notes
- approval / accepted risk / false positive 기록

## 6.4 Evidence / Artifact 뷰어

이 화면은 매우 중요하다. 최소 아래 타입을 볼 수 있어야 한다.

- source snippet
- SARIF-like 정적 분석 결과
- raw packet / parsed packet
- request-response sequence
- log window
- rule match payload
- replay seed
- simulator fault injection record
- LLM request/response metadata(민감정보 제거 후)

필수 UX:

- artifact metadata 표시: hash, content type, size, source, createdAt
- locator 기반 강조 표시(line range / packet range / time window)
- raw / parsed 전환
- evidence ref jump
- 다운로드
- 재생(replay)로 연결 가능한 경우 버튼 표시

## 6.5 Quality Gate 화면

필수 기능:

- 전체 gate 결과
- rule별 pass/fail 이유
- 신규 critical / high finding 현황
- AI-only finding이 gate에 반영되었는지 여부
- 승인 override 여부
- 최근 firmware/branch/run 비교

주의:

- gate는 단순 점수판이 아니라 "왜 fail인지" 설명 가능해야 한다.

## 6.6 Approval Queue 화면

필수 기능:

- approval id
- action type
- requested by
- target ECU / run
- requested scope
- risk level
- evidence summary
- 만료 시간
- 현재 상태

중요:

- S1은 승인 자체의 정책을 결정하지 않는다.
- 다만 승인 필요한 항목을 숨기지 말고 명확히 드러내야 한다.

---

## 7. WebSocket / 실시간 표시 요구사항

S1은 WebSocket을 적극적으로 사용하되, 아래를 지켜야 한다.

## 7.1 이벤트를 구분해서 보여줄 것

최소 이벤트 타입:

- `run.status.changed`
- `capture.frame.received`
- `capture.backpressure.notice`
- `rule.matched`
- `finding.created`
- `finding.updated`
- `approval.required`
- `approval.resolved`
- `adapter.connection.changed`
- `simulator.state.changed`
- `llm.annotation.completed`
- `system.validation.failed`

UI는 이벤트를 같은 레벨로 섞지 말아야 한다.

예:
- raw stream
- qualified events
- findings
- control/system notices

## 7.2 sequence, reconnect, idempotency

필수 표시/처리:

- 마지막 sequence 번호 추적
- 재연결 시 gap 감지
- 누락 이벤트가 있으면 "일부 이벤트 누락 가능" 표시
- 중복 이벤트는 service layer에서 dedupe

## 7.3 backpressure / drop 표시

중요:

- event drop이 생겼을 때 조용히 묻히면 안 된다.
- UI에 명시적으로 표시해야 한다.

예시 배지:
- `Dropped 14 raw frames`
- `Backpressure active`
- `Stream recovered`

---

## 8. Electron 보안 요구사항

S1은 Electron 앱이므로 보안 요구사항이 강하다.

필수:

- `contextIsolation: true`
- `nodeIntegration: false`
- preload 최소화
- renderer에 필요한 최소 IPC만 노출
- shell open / external open 제한
- 파일 시스템 접근은 명시적 user action 기반으로만
- 민감정보 저장 최소화
- access token을 localStorage에 평문으로 저장하지 않음

금지:

- renderer에서 Node API 직접 사용
- 임의 URL 로드
- raw HTML 그대로 렌더링
- LLM 응답 markdown을 sanitize 없이 렌더링

---

## 9. S1이 반드시 고려해야 할 도메인 규칙

## 9.1 Finding 상태는 UI가 임의로 만들지 않는다

상태 목록 예시:

- Open
- Needs Review
- Accepted Risk
- False Positive
- Fixed
- Needs Revalidation
- Sandbox

UI는 이 상태를 올바르게 표시해야 하며, 로컬에서 임의 상태를 생성하지 않는다.

## 9.2 Severity와 Confidence를 혼동하지 않는다

- Severity: 시스템 / 정책상 위험도
- Confidence: 분석기나 LLM의 신뢰도 추정값

두 값을 하나의 색이나 badge로 뭉치지 않는다.

## 9.3 AI 결과와 deterministic 결과를 시각적으로 분리

권장:

- deterministic rule / analyzer output: 기본 계열
- AI output: 별도 badge와 provenance drawer 제공

---

## 10. 협업 및 문서 교환 규칙

S1은 S2와 shared 모델을 공유하므로, 문서화 없는 변경을 해서는 안 된다.

## 10.1 shared 변경 시 필수 문서

shared 변경 시 반드시 아래를 작성:

1. 변경 요약
2. 변경된 타입/DTO 목록
3. breaking / non-breaking 여부
4. 프론트 영향 범위
5. 백엔드 영향 범위
6. 샘플 payload 전/후
7. 마이그레이션 메모
8. 테스트 케이스 변경점

## 10.2 문서 위치

권장:

```text
docs/changes/shared/YYYY-MM-DD_<topic>.md
```

## 10.3 문서화 없이 금지되는 변경

- enum 값 추가/삭제
- 상태명 변경
- 필수 필드 추가
- 이벤트 타입 이름 변경
- WebSocket payload 구조 변경
- artifact locator 구조 변경

---

## 11. 테스트 전략

## 11.1 단위 테스트

대상:

- mapper
- viewmodel
- formatting utilities
- evidence locator resolver
- event dedupe logic
- badge/status mapping

## 11.2 계약 테스트

shared DTO 샘플 payload를 기준으로 다음 검증:

- 역직렬화 가능 여부
- optional/required 필드 처리
- enum 호환성
- unknown field 무시 여부 정책

## 11.3 시나리오 테스트

최소 시나리오:

1. 정적 분석 finding 생성 → triage → accepted risk 표시
2. 동적 분석 run 실시간 스트림 수신 → rule match → finding 생성
3. backpressure 발생 → UI 경고 표시
4. approval required 생성 → approval queue 반영
5. LLM annotation 완료 → provenance panel 표시
6. evidence 다운로드 / jump

## 11.4 E2E 테스트

ECU Simulator를 활용하여 다음 흐름을 자동화할 것:

- live run 화면
- finding 생성
- evidence detail jump
- quality gate fail 표시
- approval flow 반영

---

## 12. 우선 구현 순서

### 1단계
- 공통 shell
- auth/session 기본 틀
- 프로젝트 / run 목록
- finding 목록
- shared DTO consumer 기초

### 2단계
- run 상세
- evidence viewer
- live WebSocket stream panel
- quality gate panel

### 3단계
- approval queue
- diff 뷰
- LLM provenance panel
- bulk triage

### 4단계
- 고급 검색
- replay 연결
- 사용자 생산성 기능(pin, compare, saved views)

---

## 13. 완료 기준 (Definition of Done)

S1 기능은 아래를 만족할 때 완료로 본다.

- 화면이 shared 계약을 정확히 소비한다.
- API/WS 에러를 사용자에게 이해 가능한 방식으로 보여준다.
- AI 결과가 AI 결과로 구분된다.
- finding에서 evidence까지 2클릭 이내로 이동 가능하다.
- run 상세 화면에서 실시간 상태와 누락/드롭 상황이 드러난다.
- 보안 구성(Electron)이 최소 기준을 만족한다.
- shared 변경 시 문서가 남아 있다.
- 테스트가 존재한다.

---

## 14. S1에게 요구하는 태도

S1은 "예쁘게 보이는 화면"보다 다음을 우선해야 한다.

1. 운영자가 판단을 검증할 수 있게 만들 것
2. 실시간 상태를 숨기지 않을 것
3. AI의 불확실성을 시각적으로 감출 생각을 하지 않을 것
4. 문서화되지 않은 shared 변경을 하지 않을 것
5. evidence-first 원칙을 깨지 않을 것

이 프론트엔드는 결국 보고서용 UI가 아니라, **분석 결과를 믿을 수 있는지 검증하는 콘솔**이어야 한다.
