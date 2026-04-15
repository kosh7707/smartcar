# Task 10 — CSS Purge Execution Wave Plan

Generated: 2026-04-15T07:56:00Z

## Inputs used

- CSS debt map: `/home/kosh/AEGIS/.omx/state/team/s1-shadcn-replatform-c-standar/tasks/task-5-css-debt-cartography.md`
- Worker-2 behavior/test map: leader mailbox message `11f58907-eacf-40f6-9aeb-927bab166967` and task `6` result.
- Repo state: read-only inspection under `services/frontend`; no production files edited.

## Ground rules for every wave

1. **No global bridge deletion until production refs hit zero.** `src/styles/primitives.css` and `src/styles/shadcn-app.css` still support `.card` 108 refs, `.btn` 61 base refs / 139 `.btn*` variant refs, `.badge*` 41 refs, and `.form-input` 29 refs.
2. **One page/surface family per PR/commit where possible.** Keep diffs reversible and pair each CSS deletion with the component/control migration that made it safe.
3. **Tests first for weak locks.** Worker-2 flagged missing visual/e2e locks, CSS-only shared components without isolated tests, and class-coupled assertions. Do not delete those CSS files before adding or adjusting tests.
4. **Use shadcn primitives before custom CSS.** Default sources: `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Dialog`, `AlertDialog`, `Tabs`, `Table`, `Select`, `Sheet`, `Tooltip`, `Progress`, `ScrollArea`, `Resizable`.
5. **Reviewer gate remains hard.** Worker-4 frontend-skill veto/acceptance criteria should approve the wave’s visual direction before deleting high-blast CSS.
6. **Each wave ends with the relevant targeted Vitest bundle, `npm run typecheck`, `npm run build`, and a browser screenshot/DOM smoke when the wave touches visible layout.**

## Owner lanes suggested

| Lane | Suggested owner | Responsibility |
|---|---|---|
| CSS/component executor | worker-1 or implementation owner | Replace bespoke class shells with shadcn/Tailwind primitives and delete CSS once refs are removed. |
| Test guardian | worker-2 | Add/update behavior locks, rewrite class-coupled assertions, run targeted/full gates. |
| Sourcing advisor | worker-3 | Confirm exact shadcn/Aceternity source component choices; reject ornamental motion by default. |
| Frontend-skill reviewer | worker-4 | Screenshot review, density/spacing/readability veto, final visual acceptance. |

## Ordered execution waves

### Wave 0 — Baseline gates and class-coupled test cleanup prep

**Goal:** Freeze behavior and visual evidence before deletion work.

**File groups:**
- No production file edits required for the baseline.
- Tests to inspect/prepare because they are class-coupled or likely to break during CSS deletion:
  - `services/frontend/src/pages/ProjectSettingsPage/ProjectSettingsPage.test.tsx` — SDK stepper classes.
  - `services/frontend/src/pages/QualityGatePage/QualityGatePage.test.tsx` — `.gate-card` lookup.
  - `services/frontend/src/pages/VulnerabilitiesPage/VulnerabilitiesPage.test.tsx` — grouped/bulk selectors.
  - `services/frontend/src/shared/ui/FileTreeNode.test.tsx` — selected row class.
  - `services/frontend/src/shared/ui/PageHeader.test.tsx` — plain/card classes.
  - `services/frontend/src/layouts/ProjectBreadcrumbLayout.test.tsx` — current class.

