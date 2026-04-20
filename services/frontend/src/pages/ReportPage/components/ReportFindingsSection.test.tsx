import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportFindingsSection } from "./ReportFindingsSection";

describe("ReportFindingsSection", () => {
  it("renders empty state when no findings exist", () => {
    render(<ReportFindingsSection findings={[]} />);
    expect(screen.getByText("해당 조건의 탐지 항목이 없습니다")).toBeInTheDocument();
  });

  it("renders finding rows with badges and evidence counts", () => {
    const findings = [
      {
        finding: {
          id: "finding-1",
          module: "static_analysis",
          status: "open",
          severity: "critical",
          sourceType: "rule-engine",
          title: "Critical auth bypass",
          location: "src/auth.ts:12",
          ruleId: "AUTH-001",
        },
        evidenceRefs: [{ id: "e1" }, { id: "e2" }],
      },
    ] as any;

    render(<ReportFindingsSection findings={findings} />);

    expect(screen.getByText("탐지 항목 목록 (1)")).toBeInTheDocument();
    expect(screen.getByText("Critical auth bypass")).toBeInTheDocument();
    expect(screen.getByText("src/auth.ts:12")).toBeInTheDocument();
    expect(screen.getByText("정적 분석")).toBeInTheDocument();
    expect(screen.getByText("룰 엔진: AUTH-001")).toBeInTheDocument();
    expect(screen.getByText("2건")).toBeInTheDocument();
  });
});
