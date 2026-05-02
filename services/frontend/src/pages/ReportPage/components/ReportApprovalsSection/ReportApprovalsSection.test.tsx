import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportApprovalsSection } from "../ReportApprovalsSection/ReportApprovalsSection";

describe("ReportApprovalsSection", () => {
  it("renders the inline empty line when no approvals exist", () => {
    render(<ReportApprovalsSection approvals={[]} />);
    expect(screen.getByText("관련 승인 요청이 없습니다.")).toBeInTheDocument();
  });

  it("renders approval rows with status, requester and decision", () => {
    const approvals = [
      {
        id: "APR-001",
        actionType: "gate.override",
        requestedBy: "alice",
        status: "approved",
        decision: { decidedBy: "bob" },
        createdAt: "2026-04-10T01:30:00Z",
      },
      {
        id: "APR-002",
        actionType: "gate.override",
        requestedBy: "carol",
        status: "pending",
        createdAt: "2026-04-11T01:30:00Z",
      },
    ] as any;

    render(<ReportApprovalsSection approvals={approvals} />);

    expect(screen.getAllByText("gate.override")).toHaveLength(2);
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("승인")).toBeInTheDocument();
    expect(screen.getByText("대기")).toBeInTheDocument();
  });
});
