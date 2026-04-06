# AEGIS local bootstrap router

> Canonical agent-facing documentation now lives in **`/home/kosh/aegis-static-wiki`**.
> This repository keeps only the minimum local bootstrap surface required to enter the wiki and to exchange local work requests.

## Start here

1. `/home/kosh/aegis-static-wiki/wiki/system/index.md`
2. `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`
3. `/home/kosh/aegis-static-wiki/wiki/canon/handoff/{lane}/readme.md`
4. `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/`

## Canonical paths

- Wiki index: `/home/kosh/aegis-static-wiki/wiki/system/index.md`
- Platform charter: `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`
- Migration map: `/home/kosh/aegis-static-wiki/wiki/system/migration-map.md`
- Lane handoff: `/home/kosh/aegis-static-wiki/wiki/canon/handoff/{lane}/readme.md`
- Lane roadmap: `/home/kosh/aegis-static-wiki/wiki/canon/roadmap/{lane}-roadmap.md`
- API contracts: `/home/kosh/aegis-static-wiki/wiki/canon/api/*.md`
- Specs: `/home/kosh/aegis-static-wiki/wiki/canon/specs/*.md`
- Feedback archive: `/home/kosh/aegis-static-wiki/wiki/canon/feedback/**`
- Work requests: `/home/kosh/aegis-static-wiki/wiki/canon/work-requests/*.md`

## Local residual surface in `AEGIS/docs/**`

Only these paths remain local after the cutover:

- `docs/AEGIS.md`
- `docs/work-requests/**`

Everything else under the previous `docs/**` tree is canonicalized in the wiki.

## Legacy path resolution

Some repo comments, READMEs, or historical notes may still mention old local paths such as `docs/api/...`, `docs/specs/...`, `docs/sN-handoff/...`, or `docs/외부피드백/...`.

Treat those as legacy references and resolve them through:

- `/home/kosh/aegis-static-wiki/wiki/system/migration-map.md`

That file is the authoritative old-path → wiki-path ledger for the cutover.

## Work-request rule

Local coordination requests may still be exchanged through `docs/work-requests/**` when a repo-local handoff is needed.
Canonical copies also exist in the wiki. If the two surfaces diverge, the wiki copy wins.

## Cutover note

- Durable documentation maintenance now happens in the wiki first.
- This file exists only to give a deterministic bootstrap path from `~/AEGIS` into the wiki-managed surface.
