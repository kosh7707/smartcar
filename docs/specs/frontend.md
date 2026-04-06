# S1 Frontend 현재 구현 스펙

> 이 문서는 `services/frontend/`의 **현재 실제 구현 + 검증된 상태**를 기준으로 작성한 S1 프론트 스펙이다.
> **마지막 검증/갱신: 2026-04-04**

---

## 1. 서비스 정의

S1 프론트엔드는 Electron + React + TypeScript 기반의 보안 분석 운영 콘솔이다.
핵심 역할은 다음 세 가지다.

1. 프로젝트/분석 결과/품질 게이트/승인 상태를 **읽기 쉽게 표현**한다.
2. finding, run, report, approval 상태를 **Evidence-first UI**로 보여준다.
3. 백엔드가 계산한 결과를 프론트가 임의 해석하지 않고 **표현 계층**으로 유지한다.

---

## 2. 설계 원칙

### 2-1. Evidence-first

화면은 가능한 한 아래 순서를 따른다.

1. 무엇을 보고 있는가
2. 현재 상태가 무엇인가
3. 어떤 결과가 나왔는가
4. 근거가 무엇인가
5. 어떤 run / 모델 / 버전이 이 결과를 만들었는가

### 2-2. Analyst-first

현재 IA는 보안 분석가/플랫폼 운영자가 가장 자주 쓰는 흐름에 맞춰져 있다.

- 프로젝트 선택
- overview 확인
- static analysis drill-down
- files / vulnerabilities / analysis history 확인
- quality gate / approvals / report 검토

### 2-3. Dynamic surface는 현재 placeholder 우선

동적 분석/동적 테스트 관련 코드 자산은 남아 있지만, **현재 제품 라우트에서는 placeholder가 정답**이다.
즉, 현재 스펙 기준에서 `/dynamic-analysis`, `/dynamic-test`는 “준비 중 화면”이 맞다.

---

## 3. 2026-04-04 검증 스냅샷

| 항목 | 명령 | 결과 |
|------|------|------|
| 빌드 | `cd services/frontend && npm run build` | PASS |
| 유닛 테스트 | `cd services/frontend && npm test` | PASS (`47` files / `356` tests) |
| 라우트 스모크 | `cd services/frontend && npx playwright test e2e/specs/navigation.spec.ts` | PASS (`13` tests) |
| 전체 E2E | `cd services/frontend && npm run test:e2e` | **FAIL** (`154` passed / `26` failed / `180` total) |
| TS 진단 | `npx tsc --noEmit --project services/frontend/tsconfig.json` | PASS (`0` errors) |

### 현재 알려진 회귀

- approval interaction 실패 `2`건
- visual snapshot drift 실패 `24`건

이 문서는 위 검증 결과를 기준으로 작성한다. 즉, **경로/모듈/테스트 자산은 최신이며, visual baseline은 아직 green이 아니다.**

---

## 4. 현재 스택

| 항목 | 현재 값 |
|------|---------|
| 런타임 | Electron `^40.8.0` |
| UI | React / React DOM `^19.2.4` |
| 라우팅 | `react-router-dom ^7.13.1` + `HashRouter` |
| 빌드 | Vite `^7.3.1` |
| 테스트 | Vitest `^4.1.0`, Playwright `^1.58.2` |
| 코드 하이라이트 | `highlight.js` |
| 마크다운 | `react-markdown` + `remark-gfm` |
| 공유 타입 | `@aegis/shared` |
| 스타일 | CSS + theme token |

---

## 5. 현재 구현 범위

### 5-1. 글로벌 라우트

| 경로 | element | 상태 |
|------|---------|------|
| `/` | `/projects` redirect | 운영 중 |
| `/login` | `LoginPage` | 운영 중 |
| `/projects` | `ProjectsPage` | 운영 중 |
| `/settings` | `SettingsPage` | 운영 중 |

### 5-2. 프로젝트 라우트

| 경로 | element | 상태 | 비고 |
|------|---------|------|------|
| `/overview` | `OverviewPage` | 운영 중 | overview dashboard |
| `/static-analysis` | `StaticAnalysisPage` | 운영 중 | 최신 분석/전체 현황, run/finding drill-down |
| `/files` | `FilesPage` | 운영 중 | 파일 탐색 |
| `/files/:fileId` | `FileDetailPage` | 운영 중 | 파일 상세 |
| `/vulnerabilities` | `VulnerabilitiesPage` | 운영 중 | 취약점 목록 |
| `/analysis-history` | `AnalysisHistoryPage` | 운영 중 | run history |
| `/report` | `ReportPage` | 운영 중 | 보고서/감사 추적 |
| `/quality-gate` | `QualityGatePage` | 운영 중 | gate 결과/override |
| `/approvals` | `ApprovalsPage` | 운영 중 | approval queue |
| `/settings` | `ProjectSettingsPage` | 운영 중 | 프로젝트 설정 |
| `/dynamic-analysis` | `ComingSoonPlaceholder` | placeholder | 사이드바 숨김 |
| `/dynamic-test` | `ComingSoonPlaceholder` | placeholder | 사이드바 숨김 |

