from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.types import TaskType


class EvidenceRef(BaseModel):
    refId: str
    artifactId: str
    artifactType: str
    locatorType: str
    locator: dict
    hash: str | None = None
    label: str | None = None


class Context(BaseModel):
    trusted: dict = Field(default_factory=dict)
    semiTrusted: dict | None = None
    untrusted: dict | None = None


class Constraints(BaseModel):
    maxTokens: int = Field(2048, ge=1, le=8192)
    timeoutMs: int = Field(15000, ge=1000, le=300000)
    outputSchema: str | None = None


class RequestMetadata(BaseModel):
    runId: str | None = None
    requestedBy: str | None = None


class TaskRequest(BaseModel):
    taskType: TaskType
    taskId: str
    context: Context
    evidenceRefs: list[EvidenceRef] = []
    constraints: Constraints = Field(default_factory=Constraints)
    metadata: RequestMetadata | None = None


class AsyncChatSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str | None = None
    messages: list[dict] = Field(min_length=1)
    max_tokens: int | None = Field(default=None, ge=1)
    temperature: float | None = None
