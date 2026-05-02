# Pages — Component & Hook Policy

This document defines the structural and naming policy for everything under `src/pages/`. Every page should follow it; deviations require an explicit justification.

The reference implementation is `src/pages/FilesPage/`.

---

## 1. Folder-per-Component

Every component lives in its own folder named after itself, regardless of whether it is a composer or a leaf.

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.test.tsx
└── ComponentName.css
```

A composer puts its `.tsx` at the folder root. Each child component is a sibling subfolder, not a flat file.

```
BuildTargetCreateDialog/
├── BuildTargetCreateDialog.tsx          ← composer
├── BuildTargetCreateDialog.test.tsx
├── BuildTargetCreateDialog.css
├── useBuildTargetCreateDialog.ts        ← single-consumer hook
├── useBuildTargetCreateDialog.test.ts
├── BuildTargetCreateDialogHeader/
├── BuildTargetCreateDialogBody/
├── BuildTargetNameField/
└── ...
```

The pattern is recursive: a child that is itself a composer applies the same rule to its own children.

### 1.1 Page-level `components/` wrapper

A page folder is the **only** level that uses an extra `components/` directory to separate page-internal artifacts (composer trio + page-level hook + hook tests) from sub-components.

```
pages/FilesPage/                    ← page root
├── FilesPage.tsx + .test.tsx + .css
├── useFilesPageController.ts + .test.ts
└── components/                     ← only at page root
    ├── BuildTargetCreateDialog/
    ├── FilesPageHeader/
    └── ...
```

Sub-composers do **not** introduce a `components/` directory. Their children are direct sibling folders (see the example above).

---

## 2. Trio Policy

Every `.tsx` file has two siblings in the same folder:

| Sibling | Purpose | Empty allowed? |
|---|---|---|
| `<Name>.test.tsx` | Tests | Yes, with `it.todo("...")` placeholder |
| `<Name>.css` | Styles | Yes (literal empty file) |

Rules:
- The `.tsx` first line is always `import "./<Name>.css";`.
- An empty test file must contain at least one `it.todo("describes expected behavior")`. Literal zero-byte test files are forbidden — the placeholder makes the unwritten slot visible in the test runner.

```ts
// MyComponent.test.tsx — minimum acceptable contents
import { describe, it } from "vitest";

describe("MyComponent", () => {
  it.todo("describes expected behavior");
});
```

---

## 3. Composer–Component Separation

A composer never holds raw structural elements (`<div>`, `<header>`, `<section>`, etc.) directly. Anything that can be given a domain-meaningful name should be extracted into its own component.

### 3.1 Stop rule (when to leave inline)

Leave a structural element inline if either condition is true:

1. **Layout-only naming.** The most accurate name uses only positional or structural terms — `Wrapper`, `Container`, `Section`, `Box`, `Layout`, `Frame`, `Row`, `Col`, `Group`. No domain noun fits.
2. **Single-purpose pass-through wrapper.** A `<div>` whose sole job is positioning a single child or applying spacing, with no domain identity (e.g., `<div className="form-wrap">{children}</div>` around exactly one composed block).

Otherwise, extract.

### 3.2 Naming test (when in doubt)

Apply the **domain-prefix test**: can you give the piece a name of the shape `<DomainPrefix><Role>` that a reader unfamiliar with the code would understand?

| Candidate name | Decision | Why |
|---|---|---|
| `Wrapper` | Inline | Layout-only |
| `FormWrap` | Inline | Still layout-only — "Wrap" is structural |
| `Field` | Inline | Generic role with no domain |
| `ForgotPasswordEmailField` | Extract | Domain prefix + concrete role |
| `BuildTargetSelectionSummary` | Extract | Domain noun phrase |
| `Footer` | Inline | Layout-only |
| `BuildTargetCreateDialogActions` | Extract | Domain prefix + behavior role |

The prefix must be the page or feature name, not "App" or "Page" alone.

### 3.3 Slot pattern

When a wrapper would otherwise need many props just to pass them through, use a `children` slot instead.

```tsx
// Body owns the styled wrapper; composer fills the slot
<BuildTargetCreateDialogBody>
  <BuildTargetNameField ... />
  <BuildTargetIncludedPathsField ... />
  ...
