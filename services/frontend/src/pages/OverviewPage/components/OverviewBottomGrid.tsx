import React from "react";
import type { BuildTarget, UploadedFile, Vulnerability } from "@aegis/shared";
import { CheckCircle2, ChevronRight, FileText, HardDrive, Loader, Search, Shield, XCircle } from "lucide-react";
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

export const OverviewBottomGrid: React.FC<OverviewBottomGridProps> = ({ projectFiles, totalFileSize, topVulnerabilities, totalVulnerabilities, targets, targetSummary, onOpenFiles, onOpenFileDetail, onOpenVulnerabilities }) => (
  <section className="overview-bottom-grid">
    <div className="panel overview-bottom-card">
      <div className="panel-body">
        <div className="overview-bottom-head">
          <div className="overview-bottom-title"><FileText size={16} /> 파일 ({projectFiles.length}){projectFiles.length > 0 ? <span className="overview-bottom-sub">· {formatFileSize(totalFileSize)}</span> : null}</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenFiles}>보기 <ChevronRight size={16} /></button>
        </div>

        {projectFiles.length === 0 ? (
          <p className="overview-bottom-empty">아직 업로드된 파일이 없습니다.</p>
        ) : (
          <>
            <div className="scroll-area overview-bottom-scroll">
              <div className="overview-bottom-list">
                {projectFiles.slice(0, 8).map((file) => (
                  <button key={file.id} type="button" className="overview-bottom-file" onClick={() => onOpenFileDetail(file.id)}>
                    <FileText size={14} />
                    <div className="overview-bottom-name">
                      <div>{file.name}</div>
                      {file.path && file.path !== file.name ? <div className="overview-bottom-meta">{file.path.slice(0, file.path.lastIndexOf("/"))}/</div> : null}
                    </div>
                    {file.language ? <span>{file.language}</span> : null}
                    <span className="overview-bottom-meta">{formatFileSize(file.size)}</span>
                  </button>
                ))}
              </div>
            </div>
            {projectFiles.length >= 5 ? <button type="button" className="btn btn-ghost btn-sm overview-bottom-action" onClick={onOpenFiles}>전체 보기 <ChevronRight size={16} /></button> : null}
          </>
        )}
      </div>
    </div>

    <div className="panel overview-bottom-card">
      <div className="panel-body">
        <div className="overview-bottom-head">
          <div className="overview-bottom-title"><Shield size={16} /> 주요 취약점</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenVulnerabilities}>보기 <ChevronRight size={16} /></button>
        </div>

        {topVulnerabilities.length === 0 ? (
          <p className="overview-bottom-empty">발견된 취약점이 없습니다.</p>
        ) : (
          <>
            <div className="scroll-area overview-bottom-scroll">
              <div className="overview-bottom-list">
                {topVulnerabilities.map((vulnerability) => (
                  <button key={vulnerability.id} type="button" className="overview-bottom-vuln" onClick={onOpenVulnerabilities}>
                    <SeverityBadge severity={vulnerability.severity} />
                    <div className="overview-bottom-name">
                      <div>{vulnerability.title}</div>
                      {vulnerability.location ? <div className="overview-bottom-meta">{vulnerability.location}</div> : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {totalVulnerabilities >= 5 ? <button type="button" className="btn btn-ghost btn-sm overview-bottom-action" onClick={onOpenVulnerabilities}>전체 보기 <ChevronRight size={16} /></button> : null}
          </>
        )}
      </div>
    </div>

    <div className="panel overview-bottom-card">
      <div className="panel-body">
        <div className="overview-bottom-head">
          <div className="overview-bottom-title"><HardDrive size={16} /> 빌드 타겟 ({targets.length}개)</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenFiles}>보기 <ChevronRight size={16} /></button>
        </div>

        {targetSummary ? (
          <div className="report-summary-tags">
            <span className="overview-target-summary-badge overview-target-summary-badge--ready"><CheckCircle2 size={12} /> 준비 {targetSummary.ready}</span>
            <span className="overview-target-summary-badge overview-target-summary-badge--running"><Loader size={12} /> 진행 {targetSummary.running}</span>
            <span className="overview-target-summary-badge overview-target-summary-badge--failed"><XCircle size={12} /> 실패 {targetSummary.failed}</span>
            <span className="overview-target-summary-badge overview-target-summary-badge--discovered"><Search size={12} /> 감지 {targetSummary.discovered}</span>
          </div>
        ) : null}

        {targets.length === 0 ? (
          <p className="overview-bottom-empty">등록된 빌드 타겟이 없습니다.</p>
        ) : (
          <div className="overview-bottom-list">
            {targets.map((target) => (
              <div key={target.id} className="overview-bottom-target">
                <span className="overview-bottom-name">{target.name}</span>
                <TargetStatusBadge status={target.status ?? "discovered"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>
);
