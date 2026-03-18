import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type { AnalysisResult, UploadedFile } from "@smartcar/shared";
import type { RunDetailResponse } from "@smartcar/shared";
import { FileSearch, FolderSearch, ListChecks } from "lucide-react";
import { useStaticAnalysis } from "../hooks/useStaticAnalysis";
import { useStaticDashboard } from "../hooks/useStaticDashboard";
import { useAsyncAnalysis } from "../hooks/useAsyncAnalysis";
import {
  fetchAnalysisResult,
  fetchProjectFiles,
  fetchRunDetail,
  ApiError,
  logError,
} from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { useSetAnalysisGuard } from "../contexts/AnalysisGuardContext";
import { FileUploadView } from "../components/static/FileUploadView";
import { AnalysisResultsView } from "../components/static/AnalysisResultsView";
import { VulnerabilityDetailView } from "../components/static/VulnerabilityDetailView";
import { StaticDashboard } from "../components/static/StaticDashboard";
import { AsyncAnalysisProgressView } from "../components/static/AsyncAnalysisProgressView";
import { RunDetailView } from "../components/static/RunDetailView";
import { FindingDetailView } from "../components/static/FindingDetailView";
import { PageHeader, BackButton, Spinner, ConfirmDialog } from "../components/ui";
import "./StaticAnalysisPage.css";

type DashboardView =
  | "dashboard"
  | "modeSelect"
  | "upload"
  | "progress"
  | "runDetail"
  | "findingDetail"
  | "legacyResult";

