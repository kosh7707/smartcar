import React from "react";
import { BackButton, ConnectionStatusBanner, Spinner } from "../../../shared/ui";
import { FindingDetailView } from "../../../shared/findings/FindingDetailView";
import { AnalysisResultsView } from "./AnalysisResultsView";
import { RunDetailView } from "./RunDetailView";
import { SourceTreeView } from "./SourceTreeView";
import { StaticAnalysisUploadScreen } from "./StaticAnalysisUploadScreen";
import { StaticAnalysisEmptyState } from "./StaticAnalysisEmptyState";
import { StaticDashboard } from "./StaticDashboard";
import { TargetSelectDialog } from "./TargetSelectDialog";
import { TwoStageProgressView } from "./TwoStageProgressView";

type StaticAnalysisViewRouterProps = {
  projectId: string;
  dashboard: {
    loading: boolean;
    summary: unknown;
    recentRuns: unknown[];
    activeAnalysis: unknown;
    latestRunDetail: unknown;
    latestRunLoading: boolean;
    period: string;
    setPeriod: (period: never) => void;
  };
  analysis: {
    analysisId: string | null;
    buildTargetId?: string | null;
    executionId?: string | null;
    stage: unknown;
    message: string;
    quickFindingCount: number | null;
    deepFindingCount: number | null;
    error: string | null;
    errorPhase: "quick" | "deep" | null;
    retryable: boolean;
    targetName: string | null;
    targetProgress: { current: number; total: number } | null;
    connectionState: string;
  };
  buildTargets: {
    targets: unknown[];
  };
  state: {
    view: string;
    analysisResult: unknown;
    analysisResultLoading: boolean;
    selectedFindingId: string | null;
    setSelectedFindingId: (value: string | null) => void;
    runDetail: unknown;
    setView: (view: never) => void;
    runDetailLoading: boolean;
    goToDashboard: () => void;
    handleSelectFinding: (findingId: string) => void;
    handleRetry: () => void;
    handleViewResults: () => void;
    sourceFiles: unknown[];
    findings: unknown[];
    handleAnalysisStart: () => void;
    handleBrowseTree: () => void;
    handleDiscoverTargets: () => void;
    handleNewAnalysis: () => void;
    handleViewRun: (runId: string) => void;
    handleResumeAnalysis: () => void;
    handleFileClick: (filePath: string) => void;
    showTargetSelect: boolean;
    setShowTargetSelect: (open: boolean) => void;
    handleAnalysisWithTargets: (selectedTargetId: string) => void;
  };
};

export function StaticAnalysisViewRouter({
  projectId,
  dashboard,
  analysis,
  buildTargets,
  state,
}: StaticAnalysisViewRouterProps) {
  if (state.view === "findingDetail" && state.selectedFindingId) {
    return (
      <FindingDetailView
        findingId={state.selectedFindingId}
        projectId={projectId}
        onBack={() => {
          state.setSelectedFindingId(null);
          state.setView((state.runDetail ? "runDetail" : "dashboard") as never);
        }}
      />
    );
  }

  if (state.view === "runDetail") {
    if (state.runDetailLoading || !state.runDetail) {
      return (
        <div className="page-enter">
          <BackButton onClick={state.goToDashboard} label="대시보드로" />
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
            <Spinner label="Run 로딩 중..." />
          </div>
        </div>
      );
    }

    return (
      <RunDetailView
        runDetail={state.runDetail as never}
        analysisResult={null}
        projectId={projectId}
        onBack={state.goToDashboard}
        onSelectFinding={state.handleSelectFinding}
        onViewLegacyResult={() => {}}
      />
    );
  }

  if (state.view === "progress") {
    return (
      <TwoStageProgressView
        analysisId={analysis.analysisId}
        buildTargetId={analysis.buildTargetId}
        executionId={analysis.executionId}
        stage={analysis.stage as never}
        message={analysis.message}
        quickFindingCount={analysis.quickFindingCount}
        deepFindingCount={analysis.deepFindingCount}
        error={analysis.error}
        errorPhase={analysis.errorPhase}
        retryable={analysis.retryable}
        targetName={analysis.targetName}
        targetProgress={analysis.targetProgress}
        onRetry={state.handleRetry}
        onViewResults={state.handleViewResults}
        onBack={state.goToDashboard}
      />
    );
  }

  if (state.view === "analysisResults") {
    if (state.analysisResultLoading || !state.analysisResult) {
      return (
        <div className="page-enter">
          <BackButton onClick={state.goToDashboard} label="대시보드로" />
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
            <Spinner label="분석 결과 로딩 중..." />
          </div>
        </div>
      );
    }

    return (
      <AnalysisResultsView
        result={state.analysisResult as never}
        onSelectVuln={(vuln) => state.handleSelectFinding(vuln.id)}
        onNewAnalysis={state.goToDashboard}
      />
    );
  }

  if (state.view === "sourceTree") {
    return (
      <div className="page-enter">
        <BackButton onClick={state.goToDashboard} label="대시보드로" />
        <SourceTreeView
          projectId={projectId}
          sourceFiles={state.sourceFiles as never}
          findings={state.findings as never}
          onAnalysisStart={state.handleAnalysisStart}
          onReupload={() => state.setView("sourceUpload" as never)}
          onSelectFinding={state.handleSelectFinding}
        />
      </div>
    );
  }

  if (state.view === "sourceUpload") {
    return (
      <StaticAnalysisUploadScreen
        projectId={projectId}
        onBack={state.goToDashboard}
        onAnalysisStart={state.handleAnalysisStart}
        onBrowseTree={state.handleBrowseTree}
        onDiscoverTargets={state.handleDiscoverTargets}
      />
    );
  }

  if (dashboard.loading) {
    return (
      <div className="page-enter">
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
          <Spinner label="대시보드 로딩 중..." />
        </div>
      </div>
    );
  }

  if (!dashboard.summary) {
    return <StaticAnalysisEmptyState onUpload={() => state.setView("sourceUpload" as never)} />;
  }

  return (
    <>
      <ConnectionStatusBanner connectionState={analysis.connectionState} />
      <StaticDashboard
        projectId={projectId}
        summary={dashboard.summary as never}
        recentRuns={dashboard.recentRuns as never}
        activeAnalysis={dashboard.activeAnalysis as never}
        latestRunDetail={dashboard.latestRunDetail as never}
        latestRunLoading={dashboard.latestRunLoading}
        period={dashboard.period as never}
        onPeriodChange={dashboard.setPeriod}
        onNewAnalysis={state.handleNewAnalysis}
        onViewRun={state.handleViewRun}
        onSelectFinding={state.handleSelectFinding}
        onResumeAnalysis={state.handleResumeAnalysis}
        onAbortAnalysis={state.goToDashboard}
        onFileClick={state.handleFileClick}
        onBrowseTree={state.sourceFiles.length > 0 ? state.handleBrowseTree : undefined}
      />

      <TargetSelectDialog
        open={state.showTargetSelect}
        targets={buildTargets.targets as never}
        onConfirm={state.handleAnalysisWithTargets}
        onCancel={() => state.setShowTargetSelect(false)}
      />
    </>
  );
}
