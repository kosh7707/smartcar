from __future__ import annotations

import json

import pytest

from app.agent_runtime.schemas.agent import BudgetState
from app.core.agent_session import AgentSession
from app.core.evidence_catalog import EvidenceCatalog, EvidenceCatalogEntry
from app.core.result_assembler import ResultAssembler
from app.schemas.request import Context, EvidenceRef, TaskRequest
from app.schemas.response import Claim
from app.state_machine.claim import diagnose_claim_evidence, transition_claim_status
from app.types import ClaimStatus, TaskType


def test_default_claim_is_candidate_with_empty_slots():
    claim = Claim(statement="candidate", detail="detail", location="src/main.c:1")

    assert claim.status == ClaimStatus.CANDIDATE
    assert claim.requiredEvidence == []
    assert claim.presentEvidence == []
    assert claim.missingEvidence == []
    assert claim.evidenceTrail == []
    assert claim.queryHistory == []
    assert claim.revisionHistory == []


def test_missing_local_slots_transition_to_under_evidenced():
    claim = Claim(
        statement="knowledge-only claim",
        detail="CWE context only",
        supportingEvidenceRefs=[],
        location="src/main.c:1",
    )

    diagnosis = diagnose_claim_evidence(claim, EvidenceCatalog())
    transitioned = transition_claim_status(claim, diagnosis)

    assert transitioned.status == ClaimStatus.UNDER_EVIDENCED
    assert transitioned.requiredEvidence == ["local_or_derived_support"]
    assert transitioned.missingEvidence == ["local_or_derived_support"]


def test_transition_appends_revision_history():
    catalog = EvidenceCatalog()
    claim = Claim(
        statement="claim needs local proof",
        detail="no local refs yet",
        location="src/main.c:1",
    )

    first = transition_claim_status(claim, diagnose_claim_evidence(claim, catalog))

    assert claim.revisionHistory == []
    assert len(first.revisionHistory) == 1
    assert first.revisionHistory[0]["fromStatus"] == "candidate"
    assert first.revisionHistory[0]["toStatus"] == "under_evidenced"
    assert first.revisionHistory[0]["reason"] == "missing:local_or_derived_support"
    assert isinstance(first.revisionHistory[0]["timestampMs"], int)

    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-main",
        evidence_class="local",
        roles=("source_location",),
        file="src/main.c",
    ))
    with_ref = first.model_copy(update={"supportingEvidenceRefs": ["eref-local-main"]})
    second = transition_claim_status(with_ref, diagnose_claim_evidence(with_ref, catalog))

    assert len(second.revisionHistory) == 2
    assert second.revisionHistory[0] == first.revisionHistory[0]
    assert second.revisionHistory[1]["fromStatus"] == "under_evidenced"
    assert second.revisionHistory[1]["toStatus"] == "grounded"
    assert second.revisionHistory[1]["reason"] == "grounded"


def test_transition_accepts_deterministic_timestamp():
    claim = Claim(statement="claim needs local proof", detail="detail", location="src/main.c:1")

    transitioned = transition_claim_status(
        claim,
        diagnose_claim_evidence(claim, EvidenceCatalog()),
        timestamp_ms=123456789,
    )

    assert transitioned.revisionHistory[0]["timestampMs"] == 123456789


def test_all_invalid_refs_transition_to_rejected():
    claim = Claim(
        statement="fabricated ref claim",
        detail="all refs are hallucinated",
        supportingEvidenceRefs=["eref-file-does-not-exist"],
        location="src/main.c:1",
    )

    diagnosis = diagnose_claim_evidence(claim, EvidenceCatalog())
    transitioned = transition_claim_status(claim, diagnosis, timestamp_ms=7)

    assert diagnosis.status == ClaimStatus.REJECTED
    assert transitioned.status == ClaimStatus.REJECTED
    assert transitioned.missingEvidence == ["local_or_derived_support"]
    assert transitioned.revisionHistory[0]["reason"] == "rejected:all_invalid_refs"


def test_mixed_valid_and_invalid_refs_are_under_evidenced_not_rejected():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-main",
        evidence_class="local",
        roles=("source_location",),
        file="src/main.c",
    ))
    claim = Claim(
        statement="mixed refs claim",
        detail="one local ref and one hallucinated ref",
        supportingEvidenceRefs=["eref-local-main", "eref-missing"],
        location="src/main.c:1",
    )

    diagnosis = diagnose_claim_evidence(claim, catalog)
    transitioned = transition_claim_status(claim, diagnosis)

    assert diagnosis.invalidRefs == ["eref-missing"]
    assert transitioned.status == ClaimStatus.UNDER_EVIDENCED


