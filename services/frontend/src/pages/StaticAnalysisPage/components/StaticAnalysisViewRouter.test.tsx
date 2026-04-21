import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticAnalysisViewRouter } from "./StaticAnalysisViewRouter";

vi.mock("../../../shared/findings/FindingDetailView", () => ({
  FindingDetailView: () => <div>finding-detail-view</div>,
}));
vi.mock("./AnalysisResultsView", () => ({
  AnalysisResultsView: () => <div>analysis-results-view</div>,
}));
vi.mock("./RunDetailView", () => ({
  RunDetailView: () => <div>run-detail-view</div>,
}));
vi.mock("./StaticAnalysisUploadScreen", () => ({
  StaticAnalysisUploadScreen: () => <div>upload-screen</div>,
}));
vi.mock("./StaticAnalysisEmptyState", () => ({
  StaticAnalysisEmptyState: () => <div>empty-state</div>,
}));
vi.mock("./StaticDashboard", () => ({
  StaticDashboard: () => <div>dashboard-view</div>,
}));
vi.mock("./TargetSelectDialog", () => ({
  TargetSelectDialog: ({ open }: { open: boolean }) =>
    open ? <div>target-select-dialog</div> : null,
}));
vi.mock("./TwoStageProgressView", () => ({
  TwoStageProgressView: () => <div>progress-view</div>,
}));

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    projectId: "p-1",
    dashboard: {
      loading: false,
      summary: { ok: true },
      recentRuns: [],
      activeAnalysis: null,
      latestRunDetail: null,
      latestRunLoading: false,
      period: "7d",
      setPeriod: vi.fn(),
    },
    analysis: {
      analysisId: null,
      buildTargetId: null,
      executionId: null,
      stage: null,
      message: "",
      quickFindingCount: null,
      deepFindingCount: null,
      error: null,
      errorPhase: null,
      retryable: false,
      targetName: null,
      targetProgress: null,
      connectionState: "connected",
    },
    buildTargets: {
      targets: [],
    },
    state: {
      view: "dashboard",
      analysisResult: null,
      analysisResultLoading: false,
      selectedFindingId: null,
      setSelectedFindingId: vi.fn(),
      runDetail: null,
      setView: vi.fn(),
      runDetailLoading: false,
      goToDashboard: vi.fn(),
      handleSelectFinding: vi.fn(),
      handleRetry: vi.fn(),
      handleViewResults: vi.fn(),
      sourceFiles: [],
      findings: [],
      handleAnalysisStart: vi.fn(),
      handleBrowseTree: vi.fn(),
      handleDiscoverTargets: vi.fn(),
      handleNewAnalysis: vi.fn(),
      handleViewRun: vi.fn(),
      handleResumeAnalysis: vi.fn(),
      handleFileClick: vi.fn(),
      showTargetSelect: false,
      setShowTargetSelect: vi.fn(),
      handleAnalysisWithTargets: vi.fn(),
    },
    ...overrides,
  } as any;
}

describe("StaticAnalysisViewRouter", () => {
  it("renders the run-detail loading state", () => {
    render(
      <StaticAnalysisViewRouter
        {...makeProps({
          state: {
            ...makeProps().state,
            view: "runDetail",
            runDetailLoading: true,
          },
        })}
      />,
    );

    expect(screen.getByText("Run 로딩 중...")).toBeInTheDocument();
  });

  it("renders the analysis-results loading state", () => {
    render(
      <StaticAnalysisViewRouter
        {...makeProps({
          state: {
            ...makeProps().state,
            view: "analysisResults",
            analysisResultLoading: true,
          },
        })}
      />,
    );

    expect(screen.getByText("분석 결과 로딩 중...")).toBeInTheDocument();
  });

  it("renders the dashboard loading state", () => {
    render(
      <StaticAnalysisViewRouter
        {...makeProps({
          dashboard: {
            ...makeProps().dashboard,
            loading: true,
            summary: null,
          },
        })}
      />,
    );

    expect(screen.getByText("대시보드 로딩 중...")).toBeInTheDocument();
  });

  it("keeps the target select dialog available on the source upload view", () => {
    render(
      <StaticAnalysisViewRouter
        {...makeProps({
          state: {
            ...makeProps().state,
            view: "sourceUpload",
            showTargetSelect: true,
          },
          buildTargets: {
            targets: [{ id: "t-1", name: "target-1" }],
          },
        })}
      />,
    );

    expect(screen.getByText("upload-screen")).toBeInTheDocument();
    expect(screen.getByText("target-select-dialog")).toBeInTheDocument();
  });

});
