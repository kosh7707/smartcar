# S2 → S1: S1↔S2 계약 lockdown 완료 (FYI / 추가 구현 없음)

**날짜**: 2026-04-04
**발신**: S2 (AEGIS Core / Platform Orchestrator)
**수신**: S1 (Frontend)

---

## 요약

S2가 S1↔S2 canonical contract에 대해 **backend-side lockdown**을 완료했다.

이번 WR은 **FYI 용도**이며, **현재 시점에서 S1의 추가 구현 액션은 없다.**

기준 문서는 계속 아래 두 개다.

- `docs/api/shared-models.md` ← canonical contract
- `docs/s2-handoff/api-endpoints.md` ← route inventory / quick reference

---

## 이번에 S2가 고정한 내용

### 1. backend contract test 확장

다음 surface가 backend contract test로 잠겼다.

- `POST /api/projects/:pid/targets/discover`
- `GET /api/projects/:pid/sdk`
- `GET /api/projects/:pid/sdk/:id`
- `POST /api/projects/:pid/sdk`
- `POST /api/projects/:pid/pipeline/run/:targetId`
- `GET /api/projects/:pid/pipeline/status`

### 2. `includedPaths` update semantics 명시화

이전:
- `PUT /api/projects/:pid/targets/:id`에 `includedPaths`를 보내도 backend가 사실상 **silent no-op**에 가까운 동작

현재:
- `includedPaths`를 보내면 backend는 **`400 InvalidInput`** 으로 명시적으로 거부

즉, 이제 이 동작은
- 문서상으로도
- 서버 semantics 상으로도
- 테스트 상으로도

일관되게 **“미지원”** 으로 고정되었다.

### 3. canonical doc 정렬

`docs/api/shared-models.md`도 위 semantics에 맞춰 갱신되었다.

---

## S1 기준 의미

현재 S1이 이미 적용한 방향:

- discover 응답 shape 정렬
- SDK register 응답 shape 정렬
- pipeline retry/status 정렬
- `includedPaths` edit guard

는 **현재 backend contract와 일치하는 상태**다.

따라서 **추가 구현 요청은 없다.**

---

## S1에 요청하는 것

### 현재 액션

- **추가 구현 없음**

### 운영상 권고

- 이후 S1이 관련 화면/모킹/테스트를 손볼 때는
  - `docs/api/shared-models.md`
  - backend contract drift 여부
를 우선 재확인해 달라.

- 특히 `includedPaths` update UX는
  - backend가 실제 update semantics를 지원하기 전까지
  - 현재의 guard 정책을 유지해 달라.

---

## 메모

이번 WR은 **action-required WR가 아니라 closure/FYI WR**이다.

후속 구현이 다시 필요해지면 S2가 별도 WR로 요청하겠다.
