import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportApprovalsSection({ approvals }: { approvals: ProjectReport["approvals"] }) {
  return (
    <div className="card">
      <div className="card-title">승인 이력 ({approvals.length})</div>
      {approvals.map((approval) => (
        <div key={approval.id} className="report-approval-row">
          <span className={`badge badge-sm badge-${approval.status === "approved" ? "low" : approval.status === "rejected" ? "critical" : "medium"}`}>
            {approval.status}
          </span>
          <span>{approval.actionType}</span>
          <span className="text-tertiary">요청: {approval.requestedBy}</span>
          {approval.decision && (
            <span className="text-tertiary">결정: {approval.decision.decidedBy}</span>
          )}
          <span className="text-sm text-tertiary">{formatDateTime(approval.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