</BuildTargetCreateDialogBody>
```

---

## 4. Page Composer (`<Page>.tsx`)

The page-level `.tsx` is a thin composer:
- ~100 LOC ceiling, JSX wiring only.
- All state and side effects live in the page-level controller hook (see §5).
- No raw structural elements — every visible block is a component per §3, except the layout-only exceptions in §3.1.

---

## 5. Hooks

### 5.1 Location (consumer-based colocation)

| Consumers | Location |
|---|---|
| Single component | Inside that component's folder |
| Page-level state hub | Page root (`pages/<Page>/use<Page>Controller.ts`) |
| Multiple pages or shared | `src/common/hooks/` |

The single-consumer hook lives at the consumer's folder root, not inside `components/` (which is only a page-level wrapper, see §1.1).

### 5.2 Naming

- The page-level state hub is named `use<PageName>Controller` (e.g., `useFilesPageController`).
- All hook functions must start with `use` per React rules-of-hooks.

### 5.3 Extension

Hooks are `.ts`, not `.tsx`, unless they emit JSX literals. Type imports like `React.MouseEvent` do not require `.tsx`.

### 5.4 Tests

A hook gets a `.test.ts` when it owns standalone meaningful logic — filtering, derivations, state machines, multi-step orchestration. Thin hooks that just bundle `useState` calls are covered through their consumer's integration tests; do not add a stub `.test.ts` for them.

When a hook has its own `.test.ts`, the same trio expectations as components apply (placeholder `it.todo` is acceptable for unwritten cases).

---

## 6. Internal Grouping

When a page has many sibling components, group them by intent rather than letting them sit flat:

| Group | Use for |
|---|---|
| `<Page>Chrome/` | Page-level chrome — overlays, banners, loading state, empty state, drop overlay |
| `variants/` | Alternative children of the same kind (e.g., file-type previews: `FilesHighlightedCode`, `FilesBinaryPreview`, `FilesManifestInsights`) |

Subfolders for grouping still follow Folder-per-Component (§1) inside.

---

## 7. Naming Consistency & Promotion to Shared

### 7.1 Page-scoped naming

Page-scoped components carry the page prefix. `HighlightedCode` used only by `FilesPage` should be `FilesHighlightedCode`. A component without the prefix implies it is genuinely domain-neutral and reusable — in that case it belongs in `src/common/ui/`, not in a page folder.

### 7.2 When to promote to `src/common/ui/`

A page-scoped component **must** graduate to `src/common/ui/` when **all** of the following hold:

1. **Two or more pages** would use the same component.
2. The page-specific differences (label, placeholder, hint, copy, icon) can be captured as **props with sensible defaults** without producing an awkward prop sprawl.
3. The component carries no business logic tied to a specific page's state machine.

Until all three conditions are met, keep the component page-scoped — premature promotion creates abstractions that fight rather than serve their second consumer.

When promoting, drop the page prefix and rename to a domain-neutral name (`AuthEmailField`, not `LoginEmailField`).

---

## 8. CSS

### 8.1 Class ownership

Each component owns the classes it renders, with two narrow exceptions:

- **Design system primitives** — global classes from `src/common/styles/` (`btn`, `input`, `panel`, `chore`, etc.) may be used directly by any component without the component owning them.
- **Inherited shell classes** — when a component renders into a slot owned by a shared shell (e.g., `AuthConsoleShell`'s `brand-panel`, `form-wrap`), the shell-defined classes may be used directly.

For everything else, prefer **component-scoped classes** following the convention `<component-kebab-name>__<element>` (BEM-style). The component's own `.css` file holds those rules.

### 8.2 Empty `.css` is acceptable when

- All visible styling comes from design system primitives (§8.1).
- The component renders into an inherited shell slot whose classes are defined elsewhere.
- The component is purely presentational with no styling beyond its child composition.

In other words: the trio always exists, but the file may be empty if the component does not introduce new styles. Do not duplicate global styles into a component file.

### 8.3 Refactoring legacy global classes

When extracting a component from a page that used global ad-hoc classes, you may keep referencing those classes initially. Migrate to component-scoped classes opportunistically — do not hold up an extraction on the cleanup.

---

## 9. Reference

Use `src/pages/FilesPage/` as the canonical example. New pages and refactors should match its structure exactly.
