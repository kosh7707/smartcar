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
  "flex size-4 shrink-0 items-center justify-center rounded border text-primary-foreground transition-colors",
  checkedState === "unchecked" ? "border-input bg-background" : "border-primary bg-primary",
);

const rowClass = (disabled: boolean, selected = false) => cn(
  "flex min-h-8 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  selected && "bg-primary/10",
  disabled && "cursor-default opacity-70 hover:bg-transparent",
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

  const indent = <span aria-hidden className="shrink-0" style={{ width: depth * 18 }} />;

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
          <ChevronRight className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          {open ? <FolderOpen className="size-3.5 shrink-0 text-amber-600" /> : <Folder className="size-3.5 shrink-0 text-amber-600" />}
          <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
          <span className="shrink-0 text-muted-foreground">{countFiles(node)}개</span>
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
      <span aria-hidden className="w-3 shrink-0" />
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {node.data && node.data.size > 0 && <span className="shrink-0 text-muted-foreground">{formatFileSize(node.data.size)}</span>}
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
    <div className="max-h-[350px] overflow-y-auto rounded-lg border border-border py-3">
      {tree.children.map((child) => (
        <CheckNode key={child.path} node={child} depth={0} checked={checked} onToggle={onToggle} disabled={disabled} />
      ))}
    </div>
  );
}
