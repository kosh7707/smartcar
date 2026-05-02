import "./FilesPreviewPanel.css";
import React from "react";
import type { Finding, Severity } from "@aegis/shared";
import type { SourceFileEntry, TargetMappingEntry } from "@/common/api/client";
import type { useBuildTargets } from "@/common/hooks/useBuildTargets";
import type { FileClass } from "@/common/utils/fileClass";
import { FilesPreviewPanelHeader } from "./FilesPreviewPanelHeader/FilesPreviewPanelHeader";
import { FilesPreviewBody } from "./FilesPreviewBody/FilesPreviewBody";

interface FilesPreviewPanelProps {
  selectedPath: string | null;
  previewLoading: boolean;
  previewLang: string;
  previewContent: string | null;
  previewFileClass: FileClass;
  previewSize: number;
  highlightLines: Set<number>;
  selectedFileFindings: Finding[];
  onSelectFinding: (findingId: string) => void;
  previewDrawerOpen: boolean;
  onClosePreview: () => void;
  onOpenInDetail: (path: string) => void;
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  targets: ReturnType<typeof useBuildTargets>["targets"];
  findingsByFile: Map<string, { total: number; topSeverity: Severity }>;
  composition: Record<string, { count: number; bytes: number }>;
  onInsightHotspotClick: (path: string) => void;
}

export const FilesPreviewPanel: React.FC<FilesPreviewPanelProps> = ({
  selectedPath,
  previewLoading,
  previewLang,
  previewContent,
  previewFileClass,
  previewSize,
  highlightLines,
  selectedFileFindings,
  onSelectFinding,
  previewDrawerOpen,
  onClosePreview,
  onOpenInDetail,
  sourceFiles,
  targetMapping,
  targets,
  findingsByFile,
  composition,
  onInsightHotspotClick,
}) => {
  const mode = previewDrawerOpen && selectedPath ? "preview" : "insights";

  return (
    <div className="panel files-workspace-panel">
      <FilesPreviewPanelHeader
        mode={mode}
        selectedPath={selectedPath}
        previewLang={previewLang}
        onClosePreview={onClosePreview}
        onOpenInDetail={onOpenInDetail}
      />
      <FilesPreviewBody
        mode={mode}
        selectedPath={selectedPath}
        previewLoading={previewLoading}
        previewLang={previewLang}
        previewContent={previewContent}
        previewFileClass={previewFileClass}
        previewSize={previewSize}
        highlightLines={highlightLines}
        selectedFileFindings={selectedFileFindings}
        onSelectFinding={onSelectFinding}
        sourceFiles={sourceFiles}
        targetMapping={targetMapping}
        targets={targets}
        findingsByFile={findingsByFile}
        composition={composition}
        onInsightHotspotClick={onInsightHotspotClick}
      />
    </div>
  );
};
