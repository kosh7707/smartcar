import React from "react";
import type { BuildTarget, UploadedFile, Vulnerability } from "@aegis/shared";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  HardDrive,
  Loader,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { SeverityBadge, TargetStatusBadge } from "../../../shared/ui";
import { formatFileSize } from "../../../utils/format";

interface OverviewBottomGridProps {
  projectFiles: UploadedFile[];
  totalFileSize: number;
  topVulnerabilities: Vulnerability[];
  totalVulnerabilities: number;
  targets: BuildTarget[];
  targetSummary?: {
    ready: number;
    running: number;
    failed: number;
    discovered: number;
  } | null;
  onOpenFiles: () => void;
  onOpenFileDetail: (fileId: string) => void;
  onOpenVulnerabilities: () => void;
}

export const OverviewBottomGrid: React.FC<OverviewBottomGridProps> = ({
  projectFiles,
  totalFileSize,
  topVulnerabilities,
  totalVulnerabilities,
  targets,
  targetSummary,
  onOpenFiles,
  onOpenFileDetail,
  onOpenVulnerabilities,
}) => (
  <div className="overview-bottom-grid">
    <Card className="overview-files-card shadow-none">
      <CardContent className="space-y-3">
        <CardTitle className="overview-file-header" onClick={onOpenFiles}>
          <span className="flex-center flex-gap-2">
            <FileText size={16} />
            파일 ({projectFiles.length})
            {projectFiles.length > 0 && (
              <span className="overview-file-total-size">
                · {formatFileSize(totalFileSize)}
              </span>
            )}
          </span>
          <ChevronRight size={16} className="overview-header-chevron" />
        </CardTitle>
        {projectFiles.length === 0 ? (
          <p className="overview-empty-text">아직 업로드된 파일이 없습니다.</p>
        ) : (
          <div
            className={`overview-files-body${projectFiles.length >= 5 ? " has-fade" : ""}`}
          >
            {projectFiles.slice(0, 8).map((file) => (
              <div
                key={file.id}
                className="overview-file-row overview-file-row--clickable"
                onClick={() => onOpenFileDetail(file.id)}
              >
                <FileText size={14} className="overview-file-icon" />
                <div className="overview-file-info">
                  <span className="overview-file-name">{file.name}</span>
                  {file.path && file.path !== file.name && (
                    <span className="overview-file-path">
                      {file.path.slice(0, file.path.lastIndexOf("/"))}/
                    </span>
                  )}
                </div>
                {file.language && (
                  <span className="overview-lang-tag">{file.language}</span>
                )}
                <span className="overview-file-size">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
            {projectFiles.length >= 5 && (
              <div className="overview-card-fade" onClick={onOpenFiles}>
                <span>전체 보기 →</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <Card className="overview-vuln-card shadow-none">
      <CardContent className="space-y-3">
        <CardTitle
          className="overview-vuln-header"
          onClick={onOpenVulnerabilities}
        >
          <span className="flex-center flex-gap-2">
            <Shield size={16} />
            주요 취약점
          </span>
          <ChevronRight size={16} className="overview-header-chevron" />
        </CardTitle>
        {topVulnerabilities.length === 0 ? (
          <p className="overview-empty-text">발견된 취약점이 없습니다.</p>
        ) : (
          <div
            className={`overview-vuln-body${totalVulnerabilities >= 5 ? " has-fade" : ""}`}
          >
            {topVulnerabilities.map((vulnerability) => (
              <div
                key={vulnerability.id}
                className="overview-vuln-row"
                onClick={onOpenVulnerabilities}
              >
                <SeverityBadge severity={vulnerability.severity} size="sm" />
                <div className="overview-vuln-info">
                  <span className="overview-vuln-title">
                    {vulnerability.title}
                  </span>
                  {vulnerability.location && (
                    <span className="overview-vuln-location">
                      {vulnerability.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {totalVulnerabilities >= 5 && (
              <div
                className="overview-card-fade"
                onClick={onOpenVulnerabilities}
              >
                <span>전체 보기 →</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <Card className="overview-build-target-card shadow-none">
      <CardContent className="space-y-3">
        <CardTitle
          className="overview-build-target-header"
          onClick={onOpenFiles}
        >
          <span className="flex-center flex-gap-2">
            <HardDrive size={16} />
            빌드 타겟 ({targets.length}개)
          </span>
          <ChevronRight size={16} className="overview-header-chevron" />
        </CardTitle>
        {targetSummary && (
          <div className="overview-target-summary">
            <span className="overview-target-summary__item overview-target-summary__item--ready">
              <CheckCircle2 size={12} /> 준비 {targetSummary.ready}
            </span>
            <span className="overview-target-summary__item overview-target-summary__item--running">
              <Loader size={12} /> 진행 {targetSummary.running}
            </span>
            <span className="overview-target-summary__item overview-target-summary__item--failed">
              <XCircle size={12} /> 실패 {targetSummary.failed}
            </span>
            <span className="overview-target-summary__item overview-target-summary__item--discovered">
              <Search size={12} /> 감지 {targetSummary.discovered}
            </span>
          </div>
        )}
        {targets.length === 0 ? (
          <p className="overview-empty-text">등록된 빌드 타겟이 없습니다.</p>
        ) : (
          <div className="overview-build-target-body">
            {targets.map((target) => (
              <div key={target.id} className="overview-build-target-row">
                <span className="overview-build-target-name">
                  {target.name}
                </span>
                <TargetStatusBadge
                  status={target.status ?? "discovered"}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);
