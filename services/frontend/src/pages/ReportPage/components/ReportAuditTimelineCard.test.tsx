import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportAuditTimelineCard } from "./ReportAuditTimelineCard";

describe("ReportAuditTimelineCard", () => {
  it("renders an empty state when there is no audit trail", () => {
    render(<ReportAuditTimelineCard auditTrail={[]} />);

    expect(screen.getByText("감사 추적")).toBeInTheDocument();
    expect(screen.getByText("감사 이력 없음")).toBeInTheDocument();
  });

  it("shows only the first five audit entries", () => {
    const auditTrail = Array.from({ length: 7 }, (_, index) => ({
      id: `audit-${index + 1}`,
      timestamp: `2026-04-${String(index + 1).padStart(2, "0")}T01:00:00Z`,
      actor: "alice",
      action: `감사 이벤트 ${index + 1}`,
      resource: "run",
      resourceId: `run-${index + 1}`,
      detail: {},
    })) as any;

    render(<ReportAuditTimelineCard auditTrail={auditTrail} />);

    expect(screen.getByText("감사 이벤트 1")).toBeInTheDocument();
    expect(screen.getByText("감사 이벤트 5")).toBeInTheDocument();
    expect(screen.queryByText("감사 이벤트 6")).not.toBeInTheDocument();
    expect(screen.queryByText("감사 이벤트 7")).not.toBeInTheDocument();
  });
});
