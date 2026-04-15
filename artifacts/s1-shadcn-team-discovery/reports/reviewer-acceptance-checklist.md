# Task 12 — Reviewer acceptance checklist for first CSS purge wave

Generated: 2026-04-15T07:58:00Z  
Worker: worker-4  
Mode: read-only report; no production edits.

## Inputs used

- Worker-4 frontend-skill hard-veto report: `/home/kosh/AEGIS/.omx/tmp/worker4-visual-review/frontend-skill-veto-report.md`.
- Worker-1 CSS debt cartography: `/home/kosh/AEGIS/.omx/state/team/s1-shadcn-replatform-c-standar/tasks/task-5-css-debt-cartography.md`.
- Worker-2 behavior/test map and first-wave checklist: task `6` result + task `9` result.
- Worker-1 draft wave plan available so far: `/home/kosh/AEGIS/.omx/state/team/s1-shadcn-replatform-c-standar/tasks/task-10-css-purge-wave-plan.md`.
- Worker-3 sourcing matrix: `/home/kosh/AEGIS/.omx/state/team/s1-shadcn-replatform-c-standar/workers/worker-3/component-sourcing-task-7.md`.

## Non-negotiable reviewer posture

The first CSS purge wave is not accepted merely because tests pass or CSS files shrink. It is accepted only if the changed surfaces become more shadcn/Tailwind-native **and** more operator-grade: clearer hierarchy, fewer generic card shells, better mobile behavior, and no decorative Aceternity drift.

## First-wave scope this checklist covers

Treat these as the first implementation wave review boundary unless the leader narrows it:

1. **Baseline/page contract gate** before deleting CSS.
2. **Leaf dialogs/overlays/wrappers**: `BuildLogViewer`, `BuildTargetCreateDialog`, `TargetSelectDialog`, `CustomReportModal`, `ConfirmDialog`, `StateTransitionDialog`.
3. **Form/control hot spots**: `BuildProfileForm`, `VulnerabilitiesToolbar`, `SourceUploadView`, `MonitoringView`.
4. **Small shared primitives**: `EmptyState`, `StatCard`, `PageHeader`, `ListItem`, `SeverityBar`, `TargetProgressStepper`, `TargetStatusBadge`, `AdapterSelector`, `DonutChart`, `FindingSummary`.
5. **Visual proof surfaces** most likely touched by the above: Files, Static Analysis, Vulnerabilities, Dashboard/Overview shared header/empty states, Report modal, Quality Gate shared components.

Do **not** review broad page rewrites, Sidebar shell replacement, full Report overhaul, or Aceternity adoption as “first wave” unless they are explicitly scoped by the leader.

## A. Screenshot evidence required

A PR/commit for the first CSS purge wave must attach or reference screenshots from the same branch and timestamped run. Reviewer vetoes if screenshots are missing, stale, or only from Storybook/unit snapshots.

### Required desktop screenshots

Capture at **1365×900** after the change:

- `/dashboard` — proves dashboard/shared empty/header/card density did not regress.
- First project `/overview` — proves page contract/header/shared primitive behavior.
- First project `/files` — mandatory for file tree, build dialogs, build profile/forms, empty preview, resizable/scroll behavior.
- First project `/static-analysis` — mandatory if upload/source/target dialog/progress components changed.
- First project `/vulnerabilities` — mandatory if toolbar/filter/form-input/button migration changed.
- First project `/quality-gate` — mandatory if shared `PageHeader`, `StatCard`, `SeverityBar`, `TargetStatusBadge`, or gate cards changed.
- First project `/report` — mandatory if report modal/shared badges/tables/cards changed.
- `/settings` only if global shared form/card primitives or settings shell changed.

### Required mobile/tablet screenshots

Capture at **768×900** for every changed project route plus Files and Vulnerabilities by default:

