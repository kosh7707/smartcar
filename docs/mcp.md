# AEGIS local MCP bootstrap

This document explains the MCP surfaces that matter at startup from `~/AEGIS`.

Use it together with:

- `docs/AEGIS.md` — local bootstrap router
- `AGENTS.md` — agent behavior contract

## Why this file exists

When a fresh session starts in `~/AEGIS`, the agent should quickly know:

1. **which MCPs are available locally**
2. **what each MCP is for**
3. **which MCP to prefer first**

This file is bootstrap-only. It is not a replacement for the canonical wiki.

## Local MCPs that matter at startup

### 1. `aegis-static-wiki`

Source of truth for canonical documentation.

Use it for:
- reading canonical docs
- reading lane handoff pages
- reading canonical work requests
- reading migration-map / system policies
- recording session history and test evidence

Prefer it when:
- you need project guidance
- you need API/spec/handoff/history context
- you need canonical WR handling

Do **not** prefer it for:
- source-code diagnostics
- build/type errors
- log triage

Relevant tools include:
- `read_page`
- `search_pages`
- `list_pages`
- `record_session_history`
- `append_test_evidence`
- `list_my_open_wrs`
- `register_wr`
- `complete_wr`

### 2. `log-analyzer`

Operational/log debugging surface for AEGIS runtime logs.

Use it for:
- request tracing
- error/warn log search
- service-level log diagnosis

Prefer it when:
- the issue is runtime/log related
- you need request-id based debugging
- you need to inspect recent errors instead of reading raw log files

Do **not** prefer it for:
- canonical docs lookup
- handoff/spec/API reading
- WR lifecycle management

## Recommended startup order

From `~/AEGIS`:

1. Read `docs/AEGIS.md`
2. Read this file (`docs/mcp.md`)
3. Use `aegis-static-wiki` to enter canonical docs
4. Use `log-analyzer` only if the task is operational/log driven

## Rule of thumb

- **Docs / handoff / WR / policy** → `aegis-static-wiki`
- **Runtime logs / request tracing / failures** → `log-analyzer`
