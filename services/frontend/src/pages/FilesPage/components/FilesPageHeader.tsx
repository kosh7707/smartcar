import React from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    title="파일 탐색기"
    subtitle={`${fileCount}개 파일 · ${formatFileSize(totalSize)}`}
    action={(
      <div className="fpage-header-actions">
        {showCreateTarget && (
          <Button
            size="sm"
            onClick={onOpenCreateTarget}
          >
            <Plus size={14} />
            빌드 타겟 생성
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenUpload}
          title="소스코드 업로드"
        >
          <Upload size={14} />
          소스 업로드
        </Button>
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
