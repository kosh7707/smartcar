from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

FixtureKind = Literal[
    "s7_empty",
    "s7_malformed",
    "s7_strict_json",
    "s7_unavailable",
    "knowledge_only_refs",
    "operational_only_refs",
    "no_accepted_claims",
    "accepted_with_caveats",
    "poc_accepted",
    "poc_rejected",
    "poc_inconclusive",
    "build_compile_failed",
    "artifact_mismatch",
]


@dataclass(frozen=True)
class StabilityFixture:
    id: str
    kind: FixtureKind
    valid_input: bool = True
    dependency_live: bool = True
    expected_task_completed: bool = True
    expected_clean_pass: bool = False
    tags: tuple[str, ...] = field(default_factory=tuple)
    target: str = "system-stability"
    vulnerability_family: str = "state-machine"
    cwe: str | None = None
    fixture_source: str = "state_machine"
    diagnostic_channels: tuple[str, ...] = field(default_factory=tuple)


def default_fixtures() -> list[StabilityFixture]:
    """Return the default paper-facing system-stability fixture matrix.

    The suite intentionally keeps certificate-maker/CWE-78 as a smoke member,
    not the sole target. Additional families are deterministic placeholders for
    live/hotN expansion, so the reporter can already account for non-CWE-78
    outcomes without starting services.
    """
    return _state_machine_fixtures() + _paper_vulnerability_fixtures()


def _state_machine_fixtures() -> list[StabilityFixture]:
    return [
        StabilityFixture(
            "s7-empty-live",
            "s7_empty",
            tags=("output_deficient", "analysis"),
            diagnostic_channels=("audit.agentAudit.recoveryTrace",),
        ),
        StabilityFixture(
            "s7-malformed-live",
            "s7_malformed",
            tags=("output_deficient", "analysis"),
            diagnostic_channels=("audit.agentAudit.recoveryTrace",),
        ),
        StabilityFixture(
            "s7-strict-json-live",
            "s7_strict_json",
            tags=("output_deficient", "analysis"),
            diagnostic_channels=("audit.agentAudit.recoveryTrace",),
        ),
        StabilityFixture(
            "s7-unavailable",
            "s7_unavailable",
            dependency_live=False,
            expected_task_completed=False,
            tags=("dependency_unavailable",),
        ),
        StabilityFixture(
            "knowledge-only",
            "knowledge_only_refs",
            tags=("evidence_role",),
            diagnostic_channels=("result.evidenceDiagnostics", "audit.agentAudit.evidenceCatalogDiagnostics"),
        ),
        StabilityFixture(
            "operational-only",
            "operational_only_refs",
            tags=("evidence_role",),
            diagnostic_channels=("result.evidenceDiagnostics", "audit.agentAudit.evidenceCatalogDiagnostics"),
        ),
        StabilityFixture(
            "no-accepted-claims",
            "no_accepted_claims",
            tags=("quality",),
            diagnostic_channels=("result.claimDiagnostics", "result.evaluationVerdict"),
        ),
        StabilityFixture(
            "accepted-with-caveats",
            "accepted_with_caveats",
            expected_clean_pass=False,
            tags=("quality",),
            diagnostic_channels=("result.qualityGate", "result.evaluationVerdict"),
        ),
        StabilityFixture(
            "poc-accepted",
            "poc_accepted",
            expected_clean_pass=True,
            tags=("poc",),
        ),
        StabilityFixture(
            "poc-rejected",
            "poc_rejected",
            tags=("poc",),
            diagnostic_channels=("result.qualityGate", "result.evaluationVerdict"),
        ),
        StabilityFixture(
            "poc-inconclusive",
            "poc_inconclusive",
            tags=("poc",),
            diagnostic_channels=("result.qualityGate", "result.evaluationVerdict"),
        ),
        StabilityFixture(
            "build-clean-pass",
            "accepted_with_caveats",
            expected_clean_pass=True,
            tags=("build",),
            diagnostic_channels=(),
        ),
        StabilityFixture(
            "build-compile-failed",
            "build_compile_failed",
            tags=("build",),
            diagnostic_channels=("result.buildDiagnostics",),
        ),
        StabilityFixture(
            "artifact-mismatch",
            "artifact_mismatch",
            tags=("build",),
            diagnostic_channels=("result.buildDiagnostics",),
        ),
    ]


def _paper_vulnerability_fixtures() -> list[StabilityFixture]:
    return [
        StabilityFixture(
            "certificate-maker-cwe78-smoke",
            "accepted_with_caveats",
            tags=("paper_fixture", "certificate-maker", "smoke"),
            target="certificate-maker",
            vulnerability_family="command-injection",
            cwe="CWE-78",
            fixture_source="external:e2e-smoke",
            diagnostic_channels=("result.evaluationVerdict",),
        ),
        StabilityFixture(
            "golden-cwe78-getenv-system",
            "accepted_with_caveats",
            tags=("paper_fixture", "golden"),
            target="eval/golden/cases/cwe78_getenv_system.json",
            vulnerability_family="command-injection",
            cwe="CWE-78",
            fixture_source="golden:cwe78_getenv_system",
            diagnostic_channels=("result.evaluationVerdict",),
        ),
        StabilityFixture(
            "golden-cwe120-gets-overflow",
            "accepted_with_caveats",
            tags=("paper_fixture", "golden"),
            target="eval/golden/cases/cwe120_gets_overflow.json",
            vulnerability_family="memory-bounds-buffer",
            cwe="CWE-120",
            fixture_source="golden:cwe120_gets_overflow",
            diagnostic_channels=("result.evaluationVerdict",),
        ),
        StabilityFixture(
            "planned-cwe476-null-deref",
            "no_accepted_claims",
            tags=("paper_fixture", "planned"),
            target="planned/null-deref-fixture",
            vulnerability_family="null-dereference",
            cwe="CWE-476",
            fixture_source="planned:fixture-gap",
            diagnostic_channels=("result.claimDiagnostics", "result.evaluationVerdict"),
        ),
        StabilityFixture(
            "planned-cwe190-integer-overflow",
            "no_accepted_claims",
            tags=("paper_fixture", "planned"),
            target="planned/integer-overflow-fixture",
            vulnerability_family="integer-overflow",
            cwe="CWE-190",
            fixture_source="planned:fixture-gap",
            diagnostic_channels=("result.claimDiagnostics", "result.evaluationVerdict"),
        ),
        StabilityFixture(
            "planned-cwe22-path-traversal",
            "no_accepted_claims",
            tags=("paper_fixture", "planned"),
            target="planned/path-traversal-fixture",
            vulnerability_family="path-traversal-file-access",
            cwe="CWE-22",
            fixture_source="planned:fixture-gap",
            diagnostic_channels=("result.claimDiagnostics", "result.evaluationVerdict"),
        ),
    ]