**Required tests / evidence:**
```bash
cd services/frontend
npx vitest run src/pages/AnalysisHistoryPage/AnalysisHistoryPage.test.tsx src/pages/ApprovalsPage/ApprovalsPage.test.tsx src/pages/DashboardPage/DashboardPage.test.tsx src/pages/DynamicAnalysisPage/DynamicAnalysisPage.test.tsx src/pages/DynamicTestPage/DynamicTestPage.test.tsx src/pages/FileDetailPage/FileDetailPage.test.tsx src/pages/FilesPage/FilesPage.test.tsx src/pages/LoginPage/LoginPage.test.tsx src/pages/OverviewPage/OverviewPage.test.tsx src/pages/ProjectSettingsPage/ProjectSettingsPage.test.tsx src/pages/QualityGatePage/QualityGatePage.test.tsx src/pages/ReportPage/ReportPage.test.tsx src/pages/SettingsPage/SettingsPage.test.tsx src/pages/SignupPage/SignupPage.test.tsx src/pages/StaticAnalysisPage/StaticAnalysisPage.test.tsx src/pages/VulnerabilitiesPage/VulnerabilitiesPage.test.tsx
npx vitest run src/shared/ui/*.test.tsx src/layouts/*.test.tsx
npm run typecheck
npm run build
```

**Owner split:** worker-2 leads test prep; worker-4 captures baseline screenshots; implementation owner waits.

**Blockers:** task 9 first-wave checklist is still in progress; worker-4 hard-veto review is still in progress.

---

### Wave 1 — Low-blast leaf dialogs, overlays, and already-shadcn shared wrappers

**Why first:** High deletion confidence, small CSS files, clear tests, and most shells map directly to existing shadcn `Dialog`/`AlertDialog`/`Button`/`Input`/`Textarea`.

**File groups to migrate/delete:**
- `services/frontend/src/pages/FilesPage/components/BuildLogViewer.tsx`
- `services/frontend/src/pages/FilesPage/components/BuildLogViewer.css` — 72 lines.
- `services/frontend/src/pages/FilesPage/components/BuildTargetCreateDialog.tsx`
- `services/frontend/src/pages/FilesPage/components/BuildTargetCreateDialog.css` — 122 lines, `spcd(18)` family.
- `services/frontend/src/pages/StaticAnalysisPage/components/TargetSelectDialog.tsx`
- `services/frontend/src/pages/StaticAnalysisPage/components/TargetSelectDialog.css` — 110 lines, `tsd(16)` family.
- `services/frontend/src/pages/ReportPage/components/CustomReportModal.tsx`
- `services/frontend/src/pages/ReportPage/components/CustomReportModal.css` — 60 lines.
- `services/frontend/src/shared/ui/ConfirmDialog.tsx`
- `services/frontend/src/shared/ui/ConfirmDialog.css` — 66 lines.
- `services/frontend/src/shared/ui/StateTransitionDialog.tsx`
- `services/frontend/src/shared/ui/StateTransitionDialog.css` — 29 lines.

**Implementation order:**
1. Convert custom overlay/card shells to `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `AlertDialog`, and `Button`.
2. Preserve escape/overlay/focus behavior and all destructive confirmation flows.
3. Remove CSS imports only after `rg "BuildLogViewer.css|BuildTargetCreateDialog.css|TargetSelectDialog.css|CustomReportModal.css|ConfirmDialog.css|StateTransitionDialog.css" services/frontend/src` is empty.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/shared/ui/ConfirmDialog.test.tsx src/pages/FilesPage/components/BuildTargetCreateDialog.test.tsx src/pages/ReportPage/components/CustomReportModal.test.tsx src/pages/StaticAnalysisPage/components/TargetSelectDialog.test.tsx src/shared/ui/ui-components.test.tsx
npm run typecheck
npm run build
```

**Owner split:** implementation owner migrates; worker-2 adds/updates escape/overlay/focus-return assertions if missing; worker-3 confirms shadcn Dialog/AlertDialog usage; worker-4 reviews visual density.

**Blockers:** do not delete `ConfirmDialog.css` if outside-click cancel bridge is still required by tests; keep a tiny bridge only if behavior cannot be represented via shadcn props/classes.

---

### Wave 2 — Form/control hot spots that keep global `.btn` and `.form-input` alive

**Why second:** Four files account for the most actionable broad selector refs: `BuildProfileForm` 9 `.form-input`, `VulnerabilitiesToolbar` 7 `.form-input` plus buttons, `SourceUploadView` 5 `.btn`/2 `.form-input`, and `MonitoringView` 4 `.form-input` plus controls.

