import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DynamicAnalysisPage } from "./DynamicAnalysisPage";

const mockFetchDynamicSessions = vi.fn();
const mockCreateDynamicSession = vi.fn();
const mockStartDynamicSession = vi.fn();
const mockStopDynamicSession = vi.fn();
const mockUseAdapters = vi.fn();
const mockToast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };

vi.mock("../../api/client", () => ({
  fetchDynamicSessions: (...args: unknown[]) => mockFetchDynamicSessions(...args),
  createDynamicSession: (...args: unknown[]) => mockCreateDynamicSession(...args),
  startDynamicSession: (...args: unknown[]) => mockStartDynamicSession(...args),
  stopDynamicSession: (...args: unknown[]) => mockStopDynamicSession(...args),
  ApiError: class extends Error { retryable = false; },
  logError: vi.fn(),
}));

vi.mock("../../hooks/useAdapters", () => ({ useAdapters: (...args: unknown[]) => mockUseAdapters(...args) }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => mockToast }));
vi.mock("../../components/dynamic/MonitoringView", () => ({ MonitoringView: () => <div>monitoring-view</div> }));
vi.mock("../../components/dynamic/SessionDetailView", () => ({ SessionDetailView: () => <div>session-detail-view</div> }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/dynamic-analysis"]}>
      <Routes>
        <Route path="/projects/:projectId/dynamic-analysis" element={<DynamicAnalysisPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DynamicAnalysisPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchDynamicSessions.mockResolvedValue([]);
    mockUseAdapters.mockReturnValue({ connected: [], hasConnected: false });
    mockCreateDynamicSession.mockResolvedValue({ id: "session-1" });
    mockStartDynamicSession.mockResolvedValue({ id: "session-1", status: "monitoring" });
    mockStopDynamicSession.mockResolvedValue(undefined);
  });

  it("shows adapter warning when starting without connected adapters", async () => {
    renderPage();

    expect(await screen.findByText("아직 동적 분석 이력이 없습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "첫 세션 시작" }));

    expect(await screen.findByText(/연결된 어댑터가 없습니다/)).toBeInTheDocument();
  });

  it("creates a monitoring session when a connected adapter exists", async () => {
    mockUseAdapters.mockReturnValue({ connected: [{ id: "adapter-1", name: "CAN Adapter" }], hasConnected: true });

    renderPage();

    expect(await screen.findByText("아직 동적 분석 이력이 없습니다")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "첫 세션 시작" }));

    expect(await screen.findByText("새 세션")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /모니터링 시작/ }));

    await waitFor(() => expect(mockCreateDynamicSession).toHaveBeenCalledWith("p-1", "adapter-1"));
    await waitFor(() => expect(mockStartDynamicSession).toHaveBeenCalledWith("session-1"));
    expect(await screen.findByText("monitoring-view")).toBeInTheDocument();
  });
});
