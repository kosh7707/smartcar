"""Producer role boundary for Analysis Agent.

This package is the reserved home for producer-side candidate artifacts.
Producers may author draft analysis/PoC material and best-effort diagnostics,
but final quality scoring and task/envelope authority remain in ``app.quality``
and ``app.state_machine``. Current production code only instantiates the small
draft dataclasses where a role-boundary test or local producer seam needs them;
do not import Critic/Orchestrator authority back into this package.
"""

from .types import ProducerDiagnostic, ProducerDraft

__all__ = ["ProducerDiagnostic", "ProducerDraft"]
