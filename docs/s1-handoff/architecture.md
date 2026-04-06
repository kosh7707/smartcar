# S1 Frontend Architecture Snapshot

> `services/frontend/`의 실제 코드 구조와 라우팅/모듈/테스트 자산을 2026-04-04 기준으로 정리한 문서.

---

## 1. 최상위 구조

```text
services/frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
├── e2e/
│   ├── fixtures/
│   ├── helpers/
│   ├── specs/
│   ├── __screenshots__/
│   ├── qa-captures/
│   └── test-results/
└── src/
    ├── main/
    │   ├── index.ts
    │   └── preload.ts
    └── renderer/
        ├── App.tsx
        ├── main.tsx
        ├── api/                14 modules
        ├── components/         58 components total
        ├── constants/
        ├── contexts/           5 providers
        ├── hooks/              9 custom hooks
        ├── layouts/
        ├── pages/              15 page components on disk
        ├── styles/
        ├── types/
        └── utils/              10 utility modules
```

---

## 2. 실제 런타임 라우트 (`src/renderer/App.tsx` 기준)

| 경로 | 실제 element | 상태 | 검증 근거 |
|------|--------------|------|-----------|
| `/` | `Navigate -> /projects` | 운영 중 | `navigation.spec.ts` PASS |
| `/login` | `LoginPage` | 운영 중 | App 라우트 정의 |
| `/projects` | `ProjectsPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/settings` | `SettingsPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/overview` | `OverviewPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/static-analysis` | `StaticAnalysisPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/files` | `FilesPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/files/:fileId` | `FileDetailPage` | 운영 중 | file click flows in E2E suites |
| `/projects/:projectId/vulnerabilities` | `VulnerabilitiesPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/analysis-history` | `AnalysisHistoryPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/report` | `ReportPage` | 운영 중 | full E2E route/snapshot coverage |
| `/projects/:projectId/quality-gate` | `QualityGatePage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/approvals` | `ApprovalsPage` | 운영 중 | `navigation.spec.ts` PASS, approval interaction regressions 존재 |
| `/projects/:projectId/settings` | `ProjectSettingsPage` | 운영 중 | `navigation.spec.ts` PASS |
| `/projects/:projectId/dynamic-analysis` | `ComingSoonPlaceholder` | placeholder | `qa-design-audit.spec.ts` pass in full suite run |
| `/projects/:projectId/dynamic-test` | `ComingSoonPlaceholder` | placeholder | `qa-design-audit.spec.ts` pass in full suite run |

### 중요한 차이: 파일은 있지만 현재 미마운트인 자산

다음 자산은 repo에는 있지만 `App.tsx`에서 직접 사용되지 않는다.

- `src/renderer/pages/DynamicAnalysisPage.tsx`
- `src/renderer/pages/DynamicTestPage.tsx`
- `src/renderer/components/dynamic/*`
- `src/renderer/hooks/useAdapters.ts`
- `src/renderer/hooks/useDynamicTest.ts`
- `src/renderer/api/dynamic.ts`

또한 `Sidebar.tsx`는 `comingSoon` 항목을 렌더링하지 않으므로 dynamic placeholder 경로는 **라우트는 존재하지만 네비게이션에는 숨겨져 있다.**

---

## 3. 페이지/모듈 인벤토리

### 3-1. 페이지 컴포넌트 (`src/renderer/pages`)

| 구분 | 파일 |
|------|------|
| 마운트됨 | `LoginPage`, `ProjectsPage`, `OverviewPage`, `StaticAnalysisPage`, `FilesPage`, `FileDetailPage`, `VulnerabilitiesPage`, `AnalysisHistoryPage`, `ReportPage`, `QualityGatePage`, `ApprovalsPage`, `ProjectSettingsPage`, `SettingsPage` |
| 미마운트 보관 자산 | `DynamicAnalysisPage`, `DynamicTestPage` |

### 3-2. API 모듈 (`src/renderer/api`)

| 모듈 | 역할 |
|------|------|
| `core.ts` | `apiFetch`, `ApiError`, backend URL, logging/health helpers |
| `client.ts` | 호환성 barrel re-export |
| `projects.ts` | 프로젝트/개요/활동/설정 |
| `source.ts` | 소스 업로드/클론/파일 조회 |
| `analysis.ts` | runs/findings/상태 변경/PoC/summary |
| `pipeline.ts` | 빌드 타겟/파이프라인 |
| `gate.ts` | quality gate 조회/오버라이드 |
| `approval.ts` | approval queue/decision/count |
| `sdk.ts` | SDK 등록/삭제/WS URL |
| `report.ts` | 프로젝트/모듈 보고서 |
| `auth.ts` | 인증 관련 호출 |
| `notifications.ts` | 알림 목록/상태 |
| `dynamic.ts` | 동적 분석/동적 테스트/adapter 관련 보관 API |
| `mock-handler.ts` | mock mode 지원 |

