import "./FileTreeNode.css";
import React, { useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import type { TreeNode } from "@/common/utils/tree";
import { countFiles } from "@/common/utils/tree";
import { cn } from "@/common/utils/cn";

export interface FileTreeNodeProps<T> {
  node: TreeNode<T>;
  depth: number;
  searchOpen: boolean;
  defaultOpen?: boolean;
  onClickFile?: (data: T, node: TreeNode<T>) => void;
  renderFileIcon?: (data: T) => ReactNode;
  renderFileMeta?: (data: T) => ReactNode;
  renderActions?: (data: T) => ReactNode;
  renderFolderBadge?: (node: TreeNode<T>) => ReactNode;
  selectedPath?: string;
  openPaths?: Set<string>;
  onToggleFolder?: (path: string, open: boolean) => void;
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
  const open = controlled ? openPaths!.has(node.path) : localOpen;
  const effectiveOpen = searchOpen || open;

  const handleToggle = () => {
    if (controlled && onToggleFolder) {
      onToggleFolder(node.path, !open);
    } else {
      setLocalOpen(!localOpen);
    }
  };

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
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleToggle();
            }
          }}
        >
          <div className="ftree-indent">{guides}</div>
          <ChevronRight
            size={14}
            className={cn("ftree-chevron", effectiveOpen && "ftree-chevron--open")}
          />
          {effectiveOpen ? (
            <FolderOpen size={16} className="ftree-folder-icon" />
          ) : (
            <Folder size={16} className="ftree-folder-icon" />
          )}
          <span className="ftree-name ftree-name--folder">{node.name}</span>
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
      className={cn("ftree-row ftree-row--file", isSelected && "ftree-row--selected")}
      onClick={() => node.data && onClickFile?.(node.data, node)}
    >
      <div className="ftree-indent">{guides}</div>
      <span className="ftree-icon-spacer" />
      {node.data && renderFileIcon ? (
        renderFileIcon(node.data)
      ) : (
        <FileText size={16} className="ftree-file-icon" />
      )}
      <span className="ftree-name ftree-name--file">{node.name}</span>
      {node.data && renderFileMeta?.(node.data)}
      {node.data && renderActions ? (
        <div className="ftree-actions">{renderActions(node.data)}</div>
      ) : null}
    </div>
  );
}

export const FileTreeNode = React.memo(FileTreeNodeInner) as typeof FileTreeNodeInner;
