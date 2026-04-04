import React, { useState, useMemo, useCallback, useEffect } from "react";
import type { BuildProfile } from "@aegis/shared";
import type { SourceFileEntry } from "../../api/client";
import { Check, Minus, Folder, FileText, ChevronRight, FolderOpen } from "lucide-react";
import { buildTree, countFiles } from "../../utils/tree";
import type { TreeNode } from "../../utils/tree";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { useToast } from "../../contexts/ToastContext";
import { logError } from "../../api/client";
import { fetchProjectSdks } from "../../api/sdk";
import type { RegisteredSdk } from "../../api/sdk";
import { BuildProfileForm } from "./BuildProfileForm";
import { formatFileSize } from "../../utils/format";
import { Spinner } from "../ui";
import "./SubprojectCreateDialog.css";

const DEFAULT_PROFILE: BuildProfile = {
  sdkId: "none",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c17",
  headerLanguage: "auto",
};

const EMPTY_INCLUDED_PATHS: string[] = [];

interface Props {
  open: boolean;
  projectId: string;
  sourceFiles: SourceFileEntry[];
  onCancel: () => void;
  onCreated?: () => void;
  onSubmit?: (payload: { name: string; profile: BuildProfile; includedPaths: string[] }) => Promise<void>;
  title?: string;
  submitLabel?: string;
  initialName?: string;
  initialProfile?: BuildProfile;
  initialIncludedPaths?: string[];
}

// Collect all descendant file paths from a tree node
function collectPaths(node: TreeNode<SourceFileEntry>): string[] {
  if (node.data) return [node.path];
  return node.children.flatMap(collectPaths);
}

// Check state of a node: "checked" | "indeterminate" | "unchecked"
function getCheckState(
  node: TreeNode<SourceFileEntry>,
  checked: Set<string>,
): "checked" | "indeterminate" | "unchecked" {
  if (node.data) return checked.has(node.path) ? "checked" : "unchecked";
  const children = node.children;
  if (children.length === 0) return "unchecked";
  let hasChecked = false;
  let hasUnchecked = false;
  for (const child of children) {
    const st = getCheckState(child, checked);
    if (st === "checked") hasChecked = true;
    else if (st === "unchecked") hasUnchecked = true;
    else { hasChecked = true; hasUnchecked = true; }
    if (hasChecked && hasUnchecked) return "indeterminate";
  }
  return hasChecked ? "checked" : "unchecked";
}

// Checkbox tree node
const CheckNode: React.FC<{
  node: TreeNode<SourceFileEntry>;
  depth: number;
  checked: Set<string>;
  onToggle: (paths: string[], add: boolean) => void;
}> = ({ node, depth, checked, onToggle }) => {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = !node.data;
  const state = getCheckState(node, checked);

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    if ("key" in e) e.preventDefault();
    const paths = collectPaths(node);
    onToggle(paths, state !== "checked");
  };

  const guides = [];
  for (let i = 0; i < depth; i++) guides.push(<span key={i} className="spcd__indent-guide" />);

  if (isFolder) {
    const fileCount = countFiles(node);
    return (
      <>
        <div className="spcd__row spcd__row--folder" onClick={() => setOpen(!open)}>
          <div className="spcd__indent">{guides}</div>
          <div
            className={`spcd__check${state === "checked" ? " spcd__check--checked" : state === "indeterminate" ? " spcd__check--indeterminate" : ""}`}
            role="checkbox"
            aria-checked={state === "checked" ? "true" : state === "indeterminate" ? "mixed" : "false"}
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={handleToggle}
          >
            {state === "checked" && <Check size={10} />}
            {state === "indeterminate" && <Minus size={10} />}
          </div>
          <ChevronRight size={12} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", color: "var(--text-tertiary)" }} />
          {open ? <FolderOpen size={14} style={{ color: "var(--warning)" }} /> : <Folder size={14} style={{ color: "var(--warning)" }} />}
          <span className="spcd__name">{node.name}</span>
          <span className="spcd__meta">{fileCount}개</span>
        </div>
        {open && node.children.map((child) => (
          <CheckNode key={child.path} node={child} depth={depth + 1} checked={checked} onToggle={onToggle} />
        ))}
      </>
    );
  }

  const isChecked = checked.has(node.path);
  return (
    <div className="spcd__row" onClick={handleToggle}>
      <div className="spcd__indent">{guides}</div>
      <div
        className={`spcd__check${isChecked ? " spcd__check--checked" : ""}`}
        role="checkbox"
        aria-checked={isChecked}
        tabIndex={0}
        onKeyDown={handleToggle}
      >
        {isChecked && <Check size={10} />}
      </div>
      <span style={{ width: 12 }} />
      <FileText size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
      <span className="spcd__name">{node.name}</span>
      {node.data && node.data.size > 0 && <span className="spcd__meta">{formatFileSize(node.data.size)}</span>}
    </div>
  );
};