**File groups to migrate:**
- `services/frontend/src/pages/FilesPage/components/BuildProfileForm.tsx` — 9 `form-input` refs.
- `services/frontend/src/pages/VulnerabilitiesPage/components/VulnerabilitiesToolbar.tsx` — 7 `form-input`, 2 `btn`, 2 `btn-sm`, 1 `btn-secondary`, 1 `btn-icon`, 2 `card`.
- `services/frontend/src/pages/StaticAnalysisPage/components/SourceUploadView.tsx` — 5 `btn`, 3 `btn-secondary`, 4 `card`, 2 `form-input`.
- `services/frontend/src/pages/DynamicAnalysisPage/components/MonitoringView.tsx` — 4 `form-input`, 3 `btn`, 4 `card`, live panel controls.
- CSS likely affected but not necessarily fully deletable yet:
  - `services/frontend/src/pages/FilesPage/components/BuildTargetSection.css`
  - `services/frontend/src/pages/VulnerabilitiesPage/VulnerabilitiesPage.css`
  - `services/frontend/src/pages/StaticAnalysisPage/components/SourceUploadView.css`
  - `services/frontend/src/pages/DynamicAnalysisPage/DynamicAnalysisPage.css`

**Implementation order:**
1. Replace text inputs/textareas/select-like controls with shadcn `Input`, `Textarea`, `Select`, `Label`.
2. Replace `.btn*` with shadcn `Button` variants/sizes.
3. Keep page-local layout classes only for grid/spacing that shadcn does not own.
4. After each file, run `rg 'className="[^"]*(form-input|btn|btn-secondary|btn-sm|btn-icon)' <file>` to prove local ref removal.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/FilesPage/components/BuildProfileForm.test.tsx src/pages/FilesPage/components/BuildTargetSection.test.tsx src/pages/FilesPage/FilesPage.test.tsx
npx vitest run src/pages/VulnerabilitiesPage/VulnerabilitiesPage.test.tsx
npx vitest run src/pages/StaticAnalysisPage/components/FileUploadView.test.tsx src/pages/StaticAnalysisPage/StaticAnalysisPage.test.tsx
npx vitest run src/pages/DynamicAnalysisPage/DynamicAnalysisPage.test.tsx
npm run typecheck
npm run build
```

**Owner split:** implementation owner migrates controls; worker-2 adds role/label assertions if current tests rely on classes; worker-4 checks toolbar/upload/monitoring visual density.

**Blockers:** DynamicAnalysis active/live monitoring has weak layout locks; add one browser smoke before deleting panel CSS there.

---

### Wave 3 — Shared UI primitive CSS collapse

**Why third:** Shared wrappers amplify blast radius but many are already conceptually shadcn components. Remove these before page-wide deletions so later pages compose from stable primitives.

**File groups:**
- `services/frontend/src/shared/ui/EmptyState.tsx` / `EmptyState.css` — 70 lines.
- `services/frontend/src/shared/ui/StatCard.tsx` / `StatCard.css` — 120 lines.
- `services/frontend/src/shared/ui/PageHeader.tsx` / `PageHeader.css` — 58 lines.
- `services/frontend/src/shared/ui/ListItem.tsx` / `ListItem.css` — 49 lines.
- `services/frontend/src/shared/ui/SeverityBar.tsx` / `SeverityBar.css` — 62 lines.
- `services/frontend/src/shared/ui/TargetProgressStepper.tsx` / `TargetProgressStepper.css` — 116 lines.
- `services/frontend/src/shared/ui/TargetStatusBadge.tsx` / `TargetStatusBadge.css` — 24 lines.
- `services/frontend/src/shared/ui/AdapterSelector.tsx` / `AdapterSelector.css` — 67 lines.
- `services/frontend/src/shared/ui/DonutChart.tsx` / `DonutChart.css` — 38 lines.
- `services/frontend/src/shared/ui/FindingSummary.tsx` / `FindingSummary.css` — 50 lines.

**Implementation order:**
1. Convert `EmptyState`, `StatCard`, and `PageHeader` first because they already wrap shadcn `Card` semantics or page header slots.
2. Add isolated smoke tests for CSS-only shared components before deleting styles where tests are missing: `AdapterSelector`, `DonutChart`, `FindingSummary`, `ListItem`, `SeverityBar`, `TargetProgressStepper`, `TargetStatusBadge`.
3. Keep chart SVG layout CSS only if it cannot be expressed with utility classes cleanly.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/shared/ui/*.test.tsx src/pages/OverviewPage/OverviewPage.test.tsx src/pages/ProjectSettingsPage/ProjectSettingsPage.test.tsx src/pages/StaticAnalysisPage/StaticAnalysisPage.test.tsx src/pages/QualityGatePage/QualityGatePage.test.tsx
npm run typecheck
npm run build
```

