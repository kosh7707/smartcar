import React from "react";
import type { Finding, Severity } from "@aegis/shared";
import type { SourceFileEntry, TargetMappingEntry } from "../../../../api/client";
import type { useBuildTargets } from "../../../../hooks/useBuildTargets";
import type { TreeNode } from "../../../../utils/tree";
import type { FileClass } from "../../../../utils/fileClass";
import { FilesTreePanel } from "./FilesTreePanel/FilesTreePanel";
import { FilesPreviewPanel } from "./FilesPreviewPanel/FilesPreviewPanel";
import { FilesWorkspaceSplitter } from "./FilesWorkspaceSplitter/FilesWorkspaceSplitter";

interface FilesSourceWorkspaceProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  displayTree: TreeNode<SourceFileEntry>;
  selectedPath: string | null;
  handleFileClick: (data: SourceFileEntry) => void;
  previewLoading: boolean;
  previewLang: string;
  previewContent: string | null;
  previewFileClass: FileClass;
  previewSize: number;
  highlightLines: Set<number>;
  selectedFileFindings: Finding[];
  onSelectFinding: (findingId: string) => void;
  openPaths: Set<string>;
  onToggleFolder: (path: string, open: boolean) => void;
  layoutRef: React.RefObject<HTMLDivElement | null>;
  treePanelWidth: number;
  isResizing: boolean;
  onStartResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNudgeResize: (direction: "left" | "right") => void;
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  targets: ReturnType<typeof useBuildTargets>["targets"];
  findings: Finding[];
  findingsByFile: Map<string, { total: number; topSeverity: Severity }>;
  composition: Record<string, { count: number; bytes: number }>;
  previewDrawerOpen: boolean;
  onPreviewFile: (path: string) => void;
  onClosePreview: () => void;
  onOpenInDetail: (path: string) => void;
  onInsightHotspotClick: (path: string) => void;
}

export const FilesSourceWorkspace: React.FC<FilesSourceWorkspaceProps> = ({
  search,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  displayTree,
  selectedPath,
  handleFileClick,
  previewLoading,
  previewLang,
  previewContent,
  previewFileClass,
  previewSize,
  highlightLines,
  selectedFileFindings,
  onSelectFinding,
  openPaths,
  onToggleFolder,
  layoutRef,
  treePanelWidth,
  isResizing,
  onStartResize,
  onNudgeResize,
  sourceFiles,
  targetMapping,
  targets,
  findings,
  findingsByFile,
  composition,
  previewDrawerOpen,
  onPreviewFile,
  onClosePreview,
  onOpenInDetail,
  onInsightHotspotClick,
}) => {
  return (
    <div
      ref={layoutRef}
      className="files-workspace-grid"
      data-testid="files-source-workspace"
      style={{ ["--files-tree-panel-width" as string]: `${treePanelWidth}px` } as React.CSSProperties}
    >
      <FilesTreePanel
        search={search}
        onSearchChange={onSearchChange}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        displayTree={displayTree}
        selectedPath={selectedPath}
        onClickFile={handleFileClick}
        onPreviewFile={onPreviewFile}
        openPaths={openPaths}
        onToggleFolder={onToggleFolder}
        targetMapping={targetMapping}
        findings={findings}
      />

      <FilesWorkspaceSplitter
        isResizing={isResizing}
        onStartResize={onStartResize}
        onNudgeResize={onNudgeResize}
      />

      <FilesPreviewPanel
        selectedPath={selectedPath}
        previewLoading={previewLoading}
        previewLang={previewLang}
        previewContent={previewContent}
        previewFileClass={previewFileClass}
        previewSize={previewSize}
        highlightLines={highlightLines}
        selectedFileFindings={selectedFileFindings}
        onSelectFinding={onSelectFinding}
        previewDrawerOpen={previewDrawerOpen}
        onClosePreview={onClosePreview}
        onOpenInDetail={onOpenInDetail}
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
