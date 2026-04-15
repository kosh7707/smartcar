import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Upload, GitBranch, FolderArchive, Folder, Play, Search, Crosshair } from "lucide-react";
import type { SourceFileEntry } from "../../../api/client";
import { uploadSource, cloneSource, fetchSourceFiles, logError } from "../../../api/client";
import { useToast } from "../../../contexts/ToastContext";
import { useUploadProgress } from "../../../hooks/useUploadProgress";
import { Spinner, ConnectionStatusBanner } from "../../../shared/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFileSize } from "../../../utils/format";
import { buildTree, countFiles } from "../../../utils/tree";
import { LANG_GROUPS } from "../../../constants/languages";
import "./SourceUploadView.css";

type UploadTab = "zip" | "git";

interface Props {
  projectId: string;
  onAnalysisStart: () => void;
  /** Called to open the full source tree explorer */
  onBrowseTree?: () => void;
  /** Called to auto-discover build targets */
  onDiscoverTargets?: () => void;
}

export const SourceUploadView: React.FC<Props> = ({ projectId, onAnalysisStart, onBrowseTree, onDiscoverTargets }) => {
  const toast = useToast();
  const upload = useUploadProgress();
  const [tab, setTab] = useState<UploadTab>("zip");
  const [uploading, setUploading] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Git form
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");

  // Load existing source files on mount
  const loadSourceFiles = useCallback(async () => {
    try {
      const files = await fetchSourceFiles(projectId);
      if (files.length > 0) setSourceFiles(files);
    } catch {
      // No source yet — normal
    }
  }, [projectId]);

  React.useEffect(() => { loadSourceFiles(); }, [loadSourceFiles]);

  // Reload source files when upload completes
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
    // Only react to phase transitions; callbacks (loadSourceFiles, upload.reset) are stable
  }, [upload.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZipUpload = useCallback(async (file: File) => {
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
  }, [projectId, toast, upload]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    await handleZipUpload(file);
  }, [handleZipUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleZipUpload(file);
    e.target.value = "";
  }, [handleZipUpload]);

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

  // Compute top-level directory summary
  const topDirs = useMemo(() => {
    if (!sourceFiles || sourceFiles.length === 0) return [];
    const tree = buildTree(sourceFiles, (f) => f.relativePath);
    return tree.children
      .filter((c) => !c.data) // folders only
      .map((c) => ({ name: c.name, count: countFiles(c) }))
      .sort((a, b) => b.count - a.count);
  }, [sourceFiles]);

  // Language stats for bar
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

  const totalSize = useMemo(
    () => (sourceFiles ?? []).reduce((sum, f) => sum + (f.size || 0), 0),
    [sourceFiles],
  );

  return (
    <div className="source-upload">
      <ConnectionStatusBanner connectionState={upload.connectionState} />
      {/* Already have source — show summary + actions */}
      {sourceFiles && sourceFiles.length > 0 ? (
        <>
          <Card className="source-files-card gap-0">
            <CardHeader>
              <CardTitle className="source-files-card__title">
                <FolderArchive size={16} />
                소스코드 ({sourceFiles.length}개 파일 · {formatFileSize(totalSize)})
              </CardTitle>
            </CardHeader>

            {/* Language bar */}
            {langStats.length > 0 && (
              <div className="source-summary-langbar">
                {langStats.map((item) => (
                  <div
                    key={item.group}
                    className="source-summary-langbar__seg"
                    style={{
                      width: `${(item.count / sourceFiles.length) * 100}%`,
                      background: item.color,
                    }}
                    title={`${item.group}: ${item.count}`}
                  />
                ))}
              </div>
            )}

            {/* Top-level directories */}
            {topDirs.length > 0 && (
              <CardContent className="source-dir-list">
                {topDirs.map((d) => (
                  <div key={d.name} className="source-dir-row">
                    <Folder size={14} className="source-dir-icon" />
                    <span className="source-dir-name">{d.name}/</span>
                    <span className="source-dir-count">{d.count}개 파일</span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <div className="source-actions">
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
          {/* Tab selector */}
          <div className="source-tabs">
            <button
              className={`source-tab${tab === "zip" ? " source-tab--active" : ""}`}
              onClick={() => setTab("zip")}
            >
              <FolderArchive size={14} />
              ZIP / tar.gz 업로드
            </button>
            <button
              className={`source-tab${tab === "git" ? " source-tab--active" : ""}`}
              onClick={() => setTab("git")}
            >
              <GitBranch size={14} />
              Git 클론
            </button>
          </div>

          {uploading ? (
            <Card className="source-loading">
              <Spinner size={32} label={upload.isActive ? upload.message : (tab === "zip" ? "업로드 중..." : "클론 중...")} />
            </Card>
          ) : tab === "zip" ? (
            <Card
              className={`drop-zone${dragOver ? " drop-zone--active" : ""}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => document.getElementById("source-file-input")?.click()}
            >
              <div className="drop-zone-content">
                <div className="drop-zone-icon">
                  <Upload size={36} />
                </div>
                <p>프로젝트 소스코드를 드래그하거나 클릭하여 업로드</p>
                <small>지원 형식: .zip, .tar.gz, .tgz, .tar.bz2, .tar</small>
              </div>
              <input
                id="source-file-input"
                type="file"
                accept=".zip,.tar.gz,.tgz,.tar.bz2,.tar"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </Card>
          ) : (
            <Card className="source-git-form">
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
                <Input
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  placeholder="main (기본)"
                />
              </Label>
              <Button className="source-git-submit" onClick={handleGitClone}>
                <GitBranch size={14} />
                클론
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
