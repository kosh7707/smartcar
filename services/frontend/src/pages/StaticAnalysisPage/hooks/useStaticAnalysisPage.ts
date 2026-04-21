import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult, Finding, RunDetailResponse, UploadedFile } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import {
  fetchAnalysisResults,
  fetchAnalysisStatus,
  fetchProjectFiles,
  fetchProjectFindings,
  fetchRunDetail,
  fetchSourceFiles,
  logError,
} from "../../../api/client";
import type { useAnalysisWebSocket } from "../../../hooks/useAnalysisWebSocket";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import type { useStaticDashboard } from "../../../hooks/useStaticDashboard";

type PageView =
  | "dashboard"
  | "sourceUpload"
  | "sourceTree"
  | "progress"
  | "analysisResults"
  | "runDetail"
  | "findingDetail";

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
};

type GuardApi = {
  setBlocking: (blocking: boolean) => void;
};

export function useStaticAnalysisPage(
  projectId: string | undefined,
  dashboard: ReturnType<typeof useStaticDashboard>,
  analysis: ReturnType<typeof useAnalysisWebSocket>,
  buildTargets: ReturnType<typeof useBuildTargets>,
  toast: ToastApi,
  guard: GuardApi,
  navigate: (to: string) => void,
  analysisIdParam?: string | null,
  findingIdParam?: string | null,
) {
  const [view, setView] = useState<PageView>("dashboard");
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisResultLoading, setAnalysisResultLoading] = useState(false);
  const [runDetail, setRunDetail] = useState<RunDetailResponse["data"] | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [showTargetSelect, setShowTargetSelect] = useState(false);

  useEffect(() => {
    guard.setBlocking(analysis.isRunning);
    return () => guard.setBlocking(false);
  }, [analysis.isRunning, guard]);

  const loadProjectFiles = useCallback(() => {
    if (!projectId) return;
    fetchProjectFiles(projectId)
      .catch(() => [] as UploadedFile[])
      .then(setProjectFiles);
  }, [projectId]);

  useEffect(() => {
    loadProjectFiles();
  }, [loadProjectFiles]);

  const loadSourceData = useCallback(() => {
    if (!projectId) return;
    fetchSourceFiles(projectId)
      .then(setSourceFiles)
      .catch(() => setSourceFiles([]));
    fetchProjectFindings(projectId)
      .then(setFindings)
      .catch(() => setFindings([]));
  }, [projectId]);

  useEffect(() => {
    loadSourceData();
  }, [loadSourceData]);

  const goToDashboard = useCallback(() => {
    setView("dashboard");
    setAnalysisResult(null);
    setRunDetail(null);
    setSelectedFindingId(null);
    setShowTargetSelect(false);
    analysis.reset();
    dashboard.refresh();
    loadSourceData();
    if (projectId) {
      navigate(`/projects/${projectId}/static-analysis`);
    }
  }, [analysis, dashboard, loadSourceData, navigate, projectId]);

  const handleViewRun = useCallback(async (runId: string) => {
    setRunDetailLoading(true);
    setView("runDetail");
    try {
      const detail = await fetchRunDetail(runId);
      setRunDetail(detail);
    } catch (error) {
      logError("Run detail load", error);
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

  const handleBrowseTree = useCallback(() => {
    setView("sourceTree");
  }, []);

  const handleDiscoverTargets = useCallback(async () => {
    try {
      const discovered = await buildTargets.discover();
      toast.success(`${discovered?.length ?? 0}개 빌드 타겟 발견`);
    } catch {
      toast.error("타겟 탐색에 실패했습니다.");
    }
  }, [buildTargets, toast]);

  const handleAnalysisStart = useCallback(() => {
    if (!projectId) return;
    if (buildTargets.targets.length === 0) {
      toast.warning("분석을 시작하려면 BuildTarget을 먼저 생성하세요.");
      return;
    }
    if (buildTargets.targets.length > 1) {
      setShowTargetSelect(true);
      return;
    }
    analysis.startAnalysis(projectId, buildTargets.targets[0]!.id);
    setView("progress");
  }, [analysis, buildTargets.targets, projectId, toast]);

  const handleAnalysisWithTargets = useCallback((selectedTargetId: string) => {
    if (!projectId) return;
    setShowTargetSelect(false);
    analysis.startAnalysis(projectId, selectedTargetId);
    setView("progress");
  }, [analysis, projectId]);

  const handleRetry = useCallback(() => {
    if (!projectId || !analysis.buildTargetId) return;
    analysis.startAnalysis(projectId, analysis.buildTargetId);
  }, [analysis, projectId]);

  const handleResumeAnalysis = useCallback(() => {
    if (analysis.isRunning) setView("progress");
  }, [analysis.isRunning]);

  const handleFileClick = useCallback((filePath: string) => {
    if (filePath === "기타") {
      toast.warning("위치가 특정되지 않은 Finding입니다.");
      return;
    }

    const matched = projectFiles.find((file) => file.path === filePath || file.name === filePath);
    if (matched) {
      navigate(`/projects/${projectId}/files/${matched.id}`);
    } else {
      toast.warning(`파일을 찾을 수 없습니다: ${filePath}`);
    }
  }, [navigate, projectFiles, projectId, toast]);

  useEffect(() => {
    if (!findingIdParam || analysisIdParam) return;
    setSelectedFindingId(findingIdParam);
    setView("findingDetail");
  }, [analysisIdParam, findingIdParam]);

  useEffect(() => {
    if (!projectId || !analysisIdParam) return;

    let cancelled = false;

    const recoverAnalysis = async () => {
      setAnalysisResultLoading(true);
      setAnalysisResult(null);
      try {
        try {
          const status = await fetchAnalysisStatus(analysisIdParam);
          if (cancelled) return;

          if (status.status === "running") {
            await analysis.resumeAnalysis(analysisIdParam, status);
            if (!cancelled) {
              setView("progress");
            }
            return;
          }
        } catch (error) {
          logError("Analysis status recovery", error);
        }

        try {
          const result = await fetchAnalysisResults(analysisIdParam);
          if (cancelled) return;
          setAnalysisResult(result);
          setView("analysisResults");
        } catch (error) {
          logError("Analysis result recovery", error);
          if (!cancelled) {
            toast.error("분석 결과를 복구할 수 없습니다.");
            navigate(`/projects/${projectId}/static-analysis`);
          }
        }
      } finally {
        if (!cancelled) {
          setAnalysisResultLoading(false);
        }
      }
    };

    void recoverAnalysis();

    return () => {
      cancelled = true;
    };
  }, [analysis, analysisIdParam, navigate, projectId, toast]);

  return {
    view,
    setView,
    projectFiles,
    sourceFiles,
    findings,
    analysisResult,
    analysisResultLoading,
    runDetail,
    selectedFindingId,
    setSelectedFindingId,
    runDetailLoading,
    showTargetSelect,
    setShowTargetSelect,
    goToDashboard,
    handleViewRun,
    handleSelectFinding,
    handleNewAnalysis,
    handleBrowseTree,
    handleDiscoverTargets,
    handleAnalysisStart,
    handleAnalysisWithTargets,
    handleRetry,
    handleViewResults: goToDashboard,
    handleResumeAnalysis,
    handleFileClick,
  };
}
