import React, { useState } from "react";
import type { SourceFileEntry } from "../../../api/client";
import { Check, ChevronRight, FileText, Folder, FolderOpen, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "../../../utils/format";
import { buildTree, countFiles } from "../../../utils/tree";
import type { TreeNode } from "../../../utils/tree";

function collectPaths(node: TreeNode<SourceFileEntry>): string[] {
  if (node.data) return [node.path];
  return node.children.flatMap(collectPaths);
}

function getCheckState(node: TreeNode<SourceFileEntry>, checked: Set<string>): "checked" | "indeterminate" | "unchecked" {
  if (node.data) return checked.has(node.path) ? "checked" : "unchecked";
  if (node.children.length === 0) return "unchecked";
  let hasChecked = false;
  let hasUnchecked = false;
  for (const child of node.children) {
    const state = getCheckState(child, checked);
    if (state === "checked") hasChecked = true;
    else if (state === "unchecked") hasUnchecked = true;
    else { hasChecked = true; hasUnchecked = true; }
    if (hasChecked && hasUnchecked) return "indeterminate";
  }
  return hasChecked ? "checked" : "unchecked";
}

const checkClass = (checkedState: "checked" | "indeterminate" | "unchecked") => cn(
  "build-target-tree__check",
  checkedState === "unchecked"
    ? "build-target-tree__check--unchecked"
    : "build-target-tree__check--checked",
);

const rowClass = (disabled: boolean, selected = false) => cn(
  "build-target-tree__row",
  selected && "build-target-tree__row--selected",
  disabled && "build-target-tree__row--disabled",
);

const CheckNode: React.FC<{
  node: TreeNode<SourceFileEntry>;
  depth: number;
  checked: Set<string>;
  onToggle: (paths: string[], add: boolean) => void;
  disabled?: boolean;
}> = ({ node, depth, checked, onToggle, disabled = false }) => {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = !node.data;
  const state = getCheckState(node, checked);

  const handleToggle = (event: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) return;
    event.stopPropagation();
    if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
    if ("key" in event) event.preventDefault();
    onToggle(collectPaths(node), state !== "checked");
  };

  const indent = <span aria-hidden className="build-target-tree__indent" style={{ width: depth * 18 }} />;

  if (isFolder) {
    return (
      <>
        <div className={rowClass(disabled, state !== "unchecked")} onClick={() => setOpen(!open)}>
          {indent}
          <div
            className={checkClass(state)}
            role="checkbox"
            aria-checked={state === "checked" ? "true" : state === "indeterminate" ? "mixed" : "false"}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={handleToggle}
            onKeyDown={handleToggle}
          >
            {state === "checked" && <Check size={10} />}
            {state === "indeterminate" && <Minus size={10} />}
          </div>
          <ChevronRight className={cn("build-target-tree__chevron", open && "is-open")} />
          {open ? <FolderOpen className="build-target-tree__folder-icon" /> : <Folder className="build-target-tree__folder-icon" />}
          <span className="build-target-tree__name build-target-tree__name--folder">{node.name}</span>
          <span className="build-target-tree__count">{countFiles(node)}개</span>
        </div>
        {open && node.children.map((child) => (
          <CheckNode key={child.path} node={child} depth={depth + 1} checked={checked} onToggle={onToggle} disabled={disabled} />
        ))}
      </>
    );
  }

  const isChecked = checked.has(node.path);
  return (
    <div className={rowClass(disabled, isChecked)} onClick={handleToggle}>
      {indent}
      <div
        className={checkClass(isChecked ? "checked" : "unchecked")}
        role="checkbox"
        aria-checked={isChecked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleToggle}
      >
        {isChecked && <Check size={10} />}
      </div>
      <span aria-hidden className="build-target-tree__spacer" />
      <FileText className="build-target-tree__file-icon" />
      <span className="build-target-tree__name build-target-tree__name--file">{node.name}</span>
      {node.data && node.data.size > 0 && <span className="build-target-tree__count">{formatFileSize(node.data.size)}</span>}
    </div>
  );
};

export function BuildTargetTreeSelector({
  sourceFiles,
  checked,
  onToggle,
  disabled = false,
}: {
  sourceFiles: SourceFileEntry[];
  checked: Set<string>;
  onToggle: (paths: string[], add: boolean) => void;
  disabled?: boolean;
}) {
  const tree = buildTree(sourceFiles, (sourceFile) => sourceFile.relativePath);

  return (
    <div className="build-target-tree">
      {tree.children.map((child) => (
        <CheckNode key={child.path} node={child} depth={0} checked={checked} onToggle={onToggle} disabled={disabled} />
      ))}
    </div>
  );
}
