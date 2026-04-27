from eval.system_stability import default_fixtures, run_fixture_matrix, summarize_observations


def test_system_stability_fixture_matrix_separates_stability_and_quality_axes():
    fixtures = default_fixtures()
    observations = run_fixture_matrix(fixtures)
    report = summarize_observations(observations)

    assert report.total == len(fixtures)
    assert 0 < report.taskCompletionRate < 1
    assert report.dependencyFailureRate > 0
    assert report.internalDeficiencyRecoveredRate > 0
    assert report.cleanPassRate == 0.0
    assert report.acceptedClaimRate > 0
    assert report.deadlineAdherenceRate == 1.0


def test_system_stability_report_serializes_metric_names_for_paper_tables():
    report = summarize_observations(run_fixture_matrix(default_fixtures()))
    data = report.as_dict()

    assert "taskCompletionRate" in data
    assert "trueTaskFailureRate" in data
    assert "internalDeficiencyRecoveredRate" in data
    assert "cleanPassRate" in data
