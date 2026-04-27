import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalRequestList } from "./ApprovalRequestList";

describe("ApprovalRequestList", () => {
  it("renders approval rows and forwards target/decision actions", () => {
    const onOpenTarget = vi.fn();
    const onStartDecision = vi.fn();
    const approvals = [
      {
        id: "APR-1",
        actionType: "gate.override",
        requestedBy: "alice",
        targetId: "g-1",
        projectId: "p-1",
        reason: "Gate override needed",
        status: "pending",
        createdAt: "2026-04-20T01:00:00Z",
        expiresAt: "2099-04-20T01:00:00Z",
        impactSummary: { failedRules: 2, ignoredFindings: 5, severityBreakdown: { critical: 1, high: 3 } },
      },
      {
        id: "APR-2",
        actionType: "finding.accepted_risk",
        requestedBy: "bob",
        targetId: "f-5",
        projectId: "p-1",
        reason: "Accepted risk review",
        status: "approved",
        createdAt: "2026-04-20T02:00:00Z",
        expiresAt: "2099-04-21T01:00:00Z",
        decision: {
          decidedBy: "carol",
          decidedAt: "2026-04-20T03:00:00Z",
          comment: "Looks good",
        },
      },
    ] as any;

    render(
      <ApprovalRequestList
        approvals={approvals}
        onOpenTarget={onOpenTarget}
        onStartDecision={onStartDecision}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gate 보기" }));
    expect(onOpenTarget).toHaveBeenCalledWith(approvals[0]);

    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(onStartDecision).toHaveBeenCalledWith("APR-1", "approved");

    fireEvent.click(screen.getByRole("button", { name: "거부" }));
    expect(onStartDecision).toHaveBeenCalledWith("APR-1", "rejected");

    expect(screen.getByText(/carol/)).toBeInTheDocument();
    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
  });

  it("renders impactSummary verbatim from S2 contract (no frontend derive)", () => {
    const approvals = [
      {
        id: "APR-3",
        actionType: "gate.override",
        requestedBy: "alice",
        targetId: "g-1",
        projectId: "p-1",
        reason: "irrelevant",
        status: "pending",
        createdAt: "2026-04-20T01:00:00Z",
        expiresAt: "2099-04-20T01:00:00Z",
        impactSummary: {
          failedRules: 4,
          ignoredFindings: 7,
          severityBreakdown: { critical: 2, high: 5 },
        },
      },
    ] as any;

    render(
      <ApprovalRequestList
        approvals={approvals}
        onOpenTarget={vi.fn()}
        onStartDecision={vi.fn()}
      />,
    );

    expect(
      screen.getByText("차단 규칙 4 / 무시 발견 7 / critical 2, high 5"),
    ).toBeInTheDocument();
  });

  it("renders dim placeholder when impactSummary is absent (handoff §9 rule)", () => {
    const approvals = [
      {
        id: "APR-4",
        actionType: "gate.override",
        requestedBy: "alice",
        targetId: "g-1",
        projectId: "p-1",
        reason: "irrelevant",
        status: "pending",
        createdAt: "2026-04-20T01:00:00Z",
        expiresAt: "2099-04-20T01:00:00Z",
      },
    ] as any;

    render(
      <ApprovalRequestList
        approvals={approvals}
        onOpenTarget={vi.fn()}
        onStartDecision={vi.fn()}
      />,
    );

    const placeholders = screen.getAllByText("—");
    expect(placeholders.length).toBeGreaterThan(0);
  });
});
