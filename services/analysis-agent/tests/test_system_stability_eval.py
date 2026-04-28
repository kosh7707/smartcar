from eval.system_stability import StabilityFixture, default_fixtures, run_fixture_matrix, summarize_observations


def test_system_stability_fixture_matrix_separates_stability_and_quality_axes():
    fixtures = default_fixtures()
    observations = run_fixture_matrix(fixtures)
    report = summarize_observations(observations)

    assert report.total == len(fixtures)
    assert 0 < report.taskCompletionRate < 1
    assert report.dependencyFailureRate > 0
    assert report.internalDeficiencyRecoveredRate > 0
    assert 0 < report.cleanPassRate < 1
    assert report.strictCleanPassRate == report.cleanPassRate
    assert report.acceptedClaimRate > 0
    assert report.noAcceptedClaimsRate > 0
    assert report.inconclusiveRate > 0
    assert report.pocAcceptedCount > 0
    assert report.pocRejectedCount > 0
    assert report.pocInconclusiveCount > 0
    assert report.deadlineAdherenceRate == 1.0


def test_strict_clean_pass_excludes_paper_fixtures():
    observations = run_fixture_matrix([
        StabilityFixture(
            "state-clean",
            "poc_accepted",
            expected_clean_pass=True,
            fixture_source="state_machine",
        ),
        StabilityFixture(
            "paper-clean-placeholder",
            "accepted_with_caveats",
            expected_clean_pass=True,
            tags=("paper_fixture",),
            fixture_source="golden:paper",
        ),
    ])

    report = summarize_observations(observations)

    assert report.cleanPassRate == 1.0
    assert report.strictCleanPassRate == 0.5


def test_system_stability_report_serializes_metric_names_for_paper_tables():
    report = summarize_observations(run_fixture_matrix(default_fixtures()))
    data = report.as_dict()

    assert "taskCompletionRate" in data
    assert "acceptedClaimCount" in data
    assert "noAcceptedClaimsCount" in data
    assert "inconclusiveCount" in data
    assert "pocAcceptedCount" in data
    assert "pocRejectedCount" in data
    assert "pocInconclusiveCount" in data
    assert "strictCleanPassRate" in data
    assert "silent200DiagnosticCoverageRate" in data


def test_paper_fixture_suite_is_not_certificate_maker_only():
    fixtures = default_fixtures()
    paper_fixtures = [fixture for fixture in fixtures if "paper_fixture" in fixture.tags]
    families = {fixture.vulnerability_family for fixture in paper_fixtures}
    cwes = {fixture.cwe for fixture in paper_fixtures if fixture.cwe}
    targets = {fixture.target for fixture in paper_fixtures}

    assert "certificate-maker" in targets
    assert len(targets) > 1
    assert {
        "command-injection",
        "memory-bounds-buffer",
        "null-dereference",
        "integer-overflow",
        "path-traversal-file-access",
    }.issubset(families)
    assert {"CWE-78", "CWE-120", "CWE-476", "CWE-190", "CWE-22"}.issubset(cwes)


def test_completed_non_clean_default_fixtures_have_silent_200_diagnostics():
    observations = run_fixture_matrix(default_fixtures())
    completed_non_clean = [obs for obs in observations if obs.task_completed and not obs.clean_pass]

    assert completed_non_clean
    assert all(obs.silent_200_diagnostic_present for obs in completed_non_clean)
    assert summarize_observations(observations).silent200DiagnosticCoverageRate == 1.0


def test_silent_200_detector_flags_completed_non_clean_without_diagnostics():
    fixture = StabilityFixture(
        "bad-silent-200",
        "no_accepted_claims",
        tags=("quality",),
        diagnostic_channels=(),
    )

    [observation] = run_fixture_matrix([fixture])
    report = summarize_observations([observation])

    assert observation.task_completed is True
    assert observation.clean_pass is False
    assert observation.silent_200_diagnostic_present is False
    assert report.silent200DiagnosticCoverageRate == 0.0
