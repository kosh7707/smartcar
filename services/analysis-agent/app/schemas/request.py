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
    model_config = ConfigDict(extra="forbid")

    maxTokens: int = Field(2048, ge=1, le=32768)
    timeoutMs: int = Field(15000, ge=1000, le=900000)
    outputSchema: str | None = None
    enableThinking: bool | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    topP: float | None = Field(default=None, ge=0.0, le=1.0)
    topK: int | None = Field(default=None, ge=1)
    minP: float | None = Field(default=None, ge=0.0, le=1.0)
    presencePenalty: float | None = Field(default=None, ge=-2.0, le=2.0)
    repetitionPenalty: float | None = Field(default=None, ge=0.0, le=2.0)


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
