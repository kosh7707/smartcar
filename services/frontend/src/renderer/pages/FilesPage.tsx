import React, { useEffect, useRef, useState, useMemo, useCallback, DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { UploadedFile } from "@aegis/shared";
import { FileText, Upload, Trash2, Download, Search, FolderUp, HardDrive, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { fetchProjectFiles, uploadFiles, deleteProjectFile, downloadFile, logError } from "../api/client";
import { EmptyState, PageHeader, ConfirmDialog, Spinner, FileTreeNode } from "../components/ui";
import { useToast } from "../contexts/ToastContext";
import { formatFileSize } from "../utils/format";
import { buildTree, filterTree } from "../utils/tree";
import { LANG_GROUPS, getLangColor } from "../constants/languages";
import "./FilesPage.css";

const ALLOWED_EXTENSIONS = new Set(["c", "cpp", "h", "hpp", "py", "java", "js", "ts"]);

function filterSupportedFiles(fileList: File[]): { supported: File[]; skipped: string[] } {
  const supported: File[] = [];
  const skipped: string[] = [];
  for (const f of fileList) {
    const name = f.webkitRelativePath || f.name;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (ALLOWED_EXTENSIONS.has(ext)) {
      supported.push(f);
    } else {
      skipped.push(name);
    }
  }
  return { supported, skipped };
}

// ── Page ──

export const FilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const toast = useToast();
  const [treeKey, setTreeKey] = useState(0);
  const [treeDefaultOpen, setTreeDefaultOpen] = useState<boolean | undefined>(undefined);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(() => {
    if (!projectId) return;
    fetchProjectFiles(projectId)
      .then(setFiles)
      .catch((e) => { logError("Load files", e); toast.error("파일 목록을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const getFilePath = useCallback((f: UploadedFile) => f.path || f.name, []);

  const tree = useMemo(() => buildTree(files, getFilePath), [files, getFilePath]);

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

  const handleUpload = async (fileList: FileList) => {
    if (!projectId || fileList.length === 0) return;

    const { supported, skipped } = filterSupportedFiles(Array.from(fileList));

    if (skipped.length > 0) {
      const names = skipped.length <= 3
        ? skipped.join(", ")
        : `${skipped.slice(0, 3).join(", ")} 외 ${skipped.length - 3}개`;
      toast.warning(`지원하지 않는 파일 제외됨: ${names} (.c, .cpp, .h, .hpp, .py, .java, .js, .ts만 지원)`);
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
      logError("Upload files", e);
      toast.error("파일 업로드에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const handleDeleteConfirmed = async (file: UploadedFile) => {
    if (!projectId) return;
    try {
      await deleteProjectFile(projectId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      logError("Delete file", e);
      toast.error("파일 삭제에 실패했습니다.");
    }
  };

  const handleDelete = (file: UploadedFile) => {
    setConfirmDeleteFile(file);
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
      logError("Download file", e);
      toast.error("파일 다운로드에 실패했습니다.");
    }
  };

  const handleClickFile = useCallback((file: UploadedFile) => {
    navigate(`/projects/${projectId}/files/${file.id}`);
  }, [navigate, projectId]);

  const renderFileIcon = useCallback((file: UploadedFile) => (
    <FileText size={16} style={{ color: getLangColor(file), flexShrink: 0 }} />
  ), []);

  const renderFileMeta = useCallback((file: UploadedFile) => (
    <>
      {file.language && <span className="ftree-meta ftree-lang">{file.language}</span>}
      <span className="ftree-meta ftree-size">{formatFileSize(file.size)}</span>
    </>
  ), []);

  const renderActions = useCallback((file: UploadedFile) => (
    <>
      <button
        className="btn-icon"
        title="다운로드"
        onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
      >
        <Download size={13} />
      </button>
      <button
        className="btn-icon btn-danger"
        title="삭제"
        onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
      >
        <Trash2 size={13} />
      </button>
    </>
  ), []);

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
      <div className="page-enter centered-loader">
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
      <PageHeader
        title="파일 탐색기"
        icon={<HardDrive size={20} />}
        subtitle={`${files.length}개 파일 · ${formatFileSize(totalSize)}`}
        action={
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
              webkitdirectory=""
              directory=""
              multiple
              className="fpage-hidden-input"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </div>
        }
      />

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
                  <FileTreeNode<UploadedFile>
                    key={`${treeKey}-${node.path}`}
                    node={node}
                    depth={0}
                    searchOpen={search.trim().length > 0}
                    defaultOpen={treeDefaultOpen}
                    onClickFile={handleClickFile}
                    renderFileIcon={renderFileIcon}
                    renderFileMeta={renderFileMeta}
                    renderActions={renderActions}
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

      <ConfirmDialog
        open={confirmDeleteFile !== null}
        title="파일 삭제"
        message={confirmDeleteFile ? `"${confirmDeleteFile.name}" 파일을 삭제하시겠습니까?` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => { if (confirmDeleteFile) handleDeleteConfirmed(confirmDeleteFile); setConfirmDeleteFile(null); }}
        onCancel={() => setConfirmDeleteFile(null)}
      />
    </div>
  );
};
