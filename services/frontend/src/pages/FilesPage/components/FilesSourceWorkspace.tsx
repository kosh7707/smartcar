import React from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  FileText,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@aegis/shared";
import type { SourceFileEntry, TargetMappingEntry } from "../../../api/client";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import { FileTreeNode, Spinner } from "../../../shared/ui";
import type { TreeNode } from "../../../utils/tree";
import type { FileClass } from "../../../utils/fileClass";
import { HighlightedCode } from "./HighlightedCode";
import { FilesBinaryPreview } from "./FilesBinaryPreview";
import { FilesManifestInsights } from "./FilesManifestInsights";
import { parseLocation } from "../../../utils/location";

interface FilesSourceWorkspaceProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  displayTree: TreeNode<SourceFileEntry>;
  selectedPath: string | null;
  handleFileClick: (data: SourceFileEntry) => void;
  renderFileIcon: (data: SourceFileEntry) => React.ReactNode;
  renderFileMeta: (data: SourceFileEntry) => React.ReactNode;
  renderFolderBadge: (node: TreeNode<SourceFileEntry>) => React.ReactNode;
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
  // New props
  sourceFiles: SourceFileEntry[];
  targetMapping: Record<string, TargetMappingEntry>;
  targets: ReturnType<typeof useBuildTargets>["targets"];
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
  renderFileIcon,
  renderFileMeta,
  renderFolderBadge,
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
  findingsByFile,
  composition,
  previewDrawerOpen,
  onPreviewFile,
  onClosePreview,
  onOpenInDetail,
  onInsightHotspotClick,
}) => {
  const renderActions = (data: SourceFileEntry) => (
    <button
      type="button"
      className="files-tree-eye-btn"
      onClick={(event) => {
        event.stopPropagation();
        onPreviewFile(data.relativePath);
      }}
      aria-label={`${data.relativePath} 미리 보기`}
      title="미리 보기"
    >
      <Eye size={14} />
    </button>
  );

  return (
    <div
      ref={layoutRef}
      className="files-workspace-grid"
      data-testid="files-source-workspace"
      style={{ ["--files-tree-panel-width" as string]: `${treePanelWidth}px` } as React.CSSProperties}
    >
      <div className="panel files-workspace-panel">
        <div className="panel-head files-workspace-head">
          <div className="panel-body">
            <div className="files-workspace-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="파일 검색..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <div className="files-workspace-tools">
              <button
                type="button"
                className="btn btn-ghost btn-icon-sm"
                title="폴더 전부 열기"
                onClick={onExpandAll}
              >
                <ChevronsUpDown size={16} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon-sm"
                title="폴더 전부 접기"
                onClick={onCollapseAll}
              >
                <ChevronsDownUp size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="panel-body files-workspace-panel-body">
          <div className="scroll-area files-workspace-tree">
            <div className="files-workspace-tree-inner">
              {displayTree.children.length === 0 ? (
                <div className="files-workspace-tree-empty">검색 결과가 없습니다</div>
              ) : (
                displayTree.children.map((node) => (
                  <FileTreeNode<SourceFileEntry>
                    key={node.path}
                    node={node}
                    depth={0}
                    searchOpen={search.trim().length > 0}
                    onClickFile={handleFileClick}
                    renderFileIcon={renderFileIcon}
                    renderFileMeta={renderFileMeta}
                    renderActions={renderActions}
                    renderFolderBadge={renderFolderBadge}
                    selectedPath={selectedPath ?? undefined}
                    openPaths={openPaths}
                    onToggleFolder={onToggleFolder}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={cn("files-workspace-splitter", isResizing && "is-resizing")}
        data-testid="files-source-workspace-splitter"
        aria-label="패널 크기 조절"
        aria-orientation="vertical"
        title="패널 크기 조절"
        onMouseDown={onStartResize}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onNudgeResize("left");
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onNudgeResize("right");
          }
        }}
      />

      <div className="panel files-workspace-panel">
        {previewDrawerOpen && selectedPath ? (
          previewLoading ? (
            <div className="files-workspace-loading-preview">
              <Spinner label="로딩 중..." />
            </div>
          ) : (
            <>
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

              <div className="panel-body files-workspace-preview-body">
                {previewFileClass !== "text" && selectedPath ? (
                  <FilesBinaryPreview
                    path={selectedPath}
                    size={previewSize}
                    language={previewLang || null}
                    fileClass={previewFileClass}
                  />
                ) : (
                  <div className="scroll-area files-workspace-preview-scroll">
                    {previewContent !== null ? (
                      <HighlightedCode
                        code={previewContent}
                        language={previewLang}
                        highlightLineNos={highlightLines}
                      />
                    ) : (
                      <div className="files-workspace-error-preview">
                        <span className="files-workspace-error-preview-text">
                          파일 내용을 불러올 수 없습니다
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {selectedFileFindings.length > 0 ? (
                  <div className="files-workspace-findings">
                    <div className="files-workspace-findings-title">
                      탐지 항목 ({selectedFileFindings.length})
                    </div>
                    <div className="files-workspace-findings-list">
                      {selectedFileFindings.map((finding) => {
                        const { line } = parseLocation(finding.location);
                        return (
                          <button
                            key={finding.id}
                            type="button"
                            className="files-workspace-finding-row"
                            onClick={() => onSelectFinding(finding.id)}
                          >
                            <span className="files-workspace-finding-title">{finding.title}</span>
                            {line ? (
                              <span className="files-workspace-finding-line">:{line}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )
        ) : (
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
        )}
      </div>
    </div>
  );
};
