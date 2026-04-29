import React from "react";
import { Upload } from "lucide-react";

interface FilesPageHeaderProps {
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FilesPageHeader: React.FC<FilesPageHeaderProps> = ({
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
}) => {
  return (
    <header className="page-header page-header--plain page-head files-page-header">
      <div className="page-header__left">
        <div className="page-header__text">
          <h1 className="page-header__title">분석 매니페스트</h1>
        </div>
      </div>
      <div className="page-header__action actions files-page-header-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onOpenUpload}
          title="소스코드 업로드"
        >
          <Upload size={14} />
          소스 코드 업로드
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.tar.gz,.tgz,.tar.bz2,.tar"
          className="files-page-header-input"
          onChange={onFileInputChange}
        />
      </div>
    </header>
  );
};
