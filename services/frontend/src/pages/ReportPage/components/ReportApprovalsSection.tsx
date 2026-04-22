import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

const approvalStatusTone = {
  approved: "report-status-tone report-status-tone--approved",
  rejected: "report-status-tone report-status-tone--rejected",
  pending: "report-status-tone report-status-tone--pending",
} as const;

export function ReportApprovalsSection({ approvals }: { approvals: ProjectReport["approvals"] }) {
  return (
    <div className="panel report-approvals-card">
      <div className="panel-head report-approvals-card__head">
        <h3 className="panel-title">승인 이력 ({approvals.length})</h3>
      </div>
      <div className="panel-body report-approvals-card__body">
        {approvals.map((approval) => (
          <div key={approval.id} className="report-approvals-card__row">
            <div className="report-approvals-card__meta">
              <span
                className={approvalStatusTone[approval.status as keyof typeof approvalStatusTone] ?? "report-approvals-card__status report-approvals-card__status--idle"}
              >
                {approval.status}
              </span>
              <span className="report-approvals-card__action">{approval.actionType}</span>
              <span className="report-approvals-card__copy">요청: {approval.requestedBy}</span>
              {approval.decision && (
                <span className="report-approvals-card__copy">결정: {approval.decision.decidedBy}</span>
              )}
            </div>
            <span className="report-approvals-card__timestamp">{formatDateTime(approval.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
