"""ResultAssembler — 에이전트 루프 출력을 TaskResponse 형식으로 변환."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.agent_runtime.observability import agent_log
from app.pipeline.confidence import ConfidenceCalculator
from app.pipeline.response_parser import V1ResponseParser
from app.agent_runtime.schemas.agent import AgentAuditInfo
from app.quality.deep_quality_gate import evaluate_deep_quality
from app.schemas.response import (
    AssessmentResult,
    AuditInfo,
    Claim,
    EvaluationVerdict,
    EvidenceDiagnostics,
    EvidenceRefRoleDiagnostic,
    QualityGateItem,
    QualityGateResult,
    RecoveryTraceEntry,
    TaskFailureResponse,
    TaskSuccessResponse,
    TokenUsage,
    ValidationInfo,
)
from app.state_machine.outcomes import clean_pass_for
from app.state_machine.recovery_triage import recovery_trace
from app.state_machine.types import DeficiencyClass, DependencyState
from app.types import AnalysisOutcome, FailureCode, PocOutcome, QualityOutcome, TaskStatus
from app.validators.evidence_sanitizer import EvidenceRefSanitizer
from app.validators.evidence_validator import EvidenceValidator
from app.validators.schema_validator import SchemaValidator

if TYPE_CHECKING:
    from app.core.agent_session import AgentSession

logger = logging.getLogger(__name__)


class ResultAssembler:
    """에이전트 루프의 최종 결과를 API 응답 형식으로 조립한다."""

    def __init__(self, model_name: str = "", prompt_version: str = "agent-v1") -> None:
        self._parser = V1ResponseParser()
        self._schema_validator = SchemaValidator()
        self._evidence_sanitizer = EvidenceRefSanitizer()
        self._evidence_validator = EvidenceValidator()
        self._confidence_calculator = ConfidenceCalculator()
        self._model_name = model_name
        self._prompt_version = prompt_version

    def build(
        self,
        final_content: str,
        session: AgentSession,
    ) -> TaskSuccessResponse | TaskFailureResponse:
        """LLM이 반환한 최종 content를 파싱하여 응답을 구성한다."""
        # 파싱
        parsed = self._parser.parse(final_content)
        fallback = parsed is None

        agent_log(
            logger, "결과 파싱",
            component="result_assembler", phase="result_parse",
            parsedOk=not fallback, fallbackApplied=fallback,
        )

        if parsed is None:
            session.set_termination_reason("invalid_final_output")
            return self.build_completed_outcome(
                session,
                summary="S3 검토는 완료되었지만 구조화된 최종 Assessment를 확정할 수 없어 inconclusive로 분류했습니다.",
                analysis_outcome=AnalysisOutcome.INCONCLUSIVE,
                quality_outcome=QualityOutcome.REPAIR_EXHAUSTED,
                caveats=["LLM final output was not parseable as Assessment JSON after recovery."],
                policy_flags=["recovery_classified", "schema_deficient"],
                recovery_trace=[recovery_trace(
                    deficiency="LLM_OUTPUT_DEFICIENT",
                    action="outcome_classification",
                    outcome="inconclusive",
                    detail="Final content was non-JSON or not a parseable Assessment object.",
                    deficiency_class=DeficiencyClass.MALFORMED_LLM_OUTPUT,
                    dependency_state=DependencyState.OUTPUT_DEFICIENT,
                )],
                termination_reason="invalid_final_output_recovered",
            )

        # 검증: 입력 제공 refs + Phase 1 refs + 도구가 생성한 refs 합집합
        allowed_refs = {ref.refId for ref in session.request.evidenceRefs}
        allowed_refs.update(session.extra_allowed_refs)
        allowed_refs.update(session.evidence_catalog.ref_ids())
        for step in session.trace:
            allowed_refs.update(step.new_evidence_refs)

        allowed_claim_refs = _allowed_claim_ref_ids(session, allowed_refs)
        canonical_repairs, canonical_failure = _canonicalize_deep_assessment(
            parsed,
            session,
            allowed_refs,
            allowed_claim_refs,
        )
        if canonical_repairs:
            agent_log(
                logger,
                "deep assessment canonicalized",
                component="result_assembler",
                phase="result_canonicalize",
                repairs=canonical_repairs,
            )
        if canonical_failure:
            session.set_termination_reason("invalid_grounding")
            return self.build_completed_outcome(
                session,
                summary="S3 검토는 완료되었지만 claim grounding을 정직하게 수용할 수 없어 no_accepted_claims로 분류했습니다.",
                analysis_outcome=AnalysisOutcome.NO_ACCEPTED_CLAIMS,
                quality_outcome=QualityOutcome.REJECTED,
                caveats=[canonical_failure],
                policy_flags=["recovery_classified", "grounding_deficient"],
                recovery_trace=[recovery_trace(
                    deficiency="GROUNDING_DEFICIENT",
                    action="reject_unaccepted_claims",
                    outcome="no_accepted_claims",
                    detail=canonical_failure,
                    deficiency_class=DeficiencyClass.GROUNDING,
                    dependency_state=DependencyState.AVAILABLE,
                )],
                termination_reason="invalid_grounding_recovered",
            )

        schema_result = self._schema_validator.validate(parsed, session.request.taskType)
        if not schema_result.valid:
            agent_log(
                logger, "결과 검증",
                component="result_assembler", phase="result_validate",
                schemaValid=False,
                evidenceValid=False,
                errorCount=len(schema_result.errors),
            )
            session.set_termination_reason("invalid_final_output")
            return self.build_completed_outcome(
                session,
                summary="S3 검토는 완료되었지만 최종 Assessment 스키마 결함이 남아 inconclusive로 분류했습니다.",
                analysis_outcome=AnalysisOutcome.INCONCLUSIVE,
                quality_outcome=QualityOutcome.REPAIR_EXHAUSTED,
                caveats=schema_result.errors,
                policy_flags=["recovery_classified", "schema_deficient"],
                recovery_trace=[recovery_trace(
                    deficiency="SCHEMA_DEFICIENT",
                    action="outcome_classification",
                    outcome="inconclusive",
                    detail="; ".join(schema_result.errors),
                    deficiency_class=DeficiencyClass.SCHEMA,
                    dependency_state=DependencyState.OUTPUT_DEFICIENT,
                )],
                termination_reason="invalid_final_output_recovered",
            )

        evidence_diagnostics = _build_evidence_diagnostics(session, parsed, allowed_refs, allowed_claim_refs)
        contextual_evidence_refs = _contextual_evidence_refs(session, parsed, allowed_refs)
        evidence_valid, evidence_errors = self._evidence_validator.validate(
            parsed,
            allowed_refs,
            evidence_catalog=session.evidence_catalog,
            allowed_claim_ref_ids=allowed_claim_refs,
        )
        if not evidence_valid:
            agent_log(
                logger, "결과 검증",
                component="result_assembler", phase="result_validate",
                schemaValid=True,
                evidenceValid=False,
                errorCount=len(evidence_errors),
            )
            session.set_termination_reason("invalid_grounding")
            return self.build_completed_outcome(
                session,
                summary="S3 검토는 완료되었지만 evidence grounding 결함으로 accepted claim을 확정하지 못했습니다.",
                analysis_outcome=AnalysisOutcome.NO_ACCEPTED_CLAIMS,
                quality_outcome=QualityOutcome.REJECTED,
                caveats=evidence_errors,
                policy_flags=["recovery_classified", "grounding_deficient"],
                recovery_trace=[recovery_trace(
                    deficiency="REFS_OR_GROUNDING_DEFICIENT",
                    action="reject_unaccepted_claims",
                    outcome="no_accepted_claims",
                    detail="; ".join(evidence_errors),
                    deficiency_class=DeficiencyClass.GROUNDING,
                    dependency_state=DependencyState.AVAILABLE,
                )],
                evidence_diagnostics=evidence_diagnostics,
                contextual_evidence_refs=contextual_evidence_refs,
                termination_reason="invalid_grounding_recovered",
            )

        # 환각 refId 제거 (raw evidence validation 이후의 방어적 no-op)
        parsed, sanitize_corrections = self._evidence_sanitizer.sanitize(parsed, allowed_refs)
        if sanitize_corrections:
            agent_log(
                logger, "evidence ref defensive cleanup",
                component="result_assembler", phase="result_sanitize",
                correctionCount=len(sanitize_corrections),
                corrections=sanitize_corrections[:10],
            )

        validation = ValidationInfo(
            valid=schema_result.valid and evidence_valid,
            errors=schema_result.errors + evidence_errors,
        )

        agent_log(
            logger, "결과 검증",
            component="result_assembler", phase="result_validate",
            schemaValid=schema_result.valid,
            evidenceValid=evidence_valid,
            errorCount=len(schema_result.errors) + len(evidence_errors),
        )

        # confidence
        finding = session.request.context.trusted.get("finding")
        rule_matches = session.request.context.trusted.get("ruleMatches", [])
        confidence, breakdown = self._confidence_calculator.calculate(
            parsed,
            input_ref_ids=allowed_refs,
            schema_valid=validation.valid,
            has_rule_results=bool(finding or rule_matches),
            rag_hits=0,
        )

        agent_log(
            logger, "결과 신뢰도",
            component="result_assembler", phase="result_confidence",
            confidence=confidence,
            breakdown=breakdown.model_dump() if hasattr(breakdown, "model_dump") else breakdown,
        )

        # AssessmentResult 조립
        claims = [
            Claim(
                statement=c.get("statement", ""),
                detail=c.get("detail"),
                supportingEvidenceRefs=c.get("supportingEvidenceRefs", []),
                location=c.get("location"),
            )
            for c in parsed.get("claims", [])
        ]

        analysis_outcome = (
            AnalysisOutcome.ACCEPTED_CLAIMS if claims else AnalysisOutcome.NO_ACCEPTED_CLAIMS
        )
        quality_gate = evaluate_deep_quality(
            claims=claims,
            caveats=parsed.get("caveats", []),
            evidence_errors=[],
        )
        quality_outcome = quality_gate.outcome
        poc_outcome = PocOutcome.POC_NOT_REQUESTED
        clean_pass = clean_pass_for(
            analysis_outcome=analysis_outcome,
            quality_outcome=quality_outcome,
            poc_outcome=poc_outcome,
        )
        evaluation_verdict = _evaluation_verdict_for(
            clean_pass=clean_pass,
            analysis_outcome=analysis_outcome,
            quality_outcome=quality_outcome,
            poc_outcome=poc_outcome,
            evidence_errors=[],
        )

        result = AssessmentResult(
            summary=parsed.get("summary", ""),
            claims=claims,
            caveats=parsed.get("caveats", []),
            usedEvidenceRefs=parsed.get("usedEvidenceRefs", []),
            suggestedSeverity=parsed.get("suggestedSeverity"),
            confidence=confidence,
            confidenceBreakdown=breakdown,
            needsHumanReview=parsed.get("needsHumanReview", True),
            recommendedNextSteps=parsed.get("recommendedNextSteps", []),
            policyFlags=parsed.get("policyFlags", []),
            analysisOutcome=analysis_outcome,
            qualityOutcome=quality_outcome,
            pocOutcome=poc_outcome,
            recoveryTrace=[],
            cleanPass=clean_pass,
            evaluationVerdict=evaluation_verdict,
            contextualEvidenceRefs=contextual_evidence_refs,
            evidenceDiagnostics=evidence_diagnostics,
            qualityGate=quality_gate,
        )

        agent_log(
            logger, "결과 조립 완료",
            component="result_assembler", phase="result_build",
            status="completed",
            claimCount=len(claims),
            severity=parsed.get("suggestedSeverity"),
        )

        return TaskSuccessResponse(
            taskId=session.request.taskId,
            taskType=session.request.taskType,
            status=TaskStatus.COMPLETED,
            modelProfile="agent-loop",
            promptVersion="agent-v1",
            schemaVersion="agent-v1.1",
            validation=validation,
            result=result,
            audit=self._build_audit(session, "content_returned"),
        )

    _TERMINATION_MAP: dict[str, tuple[TaskStatus, FailureCode, bool]] = {
        "max_steps":           (TaskStatus.BUDGET_EXCEEDED, FailureCode.MAX_STEPS_EXCEEDED,    False),
        "budget_exhausted":    (TaskStatus.BUDGET_EXCEEDED, FailureCode.TOKEN_BUDGET_EXCEEDED, False),
        "timeout":             (TaskStatus.TIMEOUT,         FailureCode.TIMEOUT,               True),
        "no_new_evidence":     (TaskStatus.BUDGET_EXCEEDED, FailureCode.INSUFFICIENT_EVIDENCE, False),
        "all_tiers_exhausted": (TaskStatus.BUDGET_EXCEEDED, FailureCode.ALL_TOOLS_EXHAUSTED,   False),
    }

    def build_from_exhaustion(
        self,
        session: AgentSession,
    ) -> TaskSuccessResponse | TaskFailureResponse:
        """정책에 의해 루프가 종료된 경우 state-machine outcome으로 분류한다."""
        reason = session.termination_reason
        if reason in {
            "max_steps",
            "budget_exhausted",
            "no_new_evidence",
            "all_tiers_exhausted",
        } or (reason or "").startswith("llm_failure_partial:"):
            analysis_outcome = (
                AnalysisOutcome.NO_ACCEPTED_CLAIMS
                if reason == "no_new_evidence"
                else AnalysisOutcome.INCONCLUSIVE
            )
            return self.build_completed_outcome(
                session,
                summary="S3 검토는 완료되었지만 복구/증거/도구 예산이 소진되어 negative outcome으로 분류했습니다.",
                analysis_outcome=analysis_outcome,
                quality_outcome=QualityOutcome.REPAIR_EXHAUSTED,
                caveats=[f"Agent loop ended with recoverable exhaustion reason: {reason}"],
                policy_flags=["recovery_classified", "repair_exhausted"],
                recovery_trace=[recovery_trace(
                    deficiency="RECOVERY_EXHAUSTED",
                    action="outcome_classification",
                    outcome=analysis_outcome.value,
                    detail=f"termination_reason={reason}",
                    deficiency_class=DeficiencyClass.REPAIR_EXHAUSTED,
                    dependency_state=DependencyState.DEGRADED_PARTIAL,
                )],
                termination_reason=f"{reason or 'exhaustion'}_recovered",
            )
        status, code, retryable = self._TERMINATION_MAP.get(
            reason,
            (TaskStatus.BUDGET_EXCEEDED, FailureCode.TOKEN_BUDGET_EXCEEDED, False),
        )
        return self.build_failure(
            session, status, code,
            f"에이전트 루프 종료: {reason}",
            retryable=retryable,
        )

    def build_completed_outcome(
        self,
        session: AgentSession,
        *,
        summary: str,
        analysis_outcome: AnalysisOutcome = AnalysisOutcome.INCONCLUSIVE,
        quality_outcome: QualityOutcome = QualityOutcome.INCONCLUSIVE,
        poc_outcome: PocOutcome = PocOutcome.POC_NOT_REQUESTED,
        caveats: list[str] | None = None,
        recommended_next_steps: list[str] | None = None,
        policy_flags: list[str] | None = None,
        recovery_trace: list[RecoveryTraceEntry] | None = None,
        evidence_diagnostics: EvidenceDiagnostics | None = None,
        contextual_evidence_refs: list[str] | None = None,
        termination_reason: str = "outcome_classified",
    ) -> TaskSuccessResponse:
        """Build a completed honest envelope for recoverable S3-owned deficiencies."""
        session.set_termination_reason(termination_reason)
        flags = list(dict.fromkeys(policy_flags or []))
        if "state_machine_outcome" not in flags:
            flags.append("state_machine_outcome")
        clean_pass = clean_pass_for(
            analysis_outcome=analysis_outcome,
            quality_outcome=quality_outcome,
            poc_outcome=poc_outcome,
        )
        diagnostics = evidence_diagnostics or _build_evidence_diagnostics(
            session,
            {"claims": [], "usedEvidenceRefs": []},
            _all_allowed_ref_ids(session),
            _allowed_claim_ref_ids(session, _all_allowed_ref_ids(session)),
        )
        quality_gate = _quality_gate_for(
            outcome=quality_outcome,
            caveats=caveats or [],
            evidence_errors=[],
            has_claims=False,
        )
        result = AssessmentResult(
            summary=summary,
            claims=[],
            caveats=caveats or [],
            usedEvidenceRefs=[],
            suggestedSeverity="info",
            confidence=0.0,
            needsHumanReview=True,
            recommendedNextSteps=recommended_next_steps or [
                "Review recoveryTrace/audit details before treating this as a clean pass."
            ],
            policyFlags=flags,
            analysisOutcome=analysis_outcome,
            qualityOutcome=quality_outcome,
            pocOutcome=poc_outcome,
            recoveryTrace=recovery_trace or [],
            cleanPass=clean_pass,
            evaluationVerdict=_evaluation_verdict_for(
                clean_pass=clean_pass,
                analysis_outcome=analysis_outcome,
                quality_outcome=quality_outcome,
                poc_outcome=poc_outcome,
                evidence_errors=caveats or [],
            ),
            contextualEvidenceRefs=contextual_evidence_refs or _contextual_evidence_refs(
                session,
                {"contextualEvidenceRefs": []},
                _all_allowed_ref_ids(session),
            ),
            evidenceDiagnostics=diagnostics,
            qualityGate=quality_gate,
        )
        return TaskSuccessResponse(
            taskId=session.request.taskId,
            taskType=session.request.taskType,
            status=TaskStatus.COMPLETED,
            modelProfile="agent-loop",
            promptVersion="agent-v1",
            schemaVersion="agent-v1.1",
            validation=ValidationInfo(valid=True, errors=[]),
            result=result,
            audit=self._build_audit(session, termination_reason),
        )

    def build_failure(
        self,
        session: AgentSession,
        status: TaskStatus,
        code: FailureCode,
        detail: str,
        retryable: bool = False,
    ) -> TaskFailureResponse:
        return TaskFailureResponse(
            taskId=session.request.taskId,
            taskType=session.request.taskType,
            status=status,
            failureCode=code,
            failureDetail=detail,
            retryable=retryable,
            audit=self._build_audit(session, session.termination_reason or "error"),
        )

    def _build_audit(self, session: AgentSession, termination_reason: str) -> AuditInfo:
        input_str = json.dumps(session.request.model_dump(mode="json"), sort_keys=True)
        input_hash = f"sha256:{hashlib.sha256(input_str.encode()).hexdigest()[:16]}"

        agent_audit = AgentAuditInfo(
            input_hash=input_hash,
            latency_ms=session.elapsed_ms(),
            total_prompt_tokens=session.total_prompt_tokens(),
            total_completion_tokens=session.total_completion_tokens(),
            turn_count=session.turn_count,
            tool_call_count=session.total_tool_calls(),
            trace=session.trace,
            turns=session.turns,
            termination_reason=termination_reason,
            created_at=datetime.now(timezone.utc).isoformat(),
            model_name=self._model_name,
            prompt_version=self._prompt_version,
        )

        return AuditInfo(
            inputHash=input_hash,
            latencyMs=session.elapsed_ms(),
            tokenUsage=TokenUsage(
                prompt=session.total_prompt_tokens(),
                completion=session.total_completion_tokens(),
            ),
            retryCount=0,
            ragHits=0,
            createdAt=datetime.now(timezone.utc).isoformat(),
            agentAudit=agent_audit.model_dump(mode="json"),
        )


def _all_allowed_ref_ids(session: AgentSession) -> set[str]:
    refs = {ref.refId for ref in session.request.evidenceRefs}
    refs.update(session.extra_allowed_refs)
    refs.update(session.evidence_catalog.ref_ids())
    for step in session.trace:
        refs.update(step.new_evidence_refs)
    return refs


def _allowed_claim_ref_ids(session: AgentSession, allowed_refs: set[str]) -> set[str]:
    """Return refs allowed in final claims.

    The catalog is authoritative. Directly-appended test traces and legacy tool
    traces can lack catalog metadata, so local-looking prefixes remain
    claim-supporting for compatibility; knowledge/operational refs do not.
    """
    claim_refs = set(session.evidence_catalog.final_ref_ids())
    for ref_id in allowed_refs:
        if session.evidence_catalog.get(ref_id) is not None:
            continue
        if _looks_like_local_claim_ref(ref_id):
            claim_refs.add(ref_id)
    return claim_refs


def _looks_like_local_claim_ref(ref_id: str) -> bool:
    if not isinstance(ref_id, str):
        return False
    if ref_id.startswith(("eref-knowledge-", "eref-metadata-", "eref-operational-")):
        return False
    return ref_id.startswith((
        "eref-sast-",
        "eref-caller-",
        "eref-callee-",
        "eref-file-",
        "eref-codesearch-",
        "eref-source-",
        "eref-",
    ))


def _contextual_evidence_refs(session: AgentSession, parsed: dict, allowed_refs: set[str]) -> list[str]:
    refs: list[str] = []
    explicit = parsed.get("contextualEvidenceRefs", [])
    if isinstance(explicit, list):
        refs.extend(ref for ref in explicit if isinstance(ref, str) and ref in allowed_refs)
    refs.extend(sorted(session.evidence_catalog.contextual_ref_ids()))
    refs.extend(sorted(ref for ref in allowed_refs if isinstance(ref, str) and ref.startswith("eref-knowledge-")))
    return list(dict.fromkeys(refs))


def _build_evidence_diagnostics(
    session: AgentSession,
    parsed: dict,
    allowed_refs: set[str],
    allowed_claim_refs: set[str],
) -> EvidenceDiagnostics:
    invalid_refs: list[str] = []
    invalid_roles: list[EvidenceRefRoleDiagnostic] = []
    for path, ref_id in _iter_response_refs(parsed):
        if ref_id not in allowed_refs:
            invalid_refs.append(ref_id)
            invalid_roles.append(EvidenceRefRoleDiagnostic(
                refId=ref_id,
                actualClass="missing",
                requiredClass="local_or_derived_local",
                path=path,
            ))
            continue
        if path.startswith("claims[") and ref_id not in allowed_claim_refs:
            entry = session.evidence_catalog.get(ref_id)
            invalid_roles.append(EvidenceRefRoleDiagnostic(
                refId=ref_id,
                actualClass=entry.evidence_class if entry else _fallback_evidence_class(ref_id),
                requiredClass="local_or_derived_local",
                path=path,
            ))

    return EvidenceDiagnostics(
        invalidRefs=list(dict.fromkeys(invalid_refs)),
        invalidRefRoles=_dedupe_role_diagnostics(invalid_roles),
        availableLocalRefs=sorted(session.evidence_catalog.local_ref_ids() | {
            ref for ref in allowed_refs if _looks_like_local_claim_ref(ref)
        }),
        availableKnowledgeRefs=sorted(session.evidence_catalog.contextual_ref_ids() | {
            ref for ref in allowed_refs if isinstance(ref, str) and ref.startswith("eref-knowledge-")
        }),
        unclassifiedRefs=sorted(session.evidence_catalog.unclassified_ref_ids()),
    )


def _iter_response_refs(parsed: dict) -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []
    used = parsed.get("usedEvidenceRefs", [])
    if isinstance(used, list):
        refs.extend((f"usedEvidenceRefs[{i}]", ref) for i, ref in enumerate(used) if isinstance(ref, str))
    claims = parsed.get("claims", [])
    if isinstance(claims, list):
        for i, claim in enumerate(claims):
            if not isinstance(claim, dict):
                continue
            supporting = claim.get("supportingEvidenceRefs", [])
            if isinstance(supporting, list):
                refs.extend(
                    (f"claims[{i}].supportingEvidenceRefs[{j}]", ref)
                    for j, ref in enumerate(supporting)
                    if isinstance(ref, str)
                )
    return refs


def _fallback_evidence_class(ref_id: str) -> str:
    if ref_id.startswith("eref-knowledge-"):
        return "knowledge"
    if ref_id.startswith("eref-metadata-"):
        return "operational"
    if _looks_like_local_claim_ref(ref_id):
        return "local"
    return "unclassified"


def _dedupe_role_diagnostics(
    diagnostics: list[EvidenceRefRoleDiagnostic],
) -> list[EvidenceRefRoleDiagnostic]:
    seen: set[tuple[str, str | None, str | None]] = set()
    result: list[EvidenceRefRoleDiagnostic] = []
    for item in diagnostics:
        key = (item.refId, item.requiredClass, item.path)
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def _quality_gate_for(
    *,
    outcome: QualityOutcome,
    caveats: list[str],
    evidence_errors: list[str],
    has_claims: bool,
) -> QualityGateResult:
    failed_items: list[QualityGateItem] = []
    repairable_items: list[QualityGateItem] = []
    if evidence_errors:
        failed_items.append(QualityGateItem(
            id="evidence-grounding",
            repairable=True,
            requiredEvidenceSlots=["project-local-or-derived evidence"],
            detail="; ".join(evidence_errors),
        ))
    if not has_claims and outcome != QualityOutcome.ACCEPTED:
        repairable_items.append(QualityGateItem(
            id="accepted-claim-coverage",
            repairable=True,
            requiredEvidenceSlots=["grounded accepted claim or explicit negative rationale"],
            detail="No accepted claims were emitted.",
        ))
    return QualityGateResult(
        outcome=outcome,
        failedItems=failed_items,
        repairableItems=repairable_items,
        caveats=caveats,
    )


def _evaluation_verdict_for(
    *,
    clean_pass: bool,
    analysis_outcome: AnalysisOutcome,
    quality_outcome: QualityOutcome,
    poc_outcome: PocOutcome,
    evidence_errors: list[str],
) -> EvaluationVerdict:
    reasons: list[str] = []
    if clean_pass:
        reasons.append("analysis and quality gates accepted")
    else:
        reasons.append(f"analysisOutcome={analysis_outcome.value}")
        reasons.append(f"qualityOutcome={quality_outcome.value}")
        if poc_outcome != PocOutcome.POC_NOT_REQUESTED:
            reasons.append(f"pocOutcome={poc_outcome.value}")
    reasons.extend(evidence_errors[:5])
    return EvaluationVerdict(
        taskCompleted=True,
        cleanPass=clean_pass,
        reasons=list(dict.fromkeys(reasons)),
        gateOutcomes=[
            f"analysis:{analysis_outcome.value}",
            f"quality:{quality_outcome.value}",
            f"poc:{poc_outcome.value}",
        ],
    )


def _canonicalize_deep_assessment(
    parsed: dict,
    session: AgentSession,
    allowed_refs: set[str],
    allowed_claim_refs: set[str],
) -> tuple[list[str], str]:
    """Apply only CWE-agnostic Assessment shape canonicalization.

    Semantic/root-cause repair belongs in a higher-level retry or future
    evidence-role normalizer, not in ResultAssembler.
    """
    if str(session.request.taskType) != "deep-analyze":
        return [], ""

    repairs: list[str] = []
    repairs.extend(_scaffold_deep_assessment(parsed))
    repairs.extend(_sync_used_refs_with_claim_refs(parsed))
    repairs.extend(_normalize_contextual_refs_out_of_final_evidence(parsed, allowed_refs, allowed_claim_refs))
    return list(dict.fromkeys(repairs)), ""


def _scaffold_deep_assessment(parsed: dict) -> list[str]:
    repairs: list[str] = []
    scaffolded = False

    for field in ("caveats", "usedEvidenceRefs", "recommendedNextSteps"):
        if not isinstance(parsed.get(field), list):
            parsed[field] = []
            repairs.append(field)
            scaffolded = True

    if not isinstance(parsed.get("policyFlags"), list):
        parsed["policyFlags"] = []
        repairs.append("policyFlags")
        scaffolded = True

    if not isinstance(parsed.get("needsHumanReview"), bool):
        parsed["needsHumanReview"] = True
        repairs.append("needsHumanReview")
        scaffolded = True

    if not _valid_severity(parsed.get("suggestedSeverity")):
        claims = parsed.get("claims")
        if isinstance(claims, list) and not claims:
            parsed["suggestedSeverity"] = "info"
            repairs.append("suggestedSeverity")
            scaffolded = True

    if scaffolded:
        _append_policy_flag(parsed, "deterministic_schema_scaffold")
    return repairs


def _rebuilt_used_refs(parsed: dict) -> list[str]:
    refs: list[str] = []
    for claim in parsed.get("claims", []) or []:
        if isinstance(claim, dict):
            refs.extend(ref for ref in claim.get("supportingEvidenceRefs", []) if isinstance(ref, str))
    for ref in parsed.get("usedEvidenceRefs", []) or []:
        if isinstance(ref, str):
            refs.append(ref)
    return list(dict.fromkeys(refs))


def _sync_used_refs_with_claim_refs(parsed: dict) -> list[str]:
    used = parsed.get("usedEvidenceRefs")
    if not isinstance(used, list):
        return []
    if any(not isinstance(ref, str) for ref in used):
        return []
    rebuilt = _rebuilt_used_refs(parsed)
    if rebuilt != used:
        parsed["usedEvidenceRefs"] = rebuilt
        return ["usedEvidenceRefs.claimRefSync"]
    return []


def _normalize_contextual_refs_out_of_final_evidence(
    parsed: dict,
    allowed_refs: set[str],
    allowed_claim_refs: set[str],
) -> list[str]:
    """Move contextual refs out of final evidence fields when local refs remain.

    Knowledge/CAPEC/CWE refs are useful context, but final accepted claims must
    stand on project-local or derived-local refs. If the model emitted both
    local refs and contextual refs, keep the local support and move contextual
    refs to ``contextualEvidenceRefs``. If a claim has only contextual refs, do
    not invent grounding here; leave it for validation/outcome classification.
    """
    repairs: list[str] = []
    contextual: list[str] = []
    claim_local_refs: list[str] = []
    response_refs = [ref for _, ref in _iter_response_refs(parsed)]
    if any(ref not in allowed_refs for ref in response_refs):
        return repairs

    claims = parsed.get("claims", [])
    if isinstance(claims, list):
        for index, claim in enumerate(claims):
            if not isinstance(claim, dict):
                continue
            refs = claim.get("supportingEvidenceRefs")
            if not isinstance(refs, list) or any(not isinstance(ref, str) for ref in refs):
                continue
            local_refs = [ref for ref in refs if ref in allowed_claim_refs]
            if not local_refs or len(local_refs) == len(refs):
                claim_local_refs.extend(local_refs)
                continue
            removed = [ref for ref in refs if ref in allowed_refs and ref not in allowed_claim_refs]
            claim["supportingEvidenceRefs"] = list(dict.fromkeys(local_refs))
            claim_local_refs.extend(local_refs)
            contextual.extend(removed)
            repairs.append(f"claims[{index}].supportingEvidenceRefs.contextualMoved")

    used_refs = parsed.get("usedEvidenceRefs")
    if isinstance(used_refs, list) and all(isinstance(ref, str) for ref in used_refs):
        local_used_refs = [ref for ref in used_refs if ref in allowed_claim_refs]
        removed_used_refs = [ref for ref in used_refs if ref in allowed_refs and ref not in allowed_claim_refs]
        rebuilt = list(dict.fromkeys(local_used_refs + claim_local_refs))
        if rebuilt and (rebuilt != used_refs):
            parsed["usedEvidenceRefs"] = rebuilt
            contextual.extend(removed_used_refs)
            repairs.append("usedEvidenceRefs.contextualMoved")

    if contextual:
        existing = parsed.get("contextualEvidenceRefs")
        merged = []
        if isinstance(existing, list):
            merged.extend(ref for ref in existing if isinstance(ref, str) and ref in allowed_refs)
        merged.extend(ref for ref in contextual if ref in allowed_refs)
        parsed["contextualEvidenceRefs"] = list(dict.fromkeys(merged))
        _append_policy_flag(parsed, "evidence_role_normalized")

    return repairs


def _append_policy_flag(parsed: dict, flag: str) -> None:
    flags = parsed.get("policyFlags")
    if not isinstance(flags, list):
        flags = []
    if flag not in flags:
        flags.append(flag)
    parsed["policyFlags"] = flags


def _valid_severity(value) -> str | None:
    return value if isinstance(value, str) and value in {"critical", "high", "medium", "low", "info"} else None