**Owner split:** worker-2 owns new shared component smoke tests; implementation owner migrates; worker-4 reviews all changed shared surfaces on Dashboard/Overview/StaticAnalysis.

**Blockers:** `src/components/ui` shadcn primitives have no direct tests; if wrappers add local behavior/variants, add wrapper-level smoke tests rather than testing upstream shadcn internals.

---

### Wave 4 — Low/medium page shells: auth, dashboard leaves, analysis history, approvals, quality gate

**Why fourth:** These pages are behavior-covered and lower risk than Files/StaticAnalysis. Approvals and AnalysisHistory have no current broad `.btn/.card/.badge/.form-input` production refs but still carry bespoke families.

**File groups:**
- Auth:
  - `services/frontend/src/pages/LoginPage/LoginPage.css` — 270 lines, `login-page/login-card/login-field`.
  - `services/frontend/src/pages/SignupPage/SignupPage.css` — 247 lines, `signup-page/signup-card/signup-field`.
- Dashboard leaf CSS:
  - `services/frontend/src/pages/DashboardPage/DashboardPage.css`
  - `services/frontend/src/pages/DashboardPage/dashboardTokens.css`
  - `services/frontend/src/pages/DashboardPage/components/ActivityEventCard.css`
  - `services/frontend/src/pages/DashboardPage/components/AttentionProjectCard.css`
  - `services/frontend/src/pages/DashboardPage/components/CreateProjectForm.css`
  - `services/frontend/src/pages/DashboardPage/components/DashboardEmptySurface.css`
  - `services/frontend/src/pages/DashboardPage/components/NeedsAttentionSection.css`
  - `services/frontend/src/pages/DashboardPage/components/ProjectExplorer.css`
  - `services/frontend/src/pages/DashboardPage/components/ProjectExplorerRow.css`
  - `services/frontend/src/pages/DashboardPage/components/ProjectExplorerSearch.css`
  - `services/frontend/src/pages/DashboardPage/components/RecentActivitySection.css`
- Admin/governance simple pages:
  - `services/frontend/src/pages/AnalysisHistoryPage/AnalysisHistoryPage.css` — 306 lines, `history-table(28)`.
  - `services/frontend/src/pages/ApprovalsPage/ApprovalsPage.css` — 336 lines, `approval-card(29)`.
  - `services/frontend/src/pages/QualityGatePage/QualityGatePage.css` — 318 lines, `gate-rule/gate-card/gate-status-banner`.

