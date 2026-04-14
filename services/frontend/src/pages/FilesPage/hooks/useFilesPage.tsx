import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Finding } from "@aegis/shared";
import { FileText, HardDrive } from "lucide-react";
import {
  fetchProjectFindings,
  fetchSourceFileContent,
  fetchSourceFilesWithComposition,
  logError,
  uploadSource,
} from "../../../api/client";
import type { SourceFileEntry, TargetMappingEntry } from "../../../api/client";
import { getLangColorByName, LANG_GROUPS } from "../../../constants/languages";
import { useFilesWorkspaceLayout } from "./useFilesWorkspaceLayout";
import { computeFindingOverlay, getFindingCount } from "../../../utils/findingOverlay";
import type { DirFindingCount } from "../../../utils/findingOverlay";
import { formatFileSize } from "../../../utils/format";
import { parseLocation } from "../../../utils/location";
import { buildTree, filterTree } from "../../../utils/tree";
import type { TreeNode } from "../../../utils/tree";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import type { useUploadProgress } from "../../../hooks/useUploadProgress";

const getSourcePath = (file: SourceFileEntry) => file.relativePath;

const collectFolderPaths = (node: TreeNode<SourceFileEntry>): Set<string> => {
  const paths = new Set<string>();
  const walk = (current: TreeNode<SourceFileEntry>) => {
    if (current.data) return;
    if (current.path) paths.add(current.path);
    current.children.forEach(walk);
  };
  walk(node);
  return paths;
};

const collectDefaultOpenPaths = (node: TreeNode<SourceFileEntry>, maxDepth = 1): Set<string> => {
  const paths = new Set<string>();
  const walk = (current: TreeNode<SourceFileEntry>, depth: number) => {
    if (current.data) return;
    if (current.path && depth <= maxDepth) paths.add(current.path);
    current.children.forEach((child) => walk(child, depth + 1));
  };
  walk(node, 0);
  return paths;
};

type ToastApi = {
  error: (message: string) => void;
};

