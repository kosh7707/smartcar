import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Finding } from "@aegis/shared";
import {
  FileText,
  Upload,
  Search,
  HardDrive,
  ChevronsDownUp,
  ChevronsUpDown,
  Code,
  Plus,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import {
  fetchSourceFilesWithComposition,
  fetchSourceFileContent,
  fetchProjectFindings,
  uploadSource,
  logError,
} from "../../api/client";
import type { SourceFileEntry, TargetMappingEntry } from "../../api/client";
import {
  EmptyState,
  Spinner,
  SeverityBadge,
  FileTreeNode,
  TargetStatusBadge,
} from "../../shared/ui";
import { useToast } from "../../contexts/ToastContext";
import { formatFileSize } from "../../utils/format";
import { buildTree, filterTree } from "../../utils/tree";
import type { TreeNode } from "../../utils/tree";
import { LANG_GROUPS, getLangColorByName } from "../../constants/languages";
import { useUploadProgress } from "../../hooks/useUploadProgress";
import { useBuildTargets } from "../../hooks/useBuildTargets";
import { SubprojectCreateDialog } from "./components/SubprojectCreateDialog";
import { BuildLogViewer } from "./components/BuildLogViewer";
import { computeFindingOverlay, getFindingCount } from "../../utils/findingOverlay";
import type { DirFindingCount } from "../../utils/findingOverlay";
import { parseLocation } from "../../utils/location";
import { HighlightedCode } from "./components/HighlightedCode";
import "./FilesPage.css";

const getSourcePath = (f: SourceFileEntry) => f.relativePath;


export const FilesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const upload = useUploadProgress();
  const bt = useBuildTargets(projectId);

  useEffect(() => {
    document.title = "AEGIS — Files";
  }, []);

  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [targetMapping, setTargetMapping] = useState<Record<string, TargetMappingEntry>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showSubprojectDialog, setShowSubprojectDialog] = useState(false);
  const [logTarget, setLogTarget] = useState<{ id: string; name: string } | null>(null);

  // Tree view state
  const [treeKey, setTreeKey] = useState(0);
  const [treeDefaultOpen, setTreeDefaultOpen] = useState<boolean | undefined>(undefined);

  // Preview state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLang, setPreviewLang] = useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load data
  const loadData = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      fetchSourceFilesWithComposition(projectId).catch(() => ({ success: true, data: [] as SourceFileEntry[] })),
      fetchProjectFindings(projectId).catch(() => [] as Finding[]),
    ])
      .then(([filesRes, f]) => {
        setSourceFiles(filesRes.data);
        setTargetMapping(filesRes.targetMapping ?? {});
        setFindings(f);
      })
      .catch((e) => {
        logError("Load files", e);
        toast.error("파일 목록을 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload files when upload completes
  useEffect(() => {
    if (upload.phase === "complete") {
      loadData();
      upload.reset();
    }
  }, [upload.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build tree
  const tree = useMemo(() => buildTree(sourceFiles, getSourcePath), [sourceFiles]);
  const displayTree = useMemo(() => {
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim().toLowerCase()) ?? { name: "", path: "", children: [] };
  }, [tree, search]);

  // Finding overlay
  const overlay = useMemo(
    () => (findings.length > 0 ? computeFindingOverlay(findings) : new Map<string, DirFindingCount>()),
    [findings],
  );

  // File findings for preview
  const selectedFileFindings = useMemo(() => {
    if (!selectedPath || findings.length === 0) return [];
    return findings.filter((f) => {
      const { fileName } = parseLocation(f.location);
      return fileName === selectedPath;
    });
  }, [selectedPath, findings]);

  const highlightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const f of selectedFileFindings) {
      const { line } = parseLocation(f.location);
      if (line) lines.add(parseInt(line));
    }
    return lines;
  }, [selectedFileFindings]);

  // Language stats
  const langStats = useMemo(() => {
    if (sourceFiles.length === 0) return [];
    const grouped: Record<string, { count: number; color: string }> = {};
    for (const f of sourceFiles) {
      const lang = f.language || "기타";
      const info = LANG_GROUPS[lang];
      const group = info?.group ?? "기타";
      const color = info?.color ?? "var(--cds-text-placeholder)";
      if (!grouped[group]) grouped[group] = { count: 0, color };
      grouped[group].count += 1;
    }
    return Object.entries(grouped)
      .map(([group, { count, color }]) => ({ group, count, color }))
      .sort((a, b) => b.count - a.count);
  }, [sourceFiles]);

  const totalSize = useMemo(
    () => sourceFiles.reduce((sum, f) => sum + (f.size || 0), 0),
    [sourceFiles],
  );

  // File click → load content
  const handleFileClick = useCallback(
    async (data: SourceFileEntry) => {
      setSelectedPath(data.relativePath);
      setPreviewContent(null);
      setPreviewLoading(true);
      setPreviewLang(data.language || "");
      try {
        const result = await fetchSourceFileContent(projectId!, data.relativePath);
        setPreviewContent(result.content);
      } catch (e) {
        logError("Source file content", e);
        toast.error("파일 내용을 불러올 수 없습니다.");
        setPreviewContent(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [projectId, toast],
  );

  // Upload
  const handleUpload = async (fileList: FileList) => {
    if (!projectId || fileList.length === 0) return;
    const files = Array.from(fileList);
    upload.setUploading();
    try {
      const { uploadId } = await uploadSource(projectId, files);
      upload.startTracking(uploadId);
    } catch (e) {
      logError("Upload files", e);
      toast.error("파일 업로드에 실패했습니다.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render delegates for FileTreeNode
  const renderFileIcon = useCallback(
    (data: SourceFileEntry) => (
      <FileText size={16} style={{ color: getLangColorByName(data.language), flexShrink: 0 }} />
    ),
    [],
  );

  const renderFileMeta = useCallback(
    (data: SourceFileEntry) => {
      const mapping = targetMapping[data.relativePath];
      return (
        <>
          {mapping && (
            <span className="ftree-meta ftree-target" title={`서브프로젝트: ${mapping.targetName}`}>
              <HardDrive size={10} /> {mapping.targetName}
            </span>
          )}
          {data.language && <span className="ftree-meta ftree-lang">{data.language}</span>}
          <span className="ftree-meta ftree-size">{formatFileSize(data.size)}</span>
        </>
      );
    },
    [targetMapping],
  );

  const renderFolderBadge = useCallback(
    (node: TreeNode<SourceFileEntry>) => {
      const counts = getFindingCount(node.path, overlay);
      if (counts.total === 0) return null;
      return (
        <span className="ftree-folder-badge">
          {counts.critical > 0 && <span className="ftree-finding-dot ftree-finding-dot--critical">{counts.critical}</span>}
          {counts.high > 0 && <span className="ftree-finding-dot ftree-finding-dot--high">{counts.high}</span>}
          {counts.medium > 0 && <span className="ftree-finding-dot ftree-finding-dot--medium">{counts.medium}</span>}
          {counts.low > 0 && <span className="ftree-finding-dot ftree-finding-dot--low">{counts.low}</span>}
        </span>
      );
    },
    [overlay],
  );

  const handleSelectFinding = useCallback((findingId: string) => {
    navigate(`/projects/${projectId}/static-analysis?finding=${findingId}`);
  }, [navigate, projectId]);

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="파일 로딩 중..." />
      </div>
    );
  }

  if (!projectId) return null;

  return (
    <div
      className={`page-enter fpage${dragOver ? " fpage--dragover" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={handleDrop}
    >
      {/* v6: page header */}
      <div className="fpage-page-header">
        <div>
          <h1 className="fpage-page-header__title">Files</h1>
          <p className="fpage-page-header__subtitle">
            <Code size={14} className="fpage-page-header__icon" />
            {sourceFiles.length}개 파일 · {formatFileSize(totalSize)}
          </p>
        </div>
        <div className="fpage-header-actions">
          {sourceFiles.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={() => setShowSubprojectDialog(true)}
            >
              <Plus size={14} />
              서브 프로젝트 생성
            </button>
          )}
          <button
            className="fpage-action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="소스코드 업로드"
          >
            <Upload size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.tar.gz,.tgz,.tar.bz2,.tar"
            className="fpage-hidden-input"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* Upload progress banner */}
      {upload.isActive && (
        <div className="card flex-center flex-gap-3" style={{ padding: "var(--cds-spacing-04) var(--cds-spacing-05)" }}>
          <Spinner size={18} />
          <span>{upload.message}</span>
        </div>
      )}

      {sourceFiles.length === 0 && !upload.isActive ? (
        <EmptyState
          icon={<Upload size={28} />}
          title="아직 업로드된 소스코드가 없습니다"
          description="소스코드 아카이브(.zip, .tar.gz)를 드래그하거나 업로드 버튼을 사용하세요"
        />
      ) : (
        <>
          {/* Language bar */}
          {langStats.length > 0 && (
            <div className="card fpage-summary">
              <div className="fpage-langbar">
                {langStats.map((item) => (
                  <div
                    key={item.group}
                    className="fpage-langbar__segment"
                    style={{ width: `${(item.count / sourceFiles.length) * 100}%`, background: item.color }}
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
          )}

          {/* Subproject list panel */}
          {bt.targets.length > 0 && (
            <div className="card fpage-subproject-card">
              <div className="card-title flex-center flex-gap-2">
                <HardDrive size={16} />
                서브 프로젝트 ({bt.targets.length}개)
              </div>
              <div className="fpage-subproject-list">
                {bt.targets.map((target) => (
                  <div key={target.id} className="fpage-subproject-row">
                    <span className="fpage-subproject-name">{target.name}</span>
                    <TargetStatusBadge status={target.status ?? "discovered"} size="sm" />
                    <span className="fpage-subproject-meta">
                      {target.relativePath}
                    </span>
                    {target.status && target.status !== "discovered" && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setLogTarget({ id: target.id, name: target.name })}
                        title="빌드 로그"
                      >
                        <ScrollText size={14} />
                        빌드 로그
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2-panel layout */}
          <div className="source-tree__layout">
            {/* Tree panel */}
            <div className="card source-tree__tree-panel">
              <div className="source-tree__tree-header">
                <div className="source-tree__search-area">
                  <Search size={14} className="source-tree__search-icon" />
                  <input
                    type="text"
                    className="source-tree__search"
                    placeholder="파일 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="source-tree__toolbar">
                  <button
                    className="source-tree__toolbar-btn"
                    title="폴더 전부 열기"
                    onClick={() => { setTreeDefaultOpen(true); setTreeKey((k) => k + 1); }}
                  >
                    <ChevronsUpDown size={16} />
                  </button>
                  <button
                    className="source-tree__toolbar-btn"
                    title="폴더 전부 접기"
                    onClick={() => { setTreeDefaultOpen(false); setTreeKey((k) => k + 1); }}
                  >
                    <ChevronsDownUp size={16} />
                  </button>
                </div>
              </div>
              <div className="source-tree__tree-body">
                {displayTree.children.length === 0 ? (
                  <div className="ftree-no-results">검색 결과가 없습니다</div>
                ) : (
                  displayTree.children.map((node) => (
                    <FileTreeNode<SourceFileEntry>
                      key={`${treeKey}-${node.path}`}
                      node={node}
                      depth={0}
                      searchOpen={search.trim().length > 0}
                      defaultOpen={treeDefaultOpen}
                      onClickFile={handleFileClick}
                      renderFileIcon={renderFileIcon}
                      renderFileMeta={renderFileMeta}
                      renderFolderBadge={renderFolderBadge}
                      selectedPath={selectedPath ?? undefined}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Preview panel */}
            <div className="card source-tree__preview-panel">
              {!selectedPath ? (
                <div className="source-tree__preview-empty">
                  <FileText size={32} />
                  <span>파일을 선택하면 내용을 미리 볼 수 있습니다</span>
                </div>
              ) : previewLoading ? (
                <div className="source-tree__preview-loading">
                  <Spinner label="로딩 중..." />
                </div>
              ) : (
                <>
                  <div className="source-tree__preview-header">
                    <FileText size={14} style={{ color: getLangColorByName(previewLang), flexShrink: 0 }} />
                    <span className="source-tree__preview-filename">{selectedPath}</span>
                    <div className="source-tree__preview-meta">
                      {previewLang && <span>{previewLang}</span>}
                    </div>
                  </div>

                  <div className="source-tree__preview-body">
                    {previewContent !== null ? (
                      <HighlightedCode
                        code={previewContent}
                        language={previewLang}
                        highlightLineNos={highlightLines}
                      />
                    ) : (
                      <div className="source-tree__preview-empty">
                        <span>파일 내용을 불러올 수 없습니다</span>
                      </div>
                    )}
                  </div>

                  {/* Findings for this file */}
                  {selectedFileFindings.length > 0 && (
                    <div className="source-tree__file-findings">
                      <div className="source-tree__file-findings-title">
                        Finding ({selectedFileFindings.length})
                      </div>
                      {selectedFileFindings.map((f) => {
                        const { line } = parseLocation(f.location);
                        return (
                          <div
                            key={f.id}
                            className="source-tree__finding-row"
                            onClick={() => handleSelectFinding(f.id)}
                          >
                            <SeverityBadge severity={f.severity} size="sm" />
                            <span className="source-tree__finding-title">{f.title}</span>
                            {line && <span className="source-tree__finding-loc">:{line}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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

      <SubprojectCreateDialog
        open={showSubprojectDialog}
        projectId={projectId}
        sourceFiles={sourceFiles}
        onCreated={() => { setShowSubprojectDialog(false); bt.load(); }}
        onCancel={() => setShowSubprojectDialog(false)}
      />

      {logTarget && projectId && (
        <BuildLogViewer
          projectId={projectId}
          targetId={logTarget.id}
          targetName={logTarget.name}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
};
