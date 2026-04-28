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
    assert gate.failedItems[0].repairable is False


def test_poc_quality_zero_claim_is_rejected():
    gate = evaluate_poc_quality(claims=[])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-claim-bound"


def test_poc_quality_rejects_base64_shell_decode():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="Bad PoC",
        detail="echo cm0gLXJmIC8= | base64 -d | sh",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-structural-safety"
    assert gate.failedItems[0].repairable is False


def test_base64_encoded_destructive_command_rejected():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="Bad PoC",
        detail="The payload token cm0gLXJmIC8= is presented as harmless text.",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-structural-safety"
    assert gate.failedItems[0].repairable is False
    assert "encoded" in (gate.repairHint or "")


def test_quote_escape_pattern_rejected():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="Bad PoC",
        detail="Use input `name=$(id)` to prove command injection.",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-structural-safety"
    assert gate.failedItems[0].repairable is False


def test_well_formed_non_destructive_poc_with_canary_accepted():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="CWE-78 command injection PoC",
        detail=(
            "Run the target with a randomized AEGIS-CANARY-12345 value and "
            "observe that the same canary is echoed through the popen path; "
            "do not execute shell wrappers or destructive commands."
        ),
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "accepted"


def test_poc_quality_rejects_python_shell_true_destructive_call():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="Bad PoC",
        detail="```python\nimport subprocess\nsubprocess.run('rm -rf /tmp/aegis-demo', shell=True)\n```",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-safety"


def test_poc_quality_rejects_command_injection_without_randomized_canary():
    gate = evaluate_poc_quality(claims=[Claim(
        statement="CWE-78 command injection PoC",
        detail="Run `id` through the popen path.",
        supportingEvidenceRefs=["eref-001"],
        location="poc.py:1",
    )])

    assert gate.outcome == "rejected"
    assert gate.failedItems[0].id == "poc-randomized-canary"
    assert gate.failedItems[0].repairable is True
