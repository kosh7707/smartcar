import React, { useState } from "react";
import type { SourceFileEntry } from "../../../api/client";
import { Check, ChevronRight, FileText, Folder, FolderOpen, Minus } from "lucide-react";
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

  const guides = [];
  for (let i = 0; i < depth; i += 1) guides.push(<span key={i} className="spcd__indent-guide" />);

  if (isFolder) {
    return (
      <>
        <div className={`spcd__row spcd__row--folder${disabled ? " spcd__row--disabled" : ""}`} onClick={() => setOpen(!open)} style={disabled ? { opacity: 0.72 } : undefined}>
          <div className="spcd__indent">{guides}</div>
          <div
            className={`spcd__check${state === "checked" ? " spcd__check--checked" : state === "indeterminate" ? " spcd__check--indeterminate" : ""}`}
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
          <ChevronRight size={12} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--cds-text-placeholder)" }} />
          {open ? <FolderOpen size={14} style={{ color: "var(--cds-support-warning)" }} /> : <Folder size={14} style={{ color: "var(--cds-support-warning)" }} />}
          <span className="spcd__name">{node.name}</span>
          <span className="spcd__meta">{countFiles(node)}개</span>
        </div>
        {open && node.children.map((child) => (
          <CheckNode key={child.path} node={child} depth={depth + 1} checked={checked} onToggle={onToggle} disabled={disabled} />
        ))}
      </>
    );
  }

  const isChecked = checked.has(node.path);
  return (
    <div className={`spcd__row${disabled ? " spcd__row--disabled" : ""}`} onClick={handleToggle} style={disabled ? { opacity: 0.72, cursor: "default" } : undefined}>
      <div className="spcd__indent">{guides}</div>
      <div
        className={`spcd__check${isChecked ? " spcd__check--checked" : ""}`}
        role="checkbox"
        aria-checked={isChecked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleToggle}
      >
        {isChecked && <Check size={10} />}
      </div>
      <span style={{ width: 12 }} />
      <FileText size={14} style={{ color: "var(--cds-text-placeholder)", flexShrink: 0 }} />
      <span className="spcd__name">{node.name}</span>
      {node.data && node.data.size > 0 && <span className="spcd__meta">{formatFileSize(node.data.size)}</span>}
    </div>
  );
};

export function SubprojectTreeSelector({
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
    <div className="spcd__tree-wrap">
      {tree.children.map((child) => (
        <CheckNode key={child.path} node={child} depth={0} checked={checked} onToggle={onToggle} disabled={disabled} />
      ))}
    </div>
  );
}
