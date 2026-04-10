# AEGIS Design System

> IBM Carbon semantic token architecture + NVIDIA visual restraint.
> Canonical source of truth for all AEGIS frontend styling.
> Token values live in `src/styles/tokens.css` — this document defines rules, roles, and patterns.
> Last updated: 2026-04-09

---

## 1. Visual Theme & Atmosphere

**Identity:** AEGIS is an automotive embedded firmware security analysis console — not a SaaS marketing page, not a consumer dashboard. It is a **trust-oriented operational tool** where security analysts monitor vulnerability status, approve releases, and audit analysis pipelines.

**Creative North Star: "The Trusted Operations Console"**

The design is defined by:
- **IBM Carbon structure** — semantic token architecture (`--cds-*`), 8px grid, productive density
- **NVIDIA restraint** — accent as signal not surface, 2px radius, sharp geometry
- **Dark-mode-first** — the primary operating mode is `[data-theme="dark"]` (Carbon Gray 100 theme)
- **Productive density** — information-rich layouts with minimal wasted space, optimized for 1440p+ displays

### AEGIS Identity Markers (must preserve)
1. **Severity color hierarchy** — Critical → High → Medium → Low with escalating visual urgency
2. **Dark-mode-first** — command center / operations console aesthetic
3. **Monospace for technical data** — CVE IDs, file paths, hashes, run numbers, versions → IBM Plex Mono
4. **Productive density** — Carbon productive spacing, no decorative panels without analytical purpose

---

## 2. Color Palette & Roles

All color values are defined in `src/styles/tokens.css`. This section documents **semantic roles**, not raw hex values.

### Interactive (IBM Blue)
| Token | Role |
|-------|------|
| `--cds-interactive` | Primary CTA, links, focus rings, active indicators |
| `--cds-interactive-hover` | Hover state for interactive elements |
| `--cds-interactive-active` | Active/pressed state |
| `--cds-interactive-subtle` | Subtle interactive background (8% opacity) |
| `--cds-interactive-border` | Interactive element borders (22% opacity) |
| `--cds-interactive-surface` | Interactive surface tint (4% opacity) |
| `--cds-link-primary` | Text links |
| `--cds-link-primary-hover` | Link hover |
| `--cds-focus` | Focus ring color |
| `--cds-focus-inset` | Focus ring inset (contrast) |

Light: IBM Blue 60 (`#0f62fe`). Dark: Blue 40 (`#78a9ff`). Same semantic role, different values per theme.

### Surface (Carbon Gray)
| Token | Role |
|-------|------|
| `--cds-background` | Page background |
| `--cds-layer-01` | Cards, sections (first elevation) |
| `--cds-layer-02` | Nested content, hover states (second elevation) |
| `--cds-layer-03` | Deep nesting (third elevation) |
| `--cds-layer-raised` | Elevated surface variant |
| `--cds-overlay` | Modal/dialog backdrop |
| `--cds-surface-inset` | Inset panel background |

Depth is achieved through **tonal layering** (background → layer-01 → layer-02 → layer-03), not shadows.

### Text (Carbon Gray)
| Token | Role |
|-------|------|
| `--cds-text-primary` | Headings, body text |
| `--cds-text-secondary` | Descriptions, helper text |
| `--cds-text-placeholder` | Placeholder, tertiary text |
| `--cds-text-on-color` | Text on colored backgrounds (always white) |
| `--cds-text-inverse` | Inverted context text |
| `--cds-text-disabled` | Disabled element text |

### Severity (AEGIS Security Domain)
5-level severity with color + background tint (`-bg`) + border (`-border`) triplet per level:

| Token prefix | Severity | Visual urgency |
|-------------|----------|----------------|
| `--aegis-severity-critical` | Critical | Highest — red, demands immediate action |
| `--aegis-severity-high` | High | Orange, urgent |
| `--aegis-severity-medium` | Medium | Yellow, needs attention |
| `--aegis-severity-low` | Low | Blue, informational priority |
| `--aegis-severity-info` | Info | Gray, reference only |

