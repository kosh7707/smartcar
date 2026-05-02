import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QualityGatePage } from "./QualityGatePage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

const mockGates = [
  {
    id: "g-1",
    runId: "r-1",
    projectId: "p-1",
    status: "pass",
    rules: [
      { ruleId: "no-critical", result: "passed", message: "Critical 취약점 없음", linkedFindingIds: [], current: 0, threshold: 0, unit: "count" },
      { ruleId: "high-threshold", result: "passed", message: "High 2건 (임계 5건)", linkedFindingIds: ["f-1", "f-2"], current: 2, threshold: 5, unit: "count" },
    ],
    evaluatedAt: "2026-03-25T10:00:00Z",
    createdAt: "2026-03-25T10:00:00Z",
    profileId: "prof-1",
    commit: "f8a1c3d2c1",
    branch: "main",
    requestedBy: "system",
  },
  {
    id: "g-2",
    runId: "r-2",
    projectId: "p-1",
    status: "fail",
    rules: [
      { ruleId: "no-critical", result: "failed", message: "Critical 1건 발견", linkedFindingIds: ["f-3"], current: 1, threshold: 0, unit: "count" },
    ],
    evaluatedAt: "2026-03-24T10:00:00Z",
    createdAt: "2026-03-24T10:00:00Z",
    profileId: "prof-1",
    commit: "abcd1234ef",
    branch: "feat/x",
    requestedBy: "김민지",
  },
];

const mockProfile = {
  id: "prof-1",
  name: "prod-strict-v3",
  description: "production strict policy",
  rules: [],
};

const mockFetchGates = vi.fn();
const mockFetchGateProfile = vi.fn();
const mockOverrideGate = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

vi.mock("@/common/api/gate", () => ({
  fetchProjectGates: (...args: unknown[]) => mockFetchGates(...args),
  fetchGateProfile: (...args: unknown[]) => mockFetchGateProfile(...args),
  overrideGate: (...args: unknown[]) => mockOverrideGate(...args),
}));

vi.mock("@/common/api/core", () => ({ logError: vi.fn() }));
vi.mock("@/common/contexts/ToastContext", () => ({
  useToast: () => mockToast,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/quality-gate"]}>
      <Routes>
        <Route path="/projects/:projectId/quality-gate" element={<QualityGatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QualityGatePage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockFetchGates.mockResolvedValue(mockGates);
    mockFetchGateProfile.mockResolvedValue(mockProfile);
    mockOverrideGate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading feedback before gate results resolve", () => {
    mockFetchGates.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText("품질 게이트 로딩 중...")).toBeInTheDocument();
  });

  it("renders gate results", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "품질 게이트" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("통과").length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText("실패").length).toBeGreaterThanOrEqual(1);
  });

  it("renders rule details", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Critical 취약점 없음").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText("Critical 1건 발견")).toBeInTheDocument();
  });

  it("shows finding count for rules with linked findings", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("탐지 항목 2건")).toBeInTheDocument());
    expect(screen.getByText("탐지 항목 1건")).toBeInTheDocument();
  });

  it("renders threshold values directly from rule current/threshold", async () => {
    renderPage();
    const failedRule = await screen.findByText("Critical 1건 발견");
    const failedCard = failedRule.closest(".gate-card") as HTMLElement;
    // Failed gate: rule current=1, threshold=0
    expect(within(failedCard).getByText("1")).toBeInTheDocument();
    expect(within(failedCard).getByText("/ 0")).toBeInTheDocument();
    // Pass gate: rule current=2, threshold=5 lives in the other card
    const passRule = screen.getByText("High 2건 (임계 5건)");
    const passCard = passRule.closest(".gate-card") as HTMLElement;
    expect(within(passCard).getByText("2")).toBeInTheDocument();
    expect(within(passCard).getByText("/ 5")).toBeInTheDocument();
  });

  it("cross-fetches the GateProfile via fetchGateProfile", async () => {
    renderPage();
    await waitFor(() => expect(mockFetchGateProfile).toHaveBeenCalledWith("prof-1"));
    // Map cache dedupe: same profileId across gates → one fetch
    expect(mockFetchGateProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findAllByText("prod-strict-v3")).toHaveLength(2);
  });

  it("renders requestedBy=system as 자동 평가", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("자동 평가").length).toBeGreaterThanOrEqual(1));
  });

  it("shows override button on failed gate", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /오버라이드 요청/ })).toBeInTheDocument());
  });

  it("override modal opens on click", async () => {
    renderPage();
    const trigger = await screen.findByRole("button", { name: /오버라이드 요청/ });
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/사유/)).toBeInTheDocument();
  });

  it("calls overrideGate after reason + actor confirm", async () => {
    renderPage();
    const failedRule = await screen.findByText("Critical 1건 발견");
    const gateCard = failedRule.closest(".gate-card") as HTMLElement;
    fireEvent.click(within(gateCard).getByRole("button", { name: /오버라이드 요청/ }));

    const dialog = await screen.findByRole("dialog");
    const textarea = within(dialog).getByLabelText(/사유/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "테스트 오버라이드 사유입니다" } });

    const submit = within(dialog).getByRole("button", { name: /오버라이드 요청 제출/ });
    expect(submit).toBeDisabled();

    const actorConfirm = within(dialog).getByRole("checkbox");
    fireEvent.click(actorConfirm);

    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(mockOverrideGate).toHaveBeenCalledTimes(1));
    expect(mockOverrideGate).toHaveBeenCalledWith("g-2", "테스트 오버라이드 사유입니다");
  });

  it("shows empty state when no gates", async () => {
    mockFetchGates.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText("아직 평가 이력이 없습니다")).toBeInTheDocument());
  });

  it("empty state uses workflow-active-pending tone", async () => {
    mockFetchGates.mockResolvedValue([]);
    renderPage();
    const empty = await screen.findByLabelText("아직 평가 이력이 없습니다");
    expect(empty).toHaveClass("quality-gate-empty");
    expect(empty).toHaveClass("is-pending");
  });

  it("shows the empty state and does not fetch when no project id is present", async () => {
    render(
      <MemoryRouter initialEntries={["/quality-gate"]}>
        <Routes>
          <Route path="/quality-gate" element={<QualityGatePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("아직 평가 이력이 없습니다")).toBeInTheDocument();
    expect(mockFetchGates).not.toHaveBeenCalled();
  });

  it("shows an empty fallback when loading gates fails", async () => {
    mockFetchGates.mockRejectedValue(new Error("load failed"));
    renderPage();

    expect(await screen.findByText("아직 평가 이력이 없습니다")).toBeInTheDocument();
  });
});
