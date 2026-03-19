import React, { useState, useCallback } from "react";
import { Upload, GitBranch, FolderArchive, FileText, Play } from "lucide-react";
import type { SourceFileEntry } from "../../api/client";
import { uploadSource, cloneSource, fetchSourceFiles, logError } from "../../api/client";
import { useToast } from "../../contexts/ToastContext";
import { Spinner } from "../ui";
import { formatFileSize } from "../../utils/format";
import "./SourceUploadView.css";

type UploadTab = "zip" | "git";

interface Props {
  projectId: string;
  onAnalysisStart: () => void;
}

export const SourceUploadView: React.FC<Props> = ({ projectId, onAnalysisStart }) => {
  const toast = useToast();
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    await handleZipUpload(file);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleZipUpload(file);
    e.target.value = "";
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleZipUpload = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".zip") && !ext.endsWith(".tar.gz") && !ext.endsWith(".tgz")) {
      toast.error("ZIP 또는 tar.gz 파일만 업로드할 수 있습니다.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadSource(projectId, file);
      setSourceFiles(result.files);
      toast.success(`${result.fileCount}개 파일 업로드 완료`);
    } catch (e) {
      logError("Upload source", e);
      toast.error("소스코드 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleGitClone = async () => {
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
  };

  const handleReupload = () => {
    setSourceFiles(null);
  };

  return (
    <div className="source-upload">
      {/* Already have source — show file tree + actions */}
      {sourceFiles && sourceFiles.length > 0 ? (
        <>
          <div className="card source-files-card">
            <div className="card-title card-title--flush">
              <FolderArchive size={16} />
              소스코드 ({sourceFiles.length}개 파일)
            </div>
            <div className="source-file-tree">
              {sourceFiles.slice(0, 50).map((f) => (
                <div key={f.relativePath} className="source-file-row">
                  <FileText size={14} className="source-file-icon" />
                  <span className="source-file-path">{f.relativePath}</span>
                  {f.language && <span className="source-file-lang">{f.language}</span>}
                  <span className="source-file-size">{formatFileSize(f.size)}</span>
                </div>
              ))}
              {sourceFiles.length > 50 && (
                <div className="source-file-more">... 외 {sourceFiles.length - 50}개 파일</div>
              )}
            </div>
          </div>

          <div className="source-actions">
            <button className="btn btn-secondary" onClick={handleReupload}>
              <Upload size={14} />
              소스코드 재업로드
            </button>
            <button className="btn" onClick={onAnalysisStart}>
              <Play size={14} />
              분석 실행
            </button>
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
            <div className="card source-loading">
              <Spinner size={32} label={tab === "zip" ? "업로드 중..." : "클론 중..."} />
            </div>
          ) : tab === "zip" ? (
            <div
              className={`card drop-zone${dragOver ? " drop-zone--active" : ""}`}
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
                <small>지원 형식: .zip, .tar.gz, .tgz</small>
              </div>
              <input
                id="source-file-input"
                type="file"
                accept=".zip,.tar.gz,.tgz"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="card source-git-form">
              <label className="form-field">
                <span className="form-label">Git URL *</span>
                <input
                  className="form-input font-mono"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/org/repo.git"
                  spellCheck={false}
                />
              </label>
              <label className="form-field">
                <span className="form-label">Branch</span>
                <input
                  className="form-input"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  placeholder="main (기본)"
                />
              </label>
              <button className="btn" onClick={handleGitClone}>
                <GitBranch size={14} />
                클론
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
