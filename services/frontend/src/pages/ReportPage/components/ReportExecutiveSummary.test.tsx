import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportExecutiveSummary } from "./ReportExecutiveSummary";

const report = {
  generatedAt: "2026-04-10T01:00:00Z",
} as any;

describe("ReportExecutiveSummary", () => {
  it("renders top-level KPIs and PASS compliance", () => {
    render(
      <ReportExecutiveSummary
        report={report}
        allRuns={[{ gate: { status: "pass" } }]}
        summary={{ totalFindings: 6, byStatus: { open: 2, fixed: 1 } }}
        sevCounts={{ critical: 1, high: 2, medium: 2, low: 1 }}
        sevMax={2}
      />,
    );

    expect(screen.getByText("요약")).toBeInTheDocument();
    expect(screen.getByText("컴플라이언스")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
    expect(screen.getByText("총 Finding")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("심각도별")).toBeInTheDocument();
    expect(screen.getByText("상태별")).toBeInTheDocument();
  });

  it("renders FAIL compliance and severity/status badges", () => {
    render(
      <ReportExecutiveSummary
        report={report}
        allRuns={[{ gate: { status: "fail" } }]}
        summary={{ totalFindings: 3, byStatus: { open: 1, fixed: 1 } }}
        sevCounts={{ critical: 1, high: 1, medium: 0, low: 1 }}
        sevMax={1}
      />,
    );

    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.getByText("치명 1")).toBeInTheDocument();
    expect(screen.getByText("높음 1")).toBeInTheDocument();
    expect(screen.getByText("낮음 1")).toBeInTheDocument();
    expect(screen.getByText(/열림: 1/)).toBeInTheDocument();
    expect(screen.getByText(/수정됨: 1/)).toBeInTheDocument();
  });
});
