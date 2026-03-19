import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type { AnalysisResult, UploadedFile } from "@aegis/shared";
import type { RunDetailResponse } from "@aegis/shared";
import { FileSearch } from "lucide-react";
import { useStaticDashboard } from "../hooks/useStaticDashboard";
import { useAnalysisWebSocket } from "../hooks/useAnalysisWebSocket";
import {
  fetchAnalysisResult,
  fetchProjectFiles,
  fetchRunDetail,
  logError,
} from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { useSetAnalysisGuard } from "../contexts/AnalysisGuardContext";
import { SourceUploadView } from "../components/static/SourceUploadView";
import { AnalysisResultsView } from "../components/static/AnalysisResultsView";
import { VulnerabilityDetailView } from "../components/static/VulnerabilityDetailView";
import { StaticDashboard } from "../components/static/StaticDashboard";
import { TwoStageProgressView } from "../components/static/TwoStageProgressView";
import { RunDetailView } from "../components/static/RunDetailView";
import { FindingDetailView } from "../components/static/FindingDetailView";
import { PageHeader, BackButton, Spinner } from "../components/ui";
import "./StaticAnalysisPage.css";

type PageView =
  | "dashboard"
  | "sourceUpload"
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

  // Hooks
  const dashboard = useStaticDashboard(projectId);
  const analysis = useAnalysisWebSocket();

  // View routing
  const [view, setView] = useState<PageView>("dashboard");
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [viewingResult, setViewingResult] = useState<AnalysisResult | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<AnalysisResult["vulnerabilities"][0] | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetailResponse["data"] | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);

  // Navigation guard: block when analysis is running
  useEffect(() => {
    setBlocking(analysis.isRunning);
    return () => setBlocking(false);
  }, [analysis.isRunning, setBlocking]);

  // Load project files
  const loadProjectFiles = useCallback(() => {
    if (!projectId) return;
    fetchProjectFiles(projectId)
      .catch(() => [] as UploadedFile[])
      .then(setProjectFiles);
  }, [projectId]);

  useEffect(() => { loadProjectFiles(); }, [loadProjectFiles]);

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
    setSelectedVuln(null);
    setRunDetail(null);
    setSelectedFindingId(null);
    analysis.reset();
    dashboard.refresh();
  }, [setSearchParams, analysis, dashboard]);

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
    setView("sourceUpload");
  }, []);

  const handleAnalysisStart = useCallback(() => {
    if (!projectId) return;
    analysis.startAnalysis(projectId);
    setView("progress");
  }, [projectId, analysis]);

  const handleRetry = useCallback(() => {
    if (!projectId) return;
    analysis.startAnalysis(projectId);
  }, [projectId, analysis]);

  const handleViewResults = useCallback(() => {
    goToDashboard();
  }, [goToDashboard]);

  const handleResumeAnalysis = useCallback(() => {
    if (analysis.isRunning) {
      setView("progress");
    }
  }, [analysis.isRunning]);

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
    if (selectedVuln) {
      return (
        <VulnerabilityDetailView
          vulnerability={selectedVuln}
          projectId={projectId}
          onBack={() => setSelectedVuln(null)}
        />
      );
    }
    return (
      <AnalysisResultsView
        result={viewingResult}
        onSelectVuln={setSelectedVuln}
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

  // Progress view (WebSocket 2-stage)
  if (view === "progress") {
    return (
      <TwoStageProgressView
        analysisId={analysis.analysisId}
        stage={analysis.stage}
        message={analysis.message}
        quickFindingCount={analysis.quickFindingCount}
        deepFindingCount={analysis.deepFindingCount}
        error={analysis.error}
        errorPhase={analysis.errorPhase}
        retryable={analysis.retryable}
        onRetry={handleRetry}
        onViewResults={handleViewResults}
        onBack={goToDashboard}
      />
    );
  }

  // Source upload
  if (view === "sourceUpload") {
    return (
      <div className="page-enter">
        <BackButton onClick={goToDashboard} label="대시보드로" />
        <PageHeader title="소스코드 업로드" icon={<FileSearch size={20} />} />
        <SourceUploadView
          projectId={projectId}
          onAnalysisStart={handleAnalysisStart}
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
      onAbortAnalysis={goToDashboard}
      onFileClick={handleFileClick}
    />
  );
};
