import React from "react";
import { ExternalLink, FileText, Sparkles, X } from "lucide-react";

type PreviewPanelMode = "preview" | "insights";

interface FilesPreviewPanelHeaderProps {
  mode: PreviewPanelMode;
  selectedPath: string | null;
  previewLang: string;
  onClosePreview: () => void;
  onOpenInDetail: (path: string) => void;
}

export const FilesPreviewPanelHeader: React.FC<FilesPreviewPanelHeaderProps> = ({
  mode,
  selectedPath,
  previewLang,
  onClosePreview,
  onOpenInDetail,
}) => {
  if (mode === "preview" && selectedPath) {
    return (
      <div className="panel-head files-workspace-preview-head">
        <div className="panel-body">
          <FileText size={14} />
          <h3 className="panel-title files-workspace-preview-title">{selectedPath}</h3>
          {previewLang ? (
            <span className="files-workspace-preview-lang">{previewLang}</span>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm files-workspace-preview-action"
            onClick={() => onOpenInDetail(selectedPath)}
            title="상세 페이지로 열기"
            aria-label="상세 페이지로 열기"
          >
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm files-workspace-preview-action"
            onClick={onClosePreview}
            title="미리보기 닫기"
            aria-label="미리보기 닫기"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-head files-workspace-insights-head">
      <div className="panel-body">
        <Sparkles size={14} className="files-workspace-insights-head__icon" />
        <h3 className="panel-title files-workspace-insights-title">Manifest Insights</h3>
      </div>
    </div>
  );
};
