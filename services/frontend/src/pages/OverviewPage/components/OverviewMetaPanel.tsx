import React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RegisteredSdk } from "../../../api/sdk";
import { formatFileSize } from "../../../utils/format";
import type { GateCounts } from "../overviewModel";
import { getSdkStatusLabel, getSdkStatusToneClass } from "../overviewModel";

interface OverviewMetaPanelProps {
  fileCount: number;
  totalFileSize: number;
  description?: string | null;
  hasFiles: boolean;
  hasGates: boolean;
  gateCounts: GateCounts;
  approvalCount: { pending: number; total: number };
  registeredSdks: RegisteredSdk[];
  onOpenQualityGate: () => void;
  onOpenApprovals: () => void;
  onOpenSettings: () => void;
}

interface MetaCardProps {
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}

function MetaCard({ title, onClick, children }: MetaCardProps) {
  return (
    <Card
      className={`overview-meta-card ${onClick ? "overview-meta-card--interactive" : ""}`}
      onClick={onClick}
    >
      <div className="overview-meta-card__title">{title}</div>
      {children}
    </Card>
  );
}

export const OverviewMetaPanel: React.FC<OverviewMetaPanelProps> = ({
  fileCount,
  totalFileSize,
  description,
  hasFiles,
  hasGates,
  gateCounts,
  approvalCount,
  registeredSdks,
  onOpenQualityGate,
  onOpenApprovals,
  onOpenSettings,
}) => (
  <aside className="overview-meta-panel">
    <MetaCard title="프로젝트 메타데이터">
      <dl className="overview-meta-panel__dl">
        <div className="overview-meta-panel__entry">
          <dt className="overview-meta-panel__dt">Files</dt>
          <dd className="overview-meta-panel__dd overview-meta-panel__dd--mono">{fileCount}</dd>
        </div>
        {hasFiles ? (
          <div className="overview-meta-panel__entry">
            <dt className="overview-meta-panel__dt">Total Size</dt>
            <dd className="overview-meta-panel__dd overview-meta-panel__dd--mono">{formatFileSize(totalFileSize)}</dd>
          </div>
        ) : null}
        {description ? (
          <div className="overview-meta-panel__entry">
            <dt className="overview-meta-panel__dt">Description</dt>
            <dd className="overview-meta-panel__dd overview-meta-panel__dd--body">{description}</dd>
          </div>
        ) : null}
      </dl>
    </MetaCard>

    {hasGates ? (
      <MetaCard title="Quality Gate" onClick={onOpenQualityGate}>
        <div className="overview-meta-panel__badges">
          <Badge variant="outline" className="overview-gate-badge overview-gate-badge--pass">
            <CheckCircle2 size={12} /> 통과 {gateCounts.pass}
          </Badge>
          <Badge variant="outline" className="overview-gate-badge overview-gate-badge--fail">
            <XCircle size={12} /> 실패 {gateCounts.fail}
          </Badge>
          <Badge variant="outline" className="overview-gate-badge overview-gate-badge--warning">
            <AlertTriangle size={12} /> 경고 {gateCounts.warning}
          </Badge>
        </div>
      </MetaCard>
    ) : null}

    <MetaCard title="승인 요청" onClick={onOpenApprovals}>
      <div className="overview-meta-panel__approval-row">
        {approvalCount.pending > 0 ? (
          <div className="overview-meta-panel__approval-main">
            <span className="overview-meta-panel__approval-count">{approvalCount.pending}</span>
            <span className="overview-meta-panel__approval-copy">건 대기 중</span>
          </div>
        ) : (
          <p className="overview-meta-panel__approval-empty">대기 없음</p>
        )}
        {approvalCount.total > 0 ? <span className="overview-meta-panel__approval-total">총 {approvalCount.total}건</span> : null}
      </div>
    </MetaCard>

    {registeredSdks.length > 0 ? (
      <MetaCard title={`SDK (${registeredSdks.length}개)`} onClick={onOpenSettings}>
        <div className="overview-meta-panel__sdk-list">
          {registeredSdks.slice(0, 4).map((sdk) => (
            <div key={sdk.id} className="overview-meta-panel__sdk-row">
              <span className="overview-meta-panel__sdk-name">{sdk.name}</span>
              <Badge variant="outline" className={getSdkStatusToneClass(sdk.status)}>
                {getSdkStatusLabel(sdk.status)}
              </Badge>
            </div>
          ))}
        </div>
      </MetaCard>
    ) : null}
  </aside>
);
