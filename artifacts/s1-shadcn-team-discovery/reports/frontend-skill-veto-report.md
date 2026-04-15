# Worker-4 frontend-skill hard-veto review

Task: task-8, read-only review. Scope inspected: live `localhost:5173` with mock auth plus existing screenshot artifacts. New captures saved under `/home/kosh/AEGIS/.omx/tmp/worker4-visual-review/current/`.

## Visual thesis / target bar
AEGIS should read as a calm firmware-security operations console: dense enough for operators, restrained like Linear, with one clear workspace per route and almost no decorative chrome.

## Frontend-skill hard-veto criteria

1. **No generic SaaS card mosaic as the page structure.** Cards/panels are allowed only when they are the interaction boundary (file tree, settings form, report table region), not as default page filler.
2. **One route = one dominant workspace.** Each route must have a clear primary surface and one primary action; filter strips, stat boxes, and empty-state panels cannot compete for first attention.
3. **Utility copy only.** Reject marketing/aspirational copy on app pages. Headings/labels must tell operators what is present, stale, actionable, or blocked.
4. **Semantic page hierarchy is mandatory.** Every app route needs one visible/semantic `h1`; current inspected app routes report `h1Count: 0`, which should block “done”.
5. **shadcn primitives before ornament.** Use Button, Badge, Tabs, ToggleGroup, Select, Input, Table, ScrollArea, Separator, Dialog/Sheet, Breadcrumb, Tooltip, and resizable panels before custom shells or Aceternity ornament.
6. **Aceternity only after static composition passes.** Hard-veto background beams, sparkles, floating-dashboard effects, or magic-card hover for this security console. Accept only restrained disclosure/scroll/hover motion that improves hierarchy.
7. **Mobile cannot be a squeezed desktop.** At 768px, side navigation still visually consumes the left rail in captures; even without horizontal overflow, this should be treated as not touch-first. Collapse navigation into a sheet/rail before claiming responsive polish.
8. **Empty states must collapse to one action.** No large bordered slabs with tiny copy plus duplicate action buttons. Empty pages should show status, reason, next action, and optional secondary link.
9. **One accent system.** Blue is the action accent; warning/critical colors should appear only as state, not as decorative strips/borders.
10. **Polish blockers count.** Favicon 404 and missing semantic headings are small but visible “not finished” signals.

## Visible anti-slop issues from live inspection

- **Global shell:** dark sidebar + pale topbar is serviceable but heavy. The content canvas is mostly bordered white slabs on gray, so the app feels like a wireframe wrapped in navigation rather than a cohesive operations console.
- **No `h1` on inspected routes:** Dashboard, Overview, Files, Vulnerabilities, Static Analysis, Report, Quality Gate, Approvals, Settings all surfaced `h2` as top headings. This weakens scan hierarchy and accessibility.
- **Dashboard (`dashboard.png`):** left project explorer card + pink “no urgent items” strip creates a sparse, unfinished first impression. Huge whitespace dominates; “우선 확인” has no operational data density.
- **Overview (`overview.png`):** the main “분석 준비 완료” surface is a large bordered hero-card with a top blue line. It repeats status copy but does not behave like a workspace. This violates “cards only when the card is interaction”.
- **Files (`files.png`, `mobile-files.png`):** strongest candidate because it has a real workspace (tree + preview), but it still needs shadcn resizable/scroll primitives. Language legend is a crowded color-token strip; right preview empty state is oversized.
- **Vulnerabilities / Analysis History / Approvals:** filter pill soup + mini-stat boxes + large empty-state cards. These pages look generated from the same template rather than tailored workflows.
- **Report (`report.png`):** worst card debt signal: 22 card-ish/border/shadow/surface matches in DOM scan. Nested bordered regions, tabs, summary boxes, audit panel, tables, and color bars compete. Refactor after shared primitives are stable.
- **Global Settings (`global-settings.png`):** classic dashboard-card mosaic. Cards are not all interactions; “Platform info” should become definition/list layout, backend/API panels should become form sections with shadcn field composition.
- **Auth/login (`worker4-login-live.png` captured by MCP plus live snapshot):** visual ambition is higher than app pages, but the hero/form overlap and disabled low-contrast button make it feel accidental. Keep auth separate from app workspace redesign.
- **Responsive 768 captures:** no horizontal overflow detected, but the project shell still visually presents a desktop sidebar and dense controls. Responsive acceptance should require a collapsed nav/sheet and touch-scaled filter/action rows.

## First execution order

1. **Lock the global app shell and page contract first.** Update `DashboardLayout`, `GlobalLayout`, `ProjectLayoutShell`, shared breadcrumb/page header patterns, and require one `h1`, consistent action row, content max-width/gutters, and sidebar behavior. Do not page-refactor before this contract exists.
2. **Replatform shared primitives next.** Replace custom button/badge/input/tab/card shells with shadcn-backed shared components and Tailwind tokens. Keep “card” as an explicit semantic choice, not the default surface.
3. **Files page first page-level pass.** It has the clearest real workspace and will prove the target language: shadcn ResizablePanel/ScrollArea/Input/Button/Badge/Separator, left tree, right preview, compact metadata, no decorative cards.
4. **Static Analysis + Quality Gate empty/workflow states.** Convert large bordered empties into concise status/action blocks with one primary CTA and one secondary source/context link.
5. **Vulnerabilities + Analysis History + Approvals.** Rebuild filter/toolbars with ToggleGroup/Select/Input/Table/List primitives; remove stat-box filler when counts are all zero.
6. **Overview.** After primitives, replace the status hero-card with a concise operational summary: readiness, source/target/gate state, latest activity, and next action.
7. **Report.** Tackle after the shared card/table/tabs language stabilizes because it has the highest nested-surface/card debt and highest regression risk.
8. **Settings and Auth last.** Settings depends on form-section primitives; auth can keep a more branded surface but must fix contrast/overlap after app shell is coherent.

## Acceptance checks for the next implementation wave

- Each route has exactly one `h1`, one primary action, and no duplicate hero/card summary competing with the workspace.
- Desktop screenshots at 1365x900 show a clear dominant workspace in the first viewport; empty pages do not show oversized blank slabs.
- 768px screenshots show collapsed/touch-appropriate navigation and no squeezed filter/action rows.
- DOM/card-ish count should fall route-by-route, especially Report and Settings; nested `border rounded shadow surface` patterns require explicit justification.
- Typecheck and current tests remain green after each page slice.

## Evidence

- Live routes captured: dashboard, overview, static-analysis, files, vulnerabilities, analysis-history, report, quality-gate, approvals, project-settings, global-settings.
- Mobile captures: overview, vulnerabilities, files at 768x900.
- Screenshot path: `/home/kosh/AEGIS/.omx/tmp/worker4-visual-review/current/`.
- Playwright route scan: dashboard `cardish=11`, report `cardish=22`, global-settings `cardish=16`; all inspected app routes had `h1Count=0`.
- Console/network: API calls returned 200; only observed browser error was `/favicon.ico` 404.
- Verification: `npm --prefix services/frontend run typecheck` passed; `npm --prefix services/frontend run test` passed 72 files / 513 tests. Attempted `vitest --runInBand` first, but Vitest does not support that Jest option, then reran with the valid test command.
