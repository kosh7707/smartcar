import React from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../../../shared/ui";
import { formatFileSize } from "../../../utils/format";

interface FilesPageHeaderProps {
  fileCount: number;
  totalSize: number;
  targetCount?: number;
  showCreateTarget: boolean;
  onOpenCreateTarget: () => void;
  onOpenUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FilesPageHeader: React.FC<FilesPageHeaderProps> = ({
  fileCount,
  totalSize,
  targetCount,
  showCreateTarget,
  onOpenCreateTarget,
  onOpenUpload,
  fileInputRef,
  onFileInputChange,
}) => {
  const stats: Array<{ label: string; value: string; tone?: "info" | "ok" }> = [
    { label: "Files", value: fileCount.toString(), tone: fileCount > 0 ? "info" : undefined },
    { label: "Size", value: formatFileSize(totalSize) },
    { label: "Targets", value: (targetCount ?? 0).toString(), tone: (targetCount ?? 0) > 0 ? "ok" : undefined },
    { label: "Status", value: fileCount === 0 ? "empty" : "ready" },
  ];

  return (
    <div className="overview-identity">
      <PageHeader
        surface="plain"
        title="파일 탐색기"
        subtitle="소스 아카이브를 업로드하고 빌드 타겟으로 묶어 분석 파이프라인에 태웁니다."
        action={(
          <div className="files-page-header-actions">
            {showCreateTarget && (
              <Button size="sm" onClick={onOpenCreateTarget}>
                <Plus size={14} />
                빌드 타겟 생성
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenUpload} title="소스코드 업로드">
              <Upload size={14} />
              소스 업로드
            </Button>
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
      <dl className="overview-identity__strip" aria-label="파일 탐색기 지표">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`overview-identity__stat${stat.tone ? ` overview-identity__stat--${stat.tone}` : ""}`}
          >
            <dt className="overview-identity__label">{stat.label}</dt>
            <dd className="overview-identity__value">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
