import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

const approvalStatusTone = {
  approved: "report-status-tone report-status-tone--approved",
  rejected: "report-status-tone report-status-tone--rejected",
  pending:  "report-status-tone report-status-tone--pending",
} as const;

export function ReportApprovalsSection({ approvals }: { approvals: ProjectReport["approvals"] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>승인 이력 ({approvals.length})</h3>
      </div>
      <div className="panel-body report-list-body">
        {approvals.map((approval) => (
          <div key={approval.id} className="report-list-row">
            <div className="report-list-meta">
              <span
                className={
                  approvalStatusTone[approval.status as keyof typeof approvalStatusTone] ??
                  "report-status-tone"
                }
              >
                {approval.status}
              </span>
              <span className="report-list-primary">{approval.actionType}</span>
              <span className="report-list-secondary">요청: {approval.requestedBy}</span>
              {approval.decision && (
                <span className="report-list-secondary">결정: {approval.decision.decidedBy}</span>
              )}
            </div>
            <span className="report-list-timestamp">{formatDateTime(approval.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
