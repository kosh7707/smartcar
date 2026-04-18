import React, { useCallback, useRef, useState } from "react";
import { Archive, Binary, FolderOpen, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { RegisteredSdk, SdkArtifactKind } from "../../../api/sdk";
import { registerSdkByUpload } from "../../../api/sdk";
import { logError } from "../../../api/core";
import { useToast } from "../../../contexts/ToastContext";

interface SdkUploadFormProps {
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
const BIN_ACCEPT = ".bin";

function isAcceptedFile(fileName: string, mode: SdkArtifactKind): boolean {
  const lower = fileName.toLowerCase();
  if (mode === "archive") {
    return lower.endsWith(".tar.gz")
      || lower.endsWith(".tar.xz")
      || lower.endsWith(".tar.bz2")
      || lower.endsWith(".zip");
  }
  if (mode === "bin") {
    return lower.endsWith(".bin");
  }
  return true;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SdkUploadForm: React.FC<SdkUploadFormProps> = ({ projectId, onRegistered, onCancel }) => {
  const toast = useToast();
  const [mode, setMode] = useState<SdkArtifactKind>("archive");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [folderError, setFolderError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validateSelectedFiles = useCallback((selected: File[]) => {
    if (mode === "folder") {
      if (selected.length === 0) {
        setFolderError("빈 폴더입니다. 파일이 포함된 폴더를 선택하세요.");
        setFiles([]);
        return false;
      }
      setFolderError("");
      return true;
    }

    if (selected.length !== 1) {
      toast.error("아카이브/바이너리 업로드는 파일 1개만 선택하세요.");
      setFiles([]);
      return false;
    }

    if (!isAcceptedFile(selected[0].name, mode)) {
      toast.error(mode === "archive" ? "지원: .tar.gz, .tar.xz, .tar.bz2, .zip" : ".bin 파일만 업로드할 수 있습니다.");
      setFiles([]);
      return false;
    }

    setFolderError("");
    return true;
  }, [mode, toast]);

  const handleModeChange = useCallback((newMode: SdkArtifactKind) => {
    setMode(newMode);
    setFiles([]);
    setFolderError("");
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const selected = Array.from(event.target.files);
    if (!validateSelectedFiles(selected)) return;
    setFiles(selected);
  }, [validateSelectedFiles]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (mode === "folder") return;
    if (event.dataTransfer.files.length > 0) {
      const selected = Array.from(event.dataTransfer.files);
      if (!validateSelectedFiles(selected)) return;
      setFiles(selected);
    }
  }, [mode, validateSelectedFiles]);

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
      const relativePaths = mode === "folder"
        ? files.map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
        : undefined;
      const sdk = await registerSdkByUpload(
        projectId,
        name.trim(),
        files,
        description.trim() || undefined,
        relativePaths,
      );
      onRegistered(sdk);
      toast.success("SDK 등록 요청 완료 — 진행률을 확인하세요.");
    } catch (error) {
      logError("Register SDK upload", error);
      toast.error("SDK 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, description, files, mode, name, onRegistered, projectId, toast]);

  const accept = mode === "archive" ? ARCHIVE_ACCEPT : mode === "bin" ? BIN_ACCEPT : undefined;

  return (
    <Card className="sdk-register-form border-border bg-card/95 shadow-none">
      <CardContent className="space-y-4 p-4">
      <div className="sdk-register-form__modes">
        {MODES.map((entry) => {
          return (
            <Button
              key={entry.key}
              type="button"
              variant={mode === entry.key ? "default" : "outline"}
              className={cn("sdk-mode-btn", mode === entry.key && "active")}
              onClick={() => handleModeChange(entry.key)}
            >
              {entry.icon} {entry.label}
            </Button>
          );
        })}
      </div>

      <div className="sdk-register-form__fields">
        <Label className="flex flex-col items-start gap-2">
          <span className="text-sm font-medium text-muted-foreground">SDK 이름</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: TI AM335x SDK"
            autoFocus
          />
        </Label>
        <Label className="flex flex-col items-start gap-2">
          <span className="text-sm font-medium text-muted-foreground">설명 (선택)</span>
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="SDK에 대한 간략한 설명"
          />
        </Label>
      </div>

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
          onDragOver={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} className="sdk-upload-zone__icon" />
          <p>{mode === "archive" ? "아카이브 파일 업로드" : "바이너리 파일 업로드"}</p>
          <small>{mode === "archive" ? "지원: .tar.gz, .tar.xz, .tar.bz2, .zip" : "지원: .bin"}</small>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="sdk-upload-zone__hidden-input"
            onChange={handleFileSelect}
          />
        </div>
      )}

      {files.length > 0 && (
        <div className="sdk-file-preview">
          <div className="sdk-file-preview__header">
            <span>{files.length}개 파일 선택됨</span>
            <Button variant="ghost" size="icon-sm" onClick={clearFiles} title="선택 초기화" aria-label="선택 초기화">
              <X size={14} />
            </Button>
          </div>
          <div className="sdk-file-preview__list">
            {files.slice(0, 20).map((file, index) => (
              <div key={`${file.name}-${index}`} className="sdk-file-preview__item">
                <span className="sdk-file-preview__name">
                  {mode === "folder"
                    ? (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
                    : file.name}
                </span>
                <span className="sdk-file-preview__size">{formatSize(file.size)}</span>
              </div>
            ))}
            {files.length > 20 && (
              <div className="sdk-file-preview__more">...외 {files.length - 20}개</div>
            )}
          </div>
        </div>
      )}

      <div className="sdk-register-form__actions">
        <Button variant="outline" size="sm" onClick={onCancel}>취소</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "등록 중..." : "등록"}
        </Button>
      </div>
      </CardContent>
    </Card>
  );
};
