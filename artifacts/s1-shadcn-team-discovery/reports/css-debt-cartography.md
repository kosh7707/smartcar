# Task 5 — CSS Debt Cartography

Generated: 2026-04-15T07:49:07.285666+00:00

## Scope and method

- Scope: `services/frontend/src/**` CSS and CSS import consumers only; no production files edited.
- Inventory commands: `find src -name "*.css"`, CSS import grep, and Python parsing of CSS selectors plus production TS/TSX class token usage.
- Production TS/TSX usage counts below exclude tests and `src/components/ui/*` shadcn primitive implementations so the debt map tracks app-level bespoke dependencies.

## Executive inventory

- CSS files: **72**
- CSS lines: **14949**
- CSS import status: **72/72 imported**, **0 unused files** detected by static CSS import scan.
- Highest line-count areas: StaticAnalysisPage (2,500), global styles (1,413), FilesPage (1,122), shared UI (980), ProjectSettingsPage (869), OverviewPage (817), VulnerabilitiesPage (759).
- Broad bridge dependency remains substantial: app production code still directly references `.card` **108** times, `.btn*` **139** token occurrences across button variants, `.badge*` **41**, and `.form-input` **29**.

## Area blast-radius table

| Rank | Area | CSS files | CSS lines | Production legacy class-token refs | Primary selector families | Blast radius |
|---:|---|---:|---:|---:|---|---|
| 1 | `pages/StaticAnalysisPage` | 8 | 2500 | 116 | source-tree(42), async-stepper(18), tsd(16), two-stage-step(16) | high |
| 2 | `styles` | 7 | 1413 | 0 | stagger(13), severity-chip(10), table(10), badge-status(7) | high |
| 3 | `pages/FilesPage` | 6 | 1122 | 61 | source-tree(48), spcd(18), tlib(15), bt-row(13) | high |
| 4 | `src/shared/ui` | 14 | 980 | 16 | tps(26), severity-bar(17), stat-card(16), list-item(10) | high |
| 5 | `pages/ProjectSettingsPage` | 1 | 869 | 8 | sdk-card(30), project-settings-sidebar(15), project-settings-danger(11), project-settings-panel(9) | high |
| 6 | `pages/OverviewPage` | 1 | 817 | 8 | overview-stat-card(14), overview-empty-hero(7), overview-target-card(6), overview-activity-item(6) | high |
| 7 | `pages/VulnerabilitiesPage` | 1 | 759 | 17 | vuln-finding-card(35), vuln-card(14), vuln-filter-tab(13), vuln-group(10) | medium |
| 8 | `pages/ReportPage` | 2 | 730 | 20 | report-breakdown-table(12), report-findings(12), report-summary(11), report-severity-bar(10) | medium |
| 9 | `layouts` | 4 | 703 | 2 | navbar-notification(14), navbar-actions(11), navbar-theme(11), navbar-notifications(9) | medium |
| 10 | `pages/DashboardPage` | 11 | 664 | 1 | attention-project-card(20), project-explorer-row(17), dashboard-empty-surface(15), activity-event-card(10) | medium |
| 11 | `pages/DynamicAnalysisPage` | 1 | 654 | 36 | inject-history-item(10), alert-card(8), dyn-config(8), inject-scenario-card(7) | medium |
| 12 | `pages/SettingsPage` | 1 | 645 | 2 | gs-bento(10), settings-sidebar(10), gs-info-value(9), adapter-row(7) | medium |
| 13 | `src/shared/findings` | 4 | 410 | 41 | evidence-viewer(11), evidence-renderer-placeholder(4), detail-meta-link(4), evidence-panel(3) | medium |
| 14 | `pages/FileDetailPage` | 1 | 396 | 8 | file-detail-header(7), file-detail-badge(3), file-detail-toolbar(3), file-detail-tab(3) | medium |
| 15 | `pages/DynamicTestPage` | 1 | 368 | 21 | dtest-config(18), dtest-finding-card(13), dtest-running(5), dtest-finding-row(5) | medium |
| 16 | `pages/ApprovalsPage` | 1 | 336 | 0 | approval-card(29), approval-summary(6), approval-status(4), approval-toolbar(3) | medium |
| 17 | `pages/QualityGatePage` | 1 | 318 | 3 | gate-rule(13), gate-history-row(9), gate-status-banner(8), gate-card(7) | medium |
| 18 | `pages/AnalysisHistoryPage` | 1 | 306 | 0 | history-table(28), history-sev(9), history-panel(6), history-kpi(5) | medium |
| 19 | `pages/LoginPage` | 1 | 270 | 1 | login-page(19), login-card(6), login-field(5), login-submit(3) | low |
| 20 | `pages/SignupPage` | 1 | 247 | 1 | signup-page(19), signup-card(5), signup-field(4), signup-submit(3) | low |
| 21 | `root` | 1 | 137 | 0 | dark(2), css(1) | low |
| 22 | `utils` | 1 | 108 | 0 | md-table(4), md-heading(2), md-list(2), md-link(2) | low |
| 23 | `contexts` | 1 | 99 | 0 | toast(9), toast-container(1) | low |
| 24 | `src/shared/analysis` | 1 | 98 | 0 | analysis-item(16), list-item(1) | low |

## Legacy broad-selector dependency counts

### Production TS/TSX class token usage

