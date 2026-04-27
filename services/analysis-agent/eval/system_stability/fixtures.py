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
    "poc_rejected",
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


def default_fixtures() -> list[StabilityFixture]:
    return [
        StabilityFixture("s7-empty-live", "s7_empty", tags=("output_deficient", "analysis")),
        StabilityFixture("s7-malformed-live", "s7_malformed", tags=("output_deficient", "analysis")),
        StabilityFixture("s7-strict-json-live", "s7_strict_json", tags=("output_deficient", "analysis")),
        StabilityFixture("s7-unavailable", "s7_unavailable", dependency_live=False, expected_task_completed=False, tags=("dependency_unavailable",)),
        StabilityFixture("knowledge-only", "knowledge_only_refs", tags=("evidence_role",)),
        StabilityFixture("operational-only", "operational_only_refs", tags=("evidence_role",)),
        StabilityFixture("no-accepted-claims", "no_accepted_claims", tags=("quality",)),
        StabilityFixture("accepted-with-caveats", "accepted_with_caveats", expected_clean_pass=False, tags=("quality",)),
        StabilityFixture("poc-rejected", "poc_rejected", tags=("poc",)),
        StabilityFixture("build-compile-failed", "build_compile_failed", tags=("build",)),
        StabilityFixture("artifact-mismatch", "artifact_mismatch", tags=("build",)),
    ]
