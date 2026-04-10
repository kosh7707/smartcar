import React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
  <div className="overview-meta-panel">
    <div className="overview-meta-section">
      <div className="overview-meta-section__title">Project Metadata</div>
      <div className="overview-meta-rows">
        <div>
          <span className="overview-meta-row__label">Files</span>
          <span className="overview-meta-row__value">{fileCount}</span>
        </div>
        {hasFiles && (
          <div>
            <span className="overview-meta-row__label">Total Size</span>
            <span className="overview-meta-row__value">{formatFileSize(totalFileSize)}</span>
          </div>
        )}
        {description && (
          <div>
            <span className="overview-meta-row__label">Description</span>
            <span className="overview-meta-row__value overview-meta-row__value--body">{description}</span>
          </div>
        )}
      </div>
    </div>

    {hasGates && (
      <div className="overview-meta-section overview-meta-section--clickable" onClick={onOpenQualityGate}>
        <div className="overview-meta-section__title">Quality Gate</div>
        <div className="overview-gate-summary">
          <span className="overview-gate-item overview-gate-item--pass">
            <CheckCircle2 size={12} /> 통과 {gateCounts.pass}
          </span>
          <span className="overview-gate-item overview-gate-item--fail">
            <XCircle size={12} /> 실패 {gateCounts.fail}
          </span>
          <span className="overview-gate-item overview-gate-item--cds-support-warning">
            <AlertTriangle size={12} /> 경고 {gateCounts.warning}
          </span>
        </div>
      </div>
    )}

    <div className="overview-meta-section overview-meta-section--clickable" onClick={onOpenApprovals}>
      <div className="overview-meta-section__title">승인 요청</div>
      <div className="overview-approval-body">
        {approvalCount.pending > 0 ? (
          <div className="overview-approval-pending">
            <span className="overview-approval-pending__count">{approvalCount.pending}</span>
            <span className="overview-approval-pending__label">건 대기 중</span>
          </div>
        ) : (
          <p className="overview-empty-text overview-empty-text--compact">대기 없음</p>
        )}
        {approvalCount.total > 0 && <span className="overview-approval-total">총 {approvalCount.total}건</span>}
      </div>
    </div>

    {registeredSdks.length > 0 && (
      <div className="overview-meta-section overview-meta-section--clickable" onClick={onOpenSettings}>
        <div className="overview-meta-section__title">SDK ({registeredSdks.length}개)</div>
        <div className="overview-sdk-body">
          {registeredSdks.slice(0, 4).map((sdk) => (
            <div key={sdk.id} className="overview-sdk-row">
              <span className="overview-sdk-name">{sdk.name}</span>
              <span className={`overview-sdk-status ${getSdkStatusToneClass(sdk.status)}`}>
                {getSdkStatusLabel(sdk.status)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