- `/projects/:projectId/files`
- `/projects/:projectId/vulnerabilities`
- `/projects/:projectId/overview`
- Any route whose toolbar, dialog, tabs, filters, or page header changed.

If the change touches dialogs/sheets, include one open-state screenshot at 768px and 1365px.

### Screenshot acceptance rules

- Desktop first viewport must show one dominant workspace; empty pages cannot be mostly oversized bordered blank panels.
- Mobile screenshots must show no horizontal overflow and no squeezed desktop toolbar/sidebar experience.
- Dialog screenshots must show readable labels, focusable controls, visible close/cancel/submit actions, and no clipped content.
- If dark mode classes or theme tokens are touched, repeat the changed screenshots in dark mode.
- Screenshot file names must identify route + viewport + state, e.g. `files-1365-default.png`, `files-768-build-dialog.png`.

## B. Page contract rules

A first-wave change is accepted only if every directly touched route/component follows these page-contract rules.

### Semantic heading contract

- Every app route touched by the change must have **exactly one visible semantic `h1`** representing the page name or active workspace.
- Secondary panels use `h2`/`h3`; cards and empty states must not become the top page heading.
- Breadcrumb text does not count as the route `h1`.
- Reviewer should run a DOM check and veto if `h1Count !== 1` for touched routes.

Suggested check:

```js
await page.evaluate(() => ({
  h1Count: document.querySelectorAll('h1').length,
  h1Text: Array.from(document.querySelectorAll('h1')).map((el) => el.textContent?.trim()),
}))
```

### Layout/content contract

- One route = one dominant workspace and one primary action. Toolbars, filter strips, summary cards, and empty-state panels cannot all compete for attention.
- Cards/panels are allowed only when they define an interaction boundary: dialog content, form section, table region, file preview, approval item, report section. Decorative wrapping cards are rejected.
- Shared `PageHeader` must provide page title, one concise utility description, optional breadcrumb, and one action row. It must not create a marketing hero.
- Empty states must include status/reason/one primary next action; no large slabs with tiny copy and duplicate CTAs.
- Utility copy only: labels and helper text must explain state, scope, freshness, or action. Reject aspirational/marketing lines.
- Blue remains the action accent; severity colors are only for severity/status.

### CSS deletion contract

- The wave must reduce or eliminate the CSS import/class family it claims to migrate.
- Do not delete `src/styles/primitives.css` or `src/styles/shadcn-app.css` bridges until production refs for `.card`, `.btn*`, `.badge*`, and `.form-input` hit zero.
- For any deleted CSS file, reviewer requires:
  - CSS import removed.
  - `rg '<deleted-css-file-name>|<main-selector-family>' services/frontend/src` shows no production dependency except tests intentionally asserting absence/migration.
  - Replacement uses local shadcn primitives or Tailwind utility composition, not a new bespoke wrapper stylesheet.
- Net-new CSS is rejected unless it is tiny, local, and only expresses layout that shadcn/Tailwind cannot express cleanly.

## C. Mobile acceptance rules

Reviewer vetoes if mobile is merely “no horizontal scroll” but still feels like a squeezed desktop.

- At 768px, project navigation must be collapsed, drawer/sheeted, or otherwise touch-appropriate if the touched surface includes project shell/sidebar behavior.
- Filter bars must wrap or collapse into groups; no tiny pill soup or clipped selects/search fields.
- Primary action remains visible and tappable; secondary actions can move into a menu/sheet.
- Dialogs at 768px must fit the viewport, scroll internally when needed, and keep footer actions reachable.
- Touch targets should be at least 36–40px high for action controls unless the component is dense table content.
- File tree/source preview layouts must not require horizontal scrolling to understand the selected file state.
- Mobile screenshot failure is a release blocker for visual/layout changes even if unit tests pass.

## D. shadcn usage rules

Allowed first-wave shadcn primitives, preferring already-local components:

