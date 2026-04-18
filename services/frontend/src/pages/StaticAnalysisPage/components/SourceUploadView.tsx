import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Crosshair, Folder, FolderArchive, GitBranch, Play, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SourceFileEntry } from "../../../api/client";
import { cloneSource, fetchSourceFiles, logError, uploadSource } from "../../../api/client";
import { LANG_GROUPS } from "../../../constants/languages";
import { useToast } from "../../../contexts/ToastContext";
import { useUploadProgress } from "../../../hooks/useUploadProgress";
import { ConnectionStatusBanner, Spinner } from "../../../shared/ui";
import { formatFileSize } from "../../../utils/format";
import { buildTree, countFiles } from "../../../utils/tree";

type UploadTab = "zip" | "git";

interface Props {
  projectId: string;
  onAnalysisStart: () => void;
  onBrowseTree?: () => void;
  onDiscoverTargets?: () => void;
}

export const SourceUploadView: React.FC<Props> = ({ projectId, onAnalysisStart, onBrowseTree, onDiscoverTargets }) => {
  const toast = useToast();
  const upload = useUploadProgress();
  const [tab, setTab] = useState<UploadTab>("zip");
  const [uploading, setUploading] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");

  const loadSourceFiles = useCallback(async () => {
    try {
      const files = await fetchSourceFiles(projectId);
      if (files.length > 0) setSourceFiles(files);
    } catch {
      // No source yet — normal
    }
  }, [projectId]);

  React.useEffect(() => {
    loadSourceFiles();
  }, [loadSourceFiles]);

  useEffect(() => {
    if (upload.phase === "complete") {
      loadSourceFiles();
      upload.reset();
      setUploading(false);
    } else if (upload.phase === "failed") {
      toast.error(upload.error ?? "소스코드 업로드에 실패했습니다.");
      upload.reset();
      setUploading(false);
    }
  }, [upload.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZipUpload = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith(".zip") && !ext.endsWith(".tar.gz") && !ext.endsWith(".tgz") && !ext.endsWith(".tar.bz2") && !ext.endsWith(".tar")) {
        toast.error("ZIP, tar.gz, tgz, tar.bz2, tar 파일만 업로드할 수 있습니다.");
        return;
      }
      setUploading(true);
      upload.setUploading();
      try {
        const { uploadId } = await uploadSource(projectId, file);
        upload.startTracking(uploadId);
      } catch (e) {
        logError("Upload source", e);
        toast.error("소스코드 업로드에 실패했습니다.");
        setUploading(false);
        upload.reset();
      }
    },
    [projectId, toast, upload],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      await handleZipUpload(file);
    },
    [handleZipUpload],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await handleZipUpload(file);
      e.target.value = "";
    },
    [handleZipUpload],
  );

  const handleGitClone = useCallback(async () => {
    if (!gitUrl.trim()) {
      toast.error("Git URL을 입력해주세요.");
      return;
    }
    setUploading(true);
    try {
      const result = await cloneSource(projectId, gitUrl.trim(), gitBranch.trim() || undefined);
      setSourceFiles(result.files);
      toast.success(`${result.fileCount}개 파일 클론 완료`);
    } catch (e) {
      logError("Clone source", e);
      toast.error("소스코드 클론에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }, [projectId, gitUrl, gitBranch, toast]);

  const handleReupload = () => {
    setSourceFiles(null);
  };

  const topDirs = useMemo(() => {
    if (!sourceFiles || sourceFiles.length === 0) return [];
    const tree = buildTree(sourceFiles, (f) => f.relativePath);
    return tree.children
      .filter((c) => !c.data)
      .map((c) => ({ name: c.name, count: countFiles(c) }))
      .sort((a, b) => b.count - a.count);
  }, [sourceFiles]);

  const langStats = useMemo(() => {
    if (!sourceFiles || sourceFiles.length === 0) return [];
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

  const totalSize = useMemo(() => (sourceFiles ?? []).reduce((sum, f) => sum + (f.size || 0), 0), [sourceFiles]);

  return (
    <div className="space-y-5">
      <ConnectionStatusBanner connectionState={upload.connectionState} />
      {sourceFiles && sourceFiles.length > 0 ? (
        <>
          <Card className="shadow-none">
            <CardHeader className="gap-3">
              <CardTitle className="flex items-center gap-3">
                <FolderArchive size={16} />
                소스코드 ({sourceFiles.length}개 파일 · {formatFileSize(totalSize)})
              </CardTitle>
            </CardHeader>
            {langStats.length > 0 && (
              <div className="mx-5 mt-1 flex h-1.5 overflow-hidden rounded-full bg-border/70">
                {langStats.map((item) => (
                  <div
                    key={item.group}
                    className="min-w-[2px] transition-[width]"
                    style={{
                      width: `${(item.count / sourceFiles.length) * 100}%`,
                      background: item.color,
                    }}
                    title={`${item.group}: ${item.count}`}
                  />
                ))}
              </div>
            )}
            {topDirs.length > 0 && (
              <CardContent className="space-y-1 pt-4">
                {topDirs.map((d) => (
                  <div key={d.name} className="flex items-center gap-3 py-2 text-sm">
                    <Folder size={14} className="shrink-0 text-[var(--cds-support-warning)]" />
                    <span className="flex-1 font-mono font-medium text-foreground">{d.name}/</span>
                    <span className="text-muted-foreground">{d.count}개 파일</span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <div className="flex flex-wrap justify-end gap-3">
            {onBrowseTree && (
              <Button variant="outline" onClick={onBrowseTree}>
                <Search size={14} />
                소스코드 탐색
              </Button>
            )}
            {onDiscoverTargets && (
              <Button variant="outline" onClick={onDiscoverTargets}>
                <Crosshair size={14} />
                타겟 탐색
              </Button>
            )}
            <Button variant="outline" onClick={handleReupload}>
              <Upload size={14} />
              재업로드
            </Button>
            <Button onClick={onAnalysisStart}>
              <Play size={14} />
              분석 실행
            </Button>
          </div>
        </>
      ) : (
        <>
          <Tabs value={tab} onValueChange={(value) => setTab(value as UploadTab)}>
            <TabsList className="h-auto flex-wrap rounded-xl bg-muted/40 p-1">
              <TabsTrigger value="zip" className="gap-2 px-4 py-2 text-sm">
                <FolderArchive size={14} />
                ZIP / tar.gz 업로드
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-2 px-4 py-2 text-sm">
                <GitBranch size={14} />
                Git 클론
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {uploading ? (
            <Card className="shadow-none">
              <CardContent className="flex items-center justify-center py-16">
                <Spinner size={32} label={upload.isActive ? upload.message : tab === "zip" ? "업로드 중..." : "클론 중..."} />
              </CardContent>
            </Card>
          ) : tab === "zip" ? (
            <Card
              className={[
                "cursor-pointer border-2 border-dashed shadow-none transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-[var(--cds-border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,244,0.55))] hover:border-primary hover:bg-primary/5",
              ].join(" ")}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById("source-file-input")?.click()}
            >
              <CardContent className="px-5 py-16 text-center text-muted-foreground">
                <div className="mb-4 flex justify-center text-muted-foreground">
                  <Upload size={36} />
                </div>
                <p className="mb-2 text-base text-foreground">프로젝트 소스코드를 드래그하거나 클릭하여 업로드</p>
                <small className="text-sm text-muted-foreground">지원 형식: .zip, .tar.gz, .tgz, .tar.bz2, .tar</small>
              </CardContent>
              <input
                id="source-file-input"
                type="file"
                accept=".zip,.tar.gz,.tgz,.tar.bz2,.tar"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </Card>
          ) : (
            <Card className="shadow-none">
              <CardContent className="space-y-5 p-6">
                <Label className="form-field">
                  <span className="form-label">Git URL *</span>
                  <Input
                    className="font-mono"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/org/repo.git"
                    spellCheck={false}
                  />
                </Label>
                <Label className="form-field">
                  <span className="form-label">Branch</span>
                  <Input value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} placeholder="main (기본)" />
                </Label>
                <div className="flex justify-end">
                  <Button onClick={handleGitClone}>
                    <GitBranch size={14} />
                    클론
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
