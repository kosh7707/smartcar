# S2 → S1: 프론트엔드 API 계약 정렬 요청

**날짜**: 2026-04-04
**발신**: S2 (AEGIS Core / Platform Orchestrator)
**수신**: S1 (Frontend)

---

## 요약

S2가 S1↔S2 canonical API 계약서를 현재 백엔드 기준으로 재작성했다.

이제 S1은 아래 문서를 **단일 기준**으로 삼아 프론트엔드 API 소비 코드를 정렬해 달라.

- `docs/api/shared-models.md` ← **canonical contract**
- `docs/s2-handoff/api-endpoints.md` ← route inventory / quick reference

이번 WR의 목적은 **프론트가 현재 백엔드의 실제 응답 shape와 WS payload를 정확히 따르도록 정렬**하는 것이다.

---

## 배경

현재 프론트-백엔드 간 통신 이상 원인을 추적한 결과,
문서/가정/실구현 사이에 여러 drift가 누적되어 있었다.

S2는 이번에 다음을 수행했다.

1. `docs/api/shared-models.md`를 현재 mounted backend controller 기준으로 전면 재정리
2. success/error envelope 예외 명시
3. REST/WS surface를 실제 구현 기준으로 명시
4. high-risk mismatch를 계약 문서에 반영
5. `docs/s2-handoff/api-endpoints.md`의 query-string path 표기 드리프트 정리

즉, 이제부터 S1은 **추측/기존 mock 기준이 아니라 위 계약 문서 기준**으로 맞추면 된다.

---

## S1에 요청하는 작업

### 1. 계약 문서 재확인

다음 문서를 먼저 정독해 달라.

- `docs/api/shared-models.md`
- `docs/s2-handoff/api-endpoints.md`
- `docs/AEGIS.md`

특히 `docs/api/shared-models.md`의 다음 섹션을 우선 확인해 달라.

- Success / Error envelope 규칙
- Source surface
- Build-target surface
- Target-library surface
- SDK surface
- Pipeline surface
- Analysis / Dynamic-analysis / Dynamic-test surface
- WebSocket surface contract
- Canonical drift notes

---

### 2. 프론트 API 소비 코드 정렬

최우선 수정 대상은 아래다.

#### A. build target discover 응답 shape

현재 canonical contract:

- `POST /api/projects/:pid/targets/discover`
- 응답: `{ success: true, data: { discovered, created, targets, elapsedMs } }`

즉, 프론트는 **배열이 아니라 `data.targets`를 읽어야 한다.**

---

#### B. SDK register 응답 shape

현재 canonical contract:

- `POST /api/projects/:pid/sdk`
- 응답: `202 { success: true, data: RegisteredSdk }`

즉, 프론트는 **`{ sdkId }`만 온다고 가정하면 안 된다.**

---

#### C. pipeline retry 응답 shape

현재 canonical contract:

- `POST /api/projects/:pid/pipeline/run/:targetId`
- 응답: `202 { success: true, data: { targetId, status: "running" } }`

즉, 프론트는 여기서 **`pipelineId`를 기대하면 안 된다.**

---

#### D. pipeline status payload

현재 canonical contract의 polling 응답 shape를 기준으로
프론트 타입/가정/복구 로직을 맞춰 달라.

특히 현재 backend polling 응답은 WS message와 shape가 완전히 동일하지 않다.

---

#### E. SDK analyzed profile 필드명

canonical field명은:

- `environmentSetup`

프론트 로컬 타입의 `envSetupScript` 가정이 남아 있다면 정렬해 달라.

가능하면 shared type 재사용을 우선 검토해 달라.

---

### 3. `includedPaths` 편집 UX 처리 결정

현재 canonical contract상:

- build target **create**는 `includedPaths` 지원
- build target **update**는 현재 `includedPaths` 갱신 미지원

따라서 S1은 아래 둘 중 하나로 정리해 달라.

1. **현재 백엔드 기준에 맞춰 edit UX를 제한/가드 처리**
2. 또는 이 기능이 반드시 필요하면 **S2로 follow-up WR 발행**

즉, 지금 상태에서 프론트가 “수정됨”이라고 보이는데 실제론 반영되지 않는 UX는 남기지 않는 방향으로 정리해 달라.

---

### 4. mock / test도 계약 기준으로 정렬

실제 drift 중 일부는 mock과 테스트가 옛 응답 shape를 계속 사용하면서 숨겨지고 있었다.

따라서 아래도 함께 정렬해 달라.

- frontend API mock
- 관련 unit/component tests
- WS payload expectation tests

목표는:

> **실서버 응답과 mock 응답이 다르지 않게 만드는 것**

이다.

---

## 기대 산출물

S1 완료 시점에 최소 아래가 충족되길 기대한다.

1. 프론트 API layer가 canonical contract와 일치
2. discover / sdk / pipeline 관련 주요 consumer가 현재 백엔드 응답 shape와 일치
3. unsupported `includedPaths` update UX가 사용자에게 오해를 주지 않도록 처리
4. mock/test가 실제 계약과 일치
5. S1 handoff 문서에 반영 사항 정리

---

## 참고 메모

이번 계약 정렬 과정에서 확인된 대표 drift는 다음과 같다.

- `targets/discover` 응답 shape drift
- SDK register 응답 shape drift
- pipeline retry 응답 shape drift
- pipeline status payload drift
- `includedPaths` update no-op
- SDK analyzed profile field naming drift
- 일부 WS payload 해석 drift

세부 분석은 S2가 내부 검토 노트로 확보하고 있으나,
S1 작업의 공식 기준은 어디까지나 다음 문서다.

- `docs/api/shared-models.md`

---

## 요청

이 WR 확인 후,

1. 현재 프론트에서 어떤 mismatch를 먼저 고칠지 우선순위를 정하고
2. 수정 착수 전/후를 S1 handoff 또는 WR로 남겨 달라.

필요 시 backend-side 후속 지원은 S2가 이어서 받겠다.
