import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportFindingsSection } from "../ReportFindingsSection/ReportFindingsSection";

describe("ReportFindingsSection", () => {
  it("renders the inline empty line when no findings exist", () => {
    render(<ReportFindingsSection findings={[]} showModule />);
    expect(screen.getByText("조건에 해당하는 탐지 항목이 없습니다.")).toBeInTheDocument();
  });

  it("renders finding rows with severity, status, source and evidence count", () => {
    const findings = [
      {
        finding: {
          id: "finding-1",
          module: "static_analysis",
          status: "open",
          severity: "critical",
          sourceType: "sast",
          title: "Critical auth bypass",
          location: "src/auth.ts:12",
          ruleId: "AUTH-001",
        },
        evidenceRefs: [{ id: "e1" }, { id: "e2" }],
      },
    ] as any;

    render(<ReportFindingsSection findings={findings} showModule />);

    expect(screen.getByText("Critical auth bypass")).toBeInTheDocument();
    expect(screen.getByText("src/auth.ts:12")).toBeInTheDocument();
    expect(screen.getByText("정적 분석")).toBeInTheDocument();
    expect(screen.getByText("치명")).toBeInTheDocument();
    expect(screen.getByText(/sast/)).toBeInTheDocument();
    expect(screen.getByText(/AUTH-001/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("hides the module column when showModule is false", () => {
    const findings = [
      {
        finding: {
          id: "f-1",
          module: "static_analysis",
          status: "open",
          severity: "high",
          sourceType: "sast",
          title: "High issue",
          location: "src/x.ts:1",
          ruleId: "X-1",
        },
        evidenceRefs: [],
      },
    ] as any;

    render(<ReportFindingsSection findings={findings} showModule={false} />);
    expect(screen.queryByText("정적 분석")).not.toBeInTheDocument();
  });
});
