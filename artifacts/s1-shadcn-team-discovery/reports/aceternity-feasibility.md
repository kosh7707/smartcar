# Task 11 — First Aceternity adoption feasibility pack

Worker: worker-3  
Date: 2026-04-15  
Scope: read-only feasibility report; no production files edited.

## Inputs used

- Task 7 artifact: `workers/worker-3/component-sourcing-task-7.md`.
- CSS debt map: `tasks/task-5-css-debt-cartography.md`.
- Frontend-skill veto: `/home/kosh/AEGIS/.omx/tmp/worker4-visual-review/frontend-skill-veto-report.md`.
- Live reviewer guardrail: use shadcn primitives first, reject decorative Aceternity ornament, accept only restrained composition that improves hierarchy.
- Registry inspection via `https://ui.aceternity.com/registry/<component>.json` for likely files/dependencies.

## Baseline constraints

- `services/frontend/package.json` currently does **not** include `@tabler/icons-react`, `motion`, `react-dropzone`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`, or `@radix-ui/react-tabs`.
- Existing local shadcn components already cover most first-wave primitive work. Aceternity should not become a second design system.
- Any Aceternity code must be copied/adapted into `services/frontend/src/components/ui/*` or a page-local component and then stripped to AEGIS operational density.

## Candidate 1 — Aceternity `BentoGrid` as a static layout helper

- Source: https://ui.aceternity.com/components/bento-grid
- Registry: `https://ui.aceternity.com/registry/bento-grid.json`
- Install command if accepted:
  - `cd services/frontend && npx shadcn@latest add @aceternity/bento-grid`
- Registry files likely added:
  - `components/ui/bento-grid.tsx` → should map to `services/frontend/src/components/ui/bento-grid.tsx` under current aliases.
- Registry dependencies likely added:
  - `@tabler/icons-react`
- AEGIS target surfaces:
  - First possible page slice: `services/frontend/src/pages/OverviewPage/components/OverviewBottomGrid.tsx`.
  - Later, only after card debt falls: `services/frontend/src/pages/ReportPage/components/ReportExecutiveSummary.tsx` and maybe Quality Gate side summaries.
- Keep:
  - The simple CSS-grid wrapper idea (`BentoGrid`) and item composition slot (`BentoGridItem`).
  - Dense grid sizing concepts for files/vuln/build-target summary sections.
- Strip/change before implementation:
  - Remove `@tabler/icons-react`; use existing `lucide-react` icons already used by the repo.
  - Remove `max-w-7xl` default if it fights app shell width.
  - Remove `hover:shadow-xl`, `group-hover/bento:translate-x-2`, generic `bg-white/dark:bg-black`, and marketing-card hover behavior.
  - Re-skin around existing shadcn `Card` or plain `section` surfaces so cards remain interaction boundaries, not default filler.
- Reviewer risk:
  - Medium. This is the most feasible Aceternity candidate only if treated as a static layout utility. Reviewer explicitly vetoed generic card mosaics; use it to reduce bespoke grid CSS, not to add decorative dashboard cards.
- Feasibility verdict:
  - **Candidate for first wave after shell/page contract**, preferably copy-adapt manually rather than install verbatim.

## Candidate 2 — Aceternity `FileUpload` as source-upload/dropzone reference

- Source: https://ui.aceternity.com/components/file-upload
- Registry: `https://ui.aceternity.com/registry/file-upload.json`
- Install command if accepted:
  - `cd services/frontend && npx shadcn@latest add @aceternity/file-upload`
- Registry files likely added:
  - `components/ui/file-upload.tsx` → should map to `services/frontend/src/components/ui/file-upload.tsx`.
- Registry dependencies likely added:
  - `@tabler/icons-react`
  - `react-dropzone`
  - `motion`
- AEGIS target surfaces:
  - `services/frontend/src/pages/StaticAnalysisPage/components/FileUploadView.tsx`.
  - `services/frontend/src/pages/StaticAnalysisPage/components/SourceUploadView.tsx` zip/source upload area.
- Keep:
  - Accessible drag/drop affordance, file-list preview, file-size metadata, and an obvious upload action region.
  - The component contract idea: `onChange(files: File[])` and contained upload state.
- Strip/change before implementation:
  - Prefer existing native drag/drop handlers for the first implementation to avoid `react-dropzone` unless behavior tests approve it.
  - Remove `motion` import and motion wrappers; replace with static Tailwind `data-[drag-active]` styles or tiny CSS transitions.
  - Remove `GridPattern`, hover lift, floating file-card animation, and `group-hover/file:shadow-2xl`.
  - Replace `@tabler/icons-react` with existing `lucide-react` `Upload`/`FileText` icons.
  - Preserve accepted file extensions and existing Korean validation/toast copy.
- Reviewer risk:
  - Medium-high if installed verbatim because it introduces `motion`, `react-dropzone`, ornamented grid pattern, and hover animation. Medium if copy-adapted as a static dropzone.
- Feasibility verdict:
  - **Candidate as a reference/copy-adapt slice only**, not verbatim install. Useful because Files/StaticAnalysis are high-priority execution waves and upload is a real interaction boundary.

## Candidate 3 — Aceternity `CodeBlock` as finding/source-code panel reference

- Source: https://ui.aceternity.com/components/code-block
- Registry: `https://ui.aceternity.com/registry/code-block.json`
- Install command if accepted:
  - `cd services/frontend && npx shadcn@latest add @aceternity/code-block`
- Registry files likely added:
  - `components/ui/code-block.tsx` → should map to `services/frontend/src/components/ui/code-block.tsx`.
- Registry dependencies likely added:
  - `@tabler/icons-react`
  - `react-syntax-highlighter`
- Registry devDependencies likely added:
  - `@types/react-syntax-highlighter`
- AEGIS target surfaces:
  - `services/frontend/src/shared/findings/FindingDetailView.tsx` PoC/fix-code sections.
  - `services/frontend/src/shared/findings/VulnerabilityDetailView.tsx` code location and fix guide.
  - `services/frontend/src/pages/FileDetailPage/components/FileDetailSourcePanel.tsx` source preview.
- Keep:
  - Header row with filename/language, copy button, optional tabbed snippets, and horizontal scroll treatment.
  - Security-console dark code surface if it improves scanability.
- Strip/change before implementation:
  - Do **not** add `react-syntax-highlighter` in first wave. The repo already uses `highlight.js` via `services/frontend/src/utils/highlight.ts` and markdown rendering.
  - Replace `@tabler/icons-react` with `lucide-react` `Copy`/`Check`.
  - Adapt the shell around existing `highlight.js` output and current evidence/PoC data flow.
  - Keep copy behavior accessible and do not regress tests around markdown/highlight rendering.
- Reviewer risk:
  - Medium. It is operationally relevant, but adding a second syntax-highlighting stack is unnecessary dependency churn.
- Feasibility verdict:
  - **Candidate as design/API reference, not registry install**, unless the team explicitly approves the new highlighter dependency.

## Explicit rejects for first implementation wave

### Reject 1 — `BackgroundBeams`

- Source: https://ui.aceternity.com/components/background-beams
- Registry command: `cd services/frontend && npx shadcn@latest add @aceternity/background-beams`
- Registry file/dependency:
  - `components/ui/background-beams.tsx`
  - dependency: `motion`
- Reason to reject:
  - Pure decorative animated SVG background. It directly violates reviewer hard-veto against beams/sparkles/floating-dashboard ornament and does not reduce CSS debt or improve workflow.

### Reject 2 — `Animated Modal` / modal motion family

- Source: https://ui.aceternity.com/components/animated-modal
- Registry command: `cd services/frontend && npx shadcn@latest add @aceternity/animated-modal`
- Registry file/dependency:
  - `components/ui/animated-modal.tsx`
  - dependency: `motion`
- Reason to reject:
  - The repo already has shadcn `Dialog`, `AlertDialog`, and `Sheet`. Aceternity modal adds body-scroll management and animated 3D/perspective transitions without improving task flow. Use existing shadcn dialogs for BuildTarget/Approval/Report modals.

## First-wave recommendation

1. **Do not install Aceternity globally.** First wave should still be shadcn primitive cleanup.
2. **If one Aceternity experiment is allowed, choose BentoGrid** for `OverviewBottomGrid` only, copy-adapted manually, with no Tabler dependency and no hover motion/shadow.
3. **If upload UX is the chosen experiment, use FileUpload only as a reference** and preserve existing drag/drop handlers. Avoid `motion` and `react-dropzone` until tests explicitly lock file input/drop behavior.
4. **Use CodeBlock only after source/finding panels are in scope**, adapting structure to existing `highlight.js`; do not add `react-syntax-highlighter` in the CSS purge wave.
5. **Block all decorative Aceternity components** until reviewer explicitly approves a narrow behavior-driven reason.

## Suggested exact implementation gates

- Before candidate adoption:
  - `npm run -w @aegis/frontend typecheck`
  - relevant existing tests for target page/component from worker-2 checklist
  - screenshot before/after for route being touched
- After candidate adoption:
  - targeted component/page tests
  - `npm run -w @aegis/frontend typecheck`
  - `npm run -w @aegis/frontend test -- <target tests>` or current package-supported equivalent
  - `npm run -w @aegis/frontend build`
- Stop conditions:
  - Any added `motion` dependency without reviewer signoff.
  - Any increase in generic card mosaic/card-ish count.
  - Any Aceternity code that adds marketing copy, beams, sparkles, decorative hover gradients, or non-operational animation.
