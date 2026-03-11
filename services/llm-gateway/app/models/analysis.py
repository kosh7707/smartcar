from __future__ import annotations

import json
from dataclasses import dataclass, field

from app.models.vulnerability import VulnerabilityData


@dataclass(slots=True)
class AnalysisResult:
    vulnerabilities: list[VulnerabilityData] = field(default_factory=list)
    note: str | None = None

    def to_json(self) -> str:
        """MockLlmClient.generate()가 반환하는 JSON 문자열과 동일한 형태."""
        result: dict = {
            "vulnerabilities": [v.to_dict() for v in self.vulnerabilities],
        }
        if self.note:
            result["note"] = self.note
        return json.dumps(result, ensure_ascii=False)