@pytest.mark.parametrize("diagnosed_status", [
    ClaimStatus.GROUNDED,
    ClaimStatus.UNDER_EVIDENCED,
    ClaimStatus.REJECTED,
])
def test_needs_human_review_is_sticky_for_automatic_diagnoses(diagnosed_status):
    claim = Claim(
        statement="manual gate",
        detail="NHR must not be automatically demoted",
        supportingEvidenceRefs=["eref-local-main"],
        location="src/main.c:1",
        status=ClaimStatus.NEEDS_HUMAN_REVIEW,
    )
    diagnosis = diagnose_claim_evidence(claim, EvidenceCatalog()).__class__(
        status=diagnosed_status,
        requiredEvidence=["local_or_derived_support"],
        missingEvidence=["local_or_derived_support"] if diagnosed_status != ClaimStatus.GROUNDED else [],
        invalidRefs=["eref-local-main"] if diagnosed_status == ClaimStatus.REJECTED else [],
    )

    transitioned = transition_claim_status(claim, diagnosis)

    assert transitioned.status == ClaimStatus.NEEDS_HUMAN_REVIEW


def test_local_ref_fills_slots_and_transitions_to_grounded():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-main",
        evidence_class="local",
        roles=("source_location",),
        file="src/main.c",
    ))
    claim = Claim(
        statement="local claim",
        detail="source ref supports it",
        supportingEvidenceRefs=["eref-local-main"],
        location="src/main.c:1",
    )

    diagnosis = diagnose_claim_evidence(claim, catalog)
    transitioned = transition_claim_status(claim, diagnosis)

    assert transitioned.status == ClaimStatus.GROUNDED
    assert transitioned.presentEvidence == ["local_or_derived_support"]
    assert transitioned.missingEvidence == []
    assert transitioned.evidenceTrail == ["eref-local-main"]


def test_command_injection_requires_family_specific_slots():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-source",
        evidence_class="local",
        roles=("source_location",),
        file="src/main.c",
    ))
    claim = Claim(
        statement="CWE-78 command injection reaches popen",
        detail="Only the source location is currently attached.",
        supportingEvidenceRefs=["eref-local-source"],
        location="src/main.c:10",
    )

    diagnosis = diagnose_claim_evidence(claim, catalog)
    transitioned = transition_claim_status(claim, diagnosis)

    assert transitioned.status == ClaimStatus.UNDER_EVIDENCED
    assert transitioned.requiredEvidence == [
        "local_or_derived_support",
        "source_location",
        "sink_or_dangerous_api",
        "caller_chain_or_source_slice",
    ]
    assert transitioned.missingEvidence == [
        "sink_or_dangerous_api",
        "caller_chain_or_source_slice",
    ]


def test_command_injection_family_slots_can_be_filled_by_local_refs():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-source",
        evidence_class="local",
        roles=("source_location",),
        file="src/main.c",
    ))
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-sink",
        evidence_class="local",
        roles=("sink_or_dangerous_api", "source_slice"),
        file="src/main.c",
        sink="popen",
    ))
    claim = Claim(
        statement="CWE-78 command injection reaches popen",
        detail="The source location and sink slice are both attached.",
        supportingEvidenceRefs=["eref-local-source", "eref-local-sink"],
        location="src/main.c:10",
    )

    diagnosis = diagnose_claim_evidence(claim, catalog)
    transitioned = transition_claim_status(claim, diagnosis)

    assert transitioned.status == ClaimStatus.GROUNDED
    assert transitioned.missingEvidence == []
    assert transitioned.presentEvidence == transitioned.requiredEvidence


@pytest.mark.parametrize(
    ("statement", "expected_slots"),
    [
        ("CWE-22 path traversal through open()", ["source_location", "sink_or_dangerous_api", "source_slice"]),
        ("CWE-120 buffer overflow reaches strcpy", ["source_location", "source_slice", "sink_or_dangerous_api"]),
        ("CWE-476 null dereference", ["source_location", "source_slice"]),
        ("CWE-190 integer overflow before allocation", ["source_location", "source_slice"]),
        ("CVE-2024-0001 dependency library version is vulnerable", ["library_origin"]),
    ],
)
def test_non_command_families_derive_required_slots(statement, expected_slots):
    claim = Claim(
        statement=statement,
        detail="family-specific slot policy should be deterministic",
        supportingEvidenceRefs=[],
        location="src/main.c:1",
    )

    diagnosis = diagnose_claim_evidence(claim, EvidenceCatalog())

    for slot in ["local_or_derived_support", *expected_slots]:
        assert slot in diagnosis.requiredEvidence


def test_knowledge_only_support_cannot_ground_claim():
    catalog = EvidenceCatalog()
    catalog.add(EvidenceCatalogEntry(
        ref_id="eref-knowledge-CWE-78",
        evidence_class="knowledge",
        roles=("knowledge_context",),
    ))
    claim = Claim(
        statement="knowledge-only claim",
        detail="CWE ref is not local proof",
        supportingEvidenceRefs=["eref-knowledge-CWE-78"],
        location="src/main.c:1",
    )

    diagnosis = diagnose_claim_evidence(claim, catalog)
    transitioned = transition_claim_status(claim, diagnosis)

    assert transitioned.status == ClaimStatus.UNDER_EVIDENCED
    assert transitioned.missingEvidence == ["local_or_derived_support"]
    assert transitioned.evidenceTrail == []


