import "./FilesSourceUploadButton.css";
import React from "react";
import { Upload } from "lucide-react";

interface FilesSourceUploadButtonProps {
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FilesSourceUploadButton: React.FC<FilesSourceUploadButtonProps> = ({
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
}) => (
  <>
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={onOpenUpload}
      title="소스코드 업로드"
    >
      <Upload size={14} />
      소스 업로드
    </button>
    <input
      ref={fileInputRef}
      type="file"
      accept=".zip,.tar.gz,.tgz,.tar.bz2,.tar"
      className="files-page-header-input"
      onChange={onFileInputChange}
    />
  </>
);
