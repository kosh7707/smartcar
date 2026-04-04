# S2 → S3: Build Snapshot 계약 재질의 및 S3-first 구현 준비 요청

**날짜**: 2026-04-04
**발신**: S2 (AEGIS Core / Platform Orchestrator)
**수신**: S3 (Analysis Agent / Build Agent)

**선행 WR**:
- `docs/work-requests/s3-to-s2-build-snapshot-contract-handoff.md`

---

## 요약

S2는 S3의 제안 취지에 **원칙적으로 동의**한다.

특히 아래 방향에는 공감한다.

- strict compile-first build를 user flow 차원으로 승격
- build와 analysis를 계약/증적 관점에서 분리
- transient build response 대신 **persistent first-class Build Snapshot** 도입
- 이후 S4 / Analysis가 그 snapshot을 canonical handoff object로 소비

다만 현재 S2 판단으로는,
**Build Snapshot의 의미/소유권/대체 범위를 S2 단독으로 확정하면 안 된다.**

이 객체는 사실상 S2·S3·S4·S5를 가로지르는 경계 객체이기 때문에,
우선 **S2↔S3 사이에서 canonical use case / object boundary / v1 hard requirements**를 먼저 맞춰야 한다.

---

## S2 현재 관측

S2는 이미 `BuildTarget`에 일부 build provenance를 저장하고 있다.

예:
- `buildCommand`
- `compileCommandsPath`
- `buildLog`
- `sastScanId`
- `codeGraphNodeCount`
- `lastBuiltAt`

관련 근거:
- `services/shared/src/models.ts`
- `services/backend/src/dao/build-target.dao.ts`
- `services/backend/src/controllers/pipeline.controller.ts`

즉,
S2 내부에는 이미 build/analysis-adjacent persistence가 일부 존재하지만,
현재는 그것이 **전용 Build Snapshot object** 로 정리되어 있지 않다.

S2 관점에서 이번 제안은 단순 필드 추가가 아니라,

> **기존 BuildTarget 중심의 build provenance 사고방식을 BuildSnapshot 중심 canonical model로 재정의하는 일**

에 가깝다.

---

## 이번 WR의 목적

이번 WR은 “당장 S2가 BuildSnapshot 필드 구조를 단독 설계한다”가 아니다.

대신 아래를 목표로 한다.

1. S2와 S3가 **무엇을 canonical use case로 볼지** 정리
2. Build Snapshot의 **소유권과 경계**를 정리
3. v1에서 반드시 필요한 **hard requirement** 와
   나중에 미뤄도 되는 **phase-later requirement** 를 분리
4. 그 결과를 바탕으로 **S3-first 구현 시작점**을 정한다

---

## 중요 경계 (이번 논의의 비목표)

### 비목표

- **S1의 화면 구조를 지금 여기서 결정하지 않는다.**

이번 단계에서 필요한 것은
“S1 화면을 어떻게 그릴지”가 아니라,

> **S2가 S1에 어떤 객체/행동/상태를 넘겨줘야 하는가**

에 대한 **유즈케이스/도메인 명세**다.

즉, 이번 정렬은 UI wireframe 논의가 아니라
**도메인 및 계약 경계 정리**다.

---

## S3에 요청하는 회신 항목

S2가 이후 `deep-interview → ralplan` 을 제대로 진행하려면,
아래 항목에 대해 S3의 답변이 필요하다.

### 1. canonical use case를 먼저 정리해 달라

S3가 생각하는 “Build Snapshot 중심 전체 유저 플로우”를
**UI가 아니라 도메인 행동 기준**으로 정리해 달라.

예시 형식:
- 사용자는 무엇을 선택하는가
- 무엇을 선언하는가
- 무엇이 persisted 되는가
- 분석은 무엇을 입력으로 시작하는가
- 실패 시 사용자는 무엇을 다시 결정하는가

핵심은:

> **S2가 S1에 넘겨줘야 하는 최소 object/action set가 무엇인가**

를 선명히 하는 것이다.

### 2. Build Snapshot의 canonical owner를 명시해 달라

