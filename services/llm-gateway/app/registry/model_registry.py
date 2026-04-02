from __future__ import annotations

from dataclasses import dataclass

from app.types import TaskType


@dataclass
class ModelProfile:
    profileId: str
    modelName: str
    contextLimit: int
    allowedTaskTypes: list[TaskType]
    status: str = "available"
    endpoint: str = ""
    apiKey: str = ""


class ModelProfileRegistry:
    """등록된 model profile을 관리한다."""

    def __init__(self) -> None:
        self._profiles: dict[str, ModelProfile] = {}
        self._default_id: str | None = None

    def register(self, profile: ModelProfile, *, default: bool = False) -> None:
        self._profiles[profile.profileId] = profile
        if default or self._default_id is None:
            self._default_id = profile.profileId

    def get(self, profile_id: str) -> ModelProfile | None:
        return self._profiles.get(profile_id)

    def get_default(self) -> ModelProfile | None:
        if self._default_id is None:
            return None
        return self._profiles.get(self._default_id)

    def list_all(self) -> list[dict]:
        return [
            {
                "profileId": p.profileId,
                "modelName": p.modelName,
                "contextLimit": p.contextLimit,
                "allowedTaskTypes": [t.value for t in p.allowedTaskTypes],
                "status": p.status,
            }
            for p in self._profiles.values()
        ]


def create_default_registry() -> ModelProfileRegistry:
    """Settings 기반으로 기본 model profile을 등록한다."""
    from app.config import settings

    registry = ModelProfileRegistry()
    registry.register(
        ModelProfile(
            profileId=f"{settings.llm_model}-default",
            modelName=settings.llm_model,
            contextLimit=262144,
            allowedTaskTypes=list(TaskType),
            status="available",
            endpoint=settings.llm_endpoint,
            apiKey=settings.llm_api_key,
        ),
        default=True,
    )
    return registry
