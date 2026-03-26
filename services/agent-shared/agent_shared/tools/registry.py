"""ToolRegistry — tool 스키마 등록/조회. LLM에 전달할 function 목록 관리."""

from __future__ import annotations

from dataclasses import dataclass, field

from agent_shared.schemas.agent import ToolCostTier


@dataclass
class ToolSchema:
    """OpenAI function calling 스키마 + 비용 등급."""

    name: str
    description: str
    parameters: dict = field(default_factory=dict)
    cost_tier: ToolCostTier = ToolCostTier.CHEAP


class ToolRegistry:
    """tool 스키마를 등록하고 조회한다."""

    def __init__(self) -> None:
        self._schemas: dict[str, ToolSchema] = {}

    def register(self, schema: ToolSchema) -> None:
        self._schemas[schema.name] = schema

    def get(self, name: str) -> ToolSchema | None:
        return self._schemas.get(name)

    def get_cost_tier(self, name: str) -> ToolCostTier:
        schema = self._schemas.get(name)
        return schema.cost_tier if schema else ToolCostTier.CHEAP

    def get_all_schemas(self) -> list[dict]:
        """OpenAI tools 형식으로 반환."""
        return [
            {
                "type": "function",
                "function": {
                    "name": s.name,
                    "description": s.description,
                    "parameters": s.parameters,
                },
            }
            for s in self._schemas.values()
        ]

    def list_names(self) -> list[str]:
        return list(self._schemas.keys())