**Implementation order:**
1. Auth: use shadcn `Card`, `Input`, `Label`, `Button`; keep only page background/layout utilities.
2. Dashboard: migrate one leaf component at a time; each CSS file maps to one component and is deletable independently.
3. AnalysisHistory: move table to shadcn `Table` and badges to `Badge`.
4. Approvals: move approval cards/actions to shadcn `Card`, `Badge`, `Button`, `Dialog`.
5. QualityGate: replace `gate-card` and sidebar `card` shells with shadcn `Card`; rewrite class-coupled test selectors first.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/LoginPage/LoginPage.test.tsx src/pages/SignupPage/SignupPage.test.tsx
npx vitest run src/pages/DashboardPage/DashboardPage.test.tsx
npx vitest run src/pages/AnalysisHistoryPage/AnalysisHistoryPage.test.tsx src/pages/ApprovalsPage/ApprovalsPage.test.tsx src/pages/QualityGatePage/QualityGatePage.test.tsx
npm run typecheck
npm run build
```

**Visual evidence:** Playwright screenshot smoke for login/signup/dashboard plus one governance page after migration.

**Owner split:** implementation owner per page; worker-2 rewrites class-coupled QualityGate assertions; worker-4 has hard veto on Dashboard/Auth visual tone.

**Blockers:** visual regression is weak for shell/form composition; do not delete auth/dashboard CSS without screenshot evidence.

---

### Wave 5 — Report, shared findings, and FileDetail detail surfaces

**Why fifth:** Shared findings are medium blast radius and used by multiple detail views; migrate after shared UI primitives stabilize.

**File groups:**
- Report:
  - `services/frontend/src/pages/ReportPage/ReportPage.css` — 670 lines.
  - `services/frontend/src/pages/ReportPage/components/CustomReportModal.css` should already be gone from Wave 1.
- Shared findings:
  - `services/frontend/src/shared/findings/EvidencePanel.css` — 27 lines.
  - `services/frontend/src/shared/findings/EvidenceViewer.css` — 122 lines.
  - `services/frontend/src/shared/findings/FindingDetailView.css` — 86 lines.
  - `services/frontend/src/shared/findings/VulnerabilityDetailView.css` — 175 lines.
- File detail:
  - `services/frontend/src/pages/FileDetailPage/FileDetailPage.css` — 396 lines.

**Implementation order:**
1. Add/strengthen isolated tests for `EvidencePanel`, `EvidenceViewer`, `FindingDetailView`, `VulnerabilityDetailView` before deletion; Worker-2 flagged these as weak/no isolated tests.
2. Convert report section cards/tables to shadcn `Card`, `Table`, `Badge`, `Tabs` where needed.
3. Convert detail cards/badges/buttons to shadcn primitives.
4. Keep markdown/code block styling separate (`src/utils/markdown.css`) until dedicated markdown rendering review.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/ReportPage/ReportPage.test.tsx src/pages/FileDetailPage/FileDetailPage.test.tsx src/pages/StaticAnalysisPage/StaticAnalysisPage.test.tsx src/pages/VulnerabilitiesPage/VulnerabilitiesPage.test.tsx
npx vitest run src/pages/ReportPage/components/CustomReportModal.test.tsx src/shared/ui/*.test.tsx
npm run typecheck
npm run build
```

**Owner split:** worker-2 adds shared findings tests; implementation owner migrates report/detail components; worker-4 checks evidence readability and detail density.

**Blockers:** FileDetail tests cover detail surfaces partly transitively; add isolated shared findings tests before deleting shared findings CSS.

---

### Wave 6 — Runtime pages: DynamicAnalysis and DynamicTest

**Why sixth:** Behavior is covered, but active/live monitoring/progress layout is weakly locked and carries stateful controls.

**File groups:**
- `services/frontend/src/pages/DynamicAnalysisPage/DynamicAnalysisPage.css` — 654 lines, 36 broad legacy refs across page components.
- `services/frontend/src/pages/DynamicTestPage/DynamicTestPage.css` — 368 lines, 21 broad legacy refs.
- Shared dependency:
  - `services/frontend/src/shared/analysis/AnalysisListItem.css` — 98 lines, used by both pages.

