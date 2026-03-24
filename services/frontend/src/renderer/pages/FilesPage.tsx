import React, { useEffect, useRef, useState, useMemo, useCallback, DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { UploadedFile } from "@aegis/shared";
import { FileText, Upload, Trash2, Download, Search, FolderUp, HardDrive, ChevronsDownUp, ChevronsUpDown, Binary, Archive, ImageIcon, FileQuestion, FileCode, Terminal, Wrench, Settings, BookOpen, Cpu, Link2 } from "lucide-react";
import { fetchProjectFiles, fetchSourceFilesWithComposition, uploadSource, deleteProjectFile, downloadFile, logError } from "../api/client";
import type { SourceFileEntry } from "../api/client";
import { EmptyState, PageHeader, ConfirmDialog, Spinner, FileTreeNode, TargetStatusBadge } from "../components/ui";
import { useToast } from "../contexts/ToastContext";
import { formatFileSize } from "../utils/format";
import { buildTree, filterTree } from "../utils/tree";
import { LANG_GROUPS, getLangColor, inferLanguage } from "../constants/languages";
import { useUploadProgress } from "../hooks/useUploadProgress";
import { useBuildTargets } from "../hooks/useBuildTargets";
import { SubprojectCreateDialog } from "../components/static/SubprojectCreateDialog";
import { Crosshair } from "lucide-react";
import "./FilesPage.css";

// No client-side extension filter — S2 accepts all files (500MB server limit)

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
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<UploadedFile | null>(null);
  const [serverComposition, setServerComposition] = useState<Record<string, { count: number; bytes: number }> | null>(null);
  const [serverTotalSize, setServerTotalSize] = useState(0);

  // Persist folder open/close state in sessionStorage
  const storageKey = `aegis:openPaths:${projectId}`;
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [openPathsInitialized, setOpenPathsInitialized] = useState(() => {
    return sessionStorage.getItem(storageKey) !== null;
  });
  const [sourceFileMeta, setSourceFileMeta] = useState<Map<string, { fileType?: string; previewable?: boolean }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadProgress();
  const bt = useBuildTargets(projectId);
  const [showSubprojectDialog, setShowSubprojectDialog] = useState(false);
  const [sourceFilesRaw, setSourceFilesRaw] = useState<SourceFileEntry[]>([]);

  const loadFiles = useCallback(() => {
    if (!projectId) return;
    Promise.all([
      fetchProjectFiles(projectId).catch(() => [] as UploadedFile[]),
      fetchSourceFilesWithComposition(projectId).catch(() => ({ data: [] as SourceFileEntry[], success: true })),
    ])
      .then(([projectFiles, sourceResult]) => {
        const sourceFiles = sourceResult.data ?? [];
        setSourceFilesRaw(sourceFiles);
        // Store server-side composition
        if (sourceResult.composition) setServerComposition(sourceResult.composition);
        if (sourceResult.totalSize) setServerTotalSize(sourceResult.totalSize);
        // Source files are the primary source of truth
        const meta = new Map<string, { fileType?: string; previewable?: boolean }>();
        const sourceAsUploaded: UploadedFile[] = sourceFiles.map((sf) => {
          const id = `source:${sf.relativePath}`;
          meta.set(id, { fileType: sf.fileType, previewable: sf.previewable });
          return {
            id,
            name: sf.relativePath.split("/").pop() || sf.relativePath,
            size: sf.size,
            language: sf.language || inferLanguage(sf.relativePath) || undefined,
            path: sf.relativePath,
          };
        });
        setSourceFileMeta(meta);
        const sourcePaths = new Set(sourceFiles.map((sf) => sf.relativePath));
        const legacyOnly = projectFiles.filter((pf) => !sourcePaths.has(pf.path || pf.name));
        setFiles([...sourceAsUploaded, ...legacyOnly]);
      })
      .catch((e) => { logError("Load files", e); toast.error("파일 목록을 불러올 수 없습니다."); })
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const getFilePath = useCallback((f: UploadedFile) => f.path || f.name, []);

  const tree = useMemo(() => buildTree(files, getFilePath), [files, getFilePath]);

  // Auto-open top-level folders on first load (no stored state)
  useEffect(() => {
    if (!openPathsInitialized && tree.children.length > 0) {
      const initial = new Set<string>();
      for (const child of tree.children) {
        if (!child.data) initial.add(child.path); // open top-level folders
      }
      setOpenPaths(initial);
      setOpenPathsInitialized(true);
    }
  }, [tree, openPathsInitialized]);

  const allFolderPaths = useMemo(() => {
    const paths: string[] = [];
    const walk = (n: typeof tree) => {
      if (!n.data && n.path) paths.push(n.path);
      n.children.forEach(walk);
    };
    walk(tree);
    return paths;
  }, [tree]);

  const handleExpandAll = useCallback(() => {
    const all = new Set(allFolderPaths);
    setOpenPaths(all);
    sessionStorage.setItem(storageKey, JSON.stringify([...all]));
  }, [allFolderPaths, storageKey]);

  const handleCollapseAll = useCallback(() => {
    setOpenPaths(new Set());
    sessionStorage.setItem(storageKey, "[]");
  }, [storageKey]);

  const handleToggleFolder = useCallback((path: string, isOpen: boolean) => {
    setOpenPaths((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(path);
      else next.delete(path);
      sessionStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }, [storageKey]);

  const displayTree = useMemo(() => {
    if (!search.trim()) return tree;
    const filtered = filterTree(tree, search.trim().toLowerCase());
    return filtered ?? { name: "", path: "", children: [] };
  }, [tree, search]);

  // GitHub Linguist-style colors for composition groups
  const COMP_COLORS: Record<string, string> = {
    "C/C++": "#555599", "Assembly": "#6e4c13", "Python": "#3572a5",
    "Java": "#b07219", "JavaScript": "#f1e05a", "TypeScript": "#3178c6",
    "HTML/CSS": "#e34c26", "Shell": "#89e051", "Build": "#064f8c",
    "Config": "#cb171e", "Docs": "#083fa1", "Linker": "#6e4c13",
  };

  // Use server composition if available, else fallback to client-side
  const langStats = useMemo(() => {
    if (serverComposition) {
      return Object.entries(serverComposition)
        .map(([group, { count }]) => ({
          group,
          count,
          color: COMP_COLORS[group] ?? "var(--text-tertiary)",
        }))
        .sort((a, b) => b.count - a.count);
    }
    // Fallback: client-side grouping
    const grouped: Record<string, { count: number; color: string }> = {};
    for (const f of files) {
      const lang = f.language || inferLanguage(f.path || f.name) || "기타";
      const info = LANG_GROUPS[lang];
      const group = info?.group ?? "기타";
      const color = info?.color ?? "var(--text-tertiary)";
      if (!grouped[group]) grouped[group] = { count: 0, color };
      grouped[group].count += 1;
    }
    return Object.entries(grouped)
      .map(([group, { count, color }]) => ({ group, count, color }))
      .sort((a, b) => b.count - a.count);
  }, [serverComposition, files]);

  const totalSize = useMemo(() => serverTotalSize || files.reduce((sum, f) => sum + (f.size || 0), 0), [serverTotalSize, files]);

  // Reload files when upload completes
  useEffect(() => {
    if (upload.phase === "complete") {
      loadFiles();
      upload.reset();
    }
  }, [upload.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (fileList: FileList) => {
    if (!projectId || fileList.length === 0) return;

    const files = Array.from(fileList);
    upload.setUploading();
    setUploading(true);
    try {
      const { uploadId } = await uploadSource(projectId, files);
      upload.startTracking(uploadId);
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
    if (file.id.startsWith("source:")) {
      const meta = sourceFileMeta.get(file.id);
      if (meta?.previewable === false) {
        toast.warning(`이 파일은 미리보기할 수 없습니다 (${meta.fileType ?? "binary"})`);
        return;
      }
    }
    navigate(`/projects/${projectId}/files/${encodeURIComponent(file.id)}`);
  }, [navigate, projectId, sourceFileMeta, toast]);

  const renderFileIcon = useCallback((file: UploadedFile) => {
    if (file.id.startsWith("source:")) {
      const meta = sourceFileMeta.get(file.id);
      const grey = { color: "var(--text-tertiary)", flexShrink: 0 as const };
      switch (meta?.fileType) {
        case "source":
          return <FileCode size={16} style={{ color: getLangColor(file), flexShrink: 0 }} />;
        case "config":
          return <Settings size={16} style={grey} />;
        case "build":
          return <Wrench size={16} style={{ color: "#064f8c", flexShrink: 0 }} />;
        case "script":
          return <Terminal size={16} style={{ color: "#89e051", flexShrink: 0 }} />;
        case "doc":
          return <BookOpen size={16} style={grey} />;
        case "linker":
          return <Link2 size={16} style={grey} />;
        case "executable":
          return <Cpu size={16} style={grey} />;
        case "object":
        case "shared-lib":
          return <Binary size={16} style={grey} />;
        case "archive":
          return <Archive size={16} style={grey} />;
        case "image":
          return <ImageIcon size={16} style={grey} />;
        case "unknown":
          return <FileQuestion size={16} style={grey} />;
      }
    }
    return <FileText size={16} style={{ color: getLangColor(file), flexShrink: 0 }} />;
  }, [sourceFileMeta]);

  const renderFileMeta = useCallback((file: UploadedFile) => (
    <>
      {file.language && <span className="ftree-meta ftree-lang">{file.language}</span>}
      {file.size > 0 && <span className="ftree-meta ftree-size">{formatFileSize(file.size)}</span>}
    </>
  ), []);

  const renderActions = useCallback((file: UploadedFile) => {
    // Source files (id starts with "source:") don't support download/delete via legacy API
    if (file.id.startsWith("source:")) return null;
    return (
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
    );
  }, []);

  // Build target map: relativePath → BuildTarget
  const targetByPath = useMemo(() => {
    const map = new Map<string, typeof bt.targets[0]>();
    for (const t of bt.targets) {
      const p = t.relativePath.replace(/\/$/, ""); // strip trailing slash
      map.set(p, t);
    }
    return map;
  }, [bt.targets]);

  const renderFolderBadge = useCallback((node: { path: string }) => {
    const target = targetByPath.get(node.path);
    if (target) {
      return <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />;
    }
    return null;
  }, [targetByPath]);

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
            {sourceFilesRaw.length > 0 && (
              <button
                className="fpage-action-btn"
                onClick={() => setShowSubprojectDialog(true)}
                title="서브 프로젝트 생성"
              >
                <Crosshair size={20} />
              </button>
            )}
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

      {/* Upload progress banner */}
      {upload.isActive && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}>
          <Spinner size={18} />
          <span>{upload.message}</span>
        </div>
      )}
      {upload.phase === "failed" && upload.error && (
        <div className="card" style={{ color: "var(--severity-high)", padding: "var(--space-3) var(--space-4)" }}>
          업로드 실패: {upload.error}
        </div>
      )}

      {files.length === 0 && !upload.isActive ? (
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
                  onClick={handleExpandAll}
                >
                  <ChevronsUpDown size={16} />
                </button>
                <button
                  className="fpage-action-btn"
                  title="폴더 전부 접기"
                  onClick={handleCollapseAll}
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
                    key={node.path}
                    node={node}
                    depth={0}
                    searchOpen={search.trim().length > 0}
                    openPaths={openPaths}
                    onToggleFolder={handleToggleFolder}
                    onClickFile={handleClickFile}
                    renderFileIcon={renderFileIcon}
                    renderFileMeta={renderFileMeta}
                    renderActions={renderActions}
                    renderFolderBadge={renderFolderBadge}
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

      <SubprojectCreateDialog
        open={showSubprojectDialog}
        projectId={projectId ?? ""}
        sourceFiles={sourceFilesRaw}
        onCreated={() => { setShowSubprojectDialog(false); bt.load(); }}
        onCancel={() => setShowSubprojectDialog(false)}
      />
    </div>
  );
};
