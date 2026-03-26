from __future__ import annotations

from pydantic import BaseModel, Field

from app.types import FailureCode, TaskStatus, TaskType


class Claim(BaseModel):
    statement: str
    detail: str | None = None
    supportingEvidenceRefs: list[str] = []
    location: str | None = None


class ConfidenceBreakdown(BaseModel):
    grounding: float = 0.0
    deterministicSupport: float = 0.0
    ragCoverage: float = 0.0
    schemaCompliance: float = 0.0


class TestPlan(BaseModel):
    objective: str
    hypotheses: list[str] = []
    targetProtocol: str | None = None
    targetServiceClass: str | None = None
    preconditions: list[str] = []
    dataToCollect: list[str] = []
    stopConditions: list[str] = []
    safetyConstraints: list[str] = []
    suggestedExecutorTemplateIds: list[str] = []
    suggestedRiskLevel: str | None = None


class BuildResult(BaseModel):
    success: bool = False
    buildCommand: str = ""
    buildScript: str = ""
    buildDir: str = "build-aegis"
    errorLog: str | None = None


class SdkProfile(BaseModel):
    compiler: str = ""
    compilerPrefix: str = ""
    gccVersion: str = ""
    targetArch: str = ""
    languageStandard: str = ""
    sysroot: str = ""
    environmentSetup: str = ""
    includePaths: list[str] = []
    defines: dict[str, str] = {}


class AssessmentResult(BaseModel):
    summary: str
    claims: list[Claim] = []
    caveats: list[str] = []
    usedEvidenceRefs: list[str] = []
    suggestedSeverity: str | None = None
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    confidenceBreakdown: ConfidenceBreakdown = Field(
        default_factory=ConfidenceBreakdown,
    )
    needsHumanReview: bool = True
    recommendedNextSteps: list[str] = []
    policyFlags: list[str] = []
    plan: TestPlan | None = None
    buildResult: BuildResult | None = None
    sdkProfile: SdkProfile | None = None


class ValidationInfo(BaseModel):
    valid: bool
    errors: list[str] = []


class TokenUsage(BaseModel):
    prompt: int = 0
    completion: int = 0


class AuditInfo(BaseModel):
    inputHash: str
    latencyMs: int = 0
    tokenUsage: TokenUsage = Field(default_factory=TokenUsage)
    retryCount: int = 0
    ragHits: int = 0
    createdAt: str
    agentAudit: dict | None = None  # AgentAuditInfo (deep-analyze 전용)


class TaskSuccessResponse(BaseModel):
    taskId: str
    taskType: TaskType
    status: TaskStatus = TaskStatus.COMPLETED
    modelProfile: str
    promptVersion: str
    schemaVersion: str
    validation: ValidationInfo
    result: AssessmentResult
    audit: AuditInfo


class TaskFailureResponse(BaseModel):
    taskId: str
    taskType: TaskType
    status: TaskStatus
    failureCode: FailureCode
    failureDetail: str
    retryable: bool = False
    audit: AuditInfo
