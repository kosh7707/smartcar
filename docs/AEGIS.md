# AEGIS local bootstrap router

> Canonical agent-facing documentation now lives in **`/home/kosh/aegis-static-wiki`**.
> This repository keeps only the minimum local bootstrap surface required to enter the wiki from `~/AEGIS`.
>
> **Local bootstrap set**
> 1. `docs/AEGIS.md` — route from `~/AEGIS` into the right wiki surface
> 2. `docs/mcp.md` — explain the local MCPs available at startup

## Start here

1. Read **this file** for local bootstrap routing.
2. Read `docs/mcp.md` for the locally available MCP surfaces.
3. Enter the canonical wiki at `/home/kosh/aegis-static-wiki/wiki/system/index.md`.
4. Continue to `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`.
5. If a lane is explicitly declared, continue to `/home/kosh/aegis-static-wiki/wiki/canon/handoff/{lane}/readme.md`.
6. Use `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/` for new canonical WR handling.
7. Legacy WRs under `/home/kosh/AEGIS/docs/work-requests/` are archive-only and out-of-scope for WR MCP runtime behavior.

## Lane bootstrap contract

Use this file as the deterministic router when the user explicitly declares a lane, for example:

- `너는 S1이야`
- `너는 S2야`
- `이번엔 S4로 진행해`

Routing rules:

1. Read this file first.
2. Match only explicit lane tokens: `S1`, `S1-QA`, `S2`, `S3`, `S4`, `S5`, `S6`, `S7`.
3. If multiple lane tokens appear in one prompt, **the last explicit lane token wins**.
4. If the same lane is declared repeatedly, suppress duplicate bootstrap work.
5. If the lane changes, reroute cleanly to the new lane.
6. If no lane is declared, do not force a lane bootstrap.

### Machine-readable lane map

The JSON map below is **authoritative**. The following human-readable table is an intentional mirror for quick inspection.

<!-- LANE_BOOTSTRAP_MAP:START -->
```json
{
  "precedence_rule": "last-token-wins",
  "idempotent_on_same_lane": true,
  "lanes": {
    "S1": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s1/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/frontend"
      ]
    },
    "S1-QA": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s1/qa-guide.md",
      "owned_code_paths": [],
      "notes": "Do not read frontend source for QA bootstrap; use browser/Playwright verification only."
    },
    "S2": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s2/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/backend",
        "/home/kosh/AEGIS/services/shared",
        "/home/kosh/AEGIS/scripts"
      ]
    },
    "S3": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s3/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/analysis-agent",
        "/home/kosh/AEGIS/services/build-agent",
        "/home/kosh/AEGIS/services/agent-shared"
      ]
    },
    "S4": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s4/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/sast-runner"
      ]
    },
    "S5": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s5/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/knowledge-base"
      ]
    },
    "S6": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s6/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/adapter",
        "/home/kosh/AEGIS/services/ecu-simulator"
      ]
    },
    "S7": {
      "wiki_handoff": "/home/kosh/aegis-static-wiki/wiki/canon/handoff/s7/readme.md",
      "owned_code_paths": [
        "/home/kosh/AEGIS/services/llm-gateway"
      ]
    }
  }
}
```
<!-- LANE_BOOTSTRAP_MAP:END -->

### Human-readable lane map

| Lane | Wiki handoff | Owned code paths |
|---|---|---|
| `S1` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s1/readme.md` | `services/frontend` |
| `S1-QA` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s1/qa-guide.md` | none — browser/Playwright verification only |
| `S2` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s2/readme.md` | `services/backend`, `services/shared`, `scripts` |
| `S3` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s3/readme.md` | `services/analysis-agent`, `services/build-agent`, `services/agent-shared` |
| `S4` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s4/readme.md` | `services/sast-runner` |
| `S5` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s5/readme.md` | `services/knowledge-base` |
| `S6` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s6/readme.md` | `services/adapter`, `services/ecu-simulator` |
| `S7` | `/home/kosh/aegis-static-wiki/wiki/canon/handoff/s7/readme.md` | `services/llm-gateway` |

## Canonical paths

- Wiki index: `/home/kosh/aegis-static-wiki/wiki/system/index.md`
- Platform charter: `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`
- Migration map: `/home/kosh/aegis-static-wiki/wiki/system/migration-map.md`
- Session history policy: `/home/kosh/aegis-static-wiki/wiki/system/session-history-policy.md`
- Test evidence policy: `/home/kosh/aegis-static-wiki/wiki/system/test-evidence-policy.md`
- Lane handoff: `/home/kosh/aegis-static-wiki/wiki/canon/handoff/{lane}/readme.md`
- Lane roadmap: `/home/kosh/aegis-static-wiki/wiki/canon/roadmap/{lane}-roadmap.md`
- API contracts: `/home/kosh/aegis-static-wiki/wiki/canon/api/*.md`
- Specs: `/home/kosh/aegis-static-wiki/wiki/canon/specs/*.md`
- Feedback archive: `/home/kosh/aegis-static-wiki/wiki/canon/feedback/**`
- Work requests: `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/*.md`

## What this file is for

Use `docs/AEGIS.md` when you need to answer:

- what should I read first from `~/AEGIS`?
- where is the canonical wiki?
- how do I map a lane declaration to the right handoff page?
- what code surface belongs to that lane?

Do **not** use this file as a deep knowledge base for specs, APIs, handoff history, or policy detail. Those remain in the wiki.

## Local residual surface in `AEGIS/docs/**`

Only these paths remain local after the cutover:

- `docs/AEGIS.md`
- `docs/mcp.md`

Everything else under the previous `docs/**` tree is canonicalized in the wiki.

## Legacy path resolution

Some repo comments, READMEs, or historical notes may still mention old local paths such as `docs/api/...`, `docs/specs/...`, `docs/sN-handoff/...`, or `docs/외부피드백/...`.

Treat those as legacy references and resolve them through:

- `/home/kosh/aegis-static-wiki/wiki/system/migration-map.md`

That file is the authoritative old-path → wiki-path ledger for the cutover.

## Work-request rule

Work requests are now read and maintained through the canonical wiki surface:

- `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/`

Legacy archived WR markdown may exist under:

- `docs/work-requests/`

Those archived docs WRs are reference-only and out of scope for WR MCP runtime behavior.

## Cutover note

- Durable documentation maintenance now happens in the wiki first.
- Sessions launched from `~/AEGIS` should use the local `aegis-static-wiki` MCP server defined in `.mcp.json`.
- Tool availability and MCP usage guidance live in `docs/mcp.md`.
- This file exists only to give a deterministic bootstrap path from `~/AEGIS` into the wiki-managed surface.
