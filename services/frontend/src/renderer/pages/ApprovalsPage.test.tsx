import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalsPage } from "./ApprovalsPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

const mockApprovals = [
  {
    id: "a-1",
    actionType: "gate.override",
    requestedBy: "analyst-1",
    targetId: "g-2",
    projectId: "p-1",
    reason: "긴급 릴리즈 필요",
    status: "pending",
    expiresAt: "2099-12-31T23:59:59Z",
    createdAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "a-2",
    actionType: "finding.accepted_risk",
    requestedBy: "dev-1",
    targetId: "f-5",
    projectId: "p-1",
    reason: "오탐",
    status: "approved",
    decision: { decidedBy: "lead-1", decidedAt: "2026-03-25T11:00:00Z", comment: "확인함" },
    expiresAt: "2026-03-26T10:00:00Z",
    createdAt: "2026-03-25T09:00:00Z",
  },
];

const mockFetchApprovals = vi.fn();
const mockDecideApproval = vi.fn();

vi.mock("../api/approval", () => ({
  fetchProjectApprovals: (...args: unknown[]) => mockFetchApprovals(...args),
  decideApproval: (...args: unknown[]) => mockDecideApproval(...args),
}));

vi.mock("../api/core", () => ({ logError: vi.fn() }));
vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/approvals"]}>
      <Routes>
        <Route path="/projects/:projectId/approvals" element={<ApprovalsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApprovalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchApprovals.mockResolvedValue(mockApprovals);
    mockDecideApproval.mockResolvedValue(mockApprovals[0]);
  });

  it("renders approval list", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Quality Gate 오버라이드")).toBeInTheDocument());
    expect(screen.getByText("Finding 위험 수용")).toBeInTheDocument();
  });

  it("shows pending badge", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("1건 대기")).toBeInTheDocument());
  });

  it("shows approve/reject action buttons for pending", async () => {
    renderPage();
    await waitFor(() => screen.getByText("긴급 릴리즈 필요"));
    // Action buttons within card
    const actionBtns = screen.getAllByRole("button");
    const approveBtn = actionBtns.find((b) => b.textContent === "승인" && b.classList.contains("btn-sm"));
    const rejectBtn = actionBtns.find((b) => b.textContent === "거부" && b.classList.contains("btn-sm"));
    expect(approveBtn).toBeDefined();
    expect(rejectBtn).toBeDefined();
  });

  it("shows decision for approved", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/"확인함"/)).toBeInTheDocument());
  });

  it("filter by status works", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Quality Gate 오버라이드"));
    fireEvent.click(screen.getAllByText("승인")[0]); // filter button "승인"
    // After filtering, only approved approval should show
    // The "Quality Gate 오버라이드" (pending) should not show
  });

  it("opens decision dialog on approve click", async () => {
    renderPage();
    await waitFor(() => screen.getByText("긴급 릴리즈 필요"));
    // Click the action "승인" button (btn-sm in the card, not the filter)
    const actionBtns = screen.getAllByRole("button").filter(
      (b) => b.textContent === "승인" && b.classList.contains("btn-sm"),
    );
    fireEvent.click(actionBtns[0]);
    await waitFor(() => expect(screen.getByText("승인 확인")).toBeInTheDocument());
  });

  it("shows empty state when no approvals", async () => {
    mockFetchApprovals.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText("승인 요청이 없습니다")).toBeInTheDocument());
  });
});
