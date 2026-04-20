import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportRunsSection } from "./ReportRunsSection";

describe("ReportRunsSection", () => {
  it("renders nothing when there are no runs", () => {
    const { container } = render(<ReportRunsSection runs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders run rows with status and gate badges", () => {
    const runs = [
      {
        run: {
          id: "run-1",
          module: "static_analysis",
          status: "completed",
          findingCount: 2,
          createdAt: "2026-04-10T01:00:00Z",
        },
        gate: { status: "pass" },
      },
      {
        run: {
          id: "run-2",
          module: "deep_analysis",
          status: "failed",
          findingCount: 1,
          createdAt: "2026-04-11T01:00:00Z",
        },
        gate: { status: "fail" },
      },
    ] as any;

    render(<ReportRunsSection runs={runs} />);

    expect(screen.getByText("실행 이력 (2)")).toBeInTheDocument();
    expect(screen.getAllByText("completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("failed").length).toBeGreaterThan(0);
    expect(screen.getByText("게이트: pass")).toBeInTheDocument();
    expect(screen.getByText("게이트: fail")).toBeInTheDocument();
    expect(screen.getByText("탐지 항목 2건")).toBeInTheDocument();
  });
});
