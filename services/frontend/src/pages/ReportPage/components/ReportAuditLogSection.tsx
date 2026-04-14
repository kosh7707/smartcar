import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditLogSection({ auditTrail }: { auditTrail: ProjectReport["auditTrail"] }) {
  return (
    <div className="card">
      <div className="card-title">감사 추적 ({auditTrail.length})</div>
      <div className="report-audit">
        {auditTrail.map((entry) => (
          <div key={entry.id} className="report-audit__row">
            <span className="report-audit__time">{formatDateTime(entry.timestamp)}</span>
            <span className="report-audit__actor">{entry.actor}</span>
            <span className="report-audit__action">{entry.action}</span>
            <span className="text-tertiary text-sm">{entry.resource} {entry.resourceId?.slice(0, 8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