### 5-3. 화면 구현 상태

| 화면/영역 | 현재 상태 |
|----------|-----------|
| Projects | 구현 완료 |
| Overview | 구현 완료 |
| Static Analysis | 구현 완료 |
| Files + File Detail | 구현 완료 |
| Vulnerabilities | 구현 완료 |
| Analysis History | 구현 완료 |
| Report | 구현 완료 |
| Quality Gate | 구현 완료 |
| Approvals | 구현 완료(단, CTA 관련 E2E 회귀 존재) |
| Global Settings | 구현 완료 |
| Project Settings | 구현 완료 |
| Dynamic Analysis | placeholder 운영 |
| Dynamic Test | placeholder 운영 |

---

## 6. 구현 자산 인벤토리

### 6-1. 규모

| 항목 | 수량 |
|------|------|
| 페이지 컴포넌트 파일 | 15 |
| 실제 마운트된 화면 컴포넌트 | 13 |
| placeholder 프로젝트 라우트 | 2 |
| API 모듈 | 14 |
| 컨텍스트 | 5 |
| 커스텀 훅 | 9 |
| 컴포넌트 | 58 |
| 유틸리티 모듈 | 10 |
| 렌더러 test files | 47 |
| Playwright spec files | 11 |

### 6-2. API 모듈

- `analysis`
- `approval`
- `auth`
- `client`
- `core`
- `dynamic`
- `gate`
- `mock-handler`
- `notifications`
- `pipeline`
- `projects`
- `report`
- `sdk`
- `source`

### 6-3. Context

- `AuthContext`
- `ProjectContext`
- `ToastContext`
- `AnalysisGuardContext`
- `NotificationContext`

### 6-4. Hooks

- `useAnalysisWebSocket`
- `useBuildTargets`
- `useElapsedTimer`
- `usePipelineProgress`
- `useUploadProgress`
- `useStaticDashboard`
- `useKeyboardShortcuts`
- `useAdapters` *(보관 자산)*
- `useDynamicTest` *(보관 자산)*

---

## 7. 현재 제품 동작 규칙

### 7-1. Sidebar 규칙

- 프로젝트 문맥에서는 project sub-navigation을 보여준다.
- `comingSoon` 항목은 렌더링하지 않는다.
- 따라서 dynamic placeholder는 직접 URL 접근만 가능하다.

### 7-2. Notification scope

- `NotificationBridge`가 현재 URL에서 `projectId`를 추출해 `NotificationProvider`에 전달한다.

### 7-3. Breadcrumb

- `ProjectLayout`이 breadcrumb와 `Outlet`를 담당한다.
- 파일 상세는 `files/:fileId` 경로를 `파일 상세`로 표시한다.

### 7-4. Dynamic 자산 정책

다음 자산은 남겨 두되 현재 제품 표면에서는 비활성 상태로 본다.

- `DynamicAnalysisPage.tsx`
- `DynamicTestPage.tsx`
- `components/dynamic/*`
- `hooks/useAdapters.ts`
- `hooks/useDynamicTest.ts`
- `api/dynamic.ts`

---

## 8. QA / 테스트 규약

### 현재 신뢰 가능한 자동 검증

1. `npm run build`
2. `npm test`
3. `npx playwright test e2e/specs/navigation.spec.ts`

### 현재 실패 중인 자동 검증

- approval interaction 2건
- responsive/theme/visual snapshot 24건

### 의미

- 기능 라우트 자체는 살아 있다.
- approval UI와 visual baseline은 문서화된 known issue다.
- baseline을 갱신할지, UI regression을 고칠지 먼저 판단한 뒤 테스트를 손봐야 한다.

---

## 9. known gaps / 후속 작업

1. `ApprovalsPage` CTA 구조와 Playwright selector 기대치 정렬
2. visual snapshot baseline 재생성 또는 실제 UI regression 수정
3. dynamic 화면을 다시 노출할지, placeholder를 장기 유지할지 결정
4. 라우트/QA/README/architecture/spec 문서 4종을 항상 함께 유지
5. lint 체계가 아직 없으므로 필요 시 별도 도입 판단

---

## 10. 한 줄 결론

현재 S1 프론트는 **정적 분석 중심의 운영 콘솔 라우트는 살아 있고**, dynamic surface는 **보관된 코드 + placeholder 라우트** 상태이며, 자동 검증 기준은 **build/unit/route smoke는 green, 전체 Playwright는 approval + visual baseline 문제로 red**다.
