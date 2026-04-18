# S1 Frontend UI Contract — shadcn / Aceternity Replatform

Last verified: 2026-04-18

This file replaces the previous bespoke AEGIS design doctrine. Historical session/evidence docs are preserved elsewhere, but the active S1 UI contract is now this component-sourcing model.

## Document status

- Canonical source of truth: `wiki/canon/specs/frontend.md`
- Active supporting canon pages:
  - `wiki/canon/handoff/s1/readme.md`
  - `wiki/canon/handoff/s1/architecture.md`
  - `wiki/canon/feedback/s1_frontend_working_guide.md`
- This file is the **repo-local mirror/compatibility copy** of the active contract.
- `docs/design/ibm/*` and `docs/design/nvidia/*` are inspiration/reference packs only; they are not the current AEGIS UI approval baseline.

## Active rule

S1 UI is assembled from:

1. shadcn/ui + Tailwind + Radix-style primitives in `src/components/ui/*`
2. Aceternity UI as a mandatory searched reference/source
3. `$frontend-skill` reviewer hard-veto for visual quality

## Dependency convention

- Use the shadcn v4 / Tailwind v4 Vite path configured in `components.json`, `src/index.css`, and `vite.config.ts`.
- Use the `radix-ui` aggregate package for generated primitive imports. Do not add parallel direct `@radix-ui/react-*` dependencies unless a future component explicitly requires that import style and records the reason in the sourcing matrix.
- New UI dependencies must be recorded with source component, reason, maintenance/bundle risk, and reviewer/developer signoff.
- Aceternity remains a searched source/reference by default. Adopt copied/adapted Aceternity code only when it improves workflow scanability and survives reviewer veto.

## Styling contract

- `src/index.css` is the **only remaining stylesheet entrypoint** in `services/frontend/src`.
- Page-local, component-local, and former shared bridge CSS files were removed during the replatform.
- Global responsibilities that remain in `src/index.css` are limited to:
  - theme variables / semantic tokens
  - base/reset rules
  - markdown/highlight rendering
  - animation keyframes used by shared primitives
- Prefer utility composition in TSX and shadcn primitives in `src/components/ui/*` over adding new global selectors.
- If a new global rule is unavoidable, add it to `src/index.css` only after confirming the same outcome cannot be achieved with existing shadcn/Radix/Tailwind composition.
- Critic/reviewer gate: if an available shadcn primitive or safe Aceternity-derived pattern should have been used and was skipped in favor of bespoke styling, the change should be rejected.

## 3-role gate

| Role | Responsibility |
|---|---|
| Component sourcing worker | Search shadcn/ui and Aceternity UI; fill sourcing matrix. |
| Developer | Implement selected components while preserving behavior/tests. |
| Reviewer | Load `$frontend-skill`; code nothing; search nothing; approve or veto. |

Reviewer veto wins over implementation feasibility and sourcing preference.

## AEGIS fit

AEGIS is an automotive embedded security operations console. It should feel restrained, dense, legible, and operational.

Reject:
- generic SaaS card mosaics
- decorative gradients/glow
- ornamental Aceternity motion
- marketing-copy hero sections inside app surfaces
- components that decorate but do not improve workflow

Prefer:
- shadcn Button/Input/Dialog/Dropdown/Table/Tabs/Badge/Alert/Skeleton/Progress primitives
- dense but readable operational surfaces
- utility copy
- page-level normal/empty/error interaction evidence
- single-entrypoint CSS with minimal global surface area

## Required evidence

Execution must leave:
- component sourcing matrix
- reviewer gate verdicts
- page-level verification ledger
- full test/typecheck/build evidence