**Implementation order:**
1. Finish `MonitoringView` control migration from Wave 2 if not already fully done.
2. Convert config/history/result/running cards to shadcn `Card`, `Badge`, `Button`, `Progress`.
3. Convert `AnalysisListItem` to a shadcn/Tailwind list row and remove shared analysis CSS only after both dynamic pages pass.
4. Add one browser smoke for active/live state per page before deleting monitoring/progress CSS.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/DynamicAnalysisPage/DynamicAnalysisPage.test.tsx src/pages/DynamicTestPage/DynamicTestPage.test.tsx
npm run typecheck
npm run build
```

**Owner split:** implementation owner migrates; worker-2 adds active/live smoke assertions where feasible; worker-4 reviews live-state legibility.

**Blockers:** live monitoring/progress visual layout is not fine-grained in Vitest; needs Playwright/browser smoke before CSS deletion.

---

### Wave 7 — Files workspace and build target surfaces

**Why seventh:** FilesPage has 1,122 CSS lines and 61 legacy refs, with keyboard-resizable workspace behavior that must not regress.

**File groups:**
- `services/frontend/src/pages/FilesPage/FilesPage.css` — 246 lines.
- `services/frontend/src/pages/FilesPage/components/FilesSourceWorkspace.css` — 301 lines, `source-tree(48)`.
- `services/frontend/src/pages/FilesPage/components/BuildTargetSection.css` — 273 lines, `bt-row(13)` plus form styles.
- `services/frontend/src/pages/FilesPage/components/TargetLibraryPanel.css` — 108 lines.
- `services/frontend/src/pages/FilesPage/components/BuildProfileForm.tsx` should have been migrated in Wave 2.
- `services/frontend/src/shared/ui/FileTreeNode.css` — 194 lines, shared with tree views.

**Implementation order:**
1. Complete build target action/button/form migration first (`BuildTargetActionBar`, `BuildTargetRow`, `BuildTargetSection`, `BuildProfileForm`).
2. Convert `TargetLibraryPanel` to shadcn `Card`, `Button`, `Input` where applicable.
3. Migrate `FileTreeNode` and `FilesSourceWorkspace` together only after keyboard/resize/selected row tests are updated away from class coupling.
4. Preserve resizable separator keyboard behavior and hidden-file-input upload tracking.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/FilesPage/FilesPage.test.tsx src/pages/FilesPage/components/BuildProfileForm.test.tsx src/pages/FilesPage/components/BuildTargetCreateDialog.test.tsx src/pages/FilesPage/components/BuildTargetSection.test.tsx src/pages/FilesPage/components/TargetLibraryPanel.test.tsx src/shared/ui/FileTreeNode.test.tsx
npm run typecheck
npm run build
```

**Visual/browser evidence:** Playwright/DOM smoke for source workspace resize, collapse/expand, upload button, build target rows.

**Owner split:** implementation owner migrates controls/tree; worker-2 rewrites class-coupled FileTreeNode selected row assertions; worker-4 checks workspace density.

**Blockers:** `source-tree` is the largest cross-page custom family (90 CSS selector refs, 69 TSX refs). Do not split Files/StaticAnalysis tree migration without a shared tree strategy.

---

### Wave 8 — ProjectSettings, Overview, Settings, Vulnerabilities page shells

**Why eighth:** These pages have large CSS but fewer broad refs than Files/StaticAnalysis; visual density and page composition are the main risk.

**File groups:**
- `services/frontend/src/pages/ProjectSettingsPage/ProjectSettingsPage.css` — 869 lines, `sdk-card(30)`, `project-settings-sidebar(15)`.
- `services/frontend/src/pages/OverviewPage/OverviewPage.css` — 817 lines, `overview-stat-card(14)`, `overview-empty-hero(7)`.
- `services/frontend/src/pages/SettingsPage/SettingsPage.css` — 645 lines, `gs-bento`, `settings-sidebar`, adapter/settings shells.
- `services/frontend/src/pages/VulnerabilitiesPage/VulnerabilitiesPage.css` — 759 lines, `vuln-finding-card(35)`, `vuln-filter-tab(13)`.

