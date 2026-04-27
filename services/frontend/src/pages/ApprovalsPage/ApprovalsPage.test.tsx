import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApprovalsPage } from "./ApprovalsPage";

const mockNavigate = vi.fn();
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const pastDate = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const mockApprovals = [
  {
    id: "APR-0058",
    actionType: "gate.override",
    requestedBy: "analyst-1",
    targetId: "g-2",
    projectId: "p-1",
    reason: "긴급 릴리즈 필요",
    status: "pending",
    expiresAt: futureDate(365),
    createdAt: "2026-03-25T10:00:00Z",
    impactSummary: {
      failedRules: 2,
      ignoredFindings: 5,
      severityBreakdown: { critical: 1, high: 3 },
    },
    targetSnapshot: {
      runId: "1284",
      commit: "f8a1c3d3e2",
      branch: "main",
      profile: "prod-strict-v3",
      action: "gate.override",
    },
  },
  {
    id: "APR-0042",
    actionType: "finding.accepted_risk",
    requestedBy: "dev-1",
    targetId: "f-5",
    projectId: "p-1",
    reason: "오탐",
    status: "approved",
    decision: { decidedBy: "lead-1", decidedAt: pastDate(2), comment: "확인함" },
    expiresAt: pastDate(1),
    createdAt: pastDate(3),
  },
] as const;

const mockFetchApprovals = vi.fn();
const mockDecideApproval = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/approval", () => ({
  fetchProjectApprovals: (...args: unknown[]) => mockFetchApprovals(...args),
  decideApproval: (...args: unknown[]) => mockDecideApproval(...args),
}));

vi.mock("../../api/core", () => ({ logError: vi.fn() }));
vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

function renderPage(initialEntry = "/projects/p-1/approvals") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects/:projectId/approvals" element={<ApprovalsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApprovalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchApprovals.mockResolvedValue([...mockApprovals]);
    mockDecideApproval.mockResolvedValue(mockApprovals[0]);
  });

  it("shows loading feedback before approvals resolve", () => {
    mockFetchApprovals.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText("승인 요청 로딩 중...")).toBeInTheDocument();
  });

  it("renders the pending row by default and exposes status counts on segs", async () => {
    renderPage();

    await waitFor(() => expect(mockFetchApprovals).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByRole("heading", { name: "승인 큐" })).toBeInTheDocument();

    const filterTablist = screen.getByRole("tablist", { name: "승인 요청 상태 필터" });
    const pendingTab = within(filterTablist).getByRole("tab", { name: /대기/ });
    expect(pendingTab).toHaveAttribute("aria-selected", "true");
    expect(within(pendingTab).getByText("1")).toBeInTheDocument();

    const approvedTab = within(filterTablist).getByRole("tab", { name: /승인됨/ });
    expect(within(approvedTab).getByText("1")).toBeInTheDocument();

    expect(screen.getByText("Quality Gate 오버라이드")).toBeInTheDocument();
    // approved row is hidden under the default pending filter
    expect(screen.queryByText("Finding 위험 수용")).not.toBeInTheDocument();
  });

  it("renders the hero verdict block with workflow-active-pending tone", async () => {
    renderPage();
    const hero = await screen.findByLabelText("승인 큐 현재 상태");
    expect(hero).toHaveClass("hero-verdict", "v-pending");
    // pending count is 1 (workflow-active-pending tone via approval-status--pending)
    expect(within(hero).getByText("1")).toHaveClass("approval-status--pending");
  });

  it("filters to approved approvals and shows the existing decision metadata", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("Quality Gate 오버라이드")).toBeInTheDocument());
    const filterTablist = screen.getByRole("tablist", { name: "승인 요청 상태 필터" });
    fireEvent.click(within(filterTablist).getByRole("tab", { name: /승인됨/ }));

    await waitFor(() => expect(screen.queryByText("Quality Gate 오버라이드")).not.toBeInTheDocument());
    expect(screen.getByText("Finding 위험 수용")).toBeInTheDocument();
    expect(screen.getByText(/"확인함"/)).toBeInTheDocument();

    fireEvent.click(within(filterTablist).getByRole("tab", { name: /^거부/ }));
    expect(await screen.findByText("거부된 요청이 없습니다")).toBeInTheDocument();
  });

  it("routes approval targets to their project detail pages", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /Gate 보기/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Gate 보기/ }));

    const filterTablist = screen.getByRole("tablist", { name: "승인 요청 상태 필터" });
    fireEvent.click(within(filterTablist).getByRole("tab", { name: /승인됨/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Finding 보기/ }));

    expect(mockNavigate).toHaveBeenNthCalledWith(1, "/projects/p-1/quality-gate");
    expect(mockNavigate).toHaveBeenNthCalledWith(2, "/projects/p-1/vulnerabilities");
  });

  it("submits an approval decision with an optional comment and reloads the list", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("긴급 릴리즈 필요")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("코멘트 (선택)"), {
      target: { value: "승인 사유" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "승인 확정" }));

    await waitFor(() =>
      expect(mockDecideApproval).toHaveBeenCalledWith("APR-0058", "approved", undefined, "승인 사유"),
    );
    await waitFor(() => expect(mockFetchApprovals).toHaveBeenCalledTimes(2));
    expect(mockToast.success).toHaveBeenCalledWith("승인 완료");
  });

  it("submits a rejection decision without a comment and reloads the list", async () => {
    renderPage();

    const reason = await screen.findByText("긴급 릴리즈 필요");
    const pendingCard = reason.closest(".appr-row") as HTMLElement;
    fireEvent.click(within(pendingCard).getByRole("button", { name: "거부" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "거부 확정" }));

    await waitFor(() =>
      expect(mockDecideApproval).toHaveBeenCalledWith("APR-0058", "rejected", undefined, undefined),
    );
    await waitFor(() => expect(mockFetchApprovals).toHaveBeenCalledTimes(2));
    expect(mockToast.success).toHaveBeenCalledWith("거부 완료");
  });

  it("renders impactSummary preview and targetSnapshot meta in the decision dialog", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("긴급 릴리즈 필요")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    const dialog = await screen.findByRole("dialog");
    // impactSummary verbatim (S2 contract), no frontend derive
    expect(
      within(dialog).getByText("차단 규칙 2 / 무시 발견 5 / critical 1, high 3"),
    ).toBeInTheDocument();
    // targetSnapshot meta rows
    expect(within(dialog).getByText("Run")).toBeInTheDocument();
    expect(within(dialog).getByText("#1284")).toBeInTheDocument();
    expect(within(dialog).getByText("Commit")).toBeInTheDocument();
    expect(within(dialog).getByText("f8a1c3d")).toBeInTheDocument();
    expect(within(dialog).getByText("Profile")).toBeInTheDocument();
    expect(within(dialog).getByText("prod-strict-v3")).toBeInTheDocument();
  });

  it("logs and toasts when approvals fail to load", async () => {
    const error = new Error("load failed");
    mockFetchApprovals.mockRejectedValue(error);

    renderPage();

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("승인 요청 목록을 불러올 수 없습니다."),
    );
    expect(await screen.findByText("처리할 승인 요청이 없습니다")).toBeInTheDocument();
  });

  it("does not fetch approvals and shows an empty state when the route has no project id", async () => {
    render(
      <MemoryRouter initialEntries={["/approvals"]}>
        <Routes>
          <Route path="/approvals" element={<ApprovalsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("처리할 승인 요청이 없습니다")).toBeInTheDocument());
    expect(mockFetchApprovals).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("shows the empty state with 7-day stats hint when the project has only resolved approvals", async () => {
    mockFetchApprovals.mockResolvedValue([
      {
        id: "APR-X",
        actionType: "gate.override",
        requestedBy: "u",
        targetId: "g",
        projectId: "p-1",
        reason: "r",
        status: "approved",
        decision: { decidedBy: "lead", decidedAt: pastDate(2), comment: "ok" },
        expiresAt: pastDate(1),
        createdAt: pastDate(3),
      },
    ]);
    renderPage();

    expect(await screen.findByText("처리할 승인 요청이 없습니다")).toBeInTheDocument();
    // 7-day stats hint may appear in both hero (detail row) and empty state — both OK
    expect(screen.getAllByText(/지난 7일간/).length).toBeGreaterThan(0);
  });
});

