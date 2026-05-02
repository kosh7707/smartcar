import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/common/contexts/ToastContext";
import { VulnerabilityDetailView } from "@/common/ui/findings/VulnerabilityDetailView";
import { BackButton, Spinner } from "@/common/ui/primitives";
import { renderMarkdown } from "@/common/utils/markdown";
import { FileDetailAnalysisHistorySection } from "./components/FileDetailAnalysisHistorySection/FileDetailAnalysisHistorySection";
import { FileDetailHeader } from "./components/FileDetailHeader/FileDetailHeader";
import { FileDetailMissingState } from "./components/FileDetailMissingState/FileDetailMissingState";
import { FileDetailSourcePanel } from "./components/FileDetailSourcePanel/FileDetailSourcePanel";
import { FileDetailVulnerabilitiesSection } from "./components/FileDetailVulnerabilitiesSection/FileDetailVulnerabilitiesSection";
import { useFileDetailPageController } from "./useFileDetailPageController";
import "./FileDetailPage.css";

export const FileDetailPage: React.FC = () => {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightLine = Number.parseInt(searchParams.get("line") ?? "0", 10) || 0;
  const toast = useToast();
  const state = useFileDetailPageController(projectId, fileId, highlightLine, toast);

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
      <div className="page-loading-shell">
        <Spinner size={36} label="파일 정보 로딩 중..." />
      </div>
    );
  }

  if (!state.file) return <FileDetailMissingState />;

  return (
    <div className="page-shell">
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
          renderedPreview={renderMarkdown(state.sourceCode)}
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