Each has `-bg` (7% light / 15% dark opacity) and `-border` (18% light / 28% dark opacity) variants:
`--aegis-severity-critical-bg`, `--aegis-severity-critical-border`, `--aegis-severity-high-bg`, `--aegis-severity-high-border`, `--aegis-severity-medium-bg`, `--aegis-severity-medium-border`, `--aegis-severity-low-bg`, `--aegis-severity-low-border`, `--aegis-severity-info-bg`, `--aegis-severity-info-border`.

### Semantic (Carbon Support)
| Token | Role |
|-------|------|
| `--cds-support-success` | Success states, passed gates |
| `--cds-support-warning` | Warning states |
| `--cds-support-error` | Error states, failures |
| `--cds-support-info` | Informational highlights |

Each has a `-bg` variant for subtle background tinting: `--cds-support-success-bg`, `--cds-support-warning-bg`, `--cds-support-error-bg`, `--cds-support-error-hover`, `--cds-support-info-bg`.

### Sidebar (Theme-Invariant — Always Dark)
| Token | Role |
|-------|------|
| `--aegis-sidebar-bg` | Sidebar background (always #161616) |
| `--aegis-sidebar-surface` | Sidebar inner sections |
| `--aegis-sidebar-hover` | Nav item hover |
| `--aegis-sidebar-active` | Nav item active background |
| `--aegis-sidebar-text` | Inactive nav text |
| `--aegis-sidebar-text-active` | Active nav text |
| `--aegis-sidebar-border` | Sidebar edge border |
| `--aegis-sidebar-width` | Sidebar width (232px) |

The sidebar is always dark regardless of theme. This creates a consistent anchor point.

### Finding Status (AEGIS Domain)
7 statuses, each with color + `-bg` + `-border` triplet (e.g. `--aegis-status-open`, `--aegis-status-open-bg`, `--aegis-status-open-border`):

| Token prefix | Status | Usage |
|-------------|--------|-------|
| `--aegis-status-open` | Open | Default state, unreviewed |
| `--aegis-status-needs-review` | Needs Review | Awaiting human review |
| `--aegis-status-accepted-risk` | Accepted Risk | Risk acknowledged, not fixed |
| `--aegis-status-false-positive` | False Positive | Dismissed as non-issue |
| `--aegis-status-fixed` | Fixed | Remediated |
| `--aegis-status-needs-revalidation` | Needs Revalidation | Fix applied, needs re-scan |
| `--aegis-status-sandbox` | Sandbox | Isolated for testing |

All 7 statuses have `-bg` and `-border` variants: `--aegis-status-open-bg`, `--aegis-status-open-border`, `--aegis-status-needs-review-bg`, `--aegis-status-needs-review-border`, `--aegis-status-accepted-risk-bg`, `--aegis-status-accepted-risk-border`, `--aegis-status-false-positive-bg`, `--aegis-status-false-positive-border`, `--aegis-status-fixed-bg`, `--aegis-status-fixed-border`, `--aegis-status-needs-revalidation-bg`, `--aegis-status-needs-revalidation-border`, `--aegis-status-sandbox-bg`, `--aegis-status-sandbox-border`.

### Confidence (AEGIS Domain)
3 levels, each with color + `-bg` + `-border` triplet (e.g. `--aegis-confidence-high`, `--aegis-confidence-high-bg`, `--aegis-confidence-high-border`):

| Token prefix | Level | Usage |
|-------------|-------|-------|
| `--aegis-confidence-high` | High | Strong detection confidence (green) |
| `--aegis-confidence-medium` | Medium | Moderate confidence (yellow) |
| `--aegis-confidence-low` | Low | Low confidence, may be false positive (red) |

Variants: `--aegis-confidence-low-bg`, `--aegis-confidence-low-border`, `--aegis-confidence-medium-bg`, `--aegis-confidence-medium-border`.

### Source Classification (AEGIS Domain)
5 types, each with color + `-bg` + `-border` triplet (e.g. `--aegis-source-rule`, `--aegis-source-rule-bg`, `--aegis-source-rule-border`):

| Token prefix | Source | Usage |
|-------------|--------|-------|
| `--aegis-source-rule` | Rule-based | SAST rule match (purple) |
| `--aegis-source-ai` | AI-detected | LLM/ML detection (blue) |
| `--aegis-source-both` | Rule + AI | Both sources agree (violet) |
| `--aegis-source-agent` | Agent | Autonomous agent finding (yellow) |
| `--aegis-source-sast` | SAST | Static analysis tool (green) |

All 5 sources have `-bg` and `-border` variants: `--aegis-source-rule-bg`, `--aegis-source-rule-border`, `--aegis-source-ai-bg`, `--aegis-source-ai-border`, `--aegis-source-both-bg`, `--aegis-source-both-border`, `--aegis-source-agent-bg`, `--aegis-source-agent-border`, `--aegis-source-sast-bg`, `--aegis-source-sast-border`.

### Module Colors (AEGIS Domain)
| Token prefix | Module | Usage |
|-------------|--------|-------|
| `--aegis-module-static` | Static Analysis | Purple accent |
| `--aegis-module-dynamic` | Dynamic Analysis | Green accent (= success) |
| `--aegis-module-test` | Dynamic Test | Blue accent (= interactive) |

Each has a `-bg` variant for subtle section backgrounds: `--aegis-module-static-bg`, `--aegis-module-dynamic-bg`, `--aegis-module-test-bg`.

### Glow Effects
Instrument-style emphasis for severity indicators:
- `--aegis-glow-success` — green glow for success states
- `--aegis-glow-danger` — red glow for critical/error states
- `--aegis-glow-warning` — yellow glow for warning states
- `--aegis-glow-interactive` — blue glow for focused interactive elements

### Border
| Token | Role |
|-------|------|
| `--cds-border-subtle` | Default borders, dividers |
| `--cds-border-strong` | Emphasized borders |
| `--cds-border-inverse` | Inverted context borders |

### Field (Input)
| Token | Role |
|-------|------|
| `--cds-field` | Input field background |
| `--cds-field-hover` | Input hover state |

---

## 3. Typography

### Font Stack
| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| Body / Display | IBM Plex Sans (300/400/500/600) | Pretendard → system-ui | All UI text |
| Code / Data | IBM Plex Mono (400/500) | Fira Code → monospace | Technical identifiers |

Font variable: `--cds-font-sans`, `--cds-font-mono`

### Type Scale
| Token | Size | Usage |
|-------|------|-------|
| `--cds-type-display` | 42px | Hero numbers, dashboard headline |
| `--cds-type-3xl` | 32px | Page titles |
| `--cds-type-2xl` | 26px | Section titles |
| `--cds-type-xl` | 20px | Card titles |
| `--cds-type-lg` | 16px | Large body text |
| `--cds-type-md` | 14px | Default body, navigation |
| `--cds-type-base` | 13px | Compact body (productive density) |
| `--cds-type-sm` | 12px | Captions, table headers |
| `--cds-type-xs` | 11px | Small labels |
| `--cds-type-2xs` | 10px | Micro labels, badges |

### Weight Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--cds-weight-light` | 300 | Display text (Carbon expressive) |
| `--cds-weight-normal` | 400 | Body text |
| `--cds-weight-medium` | 500 | Emphasis, nav labels |
| `--cds-weight-semibold` | 600 | Headings, strong emphasis |

### Line Height
| Token | Value | Usage |
|-------|-------|-------|
| `--cds-leading-tight` | 1.2 | Headings, compact displays |
| `--cds-leading-normal` | 1.5 | Body text |
| `--cds-leading-relaxed` | 1.65 | Long-form reading |

### Letter Spacing Rules
- **Display** (42px+): weight 300 (Light), no extra spacing — Carbon expressive
- **Body** (14px): `--cds-letter-spacing-body` (0.16px) — Carbon productive
- **Caption** (12px): `--cds-letter-spacing-caption` (0.32px)
- **Technical data** (CVE, paths, hashes, run numbers, versions, timestamps): always IBM Plex Mono

---

## 4. Component Styling

### Buttons
| Type | Background | Text | Border | Token |
|------|-----------|------|--------|-------|
| Primary | `--cds-button-primary` | `--cds-text-on-color` | none | |
| Secondary | `--cds-button-secondary` | `--cds-text-on-color` | none | |
| Tertiary | transparent | `--cds-button-tertiary` | 1px solid | Ghost-style |
| Ghost | transparent | `--cds-interactive` | 1px solid `--cds-interactive` | |
| Danger | `--cds-button-danger` | `--cds-text-on-color` | none | |

All buttons: `border-radius: var(--cds-radius)` (2px). Hover/active variants: `--cds-button-primary-hover`, `--cds-button-primary-active`, `--cds-button-secondary-hover`, `--cds-button-danger-hover`.

### Cards
- Background: `--cds-layer-01`
- Radius: `var(--cds-radius)` (2px)
- Shadow: **none** (flat design)
- Hover: background transitions to `--cds-layer-02`
- Severity stripe: `border-left: 3px solid var(--aegis-severity-*)`
- Interactive variant: `.card--interactive` — cursor pointer, hover lift

### Inputs (Carbon Bottom-Border Pattern)
- Background: `--cds-field`
- Border: none (sides/top), `2px solid transparent` (bottom)
- Focus: bottom `2px solid var(--cds-focus)`
- Error: bottom `2px solid var(--cds-support-error)`
- Hover: background `--cds-field-hover`

### Badges / Tags
- Radius: `var(--cds-radius-pill)` (24px)
- Background: semantic color at 10% opacity
- Text: 60-grade semantic color
- Severity badges: `.badge-severity--critical`, `.badge-severity--high`, etc.
- Status badges: `.badge-status--open`, `.badge-status--fixed`, etc.
- Confidence badges: `.badge-confidence--high`, etc.

### Sidebar
- Always dark (`--aegis-sidebar-*` tokens, theme-invariant)
- Active item: `border-left: 3px solid var(--cds-interactive)`
- Menu font: 14px minimum
- Width: `var(--aegis-sidebar-width)` (232px)

### Tables
- Header background: `--cds-layer-01`
- Zebra striping: alternate rows `--cds-layer-01` / `--cds-background`
- Sortable column header: cursor pointer, arrow indicator
- Cell padding: `--cds-spacing-04` (12px) vertical, `--cds-spacing-05` (16px) horizontal
- Technical data columns: monospace font

### Modals / Dialogs
- Backdrop: `--cds-overlay`
- Surface: `--cds-layer-raised`
- Shadow: `--cds-shadow-modal`
- Z-index: `--cds-z-modal` (1050), backdrop at `--cds-z-modal-backdrop` (1000)
- Max-width: 640px (standard), 480px (confirmation)
- Radius: `var(--cds-radius)` (2px)

### Toast / Notifications
- Position: top-right, stacked
- Z-index: `--cds-z-toast` (1100)
- Left border: 3px solid severity/status color
- Background: `--cds-layer-01`
- Auto-dismiss: 5s default

### Dropdowns
- Shadow: `--cds-shadow-dropdown`
- Z-index: `--cds-z-dropdown` (50)
- Max-height: 320px with scroll
- Background: `--cds-layer-raised`

### Empty State
- Centered layout within content area
- Muted icon or illustration (48-64px)
- Primary text: `--cds-text-primary`, 16px
- Secondary text: `--cds-text-secondary`, 14px
- CTA button: Primary or Ghost style

### Code Viewer
- Background: `--cds-code-bg`
- Text: `--cds-code-text`
- Border: `--cds-code-border`
- Line numbers: `--cds-code-line-num`, monospace
- Font: `--cds-font-mono` at `--cds-type-sm` (12px)

### CSS Class Naming Convention
BEM-like with hyphens (no underscore namespace):
```
.card                        — block
.card--interactive           — modifier
.card-title                  — element
.card-title--flush           — element modifier

.btn, .btn-secondary, .btn-sm, .btn-danger, .btn-icon
.badge, .badge-severity--critical, .badge-confidence--high
.sidebar, .sidebar-link, .sidebar-link.active
```

No CSS modules, no styled-components — vanilla CSS with custom properties.

---

## 5. Layout Principles

### Page Shell
Navbar and sidebar shell components are layout-owned and live under `src/layouts/`.

```
┌─────────────────────────────────────────────┐
│ Navbar (56px height, full width)            │
├──────────┬──────────────────────────────────┤
│ Sidebar  │ Main Content                     │
│ (232px)  │                                  │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### Page Types
| Type | Navbar | Sidebar | Example |
|------|--------|---------|---------|
| Project | Yes | Yes (project nav) | Overview, Files, Vulnerabilities, etc. |
| Global | Yes | No | Projects List, Global Settings |
| Auth | No | No | Login, Signup (centered card, max 420px) |

### Sidebar Navigation Order (canonical, from Sidebar.tsx)
1. Overview
2. Files
3. Vulnerabilities
4. Static Analysis
5. ~~Dynamic Analysis~~ (comingSoon)
6. ~~Dynamic Test~~ (comingSoon)
7. Quality Gate
8. Approvals
9. Analysis History
10. Report
--- (divider) ---
11. Settings

Items 5-6 are filtered in rendering when `comingSoon: true`.

### Grid System
- Base unit: 8px (`--cds-spacing-03`)
- Gutter: 16px (`--cds-spacing-05`)
- Content max-width: none (full available width after sidebar)
- Card grid: `auto-fill, minmax(300px, 1fr)` for responsive card layouts

### Spacing Scale
| Token | Value |
|-------|-------|
| `--cds-spacing-01` | 2px |
| `--cds-spacing-02` | 4px |
| `--cds-spacing-03` | 8px |
| `--cds-spacing-04` | 12px |
| `--cds-spacing-05` | 16px |
| `--aegis-spacing-05` | 20px (AEGIS extension) |
| `--cds-spacing-06` | 24px |
| `--cds-spacing-07` | 32px |
| `--cds-spacing-08` | 40px |
| `--cds-spacing-09` | 48px |
| `--cds-spacing-10` | 64px |
| `--cds-spacing-11` | 80px |
| `--cds-spacing-12` | 96px |

---

## 6. Depth & Elevation

### Philosophy
**Flat design.** Static elements have no shadow. Depth is communicated through tonal layering (Carbon surface tokens), not drop shadows.

### Shadow Tokens (floating elements only)
| Token | Usage |
|-------|-------|
| `--cds-shadow-dropdown` | Dropdown menus, popovers |
| `--cds-shadow-modal` | Modal dialogs |
| `--cds-shadow-sidebar` | Sidebar edge (1px line, not box-shadow) |

### Z-Index Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--cds-z-base` | 1 | Default stacking |
| `--cds-z-sticky` | 10 | Sticky headers, toolbars |
| `--cds-z-dropdown` | 50 | Dropdown menus |
| `--cds-z-overlay` | 100 | Overlays, popovers |
| `--cds-z-modal-backdrop` | 1000 | Modal backdrop |
| `--cds-z-modal` | 1050 | Modal content |
| `--cds-z-toast` | 1100 | Toast notifications (topmost) |

### Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--cds-radius` | 2px | Default (NVIDIA-style sharp) |
| `--cds-radius-pill` | 24px | Badges, tags, chips |
| `--cds-radius-circle` | 9999px | Avatars, status dots |

### Transition Timing
| Token | Value | Usage |
|-------|-------|-------|
| `--cds-transition-fast` | 100ms ease | Hover states, toggles |
| `--cds-transition-base` | 180ms ease | Standard transitions |
| `--cds-transition-slow` | 280ms ease | Panel open/close |
| `--cds-transition-spring` | 280ms cubic-bezier(0.34,1.56,0.64,1) | Bouncy micro-interactions |

### Shimmer
`--cds-shimmer` — loading skeleton animation overlay color.

---

## 7. Design Guardrails

### Title Policy
Every page: `<title>AEGIS — {Page Name}</title>`
Examples: "AEGIS — Overview", "AEGIS — Login", "AEGIS — Global Settings"

### Footer Contract
All pages: `"AEGIS v2.1.0 — Embedded Firmware Security Analysis Platform"` — centered, muted text.

### Brand Purity
- The **only** brand name is "AEGIS"
- Never: Sentinel, Sovereign, Architect (as brand), Platform Cloud-Core, SENTINEL ENGINE
- Never: "Technical Precision Authority", "Project Alpha", or any synthetic marketing tagline

### Role Purity
- The **only** user role label shown is "Admin"
- Never: Security Lead, Lead Architect, Sovereign Engineer, System Architect

### Navigation Purity
- Sidebar items must match canonical order (Section 5)
- Never add fabricated nav items: Repositories, Pull Requests, Issues, Marketplace, Actions, Deployments, Analytics, Templates, Security Policies, Target Analytics
- Never add decorative panels: "System Architecture View", "Customize Widget"

### CSS Class Naming
BEM-like convention (Section 4). No inline styles for semantic values — always use CSS custom properties from tokens.css.

### Icon System
**Lucide React** (`lucide-react`) for all UI icons. Consistent stroke width, no mixing icon libraries.

---

## 8. Responsive Behavior

AEGIS is a **desktop-first** operations console. Mobile is not a primary target.

| Breakpoint | Behavior |
|-----------|----------|
| ≥1440px | Full layout — sidebar expanded, all panels visible |
| 1280-1439px | Compact — slightly reduced spacing |
| 1024-1279px | Sidebar collapses to icon-only (48px) |
| <1024px | Not officially supported — graceful degradation only |

### Minimum Supported
- Resolution: 1280 × 720
- Tables: horizontal scroll on narrow viewports
- Cards: single column below 640px content width

---

## 9. Agent Prompt Guide

When using AI design tools (Stitch, etc.) to generate AEGIS-consistent screens, include these directives:

### Must-Include Elements by Page Type

**Project pages** (sidebar + navbar):
- Navbar: "AEGIS" logo left, search center, notification bell (badge) + "Kosh" / "Admin" right
- Sidebar: project name with green dot, canonical nav order (Section 5), sub-projects section, "Back to Projects" link
- Footer: standard footer contract (Section 7)

**Global pages** (navbar, no project sidebar):
- Navbar: same as project pages
- No sidebar or a settings-specific nav panel
- Footer: standard

**Auth pages** (no navbar, no sidebar):
- Centered card (max 420px), AEGIS logo + subtitle
- Footer: standard

### Canonical Project Data
- Projects: ECU-PowerTrain-v2.1 (3 targets), ADAS-Camera-v1.4 (2), BMS-CellMonitor-v3.0 (1), TCU-Telematics-v2.2 (2)
- Build targets: arm-cortex-m4-main (30 findings), arm-cortex-m4-boot (8), riscv-rv32-diag (5)
- Severity totals: C:0, H:3, M:12, L:28 = 43 total
- User: Kosh / Admin
- Brand: AEGIS v2.1.0

### Common Drift Patterns to Avoid
From v5/v6 generation experience, Stitch commonly:
1. **Invents brand names** — Sentinel, Sovereign, Platform Cloud-Core → always sed-check after generation
2. **Adds fabricated roles** — Security Lead, Lead Architect → grep and fix
3. **Adds synthetic marketing copy** — "Technical Precision Authority" → never accept
4. **Drifts on footer version** — v2.4.0, v4.2.1-stable → must be "AEGIS v2.1.0"
5. **Omits sidebar items** — Analysis History, Settings frequently dropped → verify 9-item order
6. **Adds shell elements** — "Repositories", "Security Policies", "Target Analytics" → structural grep

### Anti-Drift Directive (paste into every Stitch prompt)
```
CRITICAL CONSTRAINTS:
- The ONLY brand is "AEGIS". No Sentinel, Sovereign, or other brands.
- The ONLY role is "Admin". No Security Lead, Lead Architect.
- Do NOT add navigation items not listed in the sidebar contract.
- Do NOT add decorative panels without analytical purpose.
- Footer: "AEGIS v2.1.0 — Embedded Firmware Security Analysis Platform"
```

---

## References
- **Token source**: `src/styles/tokens.css`
- **IBM Carbon reference**: `docs/design/ibm/DESIGN.md`
- **NVIDIA reference**: `docs/design/nvidia/DESIGN.md`
- **v6 Design Reference**: `docs/design/reference/v6/` (13 pages, light-only)
- **Design system choice WR**: `wiki/canon/work-requests/s1-qa-to-s1-aegis-ibm-carbon-nvidia.md`
- **S2 opinion WR**: `wiki/canon/work-requests/s2-to-s1-qa-reply-s2-opinion-on-aegis-design-system-choice-favors-ibm-carbon-as-canonical-ba.md`
