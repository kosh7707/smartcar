# S1 Frontend 개발 인수인계서

> **먼저 `docs/AEGIS.md`를 읽을 것.**
> 이 문서는 `services/frontend/` 기준의 현재 구현 상태, 검증 결과, 라우트/모듈 인벤토리를 다음 세션에 넘기기 위한 최신 진입점이다.
> **마지막 검증/갱신: 2026-04-04**

---

## 문서 구조

| 문서 | 내용 |
|------|------|
| **이 파일 (`README.md`)** | 현재 상태, 검증 결과, 라우트/모듈 요약, 운영 메모 |
| [architecture.md](architecture.md) | 실제 파일 구조, 라우트 표, API/컨텍스트/훅 인벤토리, 테스트 자산 |
| [qa-guide.md](qa-guide.md) | S1-QA 전용 실행 가이드, 현재 회귀 상태, 권장 실행 순서 |
| [roadmap.md](roadmap.md) | 후속 작업 / 대기 항목 |
| `session-*.md` | 세션 로그 |
| [`../specs/frontend.md`](../specs/frontend.md) | 현재 구현 기준 프론트 스펙 |

---

## 1. 역할과 경계

- S1은 `services/frontend/` 하위 프론트엔드 코드와 S1 handoff/spec 문서를 관리한다.
- 연동 판단은 `docs/api/*.md` 계약서를 기준으로 한다.
- `services/shared/`는 참조만 하고 직접 소유하지 않는다.
- 동적 분석/동적 테스트 화면은 **코드 자산은 남아 있지만 현재 운영 라우트에서는 placeholder 상태**다.
- QA lane은 별도이며, 상세 절차는 [qa-guide.md](qa-guide.md)를 따른다.

---

## 2. 2026-04-04 기준 검증 스냅샷

### 명령 결과

| 항목 | 명령 | 결과 |
|------|------|------|
| 의존성 설치 | `npm ci` | PASS |
| 빌드 | `cd services/frontend && npm run build` | PASS (`dist/renderer/assets/index-CdKamH_F.js` 695.39 kB chunk warning 1건) |
| 유닛 테스트 | `cd services/frontend && npm test` | PASS (`47` files, `356` tests) |
| 라우트 스모크 | `cd services/frontend && npx playwright test e2e/specs/navigation.spec.ts` | PASS (`13` tests) |
| 전체 E2E | `cd services/frontend && npm run test:e2e` | **FAIL** (`154` passed / `26` failed / `180` total) |
| TS 진단 | `npx tsc --noEmit --project services/frontend/tsconfig.json` | PASS (`0` errors, `0` warnings) |

### 현재 E2E 실패 묶음

1. **Approval interaction 2건 실패**
   - `interactions.spec.ts`의 승인 버튼 탐색/클릭 단계 실패
2. **시각 스냅샷 24건 실패**
   - `responsive.spec.ts`, `theme.spec.ts`, `visual-qa*.spec.ts` 전반에서 baseline mismatch

> 즉, **라우트 진입과 대부분의 상호작용은 살아 있지만 시각 기준선과 approval CTA 검증은 깨져 있다.**

---

## 3. 현재 코드베이스 인벤토리

| 항목 | 현재 값 |
|------|---------|
| 마운트된 화면 컴포넌트 | `13`개 (`Login/Projects/Settings` + 프로젝트 하위 10개 실화면) |
| placeholder 프로젝트 라우트 | `2`개 (`/dynamic-analysis`, `/dynamic-test`) |
| 페이지 컴포넌트 파일 | `15`개 (`DynamicAnalysisPage.tsx`, `DynamicTestPage.tsx`는 현재 미마운트) |
| API 모듈 | `14`개 |
| 컨텍스트 | `5`개 |
| 커스텀 훅 | `9`개 |
| 컴포넌트 | `58`개 (`ui 24 / static 24 / finding 3 / dynamic 2 / root 5`) |
| 유틸리티 모듈 | `10`개 |
| 렌더러 유닛 테스트 파일 | `47`개 |
| Playwright spec 파일 | `11`개 |
| lint 설정/스크립트 | **없음** |

---

## 4. 현재 라우트 요약

### 전역

- `/` → `/projects` redirect
- `/login` → `LoginPage`
- `/projects` → `ProjectsPage`
- `/settings` → `SettingsPage`

### 프로젝트 스코프

- `/projects/:projectId/overview` → `OverviewPage`
- `/projects/:projectId/static-analysis` → `StaticAnalysisPage`
- `/projects/:projectId/files` → `FilesPage`
- `/projects/:projectId/files/:fileId` → `FileDetailPage`
- `/projects/:projectId/vulnerabilities` → `VulnerabilitiesPage`
- `/projects/:projectId/analysis-history` → `AnalysisHistoryPage`
- `/projects/:projectId/report` → `ReportPage`
- `/projects/:projectId/quality-gate` → `QualityGatePage`
- `/projects/:projectId/approvals` → `ApprovalsPage`
- `/projects/:projectId/settings` → `ProjectSettingsPage`
- `/projects/:projectId/dynamic-analysis` → `ComingSoonPlaceholder`
- `/projects/:projectId/dynamic-test` → `ComingSoonPlaceholder`

### 주의

- `DynamicAnalysisPage.tsx`, `DynamicTestPage.tsx`, `components/dynamic/*`, `hooks/useAdapters.ts`, `hooks/useDynamicTest.ts`, `api/dynamic.ts`는 **보관 중인 자산**이다.
- 현재 `App.tsx`는 위 자산을 마운트하지 않고 placeholder만 연결한다.
- `Sidebar.tsx`는 `comingSoon` 항목을 필터링하므로 **동적 라우트는 직접 URL로만 접근 가능**하고 사이드바에는 노출되지 않는다.

---

## 5. 핵심 모듈 요약

### API (`src/renderer/api`)

`analysis`, `approval`, `auth`, `client`, `core`, `dynamic`, `gate`, `mock-handler`, `notifications`, `pipeline`, `projects`, `report`, `sdk`, `source`

### Context (`src/renderer/contexts`)

`AuthContext`, `ProjectContext`, `ToastContext`, `AnalysisGuardContext`, `NotificationContext`

### Hooks (`src/renderer/hooks`)

`useAnalysisWebSocket`, `useBuildTargets`, `useElapsedTimer`, `usePipelineProgress`, `useUploadProgress`, `useStaticDashboard`, `useKeyboardShortcuts`, `useAdapters`, `useDynamicTest`

---

## 6. 지금 바로 알아야 할 포인트

- README/architecture/spec/qa-guide는 이번 갱신으로 **동일한 수치와 라우트 기준**을 사용한다.
- 현재 신뢰 가능한 자동 검증 기준은:
  1. `npm run build`
  2. `npm test`
  3. `npx playwright test e2e/specs/navigation.spec.ts`
- 전체 Playwright 스위트는 아직 green baseline이 아니다. 시각 diff와 approval 흐름 실패를 먼저 정리해야 한다.
- 동적 분석/동적 테스트는 “구현 중”이 아니라 **코드는 남아 있으나 제품 라우트에서는 placeholder**라고 이해하는 것이 정확하다.

---

## 7. 다음 세션 우선순위

1. Approval 페이지 CTA 셀렉터/동작 회귀 2건 정리
2. Playwright screenshot baseline drift 원인 분류
3. 동적 라우트 재활성화 여부 결정 전, placeholder 전략 유지 문서/QA 기준 고정
4. 필요 시 `docs/specs/frontend.md` 기준으로 화면별 요구사항과 실제 구현 차이를 좁히기
