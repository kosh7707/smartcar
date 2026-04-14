import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StaticAnalysisPage } from "./StaticAnalysisPage";

const mockUseStaticDashboard = vi.fn();
const mockUseAnalysisWebSocket = vi.fn();
const mockUseBuildTargets = vi.fn();
const mockSetBlocking = vi.fn();
const mockFetchRunDetail = vi.fn();

vi.mock("../../hooks/useStaticDashboard", () => ({ useStaticDashboard: (...args: unknown[]) => mockUseStaticDashboard(...args) }));
vi.mock("../../hooks/useAnalysisWebSocket", () => ({ useAnalysisWebSocket: () => mockUseAnalysisWebSocket() }));
vi.mock("../../hooks/useBuildTargets", () => ({ useBuildTargets: (...args: unknown[]) => mockUseBuildTargets(...args) }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));
vi.mock("../../contexts/AnalysisGuardContext", () => ({ useSetAnalysisGuard: () => ({ setBlocking: mockSetBlocking }) }));
vi.mock("../../api/client", () => ({
  fetchProjectFiles: vi.fn(() => Promise.resolve([])),
  fetchProjectFindings: vi.fn(() => Promise.resolve([])),
  fetchSourceFiles: vi.fn(() => Promise.resolve([])),
  fetchRunDetail: (...args: unknown[]) => mockFetchRunDetail(...args),
  logError: vi.fn(),
}));
vi.mock("./components/StaticAnalysisUploadScreen", () => ({
  StaticAnalysisUploadScreen: ({ onAnalysisStart, onBrowseTree }: { onAnalysisStart: () => void; onBrowseTree: () => void }) => (
    <div>
      <div>source-upload-view</div>
      <button onClick={onAnalysisStart}>start-analysis</button>
      <button onClick={onBrowseTree}>browse-tree</button>
    </div>
  ),
}));
vi.mock("./components/SourceTreeView", () => ({
  SourceTreeView: ({ onSelectFinding }: { onSelectFinding: (findingId: string) => void }) => (
    <div>
      <div>source-tree-view</div>
      <button onClick={() => onSelectFinding("finding-1")}>open-finding</button>
    </div>
  ),
}));
vi.mock("./components/StaticDashboard", () => ({
  StaticDashboard: ({ onNewAnalysis, onViewRun }: { onNewAnalysis: () => void; onViewRun: (runId: string) => void }) => (
    <div>
      <div>static-dashboard-view</div>
      <button onClick={onNewAnalysis}>open-new-analysis</button>
      <button onClick={() => onViewRun("run-1")}>open-run-detail</button>
    </div>
  ),
}));
vi.mock("./components/TwoStageProgressView", () => ({ TwoStageProgressView: () => <div>two-stage-progress-view</div> }));
vi.mock("./components/RunDetailView", () => ({ RunDetailView: () => <div>run-detail-view</div> }));
vi.mock("../../shared/findings/FindingDetailView", () => ({ FindingDetailView: () => <div>finding-detail-view</div> }));
vi.mock("../../shared/findings/VulnerabilityDetailView", () => ({ VulnerabilityDetailView: () => <div>vulnerability-detail-view</div> }));
vi.mock("./components/AnalysisResultsView", () => ({ AnalysisResultsView: () => <div>analysis-results-view</div> }));
vi.mock("./components/TargetSelectDialog", () => ({ TargetSelectDialog: () => null }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p-1/static-analysis"]}>
      <Routes>
        <Route path="/projects/:projectId/static-analysis" element={<StaticAnalysisPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StaticAnalysisPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRunDetail.mockResolvedValue({ id: "run-1" });
    mockUseAnalysisWebSocket.mockReturnValue({ isRunning: false, reset: vi.fn(), startAnalysis: vi.fn(), analysisId: null, stage: null, message: '', quickFindingCount: 0, deepFindingCount: 0, error: null, errorPhase: null, retryable: false, targetName: null, targetProgress: null, connectionState: 'connected' });
    mockUseBuildTargets.mockReturnValue({ targets: [], discover: vi.fn(() => Promise.resolve([])) });
  });

  it("shows dashboard loading feedback while summary data is resolving", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: true, summary: null, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });
    renderPage();
    expect(await screen.findByText("대시보드 로딩 중...")).toBeInTheDocument();
  });

  it("shows an empty state when there is no static analysis summary", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: null });
    renderPage();
    expect(await screen.findByText("아직 분석 데이터가 없습니다")).toBeInTheDocument();
  });

  it("navigates to the upload view from the empty state action", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "소스 코드 업로드" }));
    expect(await screen.findByText("source-upload-view")).toBeInTheDocument();
  });

  it("renders the dashboard view when summary data exists", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });
    renderPage();
    expect(await screen.findByText("static-dashboard-view")).toBeInTheDocument();
  });

  it("opens the run detail view when the dashboard requests a run", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "open-run-detail" }));
    expect(await screen.findByText("run-detail-view")).toBeInTheDocument();
    await waitFor(() => expect(mockFetchRunDetail).toHaveBeenCalledWith("run-1"));
  });

  it("navigates from upload to source tree and opens finding detail", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "open-new-analysis" }));
    expect(await screen.findByText("source-upload-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "browse-tree" }));
    expect(await screen.findByText("source-tree-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-finding" }));
    expect(await screen.findByText("finding-detail-view")).toBeInTheDocument();
  });

  it("updates the analysis guard blocking flag based on running state", async () => {
    mockUseAnalysisWebSocket.mockReturnValue({ isRunning: true, reset: vi.fn(), startAnalysis: vi.fn(), analysisId: null, stage: null, message: '', quickFindingCount: 0, deepFindingCount: 0, error: null, errorPhase: null, retryable: false, targetName: null, targetProgress: null, connectionState: 'connected' });
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });

    const { unmount } = renderPage();

    await waitFor(() => expect(mockSetBlocking).toHaveBeenCalledWith(true));
    unmount();
    expect(mockSetBlocking).toHaveBeenLastCalledWith(false);
  });
});