export function useFilesPage(
  projectId: string | undefined,
  navigate: (to: string) => void,
  toast: ToastApi,
  upload: ReturnType<typeof useUploadProgress>,
  buildTargets: ReturnType<typeof useBuildTargets>,
) {
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [targetMapping, setTargetMapping] = useState<Record<string, TargetMappingEntry>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showBuildTargetDialog, setShowBuildTargetDialog] = useState(false);
  const [logTarget, setLogTarget] = useState<{ id: string; name: string } | null>(null);
  const [openPaths, setOpenPaths] = useState<Set<string> | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLang, setPreviewLang] = useState("");
  const workspaceLayout = useFilesWorkspaceLayout();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "AEGIS — Files";
  }, []);

  const loadData = useCallback(() => {
    if (!projectId) {
      setSourceFiles([]);
      setTargetMapping({});
      setFindings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetchSourceFilesWithComposition(projectId).catch(() => ({ success: true, data: [] as SourceFileEntry[] })),
      fetchProjectFindings(projectId).catch(() => [] as Finding[]),
    ])
      .then(([filesRes, nextFindings]) => {
        setSourceFiles(filesRes.data);
        setTargetMapping(filesRes.targetMapping ?? {});
        setFindings(nextFindings);
      })
      .catch((error) => {
        logError("Load files", error);
        toast.error("파일 목록을 불러올 수 없습니다.");
      })
      .finally(() => setLoading(false));
  }, [projectId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (upload.phase === "complete") {
      loadData();
      upload.reset();
    }
  }, [loadData, upload]);

  const tree = useMemo(() => buildTree(sourceFiles, getSourcePath), [sourceFiles]);
  const displayTree = useMemo(() => {
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim().toLowerCase()) ?? { name: "", path: "", children: [] };
  }, [search, tree]);
  const effectiveOpenPaths = useMemo(
    () => openPaths ?? collectDefaultOpenPaths(tree),
    [openPaths, tree],
  );

  const overlay = useMemo(
    () => (findings.length > 0 ? computeFindingOverlay(findings) : new Map<string, DirFindingCount>()),
    [findings],
  );

  const selectedFileFindings = useMemo(() => {
    if (!selectedPath || findings.length === 0) return [];
    return findings.filter((finding) => {
      const { fileName } = parseLocation(finding.location);
      return fileName === selectedPath;
    });
  }, [findings, selectedPath]);

  const highlightLines = useMemo(() => {
    const lines = new Set<number>();
    for (const finding of selectedFileFindings) {
      const { line } = parseLocation(finding.location);
      if (line) lines.add(parseInt(line));
    }
    return lines;
  }, [selectedFileFindings]);

  const langStats = useMemo(() => {
    if (sourceFiles.length === 0) return [];
    const grouped: Record<string, { count: number; color: string }> = {};
    for (const file of sourceFiles) {
      const language = file.language || "기타";
      const info = LANG_GROUPS[language];
      const group = info?.group ?? "기타";
      const color = info?.color ?? "var(--cds-text-placeholder)";
      if (!grouped[group]) grouped[group] = { count: 0, color };
      grouped[group].count += 1;
    }
    return Object.entries(grouped)
      .map(([group, value]) => ({ group, count: value.count, color: value.color }))
      .sort((a, b) => b.count - a.count);
  }, [sourceFiles]);

  const totalSize = useMemo(
    () => sourceFiles.reduce((sum, file) => sum + (file.size || 0), 0),
    [sourceFiles],
  );

  const handleFileClick = useCallback(async (file: SourceFileEntry) => {
    if (!projectId) return;
    setSelectedPath(file.relativePath);
    setPreviewContent(null);
    setPreviewLoading(true);
    setPreviewLang(file.language || "");
    try {
      const result = await fetchSourceFileContent(projectId, file.relativePath);
      setPreviewContent(result.content);
    } catch (error) {
      logError("Source file content", error);
      toast.error("파일 내용을 불러올 수 없습니다.");
      setPreviewContent(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [projectId, toast]);

  const handleUpload = useCallback(async (fileList: FileList) => {
    if (!projectId || fileList.length === 0) return;
    const files = Array.from(fileList);
    upload.setUploading();
    try {
      const { uploadId } = await uploadSource(projectId, files);
      upload.startTracking(uploadId);
    } catch (error) {
      logError("Upload files", error);
      toast.error("파일 업로드에 실패했습니다.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [projectId, toast, upload]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files.length > 0) {
      void handleUpload(event.dataTransfer.files);
    }
  }, [handleUpload]);

  const renderFileIcon = useCallback(
    (data: SourceFileEntry) => (
      <FileText size={16} style={{ color: getLangColorByName(data.language), flexShrink: 0 }} />
    ),
    [],
  );

  const renderFileMeta = useCallback((data: SourceFileEntry) => {
    const mapping = targetMapping[data.relativePath];
    return (
      <>
        {mapping && (
          <span className="ftree-meta ftree-target" title={`BuildTarget: ${mapping.targetName}`}>
            <HardDrive size={10} /> {mapping.targetName}
          </span>
        )}
        {data.language && <span className="ftree-meta ftree-lang">{data.language}</span>}
        <span className="ftree-meta ftree-size">{formatFileSize(data.size)}</span>
      </>
    );
  }, [targetMapping]);

  const renderFolderBadge = useCallback((node: TreeNode<SourceFileEntry>) => {
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
  }, [overlay]);

  const handleSelectFinding = useCallback((findingId: string) => {
    navigate(`/projects/${projectId}/static-analysis?finding=${findingId}`);
  }, [navigate, projectId]);

  const onExpandAll = useCallback(() => setOpenPaths(collectFolderPaths(tree)), [tree]);
  const onCollapseAll = useCallback(() => setOpenPaths(new Set()), []);
  const onToggleFolder = useCallback((path: string, open: boolean) => {
    setOpenPaths((prev) => {
      const next = new Set(prev ?? collectDefaultOpenPaths(tree));
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });
  }, [tree]);

  return {
    sourceFiles,
    findings,
    loading,
    search,
    setSearch,
    dragOver,
    setDragOver,
    showBuildTargetDialog,
    setShowBuildTargetDialog,
    logTarget,
    setLogTarget,
    selectedPath,
    previewContent,
    previewLoading,
    previewLang,
    workspaceLayout,
    fileInputRef,
    displayTree,
    effectiveOpenPaths,
    selectedFileFindings,
    highlightLines,
    langStats,
    totalSize,
    buildTargets,
    upload,
    handleDrop,
    handleUpload,
    handleFileClick,
    renderFileIcon,
    renderFileMeta,
    renderFolderBadge,
    handleSelectFinding,
    onExpandAll,
    onCollapseAll,
    onToggleFolder,
    onBuildTargetCreated: () => {
      setShowBuildTargetDialog(false);
      void buildTargets.load();
    },
  };
}
