import React, { useState, useRef, useCallback } from "react";
import { Archive, Binary, FolderOpen, Upload, X } from "lucide-react";
import type { RegisteredSdk, SdkArtifactKind } from "../api/sdk";
import { registerSdkByUpload } from "../api/sdk";
import { logError } from "../api/core";
import { useToast } from "../contexts/ToastContext";

interface Props {
  projectId: string;
  onRegistered: (sdk: RegisteredSdk) => void;
  onCancel: () => void;
}

const MODES: { key: SdkArtifactKind; label: string; icon: React.ReactNode }[] = [
  { key: "archive", label: "아카이브", icon: <Archive size={14} /> },
  { key: "bin", label: "바이너리", icon: <Binary size={14} /> },
  { key: "folder", label: "폴더", icon: <FolderOpen size={14} /> },
];

const ARCHIVE_ACCEPT = ".tar.gz,.tar.xz,.tar.bz2,.zip";
const BIN_ACCEPT = ".bin,.run,.sh";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SdkUploadForm: React.FC<Props> = ({ projectId, onRegistered, onCancel }) => {
  const toast = useToast();
  const [mode, setMode] = useState<SdkArtifactKind>("archive");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [folderError, setFolderError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleModeChange = useCallback((newMode: SdkArtifactKind) => {
    setMode(newMode);
    setFiles([]);
    setFolderError("");
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const selected = Array.from(e.target.files);
    if (mode === "folder") {
      if (selected.length === 0) {
        setFolderError("빈 폴더입니다. 파일이 포함된 폴더를 선택하세요.");
        setFiles([]);
        return;
      }
      setFolderError("");
    }
    setFiles(selected);
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (mode === "folder") return; // folder mode uses directory picker only
    if (e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }, [mode]);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setFolderError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }, []);

  const canSubmit = name.trim().length > 0 && files.length > 0 && !submitting && !folderError;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let relativePaths: string[] | undefined;
      if (mode === "folder") {
        relativePaths = files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
      }
      const sdk = await registerSdkByUpload(
        projectId,
        name.trim(),
        files,
        description.trim() || undefined,
        relativePaths,
      );
      onRegistered(sdk);
      toast.success("SDK 등록 요청 완료 — 진행률을 확인하세요.");
    } catch (e) {
      logError("Register SDK upload", e);
      toast.error("SDK 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, projectId, name, description, files, mode, onRegistered, toast]);

  const accept = mode === "archive" ? ARCHIVE_ACCEPT : mode === "bin" ? BIN_ACCEPT : undefined;

  return (
    <div className="card sdk-register-form">
      {/* Mode tabs */}
      <div className="sdk-register-form__modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`sdk-mode-btn${mode === m.key ? " active" : ""}`}
            type="button"
            onClick={() => handleModeChange(m.key)}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Name + Description fields */}
      <div className="sdk-register-form__fields">
        <label className="form-field">
          <span className="form-label">SDK 이름</span>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: TI AM335x SDK"
            autoFocus
          />
        </label>
        <label className="form-field">
          <span className="form-label">설명 (선택)</span>
          <input
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="SDK에 대한 간략한 설명"
          />
        </label>
      </div>

      {/* File picker area */}
      {mode === "folder" ? (
        <div className="sdk-upload-zone sdk-upload-zone--folder">
          <FolderOpen size={24} className="sdk-upload-zone__icon" />
          <p>폴더 선택</p>
          <small>디렉터리 구조가 보존됩니다</small>
          <input
            ref={folderInputRef}
            type="file"
            /* @ts-expect-error webkitdirectory is non-standard but widely supported */
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFileSelect}
            className="sdk-upload-zone__input"
          />
          {folderError && <div className="sdk-upload-zone__error">{folderError}</div>}
        </div>
      ) : (
        <div
          className="sdk-upload-zone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} className="sdk-upload-zone__icon" />
          <p>{mode === "archive" ? "아카이브 파일 업로드" : "바이너리 파일 업로드"}</p>
          <small>
            {mode === "archive"
              ? "지원: .tar.gz, .tar.xz, .tar.bz2, .zip"
              : "지원: .bin, .run, .sh"}
          </small>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
        </div>
      )}

      {/* File preview list */}
      {files.length > 0 && (
        <div className="sdk-file-preview">
          <div className="sdk-file-preview__header">
            <span>{files.length}개 파일 선택됨</span>
            <button className="btn-icon" onClick={clearFiles} title="선택 초기화">
              <X size={14} />
            </button>
          </div>
          <div className="sdk-file-preview__list">
            {files.slice(0, 20).map((f, i) => (
              <div key={i} className="sdk-file-preview__item">
                <span className="sdk-file-preview__name">
                  {mode === "folder"
                    ? (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
                    : f.name}
                </span>
                <span className="sdk-file-preview__size">{formatSize(f.size)}</span>
              </div>
            ))}
            {files.length > 20 && (
              <div className="sdk-file-preview__more">...외 {files.length - 20}개</div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="sdk-register-form__actions">
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>취소</button>
        <button className="btn btn-sm" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
};
