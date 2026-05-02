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
const mockFetchAnalysisStatus = vi.fn();
const mockFetchAnalysisResults = vi.fn();

vi.mock("@/common/hooks/useStaticDashboard", () => ({ useStaticDashboard: (...args: unknown[]) => mockUseStaticDashboard(...args) }));
vi.mock("@/common/hooks/useAnalysisWebSocket", () => ({ useAnalysisWebSocket: () => mockUseAnalysisWebSocket() }));
vi.mock("@/common/hooks/useBuildTargets", () => ({ useBuildTargets: (...args: unknown[]) => mockUseBuildTargets(...args) }));
vi.mock("@/common/contexts/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));
vi.mock("@/common/contexts/AnalysisGuardContext", () => ({ useSetAnalysisGuard: () => ({ setBlocking: mockSetBlocking }) }));
vi.mock("@/common/api/client", () => ({
  fetchProjectFiles: vi.fn(() => Promise.resolve([])),
  fetchProjectFindings: vi.fn(() => Promise.resolve([])),
  fetchSourceFiles: vi.fn(() => Promise.resolve([])),
  fetchRunDetail: (...args: unknown[]) => mockFetchRunDetail(...args),
  fetchAnalysisStatus: (...args: unknown[]) => mockFetchAnalysisStatus(...args),
  fetchAnalysisResults: (...args: unknown[]) => mockFetchAnalysisResults(...args),
  logError: vi.fn(),
}));
vi.mock("./components/StaticAnalysisUploadScreen/StaticAnalysisUploadScreen", () => ({
  StaticAnalysisUploadScreen: ({ onAnalysisStart, onBrowseTree }: { onAnalysisStart: () => void; onBrowseTree: () => void }) => (
    <div>
      <div>source-upload-view</div>
      <button onClick={onAnalysisStart}>start-analysis</button>
      <button onClick={onBrowseTree}>browse-tree</button>
    </div>
  ),
}));
vi.mock("./components/StaticDashboard/StaticDashboard", () => ({
  StaticDashboard: ({ onNewAnalysis, onViewRun }: { onNewAnalysis: () => void; onViewRun: (runId: string) => void }) => (
    <div>
      <div>static-dashboard-view</div>
      <button onClick={onNewAnalysis}>open-new-analysis</button>
      <button onClick={() => onViewRun("run-1")}>open-run-detail</button>
    </div>
  ),
}));
vi.mock("./components/TwoStageProgressView/TwoStageProgressView", () => ({ TwoStageProgressView: () => <div>two-stage-progress-view</div> }));
vi.mock("./components/RunDetailView/RunDetailView", () => ({ RunDetailView: () => <div>run-detail-view</div> }));
vi.mock("@/common/ui/findings/FindingDetailView", () => ({ FindingDetailView: () => <div>finding-detail-view</div> }));
vi.mock("@/common/ui/findings/VulnerabilityDetailView", () => ({ VulnerabilityDetailView: () => <div>vulnerability-detail-view</div> }));
vi.mock("./components/AnalysisResultsView/AnalysisResultsView", () => ({ AnalysisResultsView: () => <div>analysis-results-view</div> }));
vi.mock("./components/TargetSelectDialog/TargetSelectDialog", () => ({ TargetSelectDialog: () => null }));

function renderPage(initialEntry = "/projects/p-1/static-analysis") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
    mockFetchAnalysisStatus.mockRejectedValue(new Error("not running"));
    mockFetchAnalysisResults.mockResolvedValue({
      id: "analysis-1",
      projectId: "p-1",
      module: "deep_analysis",
      status: "completed",
      vulnerabilities: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      createdAt: "2026-04-14T00:00:00Z",
    });
    mockUseAnalysisWebSocket.mockReturnValue({ isRunning: false, reset: vi.fn(), startAnalysis: vi.fn(), resumeAnalysis: vi.fn(), analysisId: null, stage: null, message: '', quickFindingCount: 0, deepFindingCount: 0, error: null, errorPhase: null, retryable: false, targetName: null, targetProgress: null, connectionState: 'connected' });
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
    expect(await screen.findByText("AWAITING SOURCE")).toBeInTheDocument();
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

  it("updates the analysis guard blocking flag based on running state", async () => {
    mockUseAnalysisWebSocket.mockReturnValue({ isRunning: true, reset: vi.fn(), startAnalysis: vi.fn(), resumeAnalysis: vi.fn(), analysisId: null, stage: null, message: '', quickFindingCount: 0, deepFindingCount: 0, error: null, errorPhase: null, retryable: false, targetName: null, targetProgress: null, connectionState: 'connected' });
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });

    const { unmount } = renderPage();

    await waitFor(() => expect(mockSetBlocking).toHaveBeenCalledWith(true));
    unmount();
    expect(mockSetBlocking).toHaveBeenLastCalledWith(false);
  });

  it("recovers a completed analysis from the analysisId query parameter", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });

    renderPage("/projects/p-1/static-analysis?analysisId=analysis-1");

    expect(await screen.findByText("analysis-results-view")).toBeInTheDocument();
    expect(mockFetchAnalysisStatus).toHaveBeenCalledWith("analysis-1");
    expect(mockFetchAnalysisResults).toHaveBeenCalledWith("analysis-1");
  });

  it("resumes an in-flight analysis from the analysisId query parameter", async () => {
    const resumeAnalysis = vi.fn().mockResolvedValue(undefined);
    mockUseAnalysisWebSocket.mockReturnValue({ isRunning: false, reset: vi.fn(), startAnalysis: vi.fn(), resumeAnalysis, analysisId: "analysis-1", stage: "quick_sast", message: '', quickFindingCount: 0, deepFindingCount: 0, error: null, errorPhase: null, retryable: false, targetName: null, targetProgress: null, connectionState: 'connected' });
    mockFetchAnalysisStatus.mockResolvedValue({
      analysisId: "analysis-1",
      projectId: "p-1",
      buildTargetId: "t-1",
      executionId: "exec-1",
      status: "running",
      phase: "quick_sast",
      currentChunk: 0,
      totalChunks: 1,
      message: "running",
      startedAt: "2026-04-14T00:00:00Z",
      updatedAt: "2026-04-14T00:00:00Z",
    });
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });

    renderPage("/projects/p-1/static-analysis?analysisId=analysis-1");

    expect(await screen.findByText("two-stage-progress-view")).toBeInTheDocument();
    expect(resumeAnalysis).toHaveBeenCalledWith(
      "analysis-1",
      expect.objectContaining({ buildTargetId: "t-1", executionId: "exec-1", status: "running" }),
    );
  });

  it("opens finding detail from the finding query parameter", async () => {
    mockUseStaticDashboard.mockReturnValue({ loading: false, summary: { ok: true }, recentRuns: [], activeAnalysis: null, latestRunDetail: null, latestRunLoading: false, period: '7d', setPeriod: vi.fn(), refresh: vi.fn() });

    renderPage("/projects/p-1/static-analysis?finding=finding-1");

    expect(await screen.findByText("finding-detail-view")).toBeInTheDocument();
  });
});
