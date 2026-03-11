import React, { useEffect, useRef, useState, useMemo, useCallback, DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { UploadedFile } from "@smartcar/shared";
import { FileText, Folder, FolderOpen, Upload, Trash2, Download, ChevronRight, Search, FolderUp, HardDrive, AlertTriangle, X, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { fetchProjectFiles, uploadFiles, deleteProjectFile, downloadFile } from "../api/client";
import { EmptyState, Spinner } from "../components/ui";
import { formatFileSize } from "../utils/format";
import "./FilesPage.css";

const ALLOWED_EXTENSIONS = new Set(["c", "cpp", "h", "hpp", "py", "java", "js", "ts"]);

function filterSupportedFiles(fileList: File[]): { supported: File[]; skipped: string[] } {
  const supported: File[] = [];
  const skipped: string[] = [];
  for (const f of fileList) {
    const name = (f as any).webkitRelativePath || f.name;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ALLOWED_EXTENSIONS.has(ext)) {
      supported.push(f);
    } else {
      skipped.push(name);
    }
  }
  return { supported, skipped };
}

// ── Language config ──

const LANG_COLORS: Record<string, string> = {
  c: "#555599",
  cpp: "#004482",
  h: "#6a5acd",
  hpp: "#6a5acd",
  python: "#3572a5",
  java: "#b07219",
  javascript: "#f1e05a",
  typescript: "#3178c6",
};

const LANG_GROUPS: Record<string, { group: string; color: string }> = {
  c: { group: "C/C++", color: "#555599" },
  cpp: { group: "C/C++", color: "#555599" },
  h: { group: "C/C++", color: "#6a5acd" },
  hpp: { group: "C/C++", color: "#6a5acd" },
  python: { group: "Python", color: "#3572a5" },
  java: { group: "Java", color: "#b07219" },
  javascript: { group: "JavaScript", color: "#f1e05a" },
  typescript: { group: "TypeScript", color: "#3178c6" },
};

function getLangColor(file: UploadedFile): string {
  if (file.language && LANG_COLORS[file.language]) return LANG_COLORS[file.language];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return LANG_COLORS[ext] ?? "var(--text-tertiary)";
}

// ── Tree data ──

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  file?: UploadedFile;
}