| Token | Total refs | Files | Top files |
|---|---:|---:|---|
| `btn` | 61 | 29 | `src/pages/StaticAnalysisPage/components/SourceUploadView.tsx`:5; `src/pages/StaticAnalysisPage/components/TwoStageProgressView.tsx`:5; `src/pages/StaticAnalysisPage/components/LatestAnalysisTab.tsx`:4; `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:3; `src/pages/FilesPage/components/BuildTargetActionBar.tsx`:3; `src/pages/FilesPage/components/BuildTargetRow.tsx`:3; `src/pages/StaticAnalysisPage/components/FileUploadView.tsx`:3; `src/pages/DynamicAnalysisPage/components/DynamicAnalysisHistoryView.tsx`:2 |
| `btn-primary` | 1 | 1 | `src/layouts/ErrorBoundary.tsx`:1 |
| `btn-secondary` | 33 | 22 | `src/pages/StaticAnalysisPage/components/LatestAnalysisTab.tsx`:3; `src/pages/StaticAnalysisPage/components/SourceUploadView.tsx`:3; `src/pages/StaticAnalysisPage/components/TwoStageProgressView.tsx`:3; `src/pages/FilesPage/components/BuildTargetActionBar.tsx`:2; `src/pages/FilesPage/components/BuildTargetRow.tsx`:2; `src/pages/StaticAnalysisPage/components/ActiveAnalysisBanner.tsx`:2; `src/pages/StaticAnalysisPage/components/FileUploadView.tsx`:2; `src/shared/findings/FindingDetailView.tsx`:2 |
| `btn-sm` | 29 | 16 | `src/pages/FilesPage/components/BuildTargetActionBar.tsx`:3; `src/pages/FilesPage/components/BuildTargetRow.tsx`:3; `src/pages/StaticAnalysisPage/components/LatestAnalysisTab.tsx`:3; `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:2; `src/pages/FilesPage/components/BuildTargetSection.tsx`:2; `src/pages/FilesPage/components/FilesPageHeader.tsx`:2; `src/pages/FilesPage/components/TargetLibraryPanel.tsx`:2; `src/pages/StaticAnalysisPage/components/ActiveAnalysisBanner.tsx`:2 |
| `btn-icon` | 8 | 6 | `src/pages/DynamicAnalysisPage/components/DynamicAnalysisHistoryView.tsx`:2; `src/pages/FilesPage/components/BuildTargetRow.tsx`:2; `src/pages/DynamicTestPage/components/DynamicTestHistoryView.tsx`:1; `src/pages/FilesPage/components/BuildLogViewer.tsx`:1; `src/pages/VulnerabilitiesPage/components/VulnerabilitiesToolbar.tsx`:1; `src/shared/findings/EvidenceViewer.tsx`:1 |
| `btn-danger` | 7 | 6 | `src/pages/DynamicAnalysisPage/components/DynamicAnalysisHistoryView.tsx`:2; `src/pages/DynamicTestPage/components/DynamicTestHistoryView.tsx`:1; `src/pages/FilesPage/components/BuildTargetRow.tsx`:1; `src/pages/StaticAnalysisPage/components/ActiveAnalysisBanner.tsx`:1; `src/pages/StaticAnalysisPage/components/AsyncAnalysisProgressView.tsx`:1; `src/pages/StaticAnalysisPage/components/TwoStageProgressView.tsx`:1 |
| `btn-stop` | 1 | 1 | `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:1 |
| `card` | 108 | 60 | `src/shared/findings/FindingDetailView.tsx`:8; `src/pages/StaticAnalysisPage/components/AgentResultPanel.tsx`:6; `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:4; `src/pages/StaticAnalysisPage/components/OverallStatusTab.tsx`:4; `src/pages/StaticAnalysisPage/components/SourceUploadView.tsx`:4; `src/shared/findings/VulnerabilityDetailView.tsx`:4; `src/pages/DynamicAnalysisPage/components/SessionDetailView.tsx`:3; `src/pages/DynamicTestPage/components/DynamicTestRunningView.tsx`:3 |
| `card-title` | 47 | 26 | `src/shared/findings/FindingDetailView.tsx`:7; `src/pages/StaticAnalysisPage/components/AgentResultPanel.tsx`:5; `src/pages/StaticAnalysisPage/components/OverallStatusTab.tsx`:4; `src/pages/OverviewPage/components/OverviewBottomGrid.tsx`:3; `src/shared/findings/VulnerabilityDetailView.tsx`:3; `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:2; `src/pages/DynamicAnalysisPage/components/SessionDetailView.tsx`:2; `src/pages/DynamicTestPage/components/DynamicTestRunningView.tsx`:2 |
| `badge` | 26 | 19 | `src/pages/StaticAnalysisPage/components/RecentRunsList.tsx`:4; `src/constants/modules.tsx`:3; `src/pages/ReportPage/components/ReportRunsSection.tsx`:2; `src/shared/findings/FindingDetailView.tsx`:2; `src/pages/DashboardPage/components/AttentionProjectCard.tsx`:1; `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:1; `src/pages/DynamicAnalysisPage/components/SessionDetailView.tsx`:1; `src/pages/ReportPage/components/ReportApprovalsSection.tsx`:1 |
| `badge-sm` | 8 | 7 | `src/pages/ReportPage/components/ReportRunsSection.tsx`:2; `src/pages/ReportPage/components/ReportApprovalsSection.tsx`:1; `src/shared/findings/EvidenceItemRow.tsx`:1; `src/shared/findings/EvidenceViewer.tsx`:1; `src/shared/ui/FindingStatusBadge.tsx`:1; `src/shared/ui/GateResultCard.tsx`:1; `src/shared/ui/SeverityBadge.tsx`:1 |
| `badge-info` | 5 | 5 | `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:1; `src/pages/DynamicAnalysisPage/components/SessionDetailView.tsx`:1; `src/pages/StaticAnalysisPage/components/RecentRunsList.tsx`:1; `src/shared/findings/EvidenceItemRow.tsx`:1; `src/shared/findings/EvidenceViewer.tsx`:1 |
| `badge-critical` | 1 | 1 | `src/pages/StaticAnalysisPage/components/RecentRunsList.tsx`:1 |
| `badge-low` | 1 | 1 | `src/pages/StaticAnalysisPage/components/RecentRunsList.tsx`:1 |
| `form-input` | 29 | 7 | `src/pages/FilesPage/components/BuildProfileForm.tsx`:9; `src/pages/VulnerabilitiesPage/components/VulnerabilitiesToolbar.tsx`:7; `src/pages/DynamicAnalysisPage/components/MonitoringView.tsx`:4; `src/pages/DynamicTestPage/components/DynamicTestConfigView.tsx`:4; `src/pages/FilesPage/components/BuildTargetSection.tsx`:2; `src/pages/StaticAnalysisPage/components/SourceUploadView.tsx`:2; `src/pages/FilesPage/components/BuildTargetCreateDialog.tsx`:1 |

### CSS bridge/global selector definitions still present

| Selector | CSS refs | Defining files |
|---|---:|---|
| `.btn` | 9 | `src/pages/ProjectSettingsPage/ProjectSettingsPage.css`:1; `src/pages/ReportPage/ReportPage.css`:1; `src/pages/StaticAnalysisPage/components/SourceUploadView.css`:1; `src/styles/primitives.css`:5; `src/styles/shadcn-app.css`:1 |
| `.btn-secondary` | 5 | `src/pages/ReportPage/ReportPage.css`:1; `src/styles/primitives.css`:3; `src/styles/shadcn-app.css`:1 |
| `.btn-tertiary` | 3 | `src/styles/primitives.css`:2; `src/styles/shadcn-app.css`:1 |
| `.btn-ghost` | 3 | `src/styles/primitives.css`:2; `src/styles/shadcn-app.css`:1 |
| `.btn-sm` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.btn-icon` | 4 | `src/styles/primitives.css`:4 |
| `.btn-danger` | 3 | `src/styles/primitives.css`:2; `src/styles/shadcn-app.css`:1 |
| `.btn-stop` | 3 | `src/pages/DynamicAnalysisPage/DynamicAnalysisPage.css`:3 |
| `.card` | 15 | `src/pages/FilesPage/FilesPage.css`:2; `src/pages/FilesPage/components/BuildTargetSection.css`:1; `src/pages/OverviewPage/OverviewPage.css`:2; `src/pages/QualityGatePage/QualityGatePage.css`:1; `src/pages/ReportPage/ReportPage.css`:3; `src/pages/StaticAnalysisPage/StaticAnalysisPage.css`:1; `src/pages/StaticAnalysisPage/components/SourceUploadView.css`:3; `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.card-title` | 6 | `src/pages/StaticAnalysisPage/StaticAnalysisPage.css`:2; `src/pages/StaticAnalysisPage/components/SourceUploadView.css`:1; `src/shared/findings/FindingDetailView.css`:1; `src/styles/primitives.css`:2 |
| `.badge` | 5 | `src/pages/StaticAnalysisPage/StaticAnalysisPage.css`:3; `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.badge-sm` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.badge-info` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.badge-critical` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.badge-high` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.badge-medium` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.badge-low` | 2 | `src/styles/primitives.css`:1; `src/styles/shadcn-app.css`:1 |
| `.form-input` | 5 | `src/styles/primitives.css`:4; `src/styles/shadcn-app.css`:1 |

## Top bespoke selector families

These are the custom shells most worth replacing with shadcn/Tailwind composition or page-local component primitives. CSS counts are selector references; TSX counts are production class-token references.

| Family | CSS selector refs | CSS files | Production TSX refs | Production TSX files |
|---|---:|---:|---:|---:|
| `source-tree` | 90 | 2 | 69 | 3 |
| `vuln-finding-card` | 35 | 1 | 17 | 1 |
| `sdk-card` | 30 | 1 | 20 | 1 |
| `approval-card` | 29 | 1 | 16 | 1 |
| `history-table` | 28 | 1 | 31 | 1 |
| `tps` | 26 | 1 | 0 | 0 |
| `stat-card` | 24 | 3 | 7 | 1 |
| `login-page` | 22 | 2 | 11 | 1 |
| `signup-page` | 22 | 2 | 11 | 1 |
| `card` | 21 | 10 | 0 | 0 |
| `attention-project-card` | 20 | 1 | 10 | 1 |
| `gate-card` | 19 | 2 | 16 | 2 |
| `dtest-config` | 18 | 1 | 32 | 1 |
| `spcd` | 18 | 1 | 0 | 0 |
| `async-stepper` | 18 | 1 | 9 | 1 |
| `project-explorer-row` | 17 | 1 | 11 | 1 |
| `vuln-card` | 17 | 2 | 4 | 3 |
| `severity-bar` | 17 | 1 | 9 | 1 |
| `project-settings-sidebar` | 16 | 2 | 11 | 1 |
| `tsd` | 16 | 1 | 0 | 0 |
| `two-stage-step` | 16 | 1 | 9 | 1 |
| `analysis-item` | 16 | 1 | 21 | 2 |
| `dashboard-empty-surface` | 15 | 1 | 7 | 1 |
| `tlib` | 15 | 1 | 0 | 0 |
| `navbar-actions` | 14 | 2 | 9 | 1 |
| `navbar-notification` | 14 | 1 | 12 | 1 |
| `overview-stat-card` | 14 | 1 | 28 | 1 |
| `analysis-stepper` | 14 | 1 | 8 | 1 |
| `navbar-theme` | 13 | 2 | 10 | 1 |
| `dtest-finding-card` | 13 | 1 | 11 | 1 |
| `bt-row` | 13 | 1 | 10 | 1 |
| `gate-rule` | 13 | 1 | 9 | 1 |
| `ranking-table` | 13 | 1 | 14 | 2 |
| `vuln-filter-tab` | 13 | 1 | 5 | 1 |
| `stagger` | 13 | 1 | 0 | 0 |
| `report-breakdown-table` | 12 | 1 | 1 | 1 |
| `report-findings` | 12 | 1 | 20 | 1 |
| `gs-bento` | 12 | 2 | 5 | 5 |
| `async-progress` | 12 | 1 | 12 | 1 |
| `navbar-notifications` | 11 | 2 | 9 | 1 |
| `page-header` | 11 | 4 | 9 | 1 |
| `project-settings-danger` | 11 | 1 | 9 | 1 |
| `report-summary` | 11 | 1 | 7 | 1 |
| `file-coverage` | 11 | 1 | 10 | 1 |
| `list-item` | 11 | 2 | 10 | 2 |

## Page-local CSS dependency chains

### `pages/AnalysisHistoryPage` — 1 CSS files / 306 lines
- `src/pages/AnalysisHistoryPage/AnalysisHistoryPage.tsx` imports: `src/pages/AnalysisHistoryPage/AnalysisHistoryPage.css`

### `pages/ApprovalsPage` — 1 CSS files / 336 lines
- `src/pages/ApprovalsPage/ApprovalsPage.tsx` imports: `src/pages/ApprovalsPage/ApprovalsPage.css`

### `pages/DashboardPage` — 11 CSS files / 664 lines
- `src/pages/DashboardPage/DashboardPage.tsx` imports: `src/pages/DashboardPage/dashboardTokens.css`, `src/pages/DashboardPage/DashboardPage.css`
- `src/pages/DashboardPage/components/ActivityEventCard.tsx` imports: `src/pages/DashboardPage/components/ActivityEventCard.css`
- `src/pages/DashboardPage/components/AttentionProjectCard.tsx` imports: `src/pages/DashboardPage/components/AttentionProjectCard.css`
- `src/pages/DashboardPage/components/CreateProjectForm.tsx` imports: `src/pages/DashboardPage/components/CreateProjectForm.css`
- `src/pages/DashboardPage/components/DashboardEmptySurface.tsx` imports: `src/pages/DashboardPage/components/DashboardEmptySurface.css`
- `src/pages/DashboardPage/components/NeedsAttentionSection.tsx` imports: `src/pages/DashboardPage/components/NeedsAttentionSection.css`
- `src/pages/DashboardPage/components/ProjectExplorer.tsx` imports: `src/pages/DashboardPage/components/ProjectExplorer.css`
- `src/pages/DashboardPage/components/ProjectExplorerRow.tsx` imports: `src/pages/DashboardPage/components/ProjectExplorerRow.css`
- `src/pages/DashboardPage/components/ProjectExplorerSearch.tsx` imports: `src/pages/DashboardPage/components/ProjectExplorerSearch.css`
- `src/pages/DashboardPage/components/RecentActivitySection.tsx` imports: `src/pages/DashboardPage/components/RecentActivitySection.css`

### `pages/DynamicAnalysisPage` — 1 CSS files / 654 lines
- `src/pages/DynamicAnalysisPage/DynamicAnalysisPage.tsx` imports: `src/shared/analysis/AnalysisListItem.css`, `src/pages/DynamicAnalysisPage/DynamicAnalysisPage.css`

### `pages/DynamicTestPage` — 1 CSS files / 368 lines
- `src/pages/DynamicTestPage/DynamicTestPage.tsx` imports: `src/shared/analysis/AnalysisListItem.css`, `src/pages/DynamicTestPage/DynamicTestPage.css`

### `pages/FileDetailPage` — 1 CSS files / 396 lines
- `src/pages/FileDetailPage/FileDetailPage.tsx` imports: `src/pages/FileDetailPage/FileDetailPage.css`

### `pages/FilesPage` — 6 CSS files / 1122 lines
- `src/pages/FilesPage/FilesPage.tsx` imports: `src/pages/FilesPage/FilesPage.css`
- `src/pages/FilesPage/components/BuildLogViewer.tsx` imports: `src/pages/FilesPage/components/BuildLogViewer.css`
- `src/pages/FilesPage/components/BuildTargetCreateDialog.tsx` imports: `src/pages/FilesPage/components/BuildTargetCreateDialog.css`
- `src/pages/FilesPage/components/BuildTargetSection.tsx` imports: `src/pages/FilesPage/components/BuildTargetSection.css`
- `src/pages/FilesPage/components/FilesSourceWorkspace.tsx` imports: `src/pages/FilesPage/components/FilesSourceWorkspace.css`
- `src/pages/FilesPage/components/TargetLibraryPanel.tsx` imports: `src/pages/FilesPage/components/TargetLibraryPanel.css`

### `pages/LoginPage` — 1 CSS files / 270 lines
- `src/pages/LoginPage/LoginPage.tsx` imports: `src/pages/LoginPage/LoginPage.css`

### `pages/OverviewPage` — 1 CSS files / 817 lines
- `src/pages/OverviewPage/OverviewPage.tsx` imports: `src/pages/OverviewPage/OverviewPage.css`

### `pages/ProjectSettingsPage` — 1 CSS files / 869 lines
- `src/pages/ProjectSettingsPage/ProjectSettingsPage.tsx` imports: `src/pages/ProjectSettingsPage/ProjectSettingsPage.css`

### `pages/QualityGatePage` — 1 CSS files / 318 lines
- `src/pages/QualityGatePage/QualityGatePage.tsx` imports: `src/pages/QualityGatePage/QualityGatePage.css`

### `pages/ReportPage` — 2 CSS files / 730 lines
- `src/pages/ReportPage/ReportPage.tsx` imports: `src/pages/ReportPage/ReportPage.css`
- `src/pages/ReportPage/components/CustomReportModal.tsx` imports: `src/pages/ReportPage/components/CustomReportModal.css`

### `pages/SettingsPage` — 1 CSS files / 645 lines
- `src/pages/SettingsPage/SettingsPage.tsx` imports: `src/pages/SettingsPage/SettingsPage.css`

### `pages/SignupPage` — 1 CSS files / 247 lines
- `src/pages/SignupPage/SignupPage.tsx` imports: `src/pages/SignupPage/SignupPage.css`

### `pages/StaticAnalysisPage` — 8 CSS files / 2500 lines
- `src/pages/StaticAnalysisPage/StaticAnalysisPage.tsx` imports: `src/pages/StaticAnalysisPage/StaticAnalysisPage.css`
- `src/pages/StaticAnalysisPage/components/AgentResultPanel.tsx` imports: `src/pages/StaticAnalysisPage/components/AgentResultPanel.css`
- `src/pages/StaticAnalysisPage/components/AnalysisProgressView.tsx` imports: `src/pages/StaticAnalysisPage/components/AnalysisProgressView.css`
- `src/pages/StaticAnalysisPage/components/AsyncAnalysisProgressView.tsx` imports: `src/pages/StaticAnalysisPage/components/AsyncAnalysisProgressView.css`
- `src/pages/StaticAnalysisPage/components/SourceTreeView.tsx` imports: `src/pages/StaticAnalysisPage/components/SourceTreeView.css`
- `src/pages/StaticAnalysisPage/components/SourceUploadView.tsx` imports: `src/pages/StaticAnalysisPage/components/SourceUploadView.css`
- `src/pages/StaticAnalysisPage/components/TargetSelectDialog.tsx` imports: `src/pages/StaticAnalysisPage/components/TargetSelectDialog.css`
- `src/pages/StaticAnalysisPage/components/TwoStageProgressView.tsx` imports: `src/pages/StaticAnalysisPage/components/TwoStageProgressView.css`

### `pages/VulnerabilitiesPage` — 1 CSS files / 759 lines
- `src/pages/VulnerabilitiesPage/VulnerabilitiesPage.tsx` imports: `src/pages/VulnerabilitiesPage/VulnerabilitiesPage.css`

### Global/layout/shared dependency chains

- `src/contexts/ToastContext.tsx` imports: `src/contexts/ToastContext.css`
- `src/layouts/ErrorBoundary.tsx` imports: `src/layouts/ErrorBoundary.css`
- `src/layouts/Navbar.tsx` imports: `src/layouts/Navbar.css`
- `src/layouts/ProjectBreadcrumbLayout.tsx` imports: `src/layouts/ProjectBreadcrumbLayout.css`
- `src/layouts/Sidebar.tsx` imports: `src/layouts/Sidebar.css`
- `src/main.tsx` imports: `src/styles/tokens.css`, `src/styles/reset.css`, `src/styles/animations.css`, `src/styles/layout.css`, `src/styles/primitives.css`, `src/styles/utilities.css`, `src/index.css`, `src/styles/shadcn-app.css`
- `src/shared/findings/EvidencePanel.tsx` imports: `src/shared/findings/EvidencePanel.css`
- `src/shared/findings/EvidenceViewer.tsx` imports: `src/shared/findings/EvidenceViewer.css`
- `src/shared/findings/FindingDetailView.tsx` imports: `src/shared/findings/FindingDetailView.css`
- `src/shared/findings/VulnerabilityDetailView.tsx` imports: `src/shared/findings/VulnerabilityDetailView.css`
- `src/shared/ui/AdapterSelector.tsx` imports: `src/shared/ui/AdapterSelector.css`
- `src/shared/ui/ConfirmDialog.tsx` imports: `src/shared/ui/ConfirmDialog.css`
- `src/shared/ui/ConnectionStatusBanner.tsx` imports: `src/shared/ui/ConnectionStatusBanner.css`
- `src/shared/ui/DonutChart.tsx` imports: `src/shared/ui/DonutChart.css`
- `src/shared/ui/EmptyState.tsx` imports: `src/shared/ui/EmptyState.css`
- `src/shared/ui/FileTreeNode.tsx` imports: `src/shared/ui/FileTreeNode.css`
- `src/shared/ui/FindingSummary.tsx` imports: `src/shared/ui/FindingSummary.css`
- `src/shared/ui/ListItem.tsx` imports: `src/shared/ui/ListItem.css`
- `src/shared/ui/PageHeader.tsx` imports: `src/shared/ui/PageHeader.css`
- `src/shared/ui/SeverityBar.tsx` imports: `src/shared/ui/SeverityBar.css`
- `src/shared/ui/StatCard.tsx` imports: `src/shared/ui/StatCard.css`
- `src/shared/ui/StateTransitionDialog.tsx` imports: `src/shared/ui/StateTransitionDialog.css`
- `src/shared/ui/TargetProgressStepper.tsx` imports: `src/shared/ui/TargetProgressStepper.css`
- `src/shared/ui/TargetStatusBadge.tsx` imports: `src/shared/ui/TargetStatusBadge.css`
- `src/utils/markdown.tsx` imports: `src/utils/markdown.css`

## Every remaining CSS file

| Area | CSS file | Lines | Top selector families |
|---|---|---:|---|
| `contexts` | `src/contexts/ToastContext.css` | 99 | toast(9), toast-container(1) |
| `layouts` | `src/layouts/ErrorBoundary.css` | 42 | error-boundary(5) |
| `layouts` | `src/layouts/Navbar.css` | 433 | navbar-notification(14), navbar-actions(11), navbar-theme(11), navbar-notifications(9), navbar-brand(8), navbar-navlink(3) |
| `layouts` | `src/layouts/ProjectBreadcrumbLayout.css` | 78 | breadcrumb-link(4), breadcrumb(3), breadcrumb-current(2), breadcrumb-sep(1) |
| `layouts` | `src/layouts/Sidebar.css` | 150 | sidebar-link(7), sidebar-header-row(3), active(3), sidebar-header(2), lucide(2), sidebar(1) |
| `pages/AnalysisHistoryPage` | `src/pages/AnalysisHistoryPage/AnalysisHistoryPage.css` | 306 | history-table(28), history-sev(9), history-panel(6), history-kpi(5), history-filter(4), history-toolbar(3) |
| `pages/ApprovalsPage` | `src/pages/ApprovalsPage/ApprovalsPage.css` | 336 | approval-card(29), approval-summary(6), approval-status(4), approval-toolbar(3), approval-filter(3), approval-dialog(3) |
| `pages/DashboardPage` | `src/pages/DashboardPage/DashboardPage.css` | 85 | dashboard(3), dashboard-main(3), dashboard-section-heading(3), dashboard-body(2), dashboard-section(1) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/ActivityEventCard.css` | 59 | activity-event-card(10) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/AttentionProjectCard.css` | 134 | attention-project-card(20) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/CreateProjectForm.css` | 54 | create-project-form(7) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/DashboardEmptySurface.css` | 68 | dashboard-empty-surface(15) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/NeedsAttentionSection.css` | 6 | needs-attention-list(1) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/ProjectExplorer.css` | 51 | project-explorer(2), project-explorer-list(2), project-explorer-empty-action(2) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/ProjectExplorerRow.css` | 112 | project-explorer-row(17), project-explorer-list(2) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/ProjectExplorerSearch.css` | 58 | project-explorer-search(5), project-explorer-create-btn(2) |
| `pages/DashboardPage` | `src/pages/DashboardPage/components/RecentActivitySection.css` | 30 | recent-activity-more(3), recent-activity-list(1) |
| `pages/DashboardPage` | `src/pages/DashboardPage/dashboardTokens.css` | 7 | dashboard(1) |
| `pages/DynamicAnalysisPage` | `src/pages/DynamicAnalysisPage/DynamicAnalysisPage.css` | 654 | inject-history-item(10), alert-card(8), dyn-config(8), inject-scenario-card(7), dyn-external-waiting(7), can-table(6) |
| `pages/DynamicTestPage` | `src/pages/DynamicTestPage/DynamicTestPage.css` | 368 | dtest-config(18), dtest-finding-card(13), dtest-running(5), dtest-finding-row(5), dtest-result-config(3), dtest-running-grid(2) |
| `pages/FileDetailPage` | `src/pages/FileDetailPage/FileDetailPage.css` | 396 | file-detail-header(7), file-detail-badge(3), file-detail-toolbar(3), file-detail-tab(3), file-detail-vuln-row(2), file-detail-vuln-location(2) |
| `pages/FilesPage` | `src/pages/FilesPage/FilesPage.css` | 246 | fpage-tree-card(8), fpage-langbar(7), fpage-page-header(4), fpage-summary(3), fpage(2), card(2) |
| `pages/FilesPage` | `src/pages/FilesPage/components/BuildLogViewer.css` | 72 | build-log-header(2), build-log-overlay(1), build-log-modal(1), build-log-actions(1), build-log-body(1), build-log-pre(1) |
| `pages/FilesPage` | `src/pages/FilesPage/components/BuildTargetCreateDialog.css` | 122 | spcd(18) |
| `pages/FilesPage` | `src/pages/FilesPage/components/BuildTargetSection.css` | 273 | bt-row(13), bt-form(4), bp-advanced-toggle(3), fpage-build-target-card(2), bp-grid(2), card(1) |
| `pages/FilesPage` | `src/pages/FilesPage/components/FilesSourceWorkspace.css` | 301 | source-tree(48), fpage-workspace(2) |
| `pages/FilesPage` | `src/pages/FilesPage/components/TargetLibraryPanel.css` | 108 | tlib(15), tlib-loading(1) |
| `pages/LoginPage` | `src/pages/LoginPage/LoginPage.css` | 270 | login-page(19), login-card(6), login-field(5), login-submit(3), page-header(1), login-form-section(1) |
| `pages/OverviewPage` | `src/pages/OverviewPage/OverviewPage.css` | 817 | overview-stat-card(14), overview-empty-hero(7), overview-target-card(6), overview-activity-item(6), overview-target-summary(6), stat-card(6) |
| `pages/ProjectSettingsPage` | `src/pages/ProjectSettingsPage/ProjectSettingsPage.css` | 869 | sdk-card(30), project-settings-sidebar(15), project-settings-danger(11), project-settings-panel(9), project-settings-field(9), sdk-upload-zone(8) |
| `pages/QualityGatePage` | `src/pages/QualityGatePage/QualityGatePage.css` | 318 | gate-rule(13), gate-history-row(9), gate-status-banner(8), gate-card(7), gate-actions-card(4), gate-override-form(4) |
| `pages/ReportPage` | `src/pages/ReportPage/ReportPage.css` | 670 | report-breakdown-table(12), report-findings(12), report-summary(11), report-severity-bar(10), report-breakdown(9), report-page(8) |
| `pages/ReportPage` | `src/pages/ReportPage/components/CustomReportModal.css` | 60 | custom-report-header(2), custom-report-overlay(1), custom-report-modal(1), custom-report-body(1), custom-report-textarea(1), custom-report-footer(1) |
| `pages/SettingsPage` | `src/pages/SettingsPage/SettingsPage.css` | 645 | gs-bento(10), settings-sidebar(10), gs-info-value(9), adapter-row(7), gs-section(7), settings-tab(5) |
| `pages/SignupPage` | `src/pages/SignupPage/SignupPage.css` | 247 | signup-page(19), signup-card(5), signup-field(4), signup-submit(3), page-header(1), signup-form-heading(1) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/StaticAnalysisPage.css` | 1073 | ranking-table(13), gate-card(12), file-coverage(11), source-dist(10), file-group(9), finding-banner(8) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/AgentResultPanel.css` | 266 | agent-confidence(7), agent-conf-bar(6), agent-sca-table(5), agent-flag(3), agent-audit-toggle(3), agent-audit-item(3) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/AnalysisProgressView.css` | 133 | analysis-stepper(14), analysis-progress(8) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/AsyncAnalysisProgressView.css` | 170 | async-stepper(18), async-progress(12) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/SourceTreeView.css` | 304 | source-tree(42) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/SourceUploadView.css` | 258 | source-tab(4), file-select-row(4), card(3), drop-zone(3), drop-zone-content(3), source-git-form(2) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/TargetSelectDialog.css` | 110 | tsd(16) |
| `pages/StaticAnalysisPage` | `src/pages/StaticAnalysisPage/components/TwoStageProgressView.css` | 186 | two-stage-step(16), two-stage-error(3), two-stage-connector(2), two-stage-quick-cta(2), two-stage-progress(1), two-stage-header(1) |
| `pages/VulnerabilitiesPage` | `src/pages/VulnerabilitiesPage/VulnerabilitiesPage.css` | 759 | vuln-finding-card(35), vuln-card(14), vuln-filter-tab(13), vuln-group(10), vuln-finding-col(9), vuln-list(8) |
| `root` | `src/index.css` | 137 | dark(2), css(1) |
| `src/shared/analysis` | `src/shared/analysis/AnalysisListItem.css` | 98 | analysis-item(16), list-item(1) |
| `src/shared/findings` | `src/shared/findings/EvidencePanel.css` | 27 | evidence-panel(3) |
| `src/shared/findings` | `src/shared/findings/EvidenceViewer.css` | 122 | evidence-viewer(11), evidence-renderer-placeholder(4) |
| `src/shared/findings` | `src/shared/findings/FindingDetailView.css` | 86 | poc-header(3), detail-meta-link(2), finding-detail-breadcrumb(1), detail-meta(1), detail-meta-item(1), poc-section(1) |
| `src/shared/findings` | `src/shared/findings/VulnerabilityDetailView.css` | 175 | detail-meta-link(2), css(2), code-viewer(2), code-line(2), code-line-highlight(2), hljs-addition(2) |
| `src/shared/ui` | `src/shared/ui/AdapterSelector.css` | 67 | adapter-selector(8), css(1), adapter-warning(1) |
| `src/shared/ui` | `src/shared/ui/ConfirmDialog.css` | 66 | confirm-dialog(6), confirm-overlay(1) |
| `src/shared/ui` | `src/shared/ui/ConnectionStatusBanner.css` | 37 | connection-status-banner(4) |
| `src/shared/ui` | `src/shared/ui/DonutChart.css` | 38 | donut-chart(5), donut-chart-container(1) |
| `src/shared/ui` | `src/shared/ui/EmptyState.css` | 70 | empty-state(9) |
| `src/shared/ui` | `src/shared/ui/FileTreeNode.css` | 194 | ftree-row(6), ftree-finding-dot(5), ftree-actions(2), ftree-guide(2), ftree-chevron(2), ftree-name(2) |
| `src/shared/ui` | `src/shared/ui/FindingSummary.css` | 50 | status-bar(7), status-bar-container(1) |
| `src/shared/ui` | `src/shared/ui/ListItem.css` | 49 | list-item(10) |
| `src/shared/ui` | `src/shared/ui/PageHeader.css` | 58 | page-header(8) |
| `src/shared/ui` | `src/shared/ui/SeverityBar.css` | 62 | severity-bar(17), severity-bar-container(1) |
| `src/shared/ui` | `src/shared/ui/StatCard.css` | 120 | stat-card(16), stat-cards(3) |
| `src/shared/ui` | `src/shared/ui/StateTransitionDialog.css` | 29 | state-dialog(5) |
| `src/shared/ui` | `src/shared/ui/TargetProgressStepper.css` | 116 | tps(26) |
| `src/shared/ui` | `src/shared/ui/TargetStatusBadge.css` | 24 | target-status-badge(3) |
| `styles` | `src/styles/animations.css` | 147 | stagger(13), shimmer-fill(2), animate-fade-in(1), animate-fade-in-up(1), animate-fade-in-scale(1), animate-slide-in-right(1) |
| `styles` | `src/styles/layout.css` | 90 | layout-project(4), layout-global(2), layout-dashboard(2), app-layout(1), main-area(1), content(1) |
| `styles` | `src/styles/primitives.css` | 520 | table(10), badge-status(7), severity-chip(6), btn(5), badge-severity(5), badge-source(5) |
| `styles` | `src/styles/reset.css` | 58 | — |
| `styles` | `src/styles/shadcn-app.css` | 131 | centered-loader(4), severity-chip(4), navbar-actions(3), login-page(3), signup-page(3), layout-project(2) |
| `styles` | `src/styles/tokens.css` | 408 | js(2) |
| `styles` | `src/styles/utilities.css` | 59 | centered-loader(2), text-secondary(1), text-tertiary(1), text-danger(1), text-success(1), text-accent(1) |
| `utils` | `src/utils/markdown.css` | 108 | md-table(4), md-heading(2), md-list(2), md-link(2), md-para(1), md-hr(1) |

