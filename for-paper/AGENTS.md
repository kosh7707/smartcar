# AEGIS Paper Mirror — PaperOrchestra Reference Surface

This directory is a **mirror/reference surface**, not the canonical paper-prep authority.

## Canonical authority
The canonical workflow and artifact authority lives at:
- `/home/kosh/projects/aegis-for-paper/PAPER_ORCHESTRA_WORKFLOW.md`
- `/home/kosh/projects/aegis-for-paper/.paper-orchestra/`
- `/home/kosh/projects/aegis-for-paper/artifacts/`

## What this directory is for
Use this directory for:
- local reference while already operating inside `AEGIS`
- mirrored/exported paper-prep material
- compatibility with engineering sessions that need to inspect paper assets

## What this directory is not for
Do **not** originate canonical paper workflow policy here.
Do **not** treat local files here as the source of truth when a canonical artifact exists in `aegis-for-paper`.
Do **not** silently fork the workflow or artifact state.

## Covered work rule
If a task here is genuinely paper-prep work, you must still follow the canonical PaperOrchestra workflow.
Read first:
- `/home/kosh/projects/aegis-for-paper/PAPER_ORCHESTRA_WORKFLOW.md`
- `/home/kosh/projects/aegis-for-paper/.paper-orchestra/state.yaml`

Prefer updating the canonical repo first.
Only make local mirror/reference changes here when the task is explicitly about mirroring, export, or local reference maintenance.

## Mirror hygiene
If you touch mirrored content here:
- keep canonical paths explicit,
- avoid introducing local-only workflow rules,
- and ensure the canonical artifact remains authoritative.

## Skill relationship
If a `paperorchestra` skill is used while operating here, treat it as a helper only.
AGENTS enforces the workflow; the canonical workflow doc defines it.
