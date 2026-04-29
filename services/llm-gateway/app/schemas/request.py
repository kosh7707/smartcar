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
    enableThinking: bool
    maxTokens: int = Field(ge=1, le=32768)
    temperature: float = Field(ge=0.0, le=2.0)
    topP: float = Field(ge=0.0, le=1.0)
    topK: int = Field(ge=-1)
    minP: float = Field(ge=0.0, le=1.0)
    presencePenalty: float = Field(ge=-2.0, le=2.0)
    repetitionPenalty: float = Field(ge=0.0, le=2.0)
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
    constraints: Constraints
    metadata: RequestMetadata | None = None


class AsyncChatSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str | None = None
    messages: list[dict] = Field(min_length=1)
    max_tokens: int | None = Field(default=None, ge=1, le=32768)
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    top_k: int | None = Field(default=None, ge=-1)
    min_p: float | None = Field(default=None, ge=0.0, le=1.0)
    presence_penalty: float | None = Field(default=None, ge=-2.0, le=2.0)
    repetition_penalty: float | None = Field(default=None, ge=0.0, le=2.0)
