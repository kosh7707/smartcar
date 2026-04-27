import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditLogSection({ auditTrail }: { auditTrail: ProjectReport["auditTrail"] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>감사 추적 ({auditTrail.length})</h3>
      </div>
      <div className="panel-body report-list-body">
        {auditTrail.map((entry) => (
          <div key={entry.id} className="report-list-row">
            <div className="report-list-meta">
              <span className="report-list-timestamp">{formatDateTime(entry.timestamp)}</span>
              <span className="report-list-primary">{entry.actor}</span>
              <span className="report-list-secondary">{entry.action}</span>
              <span className="report-list-secondary">
                {entry.resource}{" "}
                <span className="mono">{entry.resourceId?.slice(0, 8)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
