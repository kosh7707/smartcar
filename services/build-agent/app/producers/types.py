from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ProducerDiagnostic:
    """Best-effort producer note; not a final build/quality verdict."""

    id: str
    detail: str
    severity: str = "info"


@dataclass(slots=True)
class BuildProducerDraft:
    """Candidate build/script/SDK artifact before Critic classification."""

    artifact: dict[str, Any]
    diagnostics: list[ProducerDiagnostic] = field(default_factory=list)