export const SubprojectCreateDialog: React.FC<Props> = ({
  open,
  projectId,
  sourceFiles,
  onCreated,
  onCancel,
  onSubmit,
  title = "서브 프로젝트 생성",
  submitLabel = "서브 프로젝트 생성",
  initialName = "",
  initialProfile = DEFAULT_PROFILE,
  initialIncludedPaths = EMPTY_INCLUDED_PATHS,
}) => {
  const toast = useToast();
  const bt = useBuildTargets(projectId);
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<BuildProfile>(DEFAULT_PROFILE);
  const [creating, setCreating] = useState(false);
  const [registeredSdks, setRegisteredSdks] = useState<RegisteredSdk[]>([]);

  const tree = useMemo(() => buildTree(sourceFiles, (sf) => sf.relativePath), [sourceFiles]);

  // Reset on open + load SDKs
  useEffect(() => {
    if (open) {
      setName(initialName);
      setProfile(initialProfile);
      const selected = sourceFiles
        .filter((sf) => initialIncludedPaths.some((path) => sf.relativePath === path || sf.relativePath.startsWith(path)))
        .map((sf) => sf.relativePath);
      setChecked(new Set(selected));
      if (projectId) {
        fetchProjectSdks(projectId)
          .then((data) => setRegisteredSdks(data.registered))
          .catch(() => setRegisteredSdks([]));
      }
    }
  }, [open, projectId, initialIncludedPaths, initialName, initialProfile, sourceFiles]);

  const handleToggle = useCallback((paths: string[], add: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const p of paths) {
        if (add) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  }, []);

  // Summary
  const selectedFiles = useMemo(() => sourceFiles.filter((sf) => checked.has(sf.relativePath)), [sourceFiles, checked]);
  const selectedCount = selectedFiles.length;
  const selectedSize = selectedFiles.reduce((sum, sf) => sum + (sf.size || 0), 0);

  // Compute includedPaths (folder-level paths where all children are selected)
  const includedPaths = useMemo(() => {
    // Simple: just return all checked file paths
    // S2 will handle optimization
    return [...checked];
  }, [checked]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { toast.error("서브 프로젝트 이름을 입력해주세요."); return; }
    if (selectedCount === 0) { toast.error("파일을 1개 이상 선택해주세요."); return; }
    setCreating(true);
    try {
      if (onSubmit) {
        await onSubmit({ name: name.trim(), profile, includedPaths });
      } else {
        await bt.add(name.trim(), name.trim() + "/", profile, includedPaths);
        onCreated?.();
      }
      toast.success(`서브 프로젝트 "${name.trim()}" ${onSubmit ? "수정" : "생성"} 완료 (${selectedCount}개 파일)`);
    } catch (e) {
      logError(onSubmit ? "Update subproject" : "Create subproject", e);
      toast.error(`서브 프로젝트 ${onSubmit ? "수정" : "생성"}에 실패했습니다.`);
    } finally {
      setCreating(false);
    }
  }, [name, selectedCount, profile, includedPaths, bt, toast, onCreated, onSubmit]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="card spcd" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-dialog__title">{title}</h3>

        <div className="spcd__body">
          <label className="form-field">
            <span className="form-label">서브 프로젝트 이름</span>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: gateway-module"
              autoFocus
            />
          </label>

          <div>
            <span className="form-label">포함할 파일/폴더 선택</span>
            <div className="spcd__tree-wrap">
              {tree.children.map((child) => (
                <CheckNode key={child.path} node={child} depth={0} checked={checked} onToggle={handleToggle} />
              ))}
            </div>
          </div>

          <div className="spcd__summary">
            선택: <strong>{selectedCount}개 파일</strong>
            {selectedSize > 0 && <> · {formatFileSize(selectedSize)}</>}
          </div>

          <BuildProfileForm value={profile} onChange={setProfile} registeredSdks={registeredSdks} />
        </div>

        <div className="spcd__actions">
          <button className="btn btn-secondary" onClick={onCancel}>취소</button>
          <button className="btn" onClick={handleCreate} disabled={creating || selectedCount === 0}>
            {creating ? <Spinner size={14} /> : null}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
