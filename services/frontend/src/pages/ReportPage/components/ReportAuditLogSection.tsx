import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditLogSection({ auditTrail }: { auditTrail: ProjectReport["auditTrail"] }) {
  return (
    <Card className="report-audit-log-card">
      <CardHeader className="report-audit-log-card__head">
        <CardTitle>감사 추적 ({auditTrail.length})</CardTitle>
      </CardHeader>
      <CardContent className="report-audit-log-card__body">
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
      </CardContent>
    </Card>
  );
}
