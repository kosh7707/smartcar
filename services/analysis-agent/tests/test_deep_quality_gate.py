from app.quality.deep_quality_gate import evaluate_deep_quality
from app.schemas.response import Claim


def test_deep_quality_clean_claim_is_accepted():
    gate = evaluate_deep_quality(claims=[Claim(
        statement="User input reaches popen",
        detail="The source path and caller chain establish the risky call.",
        supportingEvidenceRefs=["eref-001"],
        location="src/main.c:42",
    )])

    assert gate.outcome == "accepted"
    assert gate.failedItems == []


def test_deep_quality_low_confidence_claim_is_accepted_with_caveats():
    gate = evaluate_deep_quality(
        claims=[Claim(
            statement="TOCTOU may be exploitable",
            detail="Exploitability is plausible but not fully confirmed.",
            supportingEvidenceRefs=["eref-001"],
            location="src/fs.c:22",
        )],
        caveats=["low-confidence claim: 추가 검증 필요"],
    )

    assert gate.outcome == "accepted_with_caveats"


def test_deep_quality_evidence_error_is_rejected():
    gate = evaluate_deep_quality(
        claims=[Claim(statement="bad", detail="bad", supportingEvidenceRefs=["eref-knowledge-CWE-78"], location="x:1")],
        evidence_errors=["knowledge ref cannot support claim"],
    )

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "evidence-grounding"


def test_deep_quality_zero_claim_is_inconclusive_not_clean_pass():
    gate = evaluate_deep_quality(claims=[], caveats=["No grounded claims remain."])

    assert gate.outcome == "inconclusive"
    assert gate.repairableItems[0].id == "accepted-claim-coverage"


def test_deep_quality_rejects_claim_with_unfilled_required_slots():
    gate = evaluate_deep_quality(claims=[Claim(
        statement="CWE-78 command injection reaches popen",
        detail="Only a source location slot was filled.",
        supportingEvidenceRefs=["eref-local-source"],
        location="src/main.c:42",
        requiredEvidence=[
            "local_or_derived_support",
            "source_location",
            "sink_or_dangerous_api",
            "caller_chain_or_source_slice",
        ],
        presentEvidence=["local_or_derived_support", "source_location"],
        missingEvidence=["sink_or_dangerous_api", "caller_chain_or_source_slice"],
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "claim-0-evidence-slots"
    assert gate.failedItems[0].requiredEvidenceSlots == [
        "sink_or_dangerous_api",
        "caller_chain_or_source_slice",
    ]
