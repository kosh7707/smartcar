import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { AnalysisResult, UploadedFile } from "@smartcar/shared";
import { FileSearch, Plus, Trash2, FolderSearch, ListChecks } from "lucide-react";
import { useStaticAnalysis } from "../hooks/useStaticAnalysis";
import { fetchAnalysisResults, fetchAnalysisResult, deleteAnalysisResult, fetchProjectFiles, ApiError } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { FileUploadView } from "../components/static/FileUploadView";
import { AnalysisProgressView } from "../components/static/AnalysisProgressView";
import { AnalysisResultsView } from "../components/static/AnalysisResultsView";
import { VulnerabilityDetailView } from "../components/static/VulnerabilityDetailView";
import { PageHeader, EmptyState, ConfirmDialog, SeveritySummary, ListItem, BackButton, Spinner } from "../components/ui";
import { extractFiles } from "../utils/analysis";
import { formatDateTime } from "../utils/format";
import "./StaticAnalysisPage.css";

export const StaticAnalysisPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const analysis = useStaticAnalysis(projectId!);
  const toast = useToast();

  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [viewingResult, setViewingResult] = useState<AnalysisResult | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [projectFiles, setProjectFiles] = useState<UploadedFile[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<AnalysisResult | null>(null);

  const loadHistory = () => {
    Promise.all([
      fetchAnalysisResults(projectId!),
      fetchProjectFiles(projectId!).catch(() => [] as UploadedFile[]),
    ])
      .then(([analyses, files]) => {
        setHistory(analyses.filter(a => a.module === "static_analysis"));
        setProjectFiles(files);
      })
      .catch((e) => {
        console.error("Failed to load history:", e);
        const retry = e instanceof ApiError && e.retryable ? { label: "다시 시도", onClick: loadHistory } : undefined;
        toast.error(e instanceof Error ? e.message : "분석 이력을 불러올 수 없습니다.", retry);
      })
      .finally(() => setHistoryLoading(false));
  };

  const handleDeleteAnalysis = async (a: AnalysisResult) => {
    try {
      await deleteAnalysisResult(a.id);
      setHistory((prev) => prev.filter((h) => h.id !== a.id));
    } catch (e) {
      console.error("Delete analysis failed:", e);
      toast.error("분석 이력 삭제에 실패했습니다.");
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  useEffect(() => {
    const analysisId = searchParams.get("analysisId");
    if (analysisId) {
      fetchAnalysisResult(analysisId)
        .then(setViewingResult)
        .catch((e) => { console.error("Failed to load analysis:", e); toast.error("분석 결과를 불러올 수 없습니다."); });
    } else {
      setViewingResult(null);
    }
  }, [searchParams]);

  const handleNewAnalysisComplete = () => {
    analysis.reset();
    setShowModeSelect(false);
    setShowUpload(false);
    loadHistory();
  };

  const handleRunFullProject = () => {
    analysis.setAllExisting(projectFiles);
    setShowModeSelect(false);
    analysis.runAnalysis(projectFiles);
  };

  // Viewing existing result
  if (viewingResult) {
    if (analysis.selectedVuln) {
      return (
        <VulnerabilityDetailView
          vulnerability={analysis.selectedVuln}
          projectId={projectId!}
          onBack={() => analysis.setSelectedVuln(null)}
        />
      );
    }
    return (
      <AnalysisResultsView
        result={viewingResult}
        onSelectVuln={analysis.setSelectedVuln}
        onNewAnalysis={() => { setSearchParams({}); setViewingResult(null); }}
      />
    );
  }

  // New analysis in progress
  if (analysis.view !== "upload") {
    if (analysis.selectedVuln) {
      return (
        <VulnerabilityDetailView
          vulnerability={analysis.selectedVuln}
          projectId={projectId!}
          onBack={() => analysis.setSelectedVuln(null)}
        />
      );
    }

    if (analysis.view === "progress") {
      return (
        <AnalysisProgressView
          progress={analysis.progress}
          step={analysis.progressStep}
        />
      );
    }

    if (analysis.view === "results" && analysis.result) {
      return (
        <AnalysisResultsView
          result={analysis.result}
          onSelectVuln={analysis.setSelectedVuln}
          onNewAnalysis={handleNewAnalysisComplete}
        />
      );
    }
  }

  // Mode selection view
  if (showModeSelect) {
    return (
      <div className="page-enter">
        <BackButton onClick={() => { setShowModeSelect(false); analysis.reset(); }} label="이력으로" />
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
            onClick={() => { setShowModeSelect(false); setShowUpload(true); }}
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

  // Upload view (manual file selection)
  if (showUpload) {
    return (
      <div className="page-enter">
        <BackButton onClick={() => { setShowUpload(false); setShowModeSelect(true); }} label="모드 선택으로" />
        <FileUploadView
          existingFiles={projectFiles}
          selectedExisting={analysis.selectedExisting}
          onToggleExisting={analysis.toggleExistingFile}
          onSelectAll={() => analysis.setAllExisting(projectFiles)}
          files={analysis.files}
          onAddFiles={analysis.addFiles}
          onRemoveFile={analysis.removeFile}
          onStartAnalysis={analysis.runAnalysis}
        />
      </div>
    );
  }

  // Default: history list
  return (
    <div className="page-enter">
      <PageHeader
        title="정적 분석"
        icon={<FileSearch size={20} />}
        action={
          <button className="btn" onClick={() => setShowModeSelect(true)}>
            <Plus size={16} />
            새 분석
          </button>
        }
      />

      {historyLoading ? (
        <div className="centered-loader--compact">
          <Spinner label="이력 로딩 중..." />
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          icon={<FileSearch size={28} />}
          title="아직 분석 이력이 없습니다"
          description="파일을 업로드하고 보안 분석을 시작하세요"
          action={<button className="btn" onClick={() => setShowModeSelect(true)}>첫 분석 시작</button>}
        />
      ) : (
        <div className="card">
          {history.map((a) => {
            const files = extractFiles(a);
            return (
              <ListItem
                key={a.id}
                onClick={() => setSearchParams({ analysisId: a.id })}
                trailing={
                  <>
                    <span className="analysis-item__time">{formatDateTime(a.createdAt)}</span>
                    <button
                      className="btn-icon btn-danger analysis-item__delete"
                      title="삭제"
                      onClick={(e) => { e.stopPropagation(); setConfirmTarget(a); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                }
              >
                <div>
                  <div className="analysis-item__header">
                    <span className="analysis-item__badge analysis-item__badge--static">
                      <FileSearch size={11} />
                      정적 분석
                    </span>
                    <span className="analysis-item__stat">
                      취약점 {a.summary.total - (a.summary.info ?? 0)}건
                    </span>
                    <SeveritySummary summary={a.summary} />
                  </div>
                  {files.length > 0 && (
                    <div className="analysis-item__sub">{files.join(", ")}</div>
                  )}
                </div>
              </ListItem>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="분석 이력 삭제"
        message={confirmTarget ? `이 분석 이력을 삭제하시겠습니까? (취약점 ${confirmTarget.summary.total}건)` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => { if (confirmTarget) handleDeleteAnalysis(confirmTarget); setConfirmTarget(null); }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};
