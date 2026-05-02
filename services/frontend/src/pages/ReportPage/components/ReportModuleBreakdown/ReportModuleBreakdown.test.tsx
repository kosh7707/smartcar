import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportModuleBreakdown } from "../ReportModuleBreakdown/ReportModuleBreakdown";

describe("ReportModuleBreakdown", () => {
  it("renders the inline empty line when there are no module entries", () => {
    render(<ReportModuleBreakdown moduleEntries={[]} />);
    expect(screen.getByText("실행된 모듈이 없습니다.")).toBeInTheDocument();
  });

  it("renders module rows with gate status and pass/total counts", () => {
    const moduleEntries = [
      {
        key: "static",
        mod: {
          summary: { totalFindings: 3 },
          runs: [
            { gate: { status: "pass" } },
            { gate: { status: "fail" } },
          ],
        },
      },
      {
        key: "deep",
        mod: {
          summary: { totalFindings: 1 },
          runs: [{ gate: { status: "pass" } }],
        },
      },
    ] as any;

    render(<ReportModuleBreakdown moduleEntries={moduleEntries} />);

    expect(screen.getByText("정적 분석")).toBeInTheDocument();
    expect(screen.getByText("심층 분석")).toBeInTheDocument();
    expect(screen.getByText("주의 필요")).toBeInTheDocument();
    expect(screen.getByText("안정")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });
});
