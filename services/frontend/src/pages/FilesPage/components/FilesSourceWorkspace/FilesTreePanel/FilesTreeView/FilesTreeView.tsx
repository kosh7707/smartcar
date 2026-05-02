import "./FilesTreeView.css";
import React, { useCallback, useMemo } from "react";
import { Eye, FileText } from "lucide-react";
import type { Finding } from "@aegis/shared";
import { FileTreeNode } from "@/common/ui/primitives";
import type { TreeNode } from "@/common/utils/tree";
import { computeFindingOverlay, getFindingCount } from "@/common/utils/findingOverlay";
import type { DirFindingCount } from "@/common/utils/findingOverlay";
import { getLangColorByName } from "@/common/constants/languages";
import type { SourceFileEntry } from "@/common/api/client";

interface FilesTreeViewProps {
  displayTree: TreeNode<SourceFileEntry>;
  selectedPath: string | null;
  onClickFile: (data: SourceFileEntry) => void;
  onPreviewFile: (path: string) => void;
  openPaths: Set<string>;
  onToggleFolder: (path: string, open: boolean) => void;
  findings: Finding[];
  searchOpen: boolean;
}

export const FilesTreeView: React.FC<FilesTreeViewProps> = ({
  displayTree,
  selectedPath,
  onClickFile,
  onPreviewFile,
  openPaths,
  onToggleFolder,
  findings,
  searchOpen,
}) => {
  const overlay = useMemo<Map<string, DirFindingCount>>(
    () => (findings.length > 0 ? computeFindingOverlay(findings) : new Map()),
    [findings],
  );

  const renderFileIcon = useCallback(
    (data: SourceFileEntry) => (
      <FileText size={14} className="ftree-file-icon" style={{ color: getLangColorByName(data.language) }} />
    ),
    [],
  );

  const renderFolderBadge = useCallback(
    (node: TreeNode<SourceFileEntry>) => {
      const counts = getFindingCount(node.path, overlay);
      if (counts.total === 0) return null;
      return (
        <span className="ftree-folder-badge">
          {counts.critical > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--critical">{counts.critical}</span>
          )}
          {counts.high > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--high">{counts.high}</span>
          )}
          {counts.medium > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--medium">{counts.medium}</span>
          )}
          {counts.low > 0 && (
            <span className="ftree-finding-dot ftree-finding-dot--low">{counts.low}</span>
          )}
        </span>
      );
    },
    [overlay],
  );

  const renderActions = useCallback(
    (data: SourceFileEntry) => (
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
        <Eye size={13} />
      </button>
    ),
    [onPreviewFile],
  );

  return (
    <div className="panel-body files-workspace-panel-body">
      <div className="scroll-area files-workspace-tree files-tree-panel__scroll">
        <div className="files-workspace-tree-inner files-tree-panel__inner">
          {displayTree.children.length === 0 ? (
            <div className="files-workspace-tree-empty">검색 결과가 없습니다</div>
          ) : (
            displayTree.children.map((node) => (
              <FileTreeNode<SourceFileEntry>
                key={node.path}
                node={node}
                depth={0}
                searchOpen={searchOpen}
                onClickFile={onClickFile}
                renderFileIcon={renderFileIcon}
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
  );
};
