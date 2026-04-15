# Wave 1 reviewer verification script

Prepared by worker-4 while implementation tasks 1–3 were still in progress.

Run after worker implementation commits are integrated and `localhost:5173` is available, or let the script start a mock Vite server automatically:

```bash
node artifacts/s1-shadcn-team-discovery/wave1-reviewer/verify-wave1-ui.mjs
```

Outputs:

- `artifacts/s1-shadcn-team-discovery/wave1-reviewer/latest/wave1-reviewer-report.json`
- `artifacts/s1-shadcn-team-discovery/wave1-reviewer/latest/screenshots/*.png`

Checks enforced by the script:

1. Screenshots for `/projects/p-1/files`, `/projects/p-1/static-analysis`, `/projects/p-1/overview`, and `/settings`.
2. Exactly one semantic `<h1>` on each checked route.
3. Files page build-target create dialog opens and exposes a dialog role.
4. Files page build-log viewer opens and exposes a dialog role.
5. Static analysis new-analysis flow opens target selection or upload flow; target dialog must expose a dialog role when present.

The JSON status is `PASS` only when the DOM gates pass and there are no page errors. Screenshots still require human visual review for spacing, density, and readability before final reviewer acceptance.
