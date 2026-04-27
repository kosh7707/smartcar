"""Producer role boundary for Analysis Agent.

Producers author candidate analysis/PoC artifacts and may emit producer
notes, but final quality scoring and task/envelope authority remain in
``app.quality`` and ``app.state_machine``.
"""

from .types import ProducerDiagnostic, ProducerDraft

__all__ = ["ProducerDiagnostic", "ProducerDraft"]
