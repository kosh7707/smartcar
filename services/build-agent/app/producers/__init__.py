"""Producer role boundary for Build Agent.

Build producers author build/script/SDK artifacts. They do not decide final
build-domain classification, cleanPass, or task failure boundaries.
"""

from .types import BuildProducerDraft, ProducerDiagnostic

__all__ = ["BuildProducerDraft", "ProducerDiagnostic"]
