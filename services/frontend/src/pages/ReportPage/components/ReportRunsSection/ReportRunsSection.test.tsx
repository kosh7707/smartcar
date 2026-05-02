import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportRunsSection } from "../ReportRunsSection/ReportRunsSection";

describe("ReportRunsSection", () => {
  it("renders the inline empty line when there are no runs", () => {
    render(<ReportRunsSection runs={[]} showModule />);
    expect(screen.getByText("실행 이력이 없습니다.")).toBeInTheDocument();
  });

  it("renders run rows with status, gate badges and finding count", () => {
    const runs = [
      {
        run: {
          id: "run-1abcdef",
          module: "static_analysis",
          status: "completed",
          findingCount: 2,
          createdAt: "2026-04-10T01:00:00Z",
        },
        gate: { status: "pass" },
      },
      {
        run: {
          id: "run-2abcdef",
          module: "deep_analysis",
          status: "failed",
          findingCount: 1,
          createdAt: "2026-04-11T01:00:00Z",
        },
        gate: { status: "fail" },
      },
    ] as any;

    render(<ReportRunsSection runs={runs} showModule />);

    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.getByText("정적 분석")).toBeInTheDocument();
    expect(screen.getByText("심층 분석")).toBeInTheDocument();
  });
});
