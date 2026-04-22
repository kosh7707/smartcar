import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditLogSection({ auditTrail }: { auditTrail: ProjectReport["auditTrail"] }) {
  return (
    <div className="panel report-audit-log-card">
      <div className="panel-head report-audit-log-card__head">
        <h3 className="panel-title">감사 추적 ({auditTrail.length})</h3>
      </div>
      <div className="panel-body report-audit-log-card__body">
        {auditTrail.map((entry) => (
          <div key={entry.id} className="report-audit-log-card__row">
            <div className="report-audit-log-card__meta">
              <span className="report-audit-log-card__timestamp">{formatDateTime(entry.timestamp)}</span>
              <span className="report-audit-log-card__actor">{entry.actor}</span>
              <span className="report-audit-log-card__copy">{entry.action}</span>
              <span className="report-audit-log-card__copy">
                {entry.resource} {entry.resourceId?.slice(0, 8)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