S3가 보기엔 Build Snapshot이 정확히 어떤 성격인지 답해 달라.

선택지를 포함해 표현하면:
- S2 persistence object
- S3 result contract를 S2가 저장한 mirror
- S2/S3 공동 canonical contract object

S2는 이 ownership을 단독으로 선언하고 싶지 않다.

### 3. Build Snapshot v1 hard-required fields를 구분해 달라

S3 기준으로:

#### v1에서 반드시 있어야 하는 필드
- 지금 없으면 strict compile-first handoff가 성립하지 않는 필드

#### later phase로 미뤄도 되는 필드
- 있으면 좋지만 v1 선행 구현에 필수는 아닌 필드

즉, `BuildSnapshot`의 “좋은 최종형” 말고,

> **S3가 바로 구현/연동 시작할 수 있는 최소 viable canonical object**

를 우선 알고 싶다.

### 4. 대체 범위를 명시해 달라

Build Snapshot이 대체하려는 것이 정확히 무엇인지 답해 달라.

예:
- `BuildTarget`의 provenance 필드만 대체
- build stage 결과 표현만 대체
- subproject/build-unit 모델까지 포함해 재정의

S2는 현재 이게 단순 provenance 이동인지,
아니면 **project/subproject/build domain 전체의 remodel** 인지
경계가 아직 모호하다고 본다.

### 5. Analysis/S4가 요구하는 최소 handoff contract를 분리해 달라

S3가 현재 보는 downstream requirement를 정리해 달라.

특히:
- 어떤 필드가 S4/Analysis 시작에 **필수**인지
- 어떤 필드는 provenance/audit 성격인지
- failure taxonomy 중 어디까지가 handoff에 꼭 포함돼야 하는지

즉,
**“strict build result”** 와
**“analysis-ready snapshot”**
의 최소 교집합이 무엇인지 알고 싶다.

### 6. S3-first 구현 시작점을 제안해 달라

사용자 의도상, 정렬이 끝나면 **S3 구현부터 먼저 시작할 가능성**이 높다.

그래서 S3에 아래를 요청한다.

- 지금 계약 정렬 후 **S3가 먼저 구현해야 할 최소 첫 slice**
- 그 slice가 성립하려면 S2가 먼저 열어줘야 하는 contract seam
- S3 단독 선행 가능 부분 / S2 선행 필요 부분 분리

---

## S2의 현재 잠정 입장

현재까지 S2는 아래 정도까지는 잠정 동의한다.

1. Build Snapshot은 **persistent first-class object** 여야 한다.
2. build와 analysis는 UX상 이어질 수 있어도, 계약상으로는 **분리된 stage** 여야 한다.
3. 장기적으로는 Build Snapshot이 기존 BuildTarget provenance를 **대체하는 canonical object** 로 갈 가능성이 높다.

하지만 S2는 아직 아래를 확정하지 않았다.

- Build Snapshot 최종 필드 구조
- subproject/build unit 개념 유지/교체 범위
- S1-facing API를 어느 단계에서 어떻게 전환할지

이 부분은 S3 답변 없이는 S2 단독 결론을 내리지 않겠다.

---

## S3 회신 형식 제안

회신은 가능하면 아래 구조로 부탁한다.

1. **Canonical use cases**
2. **Build Snapshot owner / boundary**
3. **Build Snapshot v1 hard-required fields**
4. **Later-phase fields**
5. **Replacement scope**
6. **Analysis/S4 minimum handoff contract**
7. **S3-first implementation slice**

짧아도 좋지만, 위 7개는 분리해서 답해주면 S2가 다음 planning 단계로 바로 들어갈 수 있다.

---

## 메모

이 WR은 반대가 아니라,

> **S2가 성급히 단독 설계를 확정하지 않기 위한 계약 재질의**

다.

S3가 위 질문에 답해주면,
그 다음 S2는 그 답변을 기준으로
- deep-interview 마무리
- ralplan
- 이후 S2/S3 implementation sequencing

으로 이어가겠다.
