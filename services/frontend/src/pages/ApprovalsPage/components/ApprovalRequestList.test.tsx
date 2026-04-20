import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalRequestList } from "./ApprovalRequestList";

describe("ApprovalRequestList", () => {
  it("renders the empty state when there are no approvals", () => {
    render(
      <ApprovalRequestList
        approvals={[]}
        filter="all"
        onOpenTarget={vi.fn()}
        onStartDecision={vi.fn()}
      />,
    );

    expect(screen.getByText("승인 요청이 없습니다")).toBeInTheDocument();
  });

  it("renders approval rows and forwards target/decision actions", () => {
    const onOpenTarget = vi.fn();
    const onStartDecision = vi.fn();
    const approvals = [
      {
        id: "approval-1",
        actionType: "gate.override",
        requestedBy: "alice",
        reason: "Gate override needed",
        status: "pending",
        createdAt: "2026-04-20T01:00:00Z",
        expiresAt: "2099-04-20T01:00:00Z",
      },
      {
        id: "approval-2",
        actionType: "finding.accepted_risk",
        requestedBy: "bob",
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
        filter="all"
        onOpenTarget={onOpenTarget}
        onStartDecision={onStartDecision}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gate 보기" }));
    expect(onOpenTarget).toHaveBeenCalledWith(approvals[0]);

    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(onStartDecision).toHaveBeenCalledWith("approval-1", "approved");

    fireEvent.click(screen.getByRole("button", { name: "거부" }));
    expect(onStartDecision).toHaveBeenCalledWith("approval-1", "rejected");

    expect(screen.getByText(/결정:\s*carol/)).toBeInTheDocument();
    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
  });
});
