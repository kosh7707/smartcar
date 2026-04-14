import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { VulnerabilityDetailView } from "../../shared/findings/VulnerabilityDetailView";
import { BackButton, Spinner } from "../../shared/ui";
import { renderMarkdown } from "../../utils/markdown";
import { FileDetailAnalysisHistorySection } from "./components/FileDetailAnalysisHistorySection";
import { FileDetailHeader } from "./components/FileDetailHeader";
import { FileDetailMissingState } from "./components/FileDetailMissingState";
import { FileDetailSourcePanel } from "./components/FileDetailSourcePanel";
import { FileDetailVulnerabilitiesSection } from "./components/FileDetailVulnerabilitiesSection";
import { useFileDetailPage } from "./hooks/useFileDetailPage";
import "./FileDetailPage.css";

export const FileDetailPage: React.FC = () => {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightLine = Number.parseInt(searchParams.get("line") ?? "0", 10) || 0;
  const toast = useToast();
  const state = useFileDetailPage(projectId, fileId, highlightLine, toast);

  if (state.selectedVulnerability) {
    return (
      <VulnerabilityDetailView
        vulnerability={state.selectedVulnerability}
        projectId={projectId ?? ""}
        onBack={() => state.setSelectedVulnerability(null)}
      />
    );
  }

  if (state.loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="파일 정보 로딩 중..." />
      </div>
    );
  }

  if (!state.file) return <FileDetailMissingState />;

  return (
    <div className="page-enter file-detail-page">
      <BackButton onClick={() => navigate(-1)} label="뒤로" />

      <FileDetailHeader
        file={state.file}
        lineCount={state.serverLineCount ?? state.sourceLines.length}
        vulnerabilityCount={state.fileVulnerabilities.length}
        onDownload={state.handleDownload}
      />

      {state.sourceCode !== null && (
        <FileDetailSourcePanel
          fileName={state.file.name}
          fileLanguage={state.file.language}
          sourceCode={state.sourceCode}
          sourceLines={state.sourceLines}
          highlightedSourceLines={state.highlightedSourceLines}
          fileVulns={state.fileVulnerabilities}
          highlightLine={highlightLine}
          highlightRef={state.highlightRef}
          viewTab={state.viewTab}
          onViewTabChange={state.setViewTab}
          maximized={state.maximized}
          onToggleMaximized={() => state.setMaximized((current) => !current)}
          renderedPreview={
            <div className={`file-detail-md-preview${state.maximized ? " file-detail-md-preview--maximized" : ""}`}>
              {renderMarkdown(state.sourceCode)}
            </div>
          }
        />
      )}

      <FileDetailVulnerabilitiesSection
        vulnerabilities={state.fileVulnerabilities}
        onSelect={state.setSelectedVulnerability}
      />

      <FileDetailAnalysisHistorySection
        analyses={state.analyses}
        onOpenAnalysis={(analysisId) => navigate(`/projects/${projectId}/static-analysis?analysisId=${analysisId}`)}
      />
    </div>
  );
};