- `Button`, `Badge`, `Card` only where cards are interaction boundaries, `Input`, `Textarea`, `Label`, `Select`, `Tabs`, `Table`, `Dialog`, `AlertDialog`, `Sheet`, `Tooltip`, `Progress`, `ScrollArea`, `Resizable`, `Separator`, `Skeleton`, `Breadcrumb`, `Checkbox`, `Switch`, `RadioGroup`.
- Additive shadcn components allowed only if justified by the touched surface: `Field`, `Empty`, `Spinner`, `Pagination`.
- `@tanstack/react-table` is rejected for first wave unless the touched table needs real sorting/pagination/column state and leader approves the dependency.

Reviewer checks:

- Button migrations preserve label, disabled/loading/destructive states, `type`, `aria-label`, and keyboard behavior.
- Dialog migrations preserve escape/outside-click behavior expected by tests, focus management, and destructive confirmation wording.
- Select migrations preserve accessible names and do not break filter state.
- Badges preserve security severity/status semantics; no generic pastel SaaS colors.

## E. Aceternity rules

### Allowed only with explicit reviewer acceptance

Aceternity may be used only as a **copy/adapt reference** after the static shadcn composition passes. Direct install/copy must be reviewed separately.

Potentially acceptable first-wave candidates, if stripped down:

- `BentoGrid` concept for Overview/QualityGate/Report summary layout — **static grid only**, no dramatic hover/motion.
- `FileUpload` concept for source upload/dropzone — keep drag/drop affordance and microcopy only; preserve existing file-selection tests.
- `CodeBlock` concept only if adapted onto existing `highlight.js`; reject `react-syntax-highlighter` dependency unless explicitly approved.
- `Timeline` concept for analysis/audit history only as static information architecture; no beam/scroll spectacle.

### Disallowed in first wave

Reject by default:

- Background beams, sparkles, focus cards, hover-border gradients, animated modal, stateful button, compare/sparkles, 3D/floating dashboard effects.
- Aceternity Sidebar direct adoption. Use existing local shadcn Sidebar later if shell work is scoped.
- Any component that adds `motion`, `framer-motion`, `react-syntax-highlighter`, `@tanstack/react-table`, or other new dependencies without leader/reviewer approval and a Lore commit rationale.
- Marketing-copy templates, hero copy, decorative gradients, or animated ornament on operational app pages.

## F. Explicit veto triggers

A reviewer should reject the wave if any of these are true:

1. **No fresh screenshots** for all changed routes/states/viewports.
2. **Any touched route has zero or multiple `h1` elements.** Current baseline had `h1Count=0`; the first wave should not perpetuate that on touched routes.
3. **Generic card mosaic remains or increases** on a touched route without interaction-boundary justification.
4. **CSS deletion claim is unproven:** deleted CSS names/selectors still appear in production imports/classes.
5. **Global bridge selectors are deleted early** while `.card`, `.btn*`, `.badge*`, or `.form-input` production refs remain.
6. **New bespoke stylesheet replaces old bespoke stylesheet** instead of shadcn/Tailwind primitives.
7. **Mobile screenshot shows squeezed desktop controls**, persistent heavy sidebar, clipped dialogs, or toolbar/filter pill soup.
8. **Aceternity ornament appears** before the static layout is accepted, or new animation/dependency is added without explicit approval.
9. **Behavior tests are weakened** to pass visual refactors, especially by removing assertions without adding role/label/user-flow equivalents.
10. **Class-coupled tests are left brittle** where Worker-2 identified them: ProjectSettings stepper classes, QualityGate `.gate-card`, Vulnerabilities grouped/bulk selectors, FileTreeNode selected row class, PageHeader plain/card classes, ProjectBreadcrumb current class.
11. **Accessibility names regress** for forms, filters, buttons, dialogs, tabs, or table/list regions.
12. **Console/network errors beyond known favicon 404** appear during screenshot smoke.
13. **Typecheck, targeted tests, full tests, or build fail**, or Vite warnings change materially from the known chunk-size warning.
14. **No clear owner/review notes** for which CSS files/selectors were removed and which were intentionally deferred.