**Implementation order:**
1. ProjectSettings: migrate SDK cards/status/stepper/upload surfaces after preserving byte-level WS upload progress tests.
2. Overview: replace stat/summary/empty/activity cards with shared `StatCard`/shadcn `Card` after Wave 3 stabilizes shared primitives.
3. Settings: convert bento/settings cards and theme controls; preserve backend URL save/reset and theme preference tests.
4. Vulnerabilities: migrate toolbar first (if not completed in Wave 2), then finding cards/groups and filter tabs with shadcn `Tabs`, `Badge`, `Card`, `Button`.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/ProjectSettingsPage/ProjectSettingsPage.test.tsx src/pages/ProjectSettingsPage/components/SdkUploadForm.test.tsx
npx vitest run src/pages/OverviewPage/OverviewPage.test.tsx src/pages/SettingsPage/SettingsPage.test.tsx src/pages/VulnerabilitiesPage/VulnerabilitiesPage.test.tsx
npm run typecheck
npm run build
```

**Visual evidence:** screenshot smoke for Overview empty/populated, ProjectSettings SDK upload/progress, Vulnerabilities grouped/detail, Settings theme/backend.

**Owner split:** implementation owner per page; worker-2 protects SDK stepper/class-coupled assertions; worker-4 reviews page density and avoids SaaS-card mosaic drift.

**Blockers:** ProjectSettings and Overview have huge CSS files with low broad-ref counts, so raw selector replacement will not prove visual equivalence; screenshots are required.

---

### Wave 9 — StaticAnalysis final high-blast purge

**Why last:** Largest and most stateful CSS surface: 8 CSS files / 2,500 lines / 116 legacy refs. Worker-2 notes top-level tests mock child views heavily, so component tests and browser smoke are mandatory.

**File groups and order:**
1. Upload/dialog/control surfaces:
   - `services/frontend/src/pages/StaticAnalysisPage/components/SourceUploadView.css` — 258 lines.
   - `services/frontend/src/pages/StaticAnalysisPage/components/FileUploadView.tsx` refs.
   - `services/frontend/src/pages/StaticAnalysisPage/components/TargetSelectDialog.css` should be gone from Wave 1.
2. Progress surfaces:
   - `services/frontend/src/pages/StaticAnalysisPage/components/AnalysisProgressView.css` — 133 lines.
   - `services/frontend/src/pages/StaticAnalysisPage/components/AsyncAnalysisProgressView.css` — 170 lines.
   - `services/frontend/src/pages/StaticAnalysisPage/components/TwoStageProgressView.css` — 186 lines.
3. Result panels:
   - `services/frontend/src/pages/StaticAnalysisPage/components/AgentResultPanel.css` — 266 lines.
   - Static dashboard/result tab card/table classes in `StaticAnalysisPage.css`.
4. Source tree:
   - `services/frontend/src/pages/StaticAnalysisPage/components/SourceTreeView.css` — 304 lines.
   - Coordinate with `services/frontend/src/shared/ui/FileTreeNode.css` and Files wave tree strategy.
5. Page shell:
   - `services/frontend/src/pages/StaticAnalysisPage/StaticAnalysisPage.css` — 1,073 lines.

**Required tests:**
```bash
cd services/frontend
npx vitest run src/pages/StaticAnalysisPage/StaticAnalysisPage.test.tsx src/pages/StaticAnalysisPage/components/AgentResultPanel.test.tsx src/pages/StaticAnalysisPage/components/FileUploadView.test.tsx src/pages/StaticAnalysisPage/components/SourceTreeView.test.tsx src/pages/StaticAnalysisPage/components/TargetSelectDialog.test.tsx src/pages/StaticAnalysisPage/components/TwoStageProgressView.test.tsx
npm run typecheck
npm run build
```

**Visual/browser evidence:** mandatory Playwright/DOM smoke for dashboard empty, upload mode tabs/drop zone, in-flight progress, source tree, latest analysis, finding detail.

**Owner split:** implementation owner handles one sub-surface per commit; worker-2 drives component/browser coverage; worker-3 confirms Table/Tabs/Progress/ScrollArea/Resizable choices; worker-4 must approve before removing page shell CSS.

**Blockers:** source tree overlaps Files strategy; direct `StaticAnalysisPage.test.tsx` is insufficient alone because child views are heavily mocked.

---

### Wave 10 — Global bridge purge and final stylesheet contraction

**Why last:** Global styles are compatibility infrastructure, not page-specific debt, and are unsafe to delete while any broad class refs remain.

**File groups:**
- `services/frontend/src/styles/primitives.css` — 520 lines.
- `services/frontend/src/styles/shadcn-app.css` — 131 lines.
- `services/frontend/src/styles/utilities.css` — 59 lines.
- `services/frontend/src/styles/layout.css` — 90 lines.
- `services/frontend/src/styles/animations.css` — 147 lines.
- Keep `tokens.css`, `reset.css`, and `index.css` until a separate theme/token review proves shadcn/Tailwind v4 fully owns equivalent semantics.

**Entry criteria:**
```bash
cd services/frontend
rg 'className=.*\b(btn|btn-secondary|btn-sm|btn-icon|btn-danger|card|card-title|badge|badge-sm|badge-info|form-input)\b' src --glob '*.{ts,tsx}'
# expected: no production matches outside tests or intentionally retained shadcn primitive internals
```

**Required final tests:**
```bash
cd services/frontend
npm run typecheck
npm test
npm run build
```

**Visual/browser evidence:** full app smoke across Dashboard, Overview, Files, StaticAnalysis, ProjectSettings, Vulnerabilities, Report, DynamicAnalysis, DynamicTest, Auth/Settings.

**Owner split:** implementation owner deletes bridge; worker-2 runs full tests and updates any obsolete class-coupled tests; worker-4 performs final visual acceptance.

**Blockers:** global `input:not(...)`, `textarea`, and `select` bridge in `shadcn-app.css` cannot be removed until all form controls are explicit shadcn `Input`/`Textarea`/`Select` or equivalent.

## First implementation sprint recommendation

If the leader wants the next actionable implementation sprint, use this exact first sprint because it has high debt payoff and bounded risk:

1. **Tests first:** worker-2 completes task 9 checklist and adds/updates missing dialog/accessibility checks for Wave 1.
2. **Wave 1 implementation:** migrate `BuildTargetCreateDialog`, `TargetSelectDialog`, `CustomReportModal`, `ConfirmDialog`, `StateTransitionDialog`, and `BuildLogViewer` to shadcn dialog/button/input/card composition.
3. **Wave 2 partial implementation:** migrate `BuildProfileForm` and `VulnerabilitiesToolbar` to shadcn form controls/buttons.
4. **Verify:** run Wave 1+2 targeted commands, then `npm run typecheck`, `npm run build`, and `npm test` if the targeted bundle is green.
5. **Reviewer:** worker-4 reviews screenshots for dialogs, Files build target panel, and Vulnerabilities toolbar before merging.

## Blocker ledger

| Blocker | Impact | Required resolution |
|---|---|---|
| Worker-4 frontend-skill hard-veto still in progress | Visual acceptance criteria may change wave order or reject styling direction. | Wait for worker-4 verdict before high-blast visible page CSS deletion. |
| Worker-2 task 9 first-wave checklist still in progress | First sprint may need additional tests before deletion. | Treat task 9 as gate for Wave 1 implementation. |
| Visual/e2e lock gap | Vitest covers behavior, not density/spacing/responsive C-standard. | Capture Playwright screenshots or DOM smoke per visible wave. |
| Class-coupled tests | CSS deletion may fail tests for the wrong reason. | Rewrite to role/name/semantic assertions before migrating affected classes. |
| StaticAnalysis child-view mocking | Top-level page test cannot prove subview visual/interaction preservation. | Run component tests and browser smoke for each StaticAnalysis sub-surface. |
| Source tree shared family | `source-tree` spans Files and StaticAnalysis plus shared FileTreeNode. | Design one shared tree migration strategy before deleting tree CSS. |
| No frontend lint script | Cannot satisfy lint gate with an existing project command. | Report N/A unless a lint script is added. |

## Verification for this read-only plan

- Report artifact exists: this file.
- Inputs referenced: task 5 CSS cartography and worker-2 test map.
- Production edits: none.
- Recommended implementation verification is embedded per wave.
