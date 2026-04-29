import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Finding, Severity } from "@aegis/shared";
import {
  fetchProjectFindings,
  fetchSourceFileContent,
  fetchSourceFilesWithComposition,
  logError,
  uploadSource,
} from "../../../api/client";
import type { SourceFileEntry, TargetMappingEntry } from "../../../api/client";
import { LANG_GROUPS } from "../../../constants/languages";
import { useFilesWorkspaceLayout } from "./useFilesWorkspaceLayout";
import { getFileClass } from "../../../utils/fileClass";
import type { FileClass } from "../../../utils/fileClass";
import { parseLocation } from "../../../utils/location";
import { buildTree, filterTree } from "../../../utils/tree";
import type { TreeNode } from "../../../utils/tree";
import type { useBuildTargets } from "../../../hooks/useBuildTargets";
import type { useUploadProgress } from "../../../hooks/useUploadProgress";

const getSourcePath = (file: SourceFileEntry) => file.relativePath;

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

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
  const [composition, setComposition] = useState<Record<string, { count: number; bytes: number }>>({});
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
  const [previewFileClass, setPreviewFileClass] = useState<FileClass>("text");
  const [previewSize, setPreviewSize] = useState(0);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const [activeTargetFilters, setActiveTargetFilters] = useState<Set<string>>(() => new Set());
  const workspaceLayout = useFilesWorkspaceLayout();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "AEGIS — Files";
  }, []);

  const loadData = useCallback(() => {
    if (!projectId) {
      setSourceFiles([]);
      setTargetMapping({});
      setComposition({});
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
        setComposition(filesRes.composition ?? {});
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

  const coveredCount = useMemo(() => {
    let n = 0;
    for (const file of sourceFiles) {
      if (targetMapping[file.relativePath]) n += 1;
    }
    return n;
  }, [sourceFiles, targetMapping]);

  const coveragePct = useMemo(() => {
    if (sourceFiles.length === 0) return 0;
    return Math.round((coveredCount / sourceFiles.length) * 100);
  }, [coveredCount, sourceFiles.length]);

  const isUntargetedMajority = useMemo(() => {
    if (sourceFiles.length === 0) return false;
    return coveredCount * 2 < sourceFiles.length;
  }, [coveredCount, sourceFiles.length]);

  const findingsByFile = useMemo(() => {
    const map = new Map<string, { total: number; topSeverity: Severity }>();
    for (const finding of findings) {
      const { fileName } = parseLocation(finding.location);
      if (!fileName) continue;
      const prev = map.get(fileName);
      const sev = finding.severity;
      if (!prev) {
        map.set(fileName, { total: 1, topSeverity: sev });
      } else {
        const nextTop =
          SEVERITY_RANK[sev] > SEVERITY_RANK[prev.topSeverity] ? sev : prev.topSeverity;
        map.set(fileName, { total: prev.total + 1, topSeverity: nextTop });
      }
    }
    return map;
  }, [findings]);

  const handleFileClick = useCallback(async (file: SourceFileEntry) => {
    if (!projectId) return;
    setSelectedPath(file.relativePath);
    setPreviewContent(null);
    setPreviewLang(file.language || "");
    setPreviewSize(file.size || 0);
    const cls = getFileClass(file.relativePath, file.language);
    setPreviewFileClass(cls);
    if (cls !== "text") {
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
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

  const openPreviewDrawer = useCallback(
    async (path: string) => {
      const file = sourceFiles.find((f) => f.relativePath === path);
      if (!file) return;
      setPreviewDrawerOpen(true);
      await handleFileClick(file);
    },
    [handleFileClick, sourceFiles],
  );

  const closePreview = useCallback(() => {
    setPreviewDrawerOpen(false);
    setSelectedPath(null);
    setPreviewContent(null);
  }, []);

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

  const toggleTargetFilter = useCallback((targetKey: string) => {
    setActiveTargetFilters((prev) => {
      const next = new Set(prev);
      if (next.has(targetKey)) next.delete(targetKey);
      else next.add(targetKey);
      return next;
    });
  }, []);

  const clearTargetFilters = useCallback(() => {
    setActiveTargetFilters(new Set());
  }, []);

  return {
    sourceFiles,
    targetMapping,
    composition,
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
    previewFileClass,
    previewSize,
    previewDrawerOpen,
    workspaceLayout,
    fileInputRef,
    displayTree,
    effectiveOpenPaths,
    selectedFileFindings,
    highlightLines,
    langStats,
    totalSize,
    coveredCount,
    coveragePct,
    isUntargetedMajority,
    findingsByFile,
    activeTargetFilters,
    buildTargets,
    upload,
    handleDrop,
    handleUpload,
    handleFileClick,
    openPreviewDrawer,
    closePreview,
    handleSelectFinding,
    onExpandAll,
    onCollapseAll,
    onToggleFolder,
    toggleTargetFilter,
    clearTargetFilters,
    onBuildTargetCreated: () => {
      setShowBuildTargetDialog(false);
      void buildTargets.load();
    },
  };
}
