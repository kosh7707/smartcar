import React from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "../../../shared/ui";

interface FilesPageHeaderProps {
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FilesPageHeader: React.FC<FilesPageHeaderProps> = ({
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
}) => (
  <PageHeader
    surface="plain"
    title="파일 탐색기"
    action={(
      <div className="files-page-header-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenUpload} title="소스코드 업로드">
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
      </div>
    )}
  />
);