export const StaticAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setBlocking } = useSetAnalysisGuard();

  // Legacy sync analysis hook (for mode select flow compat)
  const legacyAnalysis = useStaticAnalysis(projectId);

  // New hooks
  const dashboard = useStaticDashboard(projectId);
  const asyncAnalysis = useAsyncAnalysis(projectId);

  // View routing
  const [view, setView] = useState<DashboardView>("dashboard");
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [viewingResult, setViewingResult] = useState<AnalysisResult | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetailResponse["data"] | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  // Navigation guard: block when async analysis is running
  const isRunning = view === "progress" && !!asyncAnalysis.progress;
  useEffect(() => {
    setBlocking(isRunning);
    return () => setBlocking(false);
  }, [isRunning, setBlocking]);

  // Load project files for mode select
  const loadProjectFiles = useCallback(() => {
    if (!projectId) return;
    fetchProjectFiles(projectId)
      .catch((e) => {
        logError("Load project files", e);
        return [] as UploadedFile[];
      })
      .then(setProjectFiles);
  }, [projectId]);

  useEffect(() => {
    loadProjectFiles();
  }, [loadProjectFiles]);

  // Handle ?analysisId= legacy URL
  useEffect(() => {
    const analysisId = searchParams.get("analysisId");
    if (analysisId) {
      fetchAnalysisResult(analysisId)
        .then((result) => {
          setViewingResult(result);
          setView("legacyResult");
        })
        .catch((e) => {
          logError("Load analysis", e);
          toast.error("분석 결과를 불러올 수 없습니다.");
        });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation helpers
  const goToDashboard = useCallback(() => {
    setView("dashboard");
    setSearchParams({});
    setViewingResult(null);
    setRunDetail(null);
    setSelectedFindingId(null);
    legacyAnalysis.reset();
    asyncAnalysis.reset();
    dashboard.refresh();
  }, [setSearchParams, legacyAnalysis, asyncAnalysis, dashboard]);

  const handleViewRun = useCallback(async (runId: string) => {
    setRunDetailLoading(true);
    setView("runDetail");
    try {
      const detail = await fetchRunDetail(runId);
      setRunDetail(detail);
    } catch (e) {
      logError("Run detail load", e);
      toast.error("Run 상세를 불러올 수 없습니다.");
      setView("dashboard");
    } finally {
      setRunDetailLoading(false);
    }
  }, [toast]);

  const handleSelectFinding = useCallback((findingId: string) => {
    setSelectedFindingId(findingId);
    setView("findingDetail");
  }, []);

  const handleNewAnalysis = useCallback(() => {
    loadProjectFiles();
    setView("modeSelect");
  }, [loadProjectFiles]);

  const handleRunFullProject = useCallback(() => {
    asyncAnalysis.setAllExisting(projectFiles);
    if (!projectId) return;
    asyncAnalysis.startAnalysis(projectId, projectFiles);
    setView("progress");
  }, [asyncAnalysis, projectFiles, projectId]);

  const handleStartFromUpload = useCallback(() => {
    const allExisting = asyncAnalysis.selectedExisting;
    if (!projectId) return;
    asyncAnalysis.startAnalysis(projectId, allExisting);
    setView("progress");
  }, [asyncAnalysis, projectId]);

  const handleAbortAnalysis = useCallback(async () => {
    await asyncAnalysis.abortAnalysis(dashboard.activeAnalysis?.analysisId);
    setShowAbortConfirm(false);
    dashboard.refresh();
  }, [asyncAnalysis, dashboard]);

  const handleResumeAnalysis = useCallback(() => {
    if (asyncAnalysis.progress) {
      setView("progress");
    }
  }, [asyncAnalysis.progress]);

  const handleAnalysisViewResult = useCallback(() => {
    // When async analysis completes, refresh dashboard and go back
    goToDashboard();
  }, [goToDashboard]);

  const handleViewLegacyResult = useCallback((analysisResultId: string) => {
    setSearchParams({ analysisId: analysisResultId });
  }, [setSearchParams]);

  const handleFileClick = useCallback((filePath: string) => {
    if (filePath === "기타") {
      toast.warning("위치가 특정되지 않은 Finding입니다.");
      return;
    }
    const matched = projectFiles.find(
      (f) => f.path === filePath || f.name === filePath,
    );
    if (matched) {
      navigate(`/projects/${projectId}/files/${matched.id}`);
    } else {
      toast.warning(`파일을 찾을 수 없습니다: ${filePath}`);
    }
  }, [projectFiles, projectId, navigate, toast]);

  // ── Render by view ──

  if (!projectId) return null;

  // Legacy result view (?analysisId= compat)
  if (view === "legacyResult" && viewingResult) {
    if (legacyAnalysis.selectedVuln) {
      return (
        <VulnerabilityDetailView
          vulnerability={legacyAnalysis.selectedVuln}
          projectId={projectId}
          onBack={() => legacyAnalysis.setSelectedVuln(null)}
        />
      );
    }
    return (
      <AnalysisResultsView
        result={viewingResult}
        onSelectVuln={legacyAnalysis.setSelectedVuln}
        onNewAnalysis={goToDashboard}
      />
    );
  }

  // Finding detail
  if (view === "findingDetail" && selectedFindingId) {
    return (
      <FindingDetailView
        findingId={selectedFindingId}
        projectId={projectId}
        onBack={() => {
          setSelectedFindingId(null);
          setView(runDetail ? "runDetail" : "dashboard");
        }}
      />
    );
  }

  // Run detail
  if (view === "runDetail") {
    if (runDetailLoading || !runDetail) {
      return (
        <div className="page-enter">
          <BackButton onClick={goToDashboard} label="대시보드로" />
          <div className="centered-loader--compact">
            <Spinner label="Run 로딩 중..." />
          </div>
        </div>
      );
    }
    return (
      <RunDetailView
        runDetail={runDetail}
        projectId={projectId}
        onBack={goToDashboard}
        onSelectFinding={handleSelectFinding}
        onViewLegacyResult={handleViewLegacyResult}
      />
    );
  }

  // Async progress
  if (view === "progress" && asyncAnalysis.progress) {
    return (
      <AsyncAnalysisProgressView
        progress={asyncAnalysis.progress}
        onAbort={handleAbortAnalysis}
        onViewResult={handleAnalysisViewResult}
        onBack={goToDashboard}
      />
    );
  }

  // Mode selection
  if (view === "modeSelect") {
    return (
      <div className="page-enter">
        <BackButton onClick={goToDashboard} label="대시보드로" />
        <PageHeader title="새 정적 분석" icon={<FileSearch size={20} />} />
        <div className="static-mode-cards">
          <div
            className="card card--interactive static-mode-card"
            onClick={projectFiles.length > 0 ? handleRunFullProject : undefined}
            style={projectFiles.length === 0 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            <FolderSearch size={28} className="static-mode-card__icon" />
            <h3 className="static-mode-card__title">프로젝트 전체 분석</h3>
            <p className="static-mode-card__desc">
              업로드된 {projectFiles.length}개 파일 전체를 분석합니다
            </p>
          </div>
          <div
            className="card card--interactive static-mode-card"
            onClick={() => setView("upload")}
          >
            <ListChecks size={28} className="static-mode-card__icon" />
            <h3 className="static-mode-card__title">수동 파일 지정</h3>
            <p className="static-mode-card__desc">
              분석할 파일을 직접 선택하거나 새로 업로드합니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Upload view
  if (view === "upload") {
    return (
      <div className="page-enter">
        <BackButton onClick={() => setView("modeSelect")} label="모드 선택으로" />
        <FileUploadView
          existingFiles={projectFiles}
          selectedExisting={asyncAnalysis.selectedExisting}
          onToggleExisting={asyncAnalysis.toggleExistingFile}
          onSelectAll={() => asyncAnalysis.setAllExisting(projectFiles)}
          files={asyncAnalysis.files}
          onAddFiles={asyncAnalysis.addFiles}
          onRemoveFile={asyncAnalysis.removeFile}
          onStartAnalysis={handleStartFromUpload}
        />
      </div>
    );
  }

  // Default: Dashboard
  if (dashboard.loading) {
    return (
      <div className="page-enter">
        <div className="centered-loader--compact">
          <Spinner label="대시보드 로딩 중..." />
        </div>
      </div>
    );
  }

  if (!dashboard.summary) {
    return (
      <div className="page-enter">
        <PageHeader title="정적 분석" icon={<FileSearch size={20} />} />
        <div className="card card--empty">
          <p className="text-tertiary">대시보드 데이터를 불러올 수 없습니다.</p>
          <button className="btn btn-secondary" onClick={dashboard.refresh}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StaticDashboard
        projectId={projectId}
        summary={dashboard.summary}
        recentRuns={dashboard.recentRuns}
        activeAnalysis={dashboard.activeAnalysis}
        latestRunDetail={dashboard.latestRunDetail}
        latestRunLoading={dashboard.latestRunLoading}
        period={dashboard.period}
        onPeriodChange={dashboard.setPeriod}
        onNewAnalysis={handleNewAnalysis}
        onViewRun={handleViewRun}
        onSelectFinding={handleSelectFinding}
        onResumeAnalysis={handleResumeAnalysis}
        onAbortAnalysis={() => setShowAbortConfirm(true)}
        onFileClick={handleFileClick}
      />

      <ConfirmDialog
        open={showAbortConfirm}
        title="분석 중단"
        message="진행 중인 분석을 중단하시겠습니까?"
        confirmLabel="중단"
        danger
        onConfirm={handleAbortAnalysis}
        onCancel={() => setShowAbortConfirm(false)}
      />
    </>
  );
};
