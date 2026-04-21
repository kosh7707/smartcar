import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { StaticAnalysisDashboardSummary, Run } from "@aegis/shared";
import { OverallStatusTab } from "./OverallStatusTab";

const summary: StaticAnalysisDashboardSummary = {
  bySeverity: { critical: 1, high: 2, medium: 3, low: 4, info: 0 },
  byStatus: { open: 2, needs_review: 1 },
  bySource: { "rule-engine": 3, "llm-assist": 2, both: 1 },
  topFiles: [
    { filePath: "src/main.c", findingCount: 4, topSeverity: "high" },
    { filePath: "src/lib.c", findingCount: 2, topSeverity: "medium" },
  ],
  topRules: [
    { ruleId: "RULE-1", hitCount: 5 },
    { ruleId: "RULE-2", hitCount: 3 },
  ],
  trend: [
    { date: "2026-04-01", runCount: 1, findingCount: 3, gatePassCount: 1 },
    { date: "2026-04-02", runCount: 2, findingCount: 5, gatePassCount: 1 },
  ],
  gateStats: { total: 4, passed: 3, failed: 1, rate: 0.75 },
  unresolvedCount: { open: 2, needsReview: 1, needsRevalidation: 0, sandbox: 0 },
};

const runs: Run[] = [
  {
    id: "run-1",
    projectId: "project-1",
    module: "static_analysis",
    status: "completed",
    analysisResultId: "result-1",
    findingCount: 6,
    createdAt: "2026-04-10T01:00:00Z",
  },
];

describe("OverallStatusTab", () => {
  it("renders key summary surfaces", () => {
    render(
      <OverallStatusTab
        summary={summary}
        recentRuns={runs}
        period="7d"
        onPeriodChange={vi.fn()}
        onViewRun={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: /보안 현황/ })).toBeInTheDocument();
    expect(screen.getByText("분포")).toBeInTheDocument();
    expect(screen.getByText("취약 파일 Top 2")).toBeInTheDocument();
    expect(screen.getByText("룰 히트 Top 2")).toBeInTheDocument();
    expect(screen.getAllByText("최근 Run").length).toBeGreaterThan(0);
  });

  it("changes period and opens linked items", () => {
    const onPeriodChange = vi.fn();
    const onViewRun = vi.fn();
    const onFileClick = vi.fn();

    render(
      <OverallStatusTab
        summary={summary}
        recentRuns={runs}
        period="7d"
        onPeriodChange={onPeriodChange}
        onViewRun={onViewRun}
        onFileClick={onFileClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "30일" }));
    expect(onPeriodChange).toHaveBeenCalledWith("30d");

    fireEvent.click(screen.getByText("src/main.c"));
    expect(onFileClick).toHaveBeenCalledWith("src/main.c");

    fireEvent.click(screen.getByText(/탐지 항목 6건/));
    expect(onViewRun).toHaveBeenCalledWith("run-1");
  });
});
