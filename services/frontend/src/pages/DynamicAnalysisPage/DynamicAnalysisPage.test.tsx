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

vi.mock("@/common/api/client", () => ({
  fetchDynamicSessions: (...args: unknown[]) => mockFetchDynamicSessions(...args),
  createDynamicSession: (...args: unknown[]) => mockCreateDynamicSession(...args),
  startDynamicSession: (...args: unknown[]) => mockStartDynamicSession(...args),
  stopDynamicSession: (...args: unknown[]) => mockStopDynamicSession(...args),
  ApiError: class extends Error { retryable = false; },
  logError: vi.fn(),
}));

vi.mock("@/common/hooks/useAdapters", () => ({ useAdapters: (...args: unknown[]) => mockUseAdapters(...args) }));
vi.mock("@/common/contexts/ToastContext", () => ({ useToast: () => mockToast }));
vi.mock("./components/MonitoringView/MonitoringView", () => ({ MonitoringView: () => <div>monitoring-view</div> }));
vi.mock("./components/SessionDetailView/SessionDetailView", () => ({ SessionDetailView: () => <div>session-detail-view</div> }));

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    projectId: "p-1",
    status: "stopped",
    source: { type: "adapter", adapterId: "adapter-1", adapterName: "CAN Adapter" },
    messageCount: 10,
    alertCount: 1,
    startedAt: "2026-04-10T00:00:00Z",
    endedAt: "2026-04-10T00:10:00Z",
    ...overrides,
  };
}

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

  it("shows history loading feedback while sessions are resolving", () => {
    mockFetchDynamicSessions.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText("세션 이력 로딩 중...")).toBeInTheDocument();
    expect(document.title).toBe("AEGIS — Dynamic Analysis");
  });

  it("shows adapter warning when starting without connected adapters", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "첫 세션 시작" }));

    expect(await screen.findByText(/연결된 어댑터가 없습니다/)).toBeInTheDocument();
  });

  it("creates a monitoring session when a connected adapter exists", async () => {
    mockUseAdapters.mockReturnValue({ connected: [{ id: "adapter-1", name: "CAN Adapter" }], hasConnected: true });

    renderPage();

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "첫 세션 시작" }));

    expect(await screen.findByText("새 세션")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /모니터링 시작/ }));

    await waitFor(() => expect(mockCreateDynamicSession).toHaveBeenCalledWith("p-1", "adapter-1"));
    await waitFor(() => expect(mockStartDynamicSession).toHaveBeenCalledWith("session-1"));
    expect(await screen.findByText("monitoring-view")).toBeInTheDocument();
  });

  it("opens monitoring view immediately when the API returns an active session", async () => {
    mockUseAdapters.mockReturnValue({ connected: [{ id: "adapter-1", name: "CAN Adapter" }], hasConnected: true });
    mockFetchDynamicSessions.mockResolvedValue([
      makeSession({ status: "monitoring", endedAt: undefined }),
    ]);

    renderPage();

    await waitFor(() => expect(mockFetchDynamicSessions).toHaveBeenCalledWith("p-1"));
    expect(await screen.findByText("monitoring-view")).toBeInTheDocument();
  });

  it("opens the session detail view when a historical session is selected", async () => {
    mockUseAdapters.mockReturnValue({ connected: [{ id: "adapter-1", name: "CAN Adapter" }], hasConnected: true });
    mockFetchDynamicSessions.mockResolvedValue([
      makeSession(),
    ]);

    renderPage();

    const adapterBadge = await screen.findByText("CAN Adapter");
    fireEvent.click(adapterBadge);

    expect(await screen.findByText("session-detail-view")).toBeInTheDocument();
  });

  it("shows the empty history state and a toast when loading sessions fails", async () => {
    mockFetchDynamicSessions.mockRejectedValue(new Error("load failed"));

    renderPage();

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it("does not fetch sessions and shows the empty history state when no project id is present", async () => {
    render(
      <MemoryRouter initialEntries={["/dynamic-analysis"]}>
        <Routes>
          <Route path="/dynamic-analysis" element={<DynamicAnalysisPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /첫 세션 시작/ })).toBeInTheDocument();
    expect(mockFetchDynamicSessions).not.toHaveBeenCalled();
  });
});
