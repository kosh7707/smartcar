from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ProducerDiagnostic:
    """Best-effort producer note; never a final quality verdict."""

    id: str
    detail: str
    severity: str = "info"


@dataclass(slots=True)
class ProducerDraft:
    """Candidate artifact emitted before independent Critic/Orchestrator review."""

    artifact: dict[str, Any]
    diagnostics: list[ProducerDiagnostic] = field(default_factory=list)