def test_non_accepted_claim_is_excluded_from_final_claims_and_diagnosed():
    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="claim-diagnostics-test",
        context=Context(trusted={}),
        evidenceRefs=[
            EvidenceRef(
                refId="eref-knowledge-CWE-78",
                artifactId="cwe",
                artifactType="cwe",
                locatorType="knowledge",
                locator={},
            )
        ],
    )
    session = AgentSession(request, BudgetState())
    final_content = json.dumps({
        "summary": "knowledge-only support is not accepted.",
        "claims": [{
            "statement": "CWE-only claim",
            "detail": "CWE ref alone cannot ground target code.",
            "supportingEvidenceRefs": ["eref-knowledge-CWE-78"],
            "location": "src/main.c:1",
        }],
        "caveats": [],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "info",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = ResultAssembler().build(final_content, session)

    assert result.status == "completed"
    assert result.result.claims == []
    assert result.result.analysisOutcome == "no_accepted_claims"
    assert result.result.claimDiagnostics.lifecycleCounts == {"under_evidenced": 1}
    diagnostic = result.result.claimDiagnostics.nonAcceptedClaims[0]
    assert diagnostic.status == ClaimStatus.UNDER_EVIDENCED
    assert diagnostic.requiredEvidence == [
        "local_or_derived_support",
        "source_location",
        "sink_or_dangerous_api",
        "caller_chain_or_source_slice",
    ]
    assert diagnostic.presentEvidence == []
    assert diagnostic.missingEvidence == [
        "local_or_derived_support",
        "source_location",
        "sink_or_dangerous_api",
        "caller_chain_or_source_slice",
    ]
    assert diagnostic.evidenceTrail == []
    assert diagnostic.revisionHistory


def test_rejected_claim_is_diagnosed_with_rejected_contribution():
    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="claim-rejected-diagnostics-test",
        context=Context(trusted={}),
    )
    session = AgentSession(request, BudgetState())
    final_content = json.dumps({
        "summary": "fabricated refs should be rejected.",
        "claims": [{
            "statement": "fabricated claim",
            "detail": "no cited refs exist",
            "supportingEvidenceRefs": ["eref-local-fiction"],
            "location": "src/main.c:1",
        }],
        "caveats": [],
        "usedEvidenceRefs": [],
        "suggestedSeverity": "info",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = ResultAssembler().build(final_content, session)

    assert result.result.claims == []
    diagnostic = result.result.claimDiagnostics.nonAcceptedClaims[0]
    assert diagnostic.status == ClaimStatus.REJECTED
    assert diagnostic.invalidRefs == ["eref-local-fiction"]
    assert diagnostic.outcomeContribution == "rejected_unsupported"


def test_needs_human_review_candidate_stays_out_of_public_claims_without_acceptance_path():
    request = TaskRequest(
        taskType=TaskType.DEEP_ANALYZE,
        taskId="claim-nhr-diagnostics-test",
        context=Context(trusted={}),
    )
    session = AgentSession(request, BudgetState())
    session.evidence_catalog.add(EvidenceCatalogEntry(
        ref_id="eref-local-main",
        evidence_class="local",
        roles=("source_location",),
        file="src/main.c",
    ))
    final_content = json.dumps({
        "summary": "NHR candidate should remain diagnostic-only.",
        "claims": [{
            "statement": "Manual review requested claim",
            "detail": "This claim is local but already marked needs_human_review.",
            "supportingEvidenceRefs": ["eref-local-main"],
            "location": "src/main.c:1",
            "status": "needs_human_review",
        }],
        "caveats": [],
        "usedEvidenceRefs": ["eref-local-main"],
        "suggestedSeverity": "info",
        "needsHumanReview": True,
        "recommendedNextSteps": [],
        "policyFlags": [],
    })

    result = ResultAssembler().build(final_content, session)

    assert result.result.claims == []
    assert result.result.analysisOutcome == "no_accepted_claims"
    diagnostic = result.result.claimDiagnostics.nonAcceptedClaims[0]
    assert diagnostic.status == ClaimStatus.NEEDS_HUMAN_REVIEW
    assert diagnostic.outcomeContribution == "needs_human_review"


def test_claim_json_schema_exposes_additive_fields_with_old_fields():
    claim = Claim(
        statement="grounded",
        detail="detail",
        supportingEvidenceRefs=["eref-local-main"],
        location="src/main.c:1",
        claimId="claim-1",
        status=ClaimStatus.GROUNDED,
    )

    data = claim.model_dump(mode="json")

    assert data["statement"] == "grounded"
    assert data["detail"] == "detail"
    assert data["supportingEvidenceRefs"] == ["eref-local-main"]
    assert data["location"] == "src/main.c:1"
    assert data["claimId"] == "claim-1"
    assert data["status"] == "grounded"
    assert data["requiredEvidence"] == []
    assert data["queryHistory"] == []
    assert data["revisionHistory"] == []
