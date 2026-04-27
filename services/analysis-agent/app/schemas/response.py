from __future__ import annotations

from pydantic import BaseModel, Field

from app.types import (
    AnalysisOutcome,
    FailureCode,
    PocOutcome,
    QualityOutcome,
    TaskStatus,
    TaskType,
)


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


class RecoveryTraceEntry(BaseModel):
    deficiency: str
    action: str
    outcome: str
    detail: str | None = None
    level: int | None = None
    attempt: int | None = None
    deficiencyClass: str | None = None
    recoveryAction: str | None = None
    result: str | None = None
    dependencyState: str | None = None


class EvidenceRefRoleDiagnostic(BaseModel):
    refId: str
    actualClass: str | None = None
    requiredClass: str | None = None
    path: str | None = None


class EvidenceAcquisitionDiagnostic(BaseModel):
    slot: str | None = None
    tool: str | None = None
    status: str | None = None
    detail: str | None = None


class EvidenceDiagnostics(BaseModel):
    invalidRefs: list[str] = Field(default_factory=list)
    invalidRefRoles: list[EvidenceRefRoleDiagnostic] = Field(default_factory=list)
    missingSlots: list[str] = Field(default_factory=list)
    attemptedAcquisitions: list[EvidenceAcquisitionDiagnostic] = Field(default_factory=list)
    availableLocalRefs: list[str] = Field(default_factory=list)
    availableKnowledgeRefs: list[str] = Field(default_factory=list)
    unclassifiedRefs: list[str] = Field(default_factory=list)


class QualityGateItem(BaseModel):
    id: str
    repairable: bool = False
    requiredEvidenceSlots: list[str] = Field(default_factory=list)
    repairAttempts: list[str] = Field(default_factory=list)
    detail: str | None = None


class QualityGateResult(BaseModel):
    outcome: QualityOutcome = QualityOutcome.INCONCLUSIVE
    failedItems: list[QualityGateItem] = Field(default_factory=list)
    repairableItems: list[QualityGateItem] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class EvaluationVerdict(BaseModel):
    taskCompleted: bool = True
    cleanPass: bool = False
    reasons: list[str] = Field(default_factory=list)
    gateOutcomes: list[str] = Field(default_factory=list)


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
    analysisOutcome: AnalysisOutcome = AnalysisOutcome.INCONCLUSIVE
    qualityOutcome: QualityOutcome = QualityOutcome.INCONCLUSIVE
    pocOutcome: PocOutcome = PocOutcome.POC_NOT_REQUESTED
    recoveryTrace: list[RecoveryTraceEntry] = Field(default_factory=list)
    cleanPass: bool = False
    evaluationVerdict: EvaluationVerdict = Field(default_factory=EvaluationVerdict)
    contextualEvidenceRefs: list[str] = Field(default_factory=list)
    evidenceDiagnostics: EvidenceDiagnostics = Field(default_factory=EvidenceDiagnostics)
    qualityGate: QualityGateResult = Field(default_factory=QualityGateResult)


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
