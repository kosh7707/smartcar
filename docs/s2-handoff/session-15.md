# 세션 15 — S1↔S2 계약 lockdown + S2 문서 동기화

**날짜**: 2026-04-04
**범위**: backend-side contract regression lock, test harness 정렬, handoff/spec 문서 업데이트

---

## 작업 내역

### 1. S1↔S2 계약 drift를 backend-side에서 회귀 고정

- build target / SDK / pipeline 핵심 surface를 backend contract test로 잠금
  - `POST /api/projects/:pid/targets/discover`
  - `GET /api/projects/:pid/sdk`
  - `GET /api/projects/:pid/sdk/:id`
  - `POST /api/projects/:pid/sdk`
  - `POST /api/projects/:pid/pipeline/run/:targetId`
  - `GET /api/projects/:pid/pipeline/status`

### 2. `includedPaths` update semantics 명시화

- 이전:
  - `PUT /api/projects/:pid/targets/:id` 에 `includedPaths` 를 보내면 사실상 silent ignore
- 현재:
  - `includedPaths` 가 들어오면 backend는
    - `400`
    - `errorDetail.code = "INVALID_INPUT"`
    로 명시적으로 거부

### 3. contract test harness 정렬

- `services/backend/src/test/create-test-app.ts` 보강
  - `/api/projects/:pid/sdk` mount
  - discover용 `sourceService` / `sastClient` test double
  - rerun용 `pipelineOrchestrator` test double

즉, 이번 contract lockdown은 테스트 파일만 늘린 것이 아니라
**테스트 하네스가 실제 mounted semantics를 재현하도록 맞춘 작업**도 포함한다.

### 4. canonical docs 동기화

- `docs/api/shared-models.md`
  - discover / sdk / rerun / pipeline status shape 반영
  - `includedPaths` update rejection semantics 반영
- `docs/specs/backend.md`
  - Build Target / SDK / Pipeline 계약 고정 섹션 추가
- `docs/s2-handoff/README.md`
- `docs/s2-handoff/roadmap.md`
- `docs/s2-handoff/architecture.md`

### 5. WR / 운영 메모 정리

- S1에는 closure/FYI 성격의 WR 발행:
  - `docs/work-requests/s2-to-s1-contract-lockdown-fyi.md`
- 공용 `.omx` 운영 원칙은 `s2-to-all-omx-memory-discipline.md` 와
  `docs/AEGIS.md` 기준으로 유지

### 6. Build Snapshot 협의 상태 반영

- WR 폴더 기준으로 S2↔S3 Build Snapshot / BuildAttempt 계약 협의가 진행 중
- 현재 S2 입장:
  - semantics/readiness는 수용
  - 실제 persistence/orchestration 구현 착수는 **게이트 이후**

---

## 검증 결과

- `cd services/backend && npx vitest run src/__tests__/contract/api-contract.test.ts`
  - **73 passed**
- `cd services/backend && npx vitest run`
  - **18 files / 330 tests passed**
- `npx tsc --noEmit --project services/backend/tsconfig.json`
  - 통과
- `npx tsc --noEmit --project services/shared/tsconfig.json`
  - 통과
- `git diff --check`
  - 통과

---

## 커밋

- `ca11063` — S1↔S2 계약 drift가 다시 implicit behavior로 돌아가지 않도록 고정
- `c12aeac` — backend spec에 locked semantics를 명시적으로 기록

---

## 다음 세션 메모

1. `docs/work-requests/` 를 다시 기준으로 읽을 것
   - 더 이상 “S3 내부 backlog 1건만 남음” 상태가 아님
2. Build Snapshot / BuildAttempt는
   - 지금 당장 구현 시작이 아니라
   - 현재 게이트 조건과 WR 상태를 먼저 재확인할 것
3. E2E 풀스택 테스트는 여전히 중요하지만,
   사용자 허가 없는 start script 실행 금지 원칙은 유지
