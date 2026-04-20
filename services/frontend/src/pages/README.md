# Frontend page directory contract

This directory now follows the page-per-directory layout for all runtime pages.

## Current contract

Each non-trivial page should own a directory with this shape:

- `PageName/PageName.tsx` — page entry component
- shared handoff assets may live outside the page directory when multiple auth pages consume the same shell (`src/shared/auth/*`, `src/styles/handoff/*`)
- `PageName/PageName.test.tsx` — regression tests for page behavior
- `PageName/components/*` — page-local subcomponents
- `PageName/*Model.ts` or similar helpers — page-local view-model/data helpers

Use the explicit page entrypoint import pattern from `src/App.tsx`:

- `./pages/DashboardPage/DashboardPage`
- `./pages/OverviewPage/OverviewPage`
- `./pages/ProjectSettingsPage/ProjectSettingsPage`

Avoid widening shared ownership unless a helper is reused by multiple pages.

## Current state

- All 16 runtime pages are folderized.
- `App.tsx` imports page entrypoints directly.
- Login/Signup now consume the shared handoff assets under `src/shared/auth/*` and `src/styles/handoff/*`.
- Source now lives under `src/`, not a nested renderer subtree.

## Verification baseline

Use these checks after each page move:

- `npm --workspace services/frontend run typecheck`
- `npm --workspace services/frontend run test -- src/pages/<PageName>/<PageName>.test.tsx`
- `npm --workspace services/frontend run build`

There is currently no dedicated frontend lint script or ESLint config in this workspace, so lint verification must be added separately if linting becomes a release gate.
