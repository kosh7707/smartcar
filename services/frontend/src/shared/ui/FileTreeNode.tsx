import React, { useState, type ReactNode } from "react";
import { ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import type { TreeNode } from "../../utils/tree";
import { countFiles } from "../../utils/tree";
import { cn } from "@/lib/utils";

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
  /** Inline panel rendered below folder row when expanded (e.g. BuildTarget settings) */
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
    guides.push(
      <span
        key={i}
        className="ftree-guide relative h-[34px] w-5 shrink-0 before:absolute before:inset-y-0 before:left-[9px] before:w-px before:bg-border before:content-['']"
      />,
    );
  }

  if (isFolder) {
    return (
      <>
        <div
          className="ftree-row ftree-row--folder group flex h-[34px] cursor-pointer items-center gap-3 rounded-none px-4 transition-colors hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          role="button"
          aria-expanded={effectiveOpen}
          tabIndex={0}
          onClick={handleToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleToggle(); } }}
        >
          <div className="ftree-indent flex shrink-0">{guides}</div>
          <ChevronRight
            size={14}
            className={cn(
              "ftree-chevron shrink-0 text-muted-foreground transition-transform",
              effectiveOpen && "ftree-chevron--open rotate-90",
            )}
          />
          {effectiveOpen ? (
            <FolderOpen size={16} className="ftree-icon--folder shrink-0 text-amber-500" />
          ) : (
            <Folder size={16} className="ftree-icon--folder shrink-0 text-amber-500" />
          )}
          <span className="ftree-name min-w-0 flex-1 truncate text-base font-medium">{node.name}</span>
          <span className="ftree-meta ftree-count shrink-0 text-sm text-muted-foreground">{countFiles(node)}개</span>
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
      className={cn(
        "ftree-row ftree-row--file group flex h-[34px] cursor-pointer items-center gap-3 rounded-none px-4 transition-colors hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
        isSelected && "ftree-row--selected bg-primary/10",
      )}
      onClick={() => node.data && onClickFile?.(node.data, node)}
    >
      <div className="ftree-indent flex shrink-0">{guides}</div>
      <span className="ftree-icon-spacer w-3.5 shrink-0" />
      {node.data && renderFileIcon ? (
        renderFileIcon(node.data)
      ) : (
        <FileText size={16} className="shrink-0 text-muted-foreground" />
      )}
      <span className="ftree-name min-w-0 flex-1 truncate text-base font-normal">{node.name}</span>
      {node.data && renderFileMeta?.(node.data)}
      {node.data && renderActions && (
        <div className="ftree-actions flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">{renderActions(node.data)}</div>
      )}
    </div>
  );
}

export const FileTreeNode = React.memo(FileTreeNodeInner) as typeof FileTreeNodeInner;
