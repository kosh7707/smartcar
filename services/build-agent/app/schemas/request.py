from __future__ import annotations
from pydantic import BaseModel, Field
from app.types import TaskType

class Context(BaseModel):
    trusted: dict
    semiTrusted: dict | None = None
    untrusted: dict | None = None

class Constraints(BaseModel):
    maxTokens: int = Field(8192, ge=1, le=16384)
    timeoutMs: int = Field(600000, ge=1000, le=900000)
    outputSchema: str | None = None

class EvidenceRef(BaseModel):
    refId: str
    artifactId: str
    artifactType: str
    locatorType: str
    locator: dict
    hash: str | None = None

class TaskRequest(BaseModel):
    taskType: TaskType
    taskId: str
    context: Context
    evidenceRefs: list[EvidenceRef] = []
    constraints: Constraints = Constraints()
    metadata: dict | None = None