## Ranked removal / migration order

### A. Low-blast-radius first wave — delete/narrow isolated leaf CSS while behavior tests stay stable

1. **Leaf modals and wrappers:** `BuildLogViewer.css` (72), `CustomReportModal.css` (60), `TargetSelectDialog.css` (110), `BuildTargetCreateDialog.css` (122). Replace card/overlay/button/input shells with shadcn `Dialog`, `Button`, `Input`, `ScrollArea` and keep only tiny layout classes if needed.
2. **Small shared primitives already backed by shadcn:** `ConfirmDialog.css` (66), `StateTransitionDialog.css` (29), `EmptyState.css` (70), `StatCard.css` (120), `PageHeader.css` (58). These should collapse after call sites use `Card`, `Dialog`, `Badge`, `Button` className props directly.
3. **Auth/simple forms:** `LoginPage.css` (270), `SignupPage.css` (247), plus `SettingsThemeSection`/settings cards. They are visually isolated and mostly form-card shells; migrate to shadcn `Card`, `Input`, `Button`, `Tabs/Switch`.
4. **Dashboard leaf CSS:** 11 files / 664 lines, but mostly isolated component files (`ActivityEventCard`, `AttentionProjectCard`, `ProjectExplorer*`). Good candidate for incremental deletion because each CSS file maps to one component.

