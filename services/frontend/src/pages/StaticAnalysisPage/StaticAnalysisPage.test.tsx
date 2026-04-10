import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StaticAnalysisPage } from "./StaticAnalysisPage";

const mockUseStaticDashboard = vi.fn();
const mockUseAnalysisWebSocket = vi.fn();
const mockUseBuildTargets = vi.fn();
const mockSetBlocking = vi.fn();

vi.mock("../../hooks/useStaticDashboard", () => ({ useStaticDashboard: (...args: unknown[]) => mockUseStaticDashboard(...args) }));
vi.mock("../../hooks/useAnalysisWebSocket", () => ({ useAnalysisWebSocket: () => mockUseAnalysisWebSocket() }));
vi.mock("../../hooks/useBuildTargets", () => ({ useBuildTargets: (...args: unknown[]) => mockUseBuildTargets(...args) }));
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));
vi.mock("../../contexts/AnalysisGuardContext", () => ({ useSetAnalysisGuard: () => ({ setBlocking: mockSetBlocking }) }));
vi.mock("../../api/client", () => ({
  fetchProjectFiles: vi.fn(() => Promise.resolve([])),
  fetchProjectFindings: vi.fn(() => Promise.resolve([])),
  fetchSourceFiles: vi.fn(() => Promise.resolve([])),
  fetchRunDetail: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("./components/SourceUploadView", () => ({ SourceUploadView: () => <div>source-upload-view</div> }));
vi.mock("./components/SourceTreeView", () => ({ SourceTreeView: () => <div>source-tree-view</div> }));
vi.mock("./components/StaticDashboard", () => ({ StaticDashboard: () => <div>static-dashboard-view</div> }));
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
    mockUseAnalysisWebSocket.mockReturnValue({ isRunning: false, reset: vi.fn(), startAnalysis: vi.fn(), analysisId: null, stage: null, message: '', quickFindingCount: 0, deepFindingCount: 0, error: null, errorPhase: null, retryable: false, targetName: null, targetProgress: null, connectionState: 'connected' });
    mockUseBuildTargets.mockReturnValue({ targets: [], discover: vi.fn(() => Promise.resolve([])) });
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
});
