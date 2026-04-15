import React from "react";
import { CheckCircle, Clock } from "lucide-react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditTimelineCard({ auditTrail }: { auditTrail: ProjectReport["auditTrail"] }) {
  return (
    <div className="card report-audit-card">
      <span className="report-audit-card__title">감사 추적</span>
      <div className="report-audit-timeline">
        {auditTrail.length === 0 ? (
          <p className="report-audit-card__empty">감사 이력 없음</p>
        ) : (
          auditTrail.slice(0, 5).map((entry, index) => (
            <div key={entry.id} className="report-audit-item">
              <div className={`report-audit-item__dot ${index < auditTrail.length - 1 ? "report-audit-item__dot--done" : "report-audit-item__dot--pending"}`}>
                {index < auditTrail.length - 1 ? <CheckCircle size={14} /> : <Clock size={14} />}
              </div>
              <p className="report-audit-item__title">{entry.action}</p>
              <span className="report-audit-item__time">{formatDateTime(entry.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
