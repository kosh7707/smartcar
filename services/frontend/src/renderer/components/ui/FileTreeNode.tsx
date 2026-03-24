import React, { useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import type { TreeNode } from "../../utils/tree";
import { countFiles } from "../../utils/tree";
import "./FileTreeNode.css";

export interface FileTreeNodeProps<T> {
  node: TreeNode<T>;
  depth: number;
  searchOpen: boolean;
  defaultOpen?: boolean;
  onClickFile?: (data: T, node: TreeNode<T>) => void;
  /** Custom file icon (default: FileText with tertiary color) */
  renderFileIcon?: (data: T) => ReactNode;
  /** Extra metadata after file name (language badge, size, etc.) */
  renderFileMeta?: (data: T) => ReactNode;
  /** Action buttons shown on hover for files */
  renderActions?: (data: T) => ReactNode;
  /** Badge shown after folder file count (e.g. finding severity counts) */
  renderFolderBadge?: (node: TreeNode<T>) => ReactNode;
  /** Highlight the currently selected file */
  selectedPath?: string;
  /** Controlled open state: set of open folder paths */
  openPaths?: Set<string>;
  /** Called when a folder is toggled (for controlled mode) */
  onToggleFolder?: (path: string, open: boolean) => void;
  /** Inline panel rendered below folder row when expanded (e.g. subproject settings) */
  renderFolderPanel?: (node: TreeNode<T>) => ReactNode;
}

function FileTreeNodeInner<T>({
  node,
  depth,
  searchOpen,
  defaultOpen,
  onClickFile,
  renderFileIcon,
  renderFileMeta,
  renderActions,
  renderFolderBadge,
  selectedPath,
  openPaths,
  onToggleFolder,
  renderFolderPanel,
}: FileTreeNodeProps<T>) {
  const controlled = openPaths !== undefined;
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? depth < 2);

  const isFolder = !node.data;
  const open = controlled ? (openPaths!.has(node.path)) : localOpen;
  const effectiveOpen = searchOpen || open;

  const handleToggle = () => {
    if (controlled && onToggleFolder) {
      onToggleFolder(node.path, !open);
    } else {
      setLocalOpen(!localOpen);
    }
  };

  // Indent guides
  const guides = [];
  for (let i = 0; i < depth; i++) {
    guides.push(<span key={i} className="ftree-guide" />);
  }

  if (isFolder) {
    return (
      <>
        <div
          className="ftree-row ftree-row--folder"
          role="button"
          aria-expanded={effectiveOpen}
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle(); } }}
        >
          <div className="ftree-indent">{guides}</div>
          <ChevronRight
            size={14}
            className={`ftree-chevron${effectiveOpen ? " ftree-chevron--open" : ""}`}
          />
          {effectiveOpen ? (
            <FolderOpen size={16} className="ftree-icon--folder" />
          ) : (
            <Folder size={16} className="ftree-icon--folder" />
          )}
          <span className="ftree-name">{node.name}</span>
          <span className="ftree-meta ftree-count">{countFiles(node)}개</span>
          {renderFolderBadge?.(node)}
        </div>
        {effectiveOpen && renderFolderPanel?.(node)}
        {effectiveOpen &&
          node.children.map((child) => (
            <FileTreeNodeInner
              key={child.path}
              node={child}
              depth={depth + 1}
              searchOpen={searchOpen}
              defaultOpen={defaultOpen}
              onClickFile={onClickFile}
              renderFileIcon={renderFileIcon}
              renderFileMeta={renderFileMeta}
              renderActions={renderActions}
              renderFolderBadge={renderFolderBadge}
              selectedPath={selectedPath}
              openPaths={openPaths}
              onToggleFolder={onToggleFolder}
              renderFolderPanel={renderFolderPanel}
            />
          ))}
      </>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <div
      className={`ftree-row ftree-row--file${isSelected ? " ftree-row--selected" : ""}`}
      onClick={() => node.data && onClickFile?.(node.data, node)}
    >
      <div className="ftree-indent">{guides}</div>
      <span className="ftree-icon-spacer" />
      {node.data && renderFileIcon ? (
        renderFileIcon(node.data)
      ) : (
        <FileText size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      )}
      <span className="ftree-name">{node.name}</span>
      {node.data && renderFileMeta?.(node.data)}
      {node.data && renderActions && (
        <div className="ftree-actions">{renderActions(node.data)}</div>
      )}
    </div>
  );
}

export const FileTreeNode = React.memo(FileTreeNodeInner) as typeof FileTreeNodeInner;
