import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
      { ruleId: "no-critical", result: "passed", message: "Critical 취약점 없음", linkedFindingIds: [] },
      { ruleId: "high-threshold", result: "passed", message: "High 2건 (임계 5건)", linkedFindingIds: ["f-1", "f-2"] },
    ],
    evaluatedAt: "2026-03-25T10:00:00Z",
    createdAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "g-2",
    runId: "r-2",
    projectId: "p-1",
    status: "fail",
    rules: [
      { ruleId: "no-critical", result: "failed", message: "Critical 1건 발견", linkedFindingIds: ["f-3"] },
    ],
    evaluatedAt: "2026-03-24T10:00:00Z",
    createdAt: "2026-03-24T10:00:00Z",
  },
];

const mockFetchGates = vi.fn();
const mockOverrideGate = vi.fn();

vi.mock("../api/gate", () => ({
  fetchProjectGates: (...args: unknown[]) => mockFetchGates(...args),
  overrideGate: (...args: unknown[]) => mockOverrideGate(...args),
}));

vi.mock("../api/core", () => ({ logError: vi.fn() }));
vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
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
    vi.clearAllMocks();
    mockFetchGates.mockResolvedValue(mockGates);
    mockOverrideGate.mockResolvedValue(undefined);
  });

  it("renders gate results", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("통과")).toBeInTheDocument());
    expect(screen.getByText("실패")).toBeInTheDocument();
  });

  it("renders rule details", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Critical 취약점 없음").length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText("Critical 1건 발견")).toBeInTheDocument();
  });

  it("shows finding count for rules with linked findings", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Finding 2건")).toBeInTheDocument());
    expect(screen.getByText("Finding 1건")).toBeInTheDocument();
  });

  it("shows override button on failed gate", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("오버라이드")).toBeInTheDocument());
  });

  it("override form appears on click", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: "오버라이드" }));
    fireEvent.click(screen.getByRole("button", { name: "오버라이드" }));
    await waitFor(() => expect(screen.getByPlaceholderText("오버라이드 사유를 입력하세요")).toBeInTheDocument());
  });

  it("calls overrideGate on submit", async () => {
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: "오버라이드" }));
    fireEvent.click(screen.getByRole("button", { name: "오버라이드" }));
    const input = await waitFor(() => screen.getByPlaceholderText("오버라이드 사유를 입력하세요"));
    fireEvent.change(input, { target: { value: "테스트 사유" } });
    await waitFor(() => {
      const confirmBtn = screen.getByRole("button", { name: "확인" });
      expect(confirmBtn).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(mockOverrideGate).toHaveBeenCalledWith("g-2", "테스트 사유"));
  });

  it("shows empty state when no gates", async () => {
    mockFetchGates.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText("아직 Quality Gate 결과가 없습니다")).toBeInTheDocument());
  });
});
