import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportAuditLogSection } from "./ReportAuditLogSection";

describe("ReportAuditLogSection", () => {
  it("renders audit rows", () => {
    const auditTrail = [
      {
        id: "audit-1",
        timestamp: "2026-04-10T01:00:00Z",
        actor: "alice",
        action: "Static analysis completed",
        resource: "run",
        resourceId: "run-1",
      },
    ] as any;

    render(<ReportAuditLogSection auditTrail={auditTrail} />);

    expect(screen.getByText("감사 추적 (1)")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Static analysis completed")).toBeInTheDocument();
  });
});
