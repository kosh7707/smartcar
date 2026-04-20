import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportApprovalsSection } from "./ReportApprovalsSection";

describe("ReportApprovalsSection", () => {
  it("renders approval rows with status badges", () => {
    const approvals = [
      {
        id: "approval-1",
        actionType: "gate.override",
        requestedBy: "alice",
        status: "approved",
        decision: { decidedBy: "bob" },
        createdAt: "2026-04-10T01:30:00Z",
      },
      {
        id: "approval-2",
        actionType: "gate.override",
        requestedBy: "carol",
        status: "pending",
        createdAt: "2026-04-11T01:30:00Z",
      },
    ] as any;

    render(<ReportApprovalsSection approvals={approvals} />);

    expect(screen.getByText("승인 이력 (2)")).toBeInTheDocument();
    expect(screen.getAllByText("gate.override").length).toBe(2);
    expect(screen.getByText("요청: alice")).toBeInTheDocument();
    expect(screen.getByText("결정: bob")).toBeInTheDocument();
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
