from app.quality.poc_quality_gate import evaluate_poc_quality
from app.schemas.response import Claim


def test_poc_quality_clean_claim_is_accepted():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="PoC is claim-bound",
        detail="Run with a randomized canary against the built binary.",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "accepted"


def test_poc_quality_caveated_claim_is_not_strict_clean():
    gate = evaluate_poc_quality(
        claims=[Claim(statement="PoC", detail="Requires target binary path confirmation.", supportingEvidenceRefs=["eref-001"], location="poc.py:1")],
        caveats=["binary path not verified"],
    )

    assert gate.outcome == "accepted_with_caveats"


def test_poc_quality_destructive_instruction_is_rejected():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="Bad PoC",
        detail="Run rm -rf / to demonstrate impact.",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-safety"


def test_poc_quality_zero_claim_is_rejected():
    gate = evaluate_poc_quality(claims=[])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-claim-bound"
