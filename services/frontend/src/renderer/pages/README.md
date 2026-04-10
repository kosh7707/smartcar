# Renderer page directory contract

This directory is mid-refactor toward a page-per-directory layout.

## Current contract

Each non-trivial page should own a directory with this shape:

- `PageName/PageName.tsx` — page entry component
- `PageName/PageName.css` — page-local styles
- `PageName/PageName.test.tsx` — regression tests for page behavior
- `PageName/components/*` — page-local subcomponents
- `PageName/*Model.ts` or similar helpers — page-local view-model/data helpers

Follow the existing explicit import pattern from `src/renderer/App.tsx`:

- `./pages/DashboardPage/DashboardPage`
- `./pages/OverviewPage/OverviewPage`
- `./pages/ProjectSettingsPage/ProjectSettingsPage`

Avoid widening shared ownership unless a helper is reused by multiple pages.

## Integration checklist for the remaining refactors

### AnalysisHistoryPage

- Folderized implementation now lives at `AnalysisHistoryPage/AnalysisHistoryPage.tsx`
- Regression coverage exists at `AnalysisHistoryPage/AnalysisHistoryPage.test.tsx`
- `App.tsx` can now import the folder entrypoint directly

### ApprovalsPage

- Folderized implementation now lives at `ApprovalsPage/ApprovalsPage.tsx`
- Regression coverage lives at `ApprovalsPage/ApprovalsPage.test.tsx`
- `App.tsx` can now import the folder entrypoint directly

### FilesPage

- Folderized implementation now lives at `FilesPage/FilesPage.tsx`
- Regression coverage lives at `FilesPage/FilesPage.test.tsx`
- `App.tsx` can now import the folder entrypoint directly

### VulnerabilitiesPage

- Folderized implementation now lives at `VulnerabilitiesPage/VulnerabilitiesPage.tsx`
- Regression coverage lives at `VulnerabilitiesPage/VulnerabilitiesPage.test.tsx`
- `App.tsx` can now import the folder entrypoint directly

## Shared-file merge risk

The main shared-file hotspot was `src/renderer/App.tsx` while the page-per-directory migration was still in flight.

That migration step is now complete for the already-folderized pages, so future cleanup work can:

- import folder entrypoints directly from `App.tsx`
- delete obsolete flat re-export stubs
- reserve shared-file attention for the few remaining routes/pages that are not yet folderized

## Verification baseline

Use these checks after each page move:

- `npx tsc --noEmit --pretty false --project services/frontend/tsconfig.json`
- `npm --workspace services/frontend run test -- src/renderer/pages/<PageName>/<PageName>.test.tsx`
- `npm --workspace services/frontend run build`

There is currently no dedicated frontend lint script or ESLint config in this workspace, so lint verification must be added separately if linting becomes a release gate.
