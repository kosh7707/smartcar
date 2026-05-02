import "./FilesPreviewBody.css";
import React from "react";
import type { Finding, Severity } from "@aegis/shared";
import type { SourceFileEntry, TargetMappingEntry } from "@/common/api/client";
import type { useBuildTargets } from "@/common/hooks/useBuildTargets";
import type { FileClass } from "@/common/utils/fileClass";
import { FilesHighlightedCode } from "../variants/FilesHighlightedCode/FilesHighlightedCode";
import { FilesBinaryPreview } from "../variants/FilesBinaryPreview/FilesBinaryPreview";
import { FilesManifestInsights } from "../variants/FilesManifestInsights/FilesManifestInsights";
import { FilesPreviewFindingsList } from "../FilesPreviewFindingsList/FilesPreviewFindingsList";
import { FilesPreviewErrorState } from "../FilesPreviewErrorState/FilesPreviewErrorState";
import { FilesPreviewLoadingState } from "../FilesPreviewLoadingState/FilesPreviewLoadingState";

type PreviewPanelMode = "preview" | "insights";

interface FilesPreviewBodyProps {
  mode: PreviewPanelMode;
  selectedPath: string | null;
  previewLoading: boolean;
  previewLang: string;
  previewContent: string | null;
  previewFileClass: FileClass;
  previewSize: number;
  highlightLines: Set<number>;
  selectedFileFindings: Finding[];
  onSelectFinding: (findingId: string) => void;
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  targets: ReturnType<typeof useBuildTargets>["targets"];
  findingsByFile: Map<string, { total: number; topSeverity: Severity }>;
  composition: Record<string, { count: number; bytes: number }>;
  onInsightHotspotClick: (path: string) => void;
}

export const FilesPreviewBody: React.FC<FilesPreviewBodyProps> = ({
  mode,
  selectedPath,
  previewLoading,
  previewLang,
  previewContent,
  previewFileClass,
  previewSize,
  highlightLines,
  selectedFileFindings,
  onSelectFinding,
  sourceFiles,
  targetMapping,
  targets,
  findingsByFile,
  composition,
  onInsightHotspotClick,
}) => {
  if (mode === "preview" && selectedPath) {
    if (previewLoading) {
      return <FilesPreviewLoadingState />;
    }
    return (
      <div className="panel-body files-workspace-preview-body">
        {previewFileClass !== "text" ? (
          <FilesBinaryPreview
            path={selectedPath}
            size={previewSize}
            language={previewLang || null}
            fileClass={previewFileClass}
          />
        ) : (
          <div className="scroll-area files-workspace-preview-scroll">
            {previewContent !== null ? (
              <FilesHighlightedCode
                code={previewContent}
                language={previewLang}
                highlightLineNos={highlightLines}
              />
            ) : (
              <FilesPreviewErrorState />
            )}
          </div>
        )}

        {selectedFileFindings.length > 0 ? (
          <FilesPreviewFindingsList findings={selectedFileFindings} onSelect={onSelectFinding} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="panel-body files-workspace-panel-body files-workspace-insights-pane">
      <FilesManifestInsights
        sourceFiles={sourceFiles}
        targetMapping={targetMapping}
        targets={targets}
        findingsByFile={findingsByFile}
        composition={composition}
        onSelectFile={onInsightHotspotClick}
      />
    </div>
  );
};