function buildTree(files: UploadedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [] };

  for (const file of files) {
    const filePath = (file as any).path || file.name;
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join("/");

      if (isFile) {
        current.children.push({ name: part, path: pathSoFar, children: [], file });
      } else {
        let folder = current.children.find((c) => c.name === part && !c.file);
        if (!folder) {
          folder = { name: part, path: pathSoFar, children: [] };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aIsFolder = !a.file;
      const bIsFolder = !b.file;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root.children);

  return root;
}

function countFiles(node: TreeNode): number {
  if (node.file) return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}

function filterTree(node: TreeNode, query: string): TreeNode | null {
  if (node.file) {
    return node.name.toLowerCase().includes(query) ? node : null;
  }
  const filtered = node.children
    .map((c) => filterTree(c, query))
    .filter(Boolean) as TreeNode[];
  if (filtered.length === 0 && !node.name.toLowerCase().includes(query)) return null;
  return { ...node, children: filtered };
}

// ── Tree node component ──

const FileTreeNode: React.FC<{
  node: TreeNode;
  depth: number;
  searchOpen: boolean;
  defaultOpen?: boolean;
  onClickFile: (file: UploadedFile) => void;
  onDeleteFile: (file: UploadedFile) => void;
  onDownloadFile: (file: UploadedFile) => void;
}> = ({ node, depth, searchOpen, defaultOpen, onClickFile, onDeleteFile, onDownloadFile }) => {
  const [open, setOpen] = useState(defaultOpen ?? depth < 2);
  const isFolder = !node.file;

  // When searching, force all folders open
  const effectiveOpen = searchOpen || open;

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
          onClick={() => setOpen(!open)}
        >
          <div className="ftree-indent">{guides}</div>
          <ChevronRight size={14} className={`ftree-chevron${effectiveOpen ? " ftree-chevron--open" : ""}`} />
          {effectiveOpen
            ? <FolderOpen size={16} className="ftree-icon--folder" />
            : <Folder size={16} className="ftree-icon--folder" />
          }
          <span className="ftree-name">{node.name}</span>
          <span className="ftree-meta ftree-count">{countFiles(node)}개</span>
        </div>
        {effectiveOpen && node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            searchOpen={searchOpen}
            defaultOpen={defaultOpen}
            onClickFile={onClickFile}
            onDeleteFile={onDeleteFile}
            onDownloadFile={onDownloadFile}
          />
        ))}
      </>
    );
  }

  const langColor = node.file ? getLangColor(node.file) : "var(--text-tertiary)";

  return (
    <div
      className="ftree-row ftree-row--file"
      onClick={() => node.file && onClickFile(node.file)}
    >
      <div className="ftree-indent">{guides}</div>
      <span className="ftree-icon-spacer" />
      <FileText size={16} style={{ color: langColor, flexShrink: 0 }} />
      <span className="ftree-name">{node.name}</span>
      {node.file?.language && <span className="ftree-meta ftree-lang">{node.file.language}</span>}
      <span className="ftree-meta ftree-size">{node.file ? formatFileSize(node.file.size) : ""}</span>
      <div className="ftree-actions">
        <button
          className="btn-icon"
          title="다운로드"
          onClick={(e) => { e.stopPropagation(); node.file && onDownloadFile(node.file); }}
        >
          <Download size={13} />
        </button>
        <button
          className="btn-icon btn-danger"
          title="삭제"
          onClick={(e) => { e.stopPropagation(); node.file && onDeleteFile(node.file); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ── Page ──

export const FilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "warning"; message: string } | null>(null);
  const [treeKey, setTreeKey] = useState(0);
  const [treeDefaultOpen, setTreeDefaultOpen] = useState<boolean | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(() => {
    if (!projectId) return;
    fetchProjectFiles(projectId)
      .then(setFiles)
      .catch((e) => console.error("Failed to load files:", e))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const tree = useMemo(() => buildTree(files), [files]);

  const displayTree = useMemo(() => {
    if (!search.trim()) return tree;
    const filtered = filterTree(tree, search.trim().toLowerCase());
    return filtered ?? { name: "", path: "", children: [] };
  }, [tree, search]);

  const langStats = useMemo(() => {
    const grouped: Record<string, { count: number; color: string }> = {};
    for (const f of files) {
      const lang = f.language || "기타";
      const info = LANG_GROUPS[lang];
      const group = info?.group ?? "기타";
      const color = info?.color ?? "var(--text-tertiary)";
      if (!grouped[group]) grouped[group] = { count: 0, color };
      grouped[group].count += 1;
    }
    return Object.entries(grouped)
      .map(([group, { count, color }]) => ({ group, count, color }))
      .sort((a, b) => b.count - a.count);
  }, [files]);

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + (f.size || 0), 0), [files]);

  const showToast = useCallback((type: "error" | "warning", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleUpload = async (fileList: FileList) => {
    if (!projectId || fileList.length === 0) return;

    const { supported, skipped } = filterSupportedFiles(Array.from(fileList));

    if (skipped.length > 0) {
      const names = skipped.length <= 3
        ? skipped.join(", ")
        : `${skipped.slice(0, 3).join(", ")} 외 ${skipped.length - 3}개`;
      showToast("warning", `지원하지 않는 파일 제외됨: ${names} (.c, .cpp, .h, .hpp, .py, .java, .js, .ts만 지원)`);
    }

    if (supported.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadFiles(projectId, supported);
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (e) {
      console.error("Upload failed:", e);
      showToast("error", "파일 업로드에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const handleDelete = async (file: UploadedFile) => {
    if (!projectId) return;
    if (!confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return;
    try {
      await deleteProjectFile(projectId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleDownload = async (file: UploadedFile) => {
    try {
      const content = await downloadFile(file.id);
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleClickFile = (file: UploadedFile) => {
    navigate(`/projects/${projectId}/files/${file.id}`);
  };

  // Drag & Drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  if (loading) {
    return (
      <div className="page-enter fpage-loading">
        <Spinner size={36} label="파일 로딩 중..." />
      </div>
    );
  }

  return (
    <div
      className={`page-enter fpage${dragOver ? " fpage--dragover" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header panel */}
      <div className="card fpage-hero">
        <div className="fpage-hero__top">
          <div className="fpage-hero__title-area">
            <div className="fpage-hero__icon">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="fpage-hero__title">파일 탐색기</h2>
              <p className="fpage-hero__subtitle">{files.length}개 파일 · {formatFileSize(totalSize)}</p>
            </div>
          </div>
          <div className="fpage-header-actions">
            <button
              className="fpage-action-btn"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              title="폴더 업로드"
            >
              <FolderUp size={20} />
            </button>
            <button
              className="fpage-action-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="파일 업로드"
            >
              <Upload size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".c,.cpp,.h,.hpp,.py,.java,.js,.ts"
              className="fpage-hidden-input"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: "", directory: "" } as any)}
              multiple
              className="fpage-hidden-input"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={<Upload size={28} />}
          title="아직 업로드된 파일이 없습니다"
          description="파일 또는 폴더를 드래그하거나, 상단 버튼으로 업로드하세요"
        />
      ) : (
        <>
          {/* Summary card */}
          <div className="card fpage-summary">
            <div className="card-title">파일 구성</div>
            <div className="fpage-langbar">
              {langStats.map((item) => (
                <div
                  key={item.group}
                  className="fpage-langbar__segment"
                  style={{ width: `${(item.count / files.length) * 100}%`, background: item.color }}
                  title={`${item.group}: ${item.count}`}
                />
              ))}
            </div>
            <div className="fpage-langbar__legend">
              {langStats.map((item) => (
                <div key={item.group} className="fpage-langbar__legend-item">
                  <span className="fpage-langbar__dot" style={{ background: item.color }} />
                  <span className="fpage-langbar__legend-label">{item.group}</span>
                  <span className="fpage-langbar__legend-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tree card */}
          <div className="card fpage-tree-card">
            <div className="fpage-tree-card__header">
              <div className="fpage-tree-card__search-area">
                <Search size={14} className="fpage-search__icon" />
                <input
                  type="text"
                  className="fpage-tree-card__search"
                  placeholder="파일 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="fpage-tree-card__toolbar">
                <button
                  className="fpage-action-btn"
                  title="폴더 전부 열기"
                  onClick={() => { setTreeDefaultOpen(true); setTreeKey((k) => k + 1); }}
                >
                  <ChevronsUpDown size={16} />
                </button>
                <button
                  className="fpage-action-btn"
                  title="폴더 전부 접기"
                  onClick={() => { setTreeDefaultOpen(false); setTreeKey((k) => k + 1); }}
                >
                  <ChevronsDownUp size={16} />
                </button>
              </div>
            </div>
            <div className="fpage-tree-card__body">
              {displayTree.children.length === 0 ? (
                <div className="ftree-no-results">
                  검색 결과가 없습니다
                </div>
              ) : (
                displayTree.children.map((node) => (
                  <FileTreeNode
                    key={`${treeKey}-${node.path}`}
                    node={node}
                    depth={0}
                    searchOpen={search.trim().length > 0}
                    defaultOpen={treeDefaultOpen}
                    onClickFile={handleClickFile}
                    onDeleteFile={handleDelete}
                    onDownloadFile={handleDownload}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="fpage-drop-overlay">
          <Upload size={40} />
          <span>파일을 여기에 놓으세요</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fpage-toast fpage-toast--${toast.type}`}>
          <AlertTriangle size={16} />
          <span className="fpage-toast__message">{toast.message}</span>
          <button className="fpage-toast__close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
