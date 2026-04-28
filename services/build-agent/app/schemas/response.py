from __future__ import annotations

from pydantic import BaseModel, Field

from app.types import FailureCode, TaskStatus, TaskType


BUILD_RESPONSE_SCHEMA_VERSION = "build-v1.1"


class Claim(BaseModel):
    statement: str
    detail: str | None = None
    supportingEvidenceRefs: list[str] = Field(default_factory=list)
    location: str | None = None


class ConfidenceBreakdown(BaseModel):
    grounding: float = 0.0
    deterministicSupport: float = 0.0
    ragCoverage: float = 0.0
    schemaCompliance: float = 0.0


class TestPlan(BaseModel):
    objective: str
    hypotheses: list[str] = Field(default_factory=list)
    targetProtocol: str | None = None
    targetServiceClass: str | None = None
    preconditions: list[str] = Field(default_factory=list)
    dataToCollect: list[str] = Field(default_factory=list)
    stopConditions: list[str] = Field(default_factory=list)
    safetyConstraints: list[str] = Field(default_factory=list)
    suggestedExecutorTemplateIds: list[str] = Field(default_factory=list)
    suggestedRiskLevel: str | None = None


class BuildArtifact(BaseModel):
    path: str = ""
    kind: str = ""
    exists: bool | None = None
    notes: str | None = None


class ArtifactVerification(BaseModel):
    strict: bool = False
    expected: list[str] = Field(default_factory=list)
    produced: list[str] = Field(default_factory=list)
    matched: bool = True
    missing: list[str] = Field(default_factory=list)


class BuildResult(BaseModel):
    success: bool = False
    declaredMode: str | None = None
    sdkId: str | None = None
    buildCommand: str = ""
    buildScript: str = ""
    buildDir: str = "build-aegis"
    errorLog: str | None = None
    producedArtifacts: list[BuildArtifact] = Field(default_factory=list)
    artifactVerification: ArtifactVerification | None = None


class BuildPreparation(BaseModel):
    declaredMode: str | None = None
    sdkId: str | None = None
    buildCommand: str = ""
    buildScript: str = ""
    buildDir: str = "build-aegis"
    buildEnvironment: dict[str, str] = Field(default_factory=dict)
    provenance: dict[str, object] = Field(default_factory=dict)
    expectedArtifacts: list[str] = Field(default_factory=list)
    producedArtifacts: list[str] = Field(default_factory=list)


class BuildDiagnostics(BaseModel):
    failureCode: str | None = None
    failureCategory: str | None = None
    expectedArtifacts: list[str] = Field(default_factory=list)
    producedArtifacts: list[str] = Field(default_factory=list)
    missingArtifacts: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class BuildOutcome(BaseModel):
    outcome: str = "inconclusive"
    taskCompleted: bool = True
    cleanPass: bool = False
    reasons: list[str] = Field(default_factory=list)


class SdkProfile(BaseModel):
    compiler: str = ""
    compilerPrefix: str = ""
    gccVersion: str = ""
    targetArch: str = ""
    languageStandard: str = ""
    sysroot: str = ""
    environmentSetup: str = ""
    includePaths: list[str] = Field(default_factory=list)
    defines: dict[str, str] = Field(default_factory=dict)


class AssessmentResult(BaseModel):
    summary: str
    claims: list[Claim] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    usedEvidenceRefs: list[str] = Field(default_factory=list)
    suggestedSeverity: str | None = None
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    confidenceBreakdown: ConfidenceBreakdown = Field(
        default_factory=ConfidenceBreakdown,
    )
    needsHumanReview: bool = True
    recommendedNextSteps: list[str] = Field(default_factory=list)
    policyFlags: list[str] = Field(default_factory=list)
    plan: TestPlan | None = None
    buildResult: BuildResult | None = None
    buildPreparation: BuildPreparation | None = None
    sdkProfile: SdkProfile | None = None
    buildOutcome: BuildOutcome | None = None
    cleanPass: bool = False
    buildDiagnostics: BuildDiagnostics | None = None


class ValidationInfo(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)


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


class FailureContext(BaseModel):
    buildCommand: str | None = None
    buildScript: str | None = None
    buildDir: str | None = None
    expectedArtifacts: list[str] = Field(default_factory=list)
    producedArtifacts: list[str] = Field(default_factory=list)
    missingArtifacts: list[str] = Field(default_factory=list)
    strictMode: bool | None = None
    contractVersion: str | None = None


class TaskSuccessResponse(BaseModel):
    taskId: str
    taskType: TaskType
    contractVersion: str | None = None
    strictMode: bool | None = None
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
    contractVersion: str | None = None
    strictMode: bool | None = None
    status: TaskStatus
    failureCode: FailureCode
    failureDetail: str
    retryable: bool = False
    failureContext: FailureContext | None = None
    audit: AuditInfo
