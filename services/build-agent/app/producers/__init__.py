"""Producer role boundary for Build Agent.

This package is the reserved home for producer-side build/script/SDK drafts.
Build producers may propose candidate artifacts and best-effort diagnostics,
but they do not decide final build-domain classification, ``cleanPass``, or task
failure boundaries. Current production code only instantiates the small draft
dataclasses where a role-boundary test or local producer seam needs them; do not
import Critic/Orchestrator authority back into this package.
"""

from .types import BuildProducerDraft, ProducerDiagnostic

__all__ = ["BuildProducerDraft", "ProducerDiagnostic"]
