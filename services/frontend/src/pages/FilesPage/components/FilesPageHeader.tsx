import React from "react";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "../../../shared/ui";
import { formatFileSize } from "../../../utils/format";

interface FilesPageHeaderProps {
  fileCount: number;
  totalSize: number;
  showCreateTarget: boolean;
  onOpenCreateTarget: () => void;
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FilesPageHeader: React.FC<FilesPageHeaderProps> = ({
  fileCount,
  totalSize,
  showCreateTarget,
  onOpenCreateTarget,
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
}) => (
  <PageHeader
    surface="plain"
    title="Files"
    subtitle={`${fileCount}개 파일 · ${formatFileSize(totalSize)}`}
    action={(
      <div className="fpage-header-actions">
        {showCreateTarget && (
          <button
            className="btn btn-sm"
            onClick={onOpenCreateTarget}
          >
            <Plus size={14} />
            BuildTarget 생성
          </button>
        )}
        <button
          className="btn btn-secondary btn-sm"
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
          className="fpage-hidden-input"
          onChange={onFileInputChange}
        />
      </div>
    )}
  />
);