### 3-3. Context (`src/renderer/contexts`)

- `AuthContext`
- `ProjectContext`
- `ToastContext`
- `AnalysisGuardContext`
- `NotificationContext`

### 3-4. Hooks (`src/renderer/hooks`)

- `useAnalysisWebSocket`
- `useBuildTargets`
- `useElapsedTimer`
- `usePipelineProgress`
- `useUploadProgress`
- `useStaticDashboard`
- `useKeyboardShortcuts`
- `useAdapters` *(보관 자산)*
- `useDynamicTest` *(보관 자산)*

### 3-5. 컴포넌트 개수

| 영역 | 수량 |
|------|------|
| `components/ui` | 24 |
| `components/static` | 24 |
| `components/finding` | 3 |
| `components/dynamic` | 2 |
| 루트 `components/*.tsx` | 5 |
| **합계** | **58** |

---

## 4. 테스트 자산

### 렌더러 단위 테스트

- `47` test files
- `356` tests PASS (`npm test`)
- 주요 범위: API core/client, contexts, hooks, pages, static/ui components, utils

### Playwright E2E

- spec files: `11`
- total tests: `180`
- 전체 실행 결과: `154 passed / 26 failed`
- 라우트 스모크: `navigation.spec.ts` 단독 실행 시 `13 passed`

### 현행 실패 범주

| 범주 | 수량 | 비고 |
|------|------|------|
| approval interaction | 2 | 승인 버튼 locator/클릭 단계 실패 |
| visual snapshot drift | 24 | responsive/theme/visual QA baseline mismatch |

### 테스트 파일 구성 (`e2e/specs`)

- `navigation.spec.ts`
- `interactions.spec.ts`
- `responsive.spec.ts`
- `theme.spec.ts`
- `visual-qa.spec.ts`
- `visual-qa-dark.spec.ts`
- `qa-design-audit.spec.ts`
- `qa-expert-review.spec.ts`
- `qa-finding-detail.spec.ts`
- `qa-redesign-review.spec.ts`
- `qa-verify-s1-response.spec.ts`

---

## 5. 빌드/타입/도구 메모

### package.json 기준 스택

- Electron `^40.8.0`
- React / React DOM `^19.2.4`
- React Router DOM `^7.13.1`
- Vite `^7.3.1`
- Vitest `^4.1.0`
- Playwright `^1.58.2`

### 현재 검증 시 주의점

- `npm run build`는 renderer를 `vite build`로, main process를 `tsc -p tsconfig.json`으로 검증한다.
- `services/frontend/tsconfig.json`의 `include`는 `src/main`만 잡고 있으므로, renderer 안정성은 실질적으로 `vite build`, `vitest`, `playwright` 결과에 더 의존한다.
- repo에는 ESLint/Prettier 설정이 없다. 즉 **lint는 현재 공식 품질 게이트가 아니다.**

---

## 6. 현재 아키텍처적으로 중요한 사실

1. `HashRouter` 기반이다.
2. 전역 Provider 순서는 `Auth -> Toast -> AnalysisGuard -> Project -> NotificationBridge` 흐름이다.
3. `ProjectLayout`이 breadcrumb + `Outlet`를 담당한다.
4. `Sidebar`는 프로젝트 문맥일 때만 project sub-nav를 보여주고, comingSoon 항목은 숨긴다.
5. 동적 화면은 “삭제”가 아니라 “보관 후 placeholder 전환” 상태다.
6. Approval/visual baseline은 현재 회귀가 있으므로 QA 기준 문서와 함께 보아야 한다.

---

## 7. 다음 변경 시 체크리스트

- 라우트를 바꾸면 `App.tsx`, `Sidebar.tsx`, `ProjectLayout.tsx`, `docs/specs/frontend.md`, `docs/s1-handoff/README.md`, `docs/s1-handoff/qa-guide.md`를 같이 갱신할 것.
- dynamic 화면을 다시 노출할 때는 **placeholder 제거 + 사이드바 공개 + QA baseline 재생성**을 한 세트로 처리할 것.
- approval CTA 구조를 바꾸면 `interactions.spec.ts`, `qa-design-audit.spec.ts`, `qa-expert-review.spec.ts`를 함께 확인할 것.
