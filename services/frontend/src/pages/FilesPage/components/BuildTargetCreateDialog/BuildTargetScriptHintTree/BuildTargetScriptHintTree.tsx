import "./BuildTargetScriptHintTree.css";
import React, { useState } from "react";
import { ChevronRight, Circle, CircleDot, FileText, Folder, FolderOpen } from "lucide-react";
import type { SourceFileEntry } from "@/common/api/client";
import { cn } from "@/common/utils/cn";
import { formatFileSize } from "@/common/utils/format";
import { buildTree, countFiles } from "@/common/utils/tree";
import type { TreeNode } from "@/common/utils/tree";

interface BuildTargetScriptHintTreeProps {
  sourceFiles: SourceFileEntry[];
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  disabled?: boolean;
}

const FolderRow: React.FC<{
  node: TreeNode<SourceFileEntry>;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  disabled: boolean;
}> = ({ node, depth, selectedPath, onSelect, disabled }) => {
  const [open, setOpen] = useState(depth < 1);
  return (
    <>
      <div
        className={cn("script-hint-tree__row", "script-hint-tree__row--folder", disabled && "script-hint-tree__row--disabled")}
        onClick={() => !disabled && setOpen(!open)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span aria-hidden className="script-hint-tree__indent" style={{ width: depth * 18 }} />
        <span aria-hidden className="script-hint-tree__radio-spacer" />
        <ChevronRight className={cn("script-hint-tree__chevron", open && "is-open")} />
        {open ? <FolderOpen className="script-hint-tree__folder-icon" /> : <Folder className="script-hint-tree__folder-icon" />}
        <span className="script-hint-tree__name script-hint-tree__name--folder">{node.name}</span>
        <span className="script-hint-tree__count">{countFiles(node)}개</span>
      </div>
      {open && node.children.map((child) => (
        child.data
          ? <FileRow key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} disabled={disabled} />
          : <FolderRow key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} disabled={disabled} />
      ))}
    </>
  );
};

const FileRow: React.FC<{
  node: TreeNode<SourceFileEntry>;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
  disabled: boolean;
}> = ({ node, depth, selectedPath, onSelect, disabled }) => {
  const isSelected = selectedPath === node.path;
  const handle = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) return;
    if ("key" in event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
    }
    event.stopPropagation();
    onSelect(isSelected ? null : node.path);
  };

  return (
    <div
      className={cn(
        "script-hint-tree__row",
        "script-hint-tree__row--file",
        isSelected && "script-hint-tree__row--selected",
        disabled && "script-hint-tree__row--disabled",
      )}
      onClick={handle}
      role="radio"
      aria-checked={isSelected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handle}
    >
      <span aria-hidden className="script-hint-tree__indent" style={{ width: depth * 18 }} />
      <span className="script-hint-tree__radio">
        {isSelected ? <CircleDot size={14} /> : <Circle size={14} />}
      </span>
      <span aria-hidden className="script-hint-tree__chevron-spacer" />
      <FileText className="script-hint-tree__file-icon" />
      <span className="script-hint-tree__name script-hint-tree__name--file">{node.name}</span>
      {node.data && node.data.size > 0 ? <span className="script-hint-tree__count">{formatFileSize(node.data.size)}</span> : null}
    </div>
  );
};

export const BuildTargetScriptHintTree: React.FC<BuildTargetScriptHintTreeProps> = ({
  sourceFiles,
  selectedPath,
  onSelect,
  disabled = false,
}) => {
  const tree = buildTree(sourceFiles, (entry) => entry.relativePath);
  if (sourceFiles.length === 0) {
    return <div className="script-hint-tree script-hint-tree--empty">업로드된 파일이 없습니다.</div>;
  }
  return (
    <div className="script-hint-tree" role="radiogroup" aria-label="빌드 스크립트 힌트 파일">
      {tree.children.map((child) => (
        child.data
          ? <FileRow key={child.path} node={child} depth={0} selectedPath={selectedPath} onSelect={onSelect} disabled={disabled} />
          : <FolderRow key={child.path} node={child} depth={0} selectedPath={selectedPath} onSelect={onSelect} disabled={disabled} />
      ))}
    </div>
  );
};
