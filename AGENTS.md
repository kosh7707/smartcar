# AEGIS Repository — Wiki-First Agent Instructions

## Canonical documentation surface
- The canonical agent-facing documentation for AEGIS now lives in **`/home/kosh/aegis-static-wiki`**.
- Start with:
  - `/home/kosh/aegis-static-wiki/wiki/canon/charter/aegis.md`
  - `/home/kosh/aegis-static-wiki/wiki/system/index.md`
  - your lane entry page under `/home/kosh/aegis-static-wiki/wiki/canon/handoff/**`
- Treat this repository’s local `docs/**` tree as a **migration/compatibility surface**, not the primary source of truth.

## Required behavior
1. When you need project guidance, specs, API contracts, handoff notes, roadmaps, or work requests, **read the wiki first**.
2. When you update documentation, **update the wiki canon page first**.
3. Only update `docs/**` in this repo when doing one of the following:
   - maintaining compatibility redirects/notices
   - performing migration sync into the wiki
   - preserving a temporary local mirror during cutover
4. Do not introduce new durable process guidance that exists only under `docs/**`.

## Migration intent
- The project is migrating from `AEGIS/docs/**` to `aegis-static-wiki/wiki/canon/**`.
- If a local `docs/**` page and a wiki canon page disagree, the **wiki canon page wins**.
- If a wiki canon page is missing or stale, sync from the current local source into the wiki and then continue from the wiki copy.
