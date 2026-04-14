import React from "react";
import { ChevronsDownUp, ChevronsUpDown, FileText, Search } from "lucide-react";
import type { Finding } from "@aegis/shared";
import type { SourceFileEntry } from "../../../api/client";
import { FileTreeNode, Spinner } from "../../../shared/ui";
import type { TreeNode } from "../../../utils/tree";
import { HighlightedCode } from "./HighlightedCode";
import { parseLocation } from "../../../utils/location";
import "./FilesSourceWorkspace.css";

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
}) => (
  <div
    ref={layoutRef}
    className="source-tree__layout fpage-workspace"
    data-testid="files-source-workspace"
    style={{ ["--files-tree-panel-width" as string]: `${treePanelWidth}px` } as React.CSSProperties}
  >
    <div className="card source-tree__tree-panel">
      <div className="source-tree__tree-header">
        <div className="source-tree__search-area">
          <Search size={14} className="source-tree__search-icon" />
          <input
            type="text"
            className="source-tree__search"
            placeholder="파일 검색..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="source-tree__toolbar">
          <button
            className="source-tree__toolbar-btn"
            title="폴더 전부 열기"
            onClick={onExpandAll}
          >
            <ChevronsUpDown size={16} />
          </button>
          <button
            className="source-tree__toolbar-btn"
            title="폴더 전부 접기"
            onClick={onCollapseAll}
          >
            <ChevronsDownUp size={16} />
          </button>
        </div>
      </div>
      <div className="source-tree__tree-body">
        {displayTree.children.length === 0 ? (
          <div className="ftree-no-results">검색 결과가 없습니다</div>
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
              renderFolderBadge={renderFolderBadge}
              selectedPath={selectedPath ?? undefined}
              openPaths={openPaths}
              onToggleFolder={onToggleFolder}
            />
          ))
        )}
      </div>
    </div>

    <button
      type="button"
      className={`source-tree__splitter${isResizing ? " source-tree__splitter--active" : ""}`}
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

    <div className="card source-tree__preview-panel">
      {!selectedPath ? (
        <div className="source-tree__preview-empty">
          <FileText size={32} />
          <span>파일을 선택하면 내용을 미리 볼 수 있습니다</span>
        </div>
      ) : previewLoading ? (
        <div className="source-tree__preview-loading">
          <Spinner label="로딩 중..." />
        </div>
      ) : (
        <>
          <div className="source-tree__preview-header">
            <FileText size={14} style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }} />
            <span className="source-tree__preview-filename">{selectedPath}</span>
            <div className="source-tree__preview-meta">
              {previewLang && <span>{previewLang}</span>}
            </div>
          </div>

          <div className="source-tree__preview-body">
            {previewContent !== null ? (
              <HighlightedCode
                code={previewContent}
                language={previewLang}
                highlightLineNos={highlightLines}
              />
            ) : (
              <div className="source-tree__preview-empty">
                <span>파일 내용을 불러올 수 없습니다</span>
              </div>
            )}
          </div>

          {selectedFileFindings.length > 0 && (
            <div className="source-tree__file-findings">
              <div className="source-tree__file-findings-title">
                Finding ({selectedFileFindings.length})
              </div>
              {selectedFileFindings.map((finding) => {
                const { line } = parseLocation(finding.location);
                return (
                  <div
                    key={finding.id}
                    className="source-tree__finding-row"
                    onClick={() => onSelectFinding(finding.id)}
                  >
                    <span className="source-tree__finding-title">{finding.title}</span>
                    {line && <span className="source-tree__finding-loc">:{line}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  </div>
);
