"""ResultAssembler — 에이전트 루프 출력을 TaskResponse 형식으로 변환."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from agent_shared.observability import agent_log
from app.pipeline.confidence import ConfidenceCalculator
from app.pipeline.response_parser import V1ResponseParser
from agent_shared.schemas.agent import AgentAuditInfo
from app.schemas.response import (
    AssessmentResult,
    AuditInfo,
    Claim,
    TaskFailureResponse,
    TaskSuccessResponse,
    TokenUsage,
    ValidationInfo,
)
from app.types import FailureCode, TaskStatus
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
            return self.build_failure(
                session,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_SCHEMA,
                "LLM이 구조화된 Assessment JSON 대신 자연어/비JSON 응답을 반환함",
                retryable=False,
            )

        # 검증: 입력 제공 refs + Phase 1 refs + 도구가 생성한 refs 합집합
        allowed_refs = {ref.refId for ref in session.request.evidenceRefs}
        allowed_refs.update(session.extra_allowed_refs)
        allowed_refs.update(session.evidence_catalog.ref_ids())
        for step in session.trace:
            allowed_refs.update(step.new_evidence_refs)

        canonical_repairs, canonical_failure = _canonicalize_deep_assessment(
            parsed,
            session,
            allowed_refs,
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
            return self.build_failure(
                session,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_GROUNDING,
                canonical_failure,
                retryable=False,
            )

        incomplete_reason = _incomplete_command_injection_quality_failure(parsed, session)
        if incomplete_reason:
            session.set_termination_reason("invalid_grounding")
            return self.build_failure(
                session,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_GROUNDING,
                incomplete_reason,
                retryable=False,
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
            return self.build_failure(
                session,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_SCHEMA,
                "; ".join(schema_result.errors),
                retryable=False,
            )

        evidence_valid, evidence_errors = self._evidence_validator.validate(parsed, allowed_refs)
        if not evidence_valid:
            agent_log(
                logger, "결과 검증",
                component="result_assembler", phase="result_validate",
                schemaValid=True,
                evidenceValid=False,
                errorCount=len(evidence_errors),
            )
            session.set_termination_reason("invalid_grounding")
            return self.build_failure(
                session,
                TaskStatus.VALIDATION_FAILED,
                FailureCode.INVALID_GROUNDING,
                "; ".join(evidence_errors),
                retryable=False,
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
            schemaVersion="agent-v1",
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
    ) -> TaskFailureResponse:
        """정책에 의해 루프가 종료된 경우 실패 응답을 생성한다."""
        reason = session.termination_reason
        status, code, retryable = self._TERMINATION_MAP.get(
            reason,
            (TaskStatus.BUDGET_EXCEEDED, FailureCode.TOKEN_BUDGET_EXCEEDED, False),
        )
        return self.build_failure(
            session, status, code,
            f"에이전트 루프 종료: {reason}",
            retryable=retryable,
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


def _canonicalize_deep_assessment(
    parsed: dict,
    session: AgentSession,
    allowed_refs: set[str],
) -> tuple[list[str], str]:
    if str(session.request.taskType) != "deep-analyze":
        return [], ""

    repairs: list[str] = []
    bundle = session.evidence_catalog.command_injection_bundle()
    repairs.extend(_scaffold_deep_assessment(parsed, bundle))
    repairs.extend(_repair_deep_command_injection_assessment(parsed, session, allowed_refs))
    repairs.extend(_cleanup_contextual_knowledge_refs(parsed, session, allowed_refs))
    repairs.extend(_sync_used_refs_with_claim_refs(parsed))
    failure = _post_cleanup_grounding_failure(parsed, session, allowed_refs)
    return list(dict.fromkeys(repairs)), failure


def _scaffold_deep_assessment(parsed: dict, bundle) -> list[str]:
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
        if bundle.complete:
            parsed["suggestedSeverity"] = "high"
            repairs.append("suggestedSeverity")
            scaffolded = True
        elif isinstance(claims, list) and not claims:
            parsed["suggestedSeverity"] = "info"
            repairs.append("suggestedSeverity")
            scaffolded = True

    if scaffolded:
        _append_policy_flag(parsed, "deterministic_schema_scaffold")
    return repairs


def _repair_deep_command_injection_assessment(
    parsed: dict,
    session: AgentSession,
    allowed_refs: set[str],
) -> list[str]:
    if str(session.request.taskType) != "deep-analyze":
        return []
    bundle = session.evidence_catalog.command_injection_bundle()
    if not bundle.complete:
        return []

    repairs: list[str] = []
    claims = parsed.get("claims")
    if not isinstance(claims, list):
        return []

    if not claims:
        parsed["claims"] = [{
            "statement": (
                "User-controlled input reaches command string construction and "
                f"{bundle.sink}(...) execution, enabling CWE-78 OS Command Injection."
            ),
            "detail": (
                f"Deterministic S3 repair found a complete command-injection evidence bundle: "
                f"SAST refs {bundle.sast_refs[:2]}, source refs {bundle.source_refs[:3]}, "
                f"caller refs {bundle.caller_refs[:4]}. The representative root cause is "
                f"user-controlled command construction reaching {bundle.sink}."
            ),
            "supportingEvidenceRefs": [ref for ref in bundle.refs if ref in allowed_refs],
            "location": bundle.location,
        }]
        parsed["summary"] = parsed.get("summary") or "CWE-78 OS Command Injection evidence is present."
        parsed["suggestedSeverity"] = _valid_severity(parsed.get("suggestedSeverity")) or "high"
        parsed["needsHumanReview"] = True
        repairs.append("claims.commandInjectionBundle")
    else:
        for index, claim in enumerate(claims):
            if not isinstance(claim, dict):
                continue
            claim_text = " ".join(str(claim.get(k) or "") for k in ("statement", "detail")).strip()
            if claim_text and not _is_command_injection_claim(claim):
                continue
            supporting = claim.get("supportingEvidenceRefs")
            if (
                not isinstance(supporting, list)
                or not supporting
                or (
                    _is_command_injection_claim(claim)
                    and not _has_non_contextual_invalid_ref(supporting, allowed_refs)
                    and not _claim_refs_have_command_injection_coherence(supporting, bundle)
                    and not _has_incoherent_command_injection_local_refs(supporting, bundle)
                )
            ):
                claim["supportingEvidenceRefs"] = [ref for ref in bundle.refs if ref in allowed_refs]
                repairs.append(f"claims[{index}].supportingEvidenceRefs")
            if not isinstance(claim.get("location"), str) or not claim.get("location", "").strip():
                claim["location"] = bundle.location
                repairs.append(f"claims[{index}].location")
            if not isinstance(claim.get("detail"), str) or not claim.get("detail", "").strip():
                claim["detail"] = f"Command-injection evidence bundle reaches {bundle.sink} at {bundle.location}."
                repairs.append(f"claims[{index}].detail")

    used = parsed.get("usedEvidenceRefs")
    if not isinstance(used, list) or not used:
        parsed["usedEvidenceRefs"] = [ref for ref in bundle.refs if ref in allowed_refs]
        repairs.append("usedEvidenceRefs")
    if not isinstance(parsed.get("caveats"), list):
        parsed["caveats"] = []
        repairs.append("caveats")
    if not isinstance(parsed.get("recommendedNextSteps"), list):
        parsed["recommendedNextSteps"] = []
        repairs.append("recommendedNextSteps")
    policy_flags = parsed.get("policyFlags")
    if not isinstance(policy_flags, list):
        policy_flags = []
        repairs.append("policyFlags")
    if "deterministic_command_injection_repair" not in policy_flags:
        policy_flags.append("deterministic_command_injection_repair")
    parsed["policyFlags"] = policy_flags
    return list(dict.fromkeys(repairs))


def _cleanup_contextual_knowledge_refs(
    parsed: dict,
    session: AgentSession,
    allowed_refs: set[str],
) -> list[str]:
    repairs: list[str] = []
    removed_refs: list[str] = []

    used = parsed.get("usedEvidenceRefs")
    if isinstance(used, list):
        sanitized, removed = _remove_repairable_contextual_refs(used, session)
        if removed:
            parsed["usedEvidenceRefs"] = sanitized
            removed_refs.extend(removed)
            repairs.append("usedEvidenceRefs.contextualKnowledgeRefs")

    claims = parsed.get("claims")
    if isinstance(claims, list):
        bundle = session.evidence_catalog.command_injection_bundle()
        for index, claim in enumerate(claims):
            if not isinstance(claim, dict):
                continue
            refs = claim.get("supportingEvidenceRefs")
            if not isinstance(refs, list):
                continue
            sanitized, removed = _remove_repairable_contextual_refs(refs, session)
            claim_had_contextual_cleanup = bool(removed)
            if removed:
                claim["supportingEvidenceRefs"] = sanitized
                removed_refs.extend(removed)
                repairs.append(f"claims[{index}].supportingEvidenceRefs.contextualKnowledgeRefs")
            if (
                claim_had_contextual_cleanup
                and _is_command_injection_claim(claim)
                and not _has_non_contextual_invalid_ref(claim.get("supportingEvidenceRefs", []), allowed_refs)
                and not _claim_refs_have_command_injection_coherence(claim.get("supportingEvidenceRefs", []), bundle)
                and not _has_incoherent_command_injection_local_refs(claim.get("supportingEvidenceRefs", []), bundle)
                and bundle.complete
            ):
                claim["supportingEvidenceRefs"] = [ref for ref in bundle.refs if ref in allowed_refs]
                repairs.append(f"claims[{index}].supportingEvidenceRefs.localRepopulation")

    if removed_refs:
        _append_policy_flag(parsed, "sanitized_contextual_knowledge_refs")
        if any("localRepopulation" in repair for repair in repairs):
            _append_policy_flag(parsed, "repopulated_local_grounding_refs")
        if not _has_non_contextual_invalid_ref(parsed.get("usedEvidenceRefs", []), allowed_refs):
            parsed["usedEvidenceRefs"] = _rebuilt_used_refs(parsed)
            repairs.append("usedEvidenceRefs.rebuiltLocalRefs")

    return repairs


def _post_cleanup_grounding_failure(
    parsed: dict,
    session: AgentSession,
    allowed_refs: set[str],
) -> str:
    claims = parsed.get("claims")
    if not isinstance(claims, list):
        return ""

    bundle = session.evidence_catalog.command_injection_bundle()

    for index, claim in enumerate(claims):
        if not isinstance(claim, dict):
            continue
        refs = claim.get("supportingEvidenceRefs")
        if not isinstance(refs, list):
            continue

        knowledge_ref = next((ref for ref in refs if isinstance(ref, str) and ref.startswith("eref-knowledge-")), None)
        if knowledge_ref:
            if knowledge_ref in allowed_refs:
                return f"contextual knowledge ref not allowed in final grounding: '{knowledge_ref}'"
            continue

        if not _is_command_injection_claim(claim):
            continue

        if not session.evidence_catalog.has_command_injection_signal():
            continue

        if _has_non_contextual_invalid_ref(refs, allowed_refs):
            continue
        if not _claim_refs_have_command_injection_coherence(refs, bundle):
            return (
                "insufficient_command_injection_grounding: "
                "requires SAST + source/input-path + caller local refs"
            )

    used = parsed.get("usedEvidenceRefs")
    if isinstance(used, list):
        knowledge_ref = next((ref for ref in used if isinstance(ref, str) and ref.startswith("eref-knowledge-")), None)
        if knowledge_ref:
            if knowledge_ref in allowed_refs:
                return f"contextual knowledge ref not allowed in final grounding: '{knowledge_ref}'"
            return ""

    return ""


_CONTEXTUAL_KNOWLEDGE_CWE_RE = re.compile(r"^eref-knowledge-(CWE-\d+)$")


def _remove_repairable_contextual_refs(refs: list, session: AgentSession) -> tuple[list, list[str]]:
    sanitized: list = []
    removed: list[str] = []
    for ref in refs:
        if isinstance(ref, str) and _is_repairable_contextual_knowledge_ref(ref, session):
            removed.append(ref)
            continue
        sanitized.append(ref)
    return sanitized, removed


def _is_repairable_contextual_knowledge_ref(ref: str, session: AgentSession) -> bool:
    match = _CONTEXTUAL_KNOWLEDGE_CWE_RE.match(ref)
    if not match:
        return False
    cwe = match.group(1).upper()
    local_cwes = {
        entry.cwe_id.upper()
        for entry in session.evidence_catalog.entries()
        if isinstance(entry.cwe_id, str) and entry.cwe_id
    }
    if cwe in local_cwes:
        return True
    return cwe == "CWE-78" and session.evidence_catalog.command_injection_bundle().complete


def _has_non_contextual_invalid_ref(refs: list, allowed_refs: set[str]) -> bool:
    return any(isinstance(ref, str) and ref not in allowed_refs for ref in refs)


def _is_command_injection_claim(claim: dict) -> bool:
    text = " ".join(str(claim.get(key) or "") for key in ("statement", "detail", "location")).lower()
    return any(
        re.search(pattern, text)
        for pattern in (
            r"\bpopen\b",
            r"\bsystem\s*\(",
            r"\bexec(?:ve|v|le|lp|l|p)?\s*\(",
            r"\bshell\b",
            r"\bos command\b",
            r"\bcwe-78\b",
            r"\bcommand injection\b",
            r"명령",
        )
    )


def _claim_refs_have_command_injection_coherence(refs: list, bundle) -> bool:
    if not bundle.complete:
        return False
    ref_set = {ref for ref in refs if isinstance(ref, str)}
    return (
        bool(ref_set & set(bundle.sast_refs))
        and bool(ref_set & set(bundle.input_path_source_refs))
        and bool(ref_set & set(bundle.caller_refs))
    )


def _has_incoherent_command_injection_local_refs(refs: list, bundle) -> bool:
    ref_set = {ref for ref in refs if isinstance(ref, str)}
    source_refs = set(bundle.source_refs)
    coherent_source_refs = set(bundle.input_path_source_refs)
    caller_refs = {ref for ref in ref_set if ref.startswith("eref-caller-")}
    coherent_caller_refs = set(bundle.caller_refs)
    return bool((ref_set & (source_refs - coherent_source_refs)) or (caller_refs - coherent_caller_refs))


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


def _append_policy_flag(parsed: dict, flag: str) -> None:
    flags = parsed.get("policyFlags")
    if not isinstance(flags, list):
        flags = []
    if flag not in flags:
        flags.append(flag)
    parsed["policyFlags"] = flags


def _incomplete_command_injection_quality_failure(parsed: dict, session: AgentSession) -> str:
    if str(session.request.taskType) != "deep-analyze":
        return ""
    claims = parsed.get("claims")
    if isinstance(claims, list) and claims:
        return ""
    catalog = session.evidence_catalog
    if not catalog.has_command_injection_signal():
        return ""
    bundle = catalog.command_injection_bundle()
    if bundle.complete:
        return ""
    return f"command_injection_evidence_incomplete: {bundle.reason}"


def _valid_severity(value) -> str | None:
    return value if isinstance(value, str) and value in {"critical", "high", "medium", "low", "info"} else None