### B. Medium wave — page CSS with manageable state but many custom shells

5. **AnalysisHistory + Approvals + QualityGate:** 960 combined CSS lines. They have table/card/status shell families (`history-table`, `approval-card`, `gate-card/rule/status`) that map well to shadcn `Table`, `Card`, `Badge`, `Tabs`, `AlertDialog`.
6. **ReportPage:** 730 lines and 20 legacy refs. Replace report section cards/tables with shadcn `Card`, `Table`, `Badge`, `Dialog`; then delete `CustomReportModal.css`.
7. **FileDetail + shared findings:** FileDetail 396 plus shared findings 410. Needs careful shared-detail review because `FindingDetailView.tsx` alone has 21 broad legacy refs; migrate details to shadcn `Card/Badge/Button` before deleting shared findings CSS.
8. **DynamicTest + DynamicAnalysis:** 1,022 combined CSS lines and 56 legacy refs. Their monitoring/config controls depend on live state; migrate visible controls and cards first, then history/result shells.

### C. High-blast-radius final wave — broad layout/global bridge and dense analysis workspaces

9. **FilesPage:** 1,122 lines and 61 legacy refs. Biggest blockers are `BuildProfileForm.tsx` (9 `form-input`) and target/build action rows with many `.btn*`. Migrate build target forms/actions to shadcn controls before touching `FilesSourceWorkspace.css`.
10. **ProjectSettings + Overview + Vulnerabilities:** 2,445 lines. ProjectSettings/Overview have very large page CSS but relatively few remaining broad legacy refs; they need visual regression review rather than selector-only replacement. Vulnerabilities toolbar has 16 legacy refs and should move to shadcn inputs/buttons before card/list cleanup.
11. **StaticAnalysisPage:** top risk, 8 CSS files / 2,500 lines / 114 legacy refs. Split into sub-slices: upload/dialog controls, progress steppers, result panels, source tree, dashboard/results. Do not delete `StaticAnalysisPage.css` until component CSS files are migrated and page tests/browser screenshots cover each tab/state.
12. **Global `src/styles/primitives.css` + `src/styles/shadcn-app.css`:** final bridge removal only after production refs for `.card`, `.btn*`, `.badge*`, `.form-input` reach zero. `shadcn-app.css` is currently essential compatibility glue for global inputs/selects and shell layout.

## Concrete next implementation targets

- **Fastest measurable debt drop:** migrate `BuildProfileForm.tsx`, `VulnerabilitiesToolbar.tsx`, `SourceUploadView.tsx`, and `MonitoringView.tsx` from `.form-input`/`.btn*` to shadcn `Input`, `Textarea`, `Select`, `Button`. These four files account for 49 high-signal broad refs.
- **Largest CSS-line retirements after controls:** StaticAnalysis component CSS (`SourceTreeView.css`, `AgentResultPanel.css`, `SourceUploadView.css`, progress views) and Files component CSS (`FilesSourceWorkspace.css`, `BuildTargetSection.css`).
- **Do not start by deleting global `.card`/`.btn` definitions:** 108 `.card` refs across 60 production files and 61 base `.btn` refs across 29 files still depend on them.
- **After each page slice:** rerun targeted vitest for the page/component, `npm run typecheck`, `npm run build`, and Playwright screenshot/DOM smoke on `localhost:5173` if available.