describe("ApprovalsPage — Panel variant (US-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchApprovals.mockResolvedValue([...mockApprovals]);
    mockDecideApproval.mockResolvedValue(mockApprovals[0]);
  });

  it("renders the panel layout when ?view=panel is present and round-trips the URL state", async () => {
    renderPage("/projects/p-1/approvals?view=panel");

    await waitFor(() => expect(mockFetchApprovals).toHaveBeenCalledWith("p-1"));

    const tabPanel = await screen.findByRole("tabpanel");
    expect(tabPanel).toBeInTheDocument();

    // pending list filtered by default → first item auto-selected
    const masterList = screen.getByRole("tablist", { name: "승인 요청" });
    await waitFor(() => {
      const firstTab = within(masterList).getByRole("tab", { name: /APR-0058/ });
      expect(firstTab).toHaveAttribute("aria-selected", "true");
    });
    // detail pane reflects the targetSnapshot meta-grid (6 rows)
    await waitFor(() => expect(within(tabPanel).getByText("Run")).toBeInTheDocument());
    expect(within(tabPanel).getByText("#1284")).toBeInTheDocument();
    expect(within(tabPanel).getByText("Profile")).toBeInTheDocument();
    expect(within(tabPanel).getByText("prod-strict-v3")).toBeInTheDocument();
  });

  it("supports keyboard ArrowDown navigation across the master list (role=tab)", async () => {
    // Make all approvals pending so they are visible under default filter and the master has > 1 row
    mockFetchApprovals.mockResolvedValue([
      mockApprovals[0],
      {
        ...mockApprovals[1],
        id: "APR-PEND-2",
        status: "pending" as const,
        expiresAt: futureDate(2),
        createdAt: pastDate(0.5),
        decision: undefined,
      },
    ]);

    renderPage("/projects/p-1/approvals?view=panel");

    const masterList = await screen.findByRole("tablist", { name: "승인 요청" });
    const initialTabs = within(masterList).getAllByRole("tab");
    expect(initialTabs[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(masterList, { key: "ArrowDown" });

    await waitFor(() => {
      const updatedTabs = within(masterList).getAllByRole("tab");
      expect(updatedTabs[1]).toHaveAttribute("aria-selected", "true");
    });
  });

  it("renders dim placeholder for absent targetSnapshot fields (handoff §9 rule)", async () => {
    mockFetchApprovals.mockResolvedValue([
      {
        ...mockApprovals[0],
        id: "APR-NO-SNAP",
        // no targetSnapshot / no impactSummary
        impactSummary: undefined,
        targetSnapshot: undefined,
      },
    ]);

    renderPage("/projects/p-1/approvals?view=panel");

    const tabPanel = await screen.findByRole("tabpanel");
    // 5 placeholder rows for runId/commit/branch/profile/action when snapshot missing
    expect(within(tabPanel).getAllByText("—").length).toBeGreaterThanOrEqual(5);
  });
});