## G. Required verification commands

Run from repo root unless noted. Reviewer can accept equivalent package-manager syntax if output is attached.

### Baseline/full gates

```bash
npm --prefix services/frontend run typecheck
npm --prefix services/frontend run test
npm --prefix services/frontend run build
```

Lint note: current `services/frontend/package.json` has no `lint` script; if one is added, it becomes required.

### First-wave targeted test bundle

```bash
cd services/frontend
npx vitest run \
  src/shared/ui/ConfirmDialog.test.tsx \
  src/pages/FilesPage/components/BuildTargetCreateDialog.test.tsx \
  src/pages/FilesPage/components/BuildProfileForm.test.tsx \
  src/pages/FilesPage/components/BuildTargetSection.test.tsx \
  src/pages/FilesPage/FilesPage.test.tsx \
  src/pages/VulnerabilitiesPage/VulnerabilitiesPage.test.tsx \
  src/pages/StaticAnalysisPage/StaticAnalysisPage.test.tsx \
  src/pages/DynamicAnalysisPage/DynamicAnalysisPage.test.tsx \
  src/shared/ui/*.test.tsx \
  src/layouts/*.test.tsx
```

If a listed file does not exist in the final branch, reviewer requires the implementer to explain whether the component was removed/renamed and show the replacement test path.

### CSS ref proof commands

```bash
rg 'className=.*\b(btn|btn-secondary|btn-sm|btn-icon|btn-danger|card|card-title|badge|badge-sm|badge-info|form-input)\b' services/frontend/src --glob '!**/*.test.*'
rg 'BuildLogViewer.css|BuildTargetCreateDialog.css|TargetSelectDialog.css|CustomReportModal.css|ConfirmDialog.css|StateTransitionDialog.css' services/frontend/src
rg 'form-input|\bbtn\b|btn-secondary|btn-sm|btn-icon' services/frontend/src/pages/FilesPage services/frontend/src/pages/VulnerabilitiesPage services/frontend/src/pages/StaticAnalysisPage services/frontend/src/pages/DynamicAnalysisPage --glob '!**/*.test.*'
```

These commands do not need to return zero for the whole repo in early waves, but must show reduction in touched files and zero references to CSS files claimed as deleted.

### Browser smoke expectations

Use Playwright or equivalent to prove:

- routes load with API responses 200;
- changed dialogs/forms can open/close/submit/cancel in mock mode;
- no horizontal overflow at 768px;
- `h1Count === 1` on touched routes;
- no console errors except the known favicon 404 if it remains unfixed.

## H. Reviewer decision rubric

- **Accept:** screenshots complete, touched routes satisfy h1/page/mobile contracts, CSS refs are reduced/proven, tests/typecheck/build pass, no ornamental Aceternity/new dependency, and visual density improves.
- **Request changes:** minor spacing/copy issues, missing one screenshot state, small leftover class refs with clear explanation, or test command omissions that are easy to rerun.
- **Reject/veto:** any explicit veto trigger above, especially missing h1, missing screenshots, mobile squeezed desktop, early global bridge deletion, new decorative dependency, or weakened behavior tests.

## I. Minimum reviewer comment template

```md
Reviewer CSS purge acceptance:
- Screenshots: PASS/FAIL — routes/viewports/states checked:
- H1/page contract: PASS/FAIL — h1 counts:
- Mobile: PASS/FAIL — overflow/nav/dialog notes:
- CSS deletion/ref proof: PASS/FAIL — files/selectors removed and deferred:
- shadcn/Aceternity: PASS/FAIL — primitives used, disallowed ornament/deps absent:
- Tests/build: PASS/FAIL — commands and outputs:
- Vetoes: none / list explicit triggers:
Decision: accept / request changes / reject
```
