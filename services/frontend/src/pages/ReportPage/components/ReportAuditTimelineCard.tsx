import React from "react";
import { CheckCircle, Clock } from "lucide-react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditTimelineCard({
  auditTrail,
}: {
  auditTrail: ProjectReport["auditTrail"];
}) {
  const visibleEntries = auditTrail.slice(0, 5);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>감사 추적</h3>
      </div>
      <div className="panel-body report-timeline-body">
        {visibleEntries.length === 0 ? (
          <p className="report-timeline-card__empty">감사 이력 없음</p>
        ) : (
          <div>
            {visibleEntries.map((entry, index) => {
              const isComplete = index < visibleEntries.length - 1;
              return (
                <div
                  key={entry.id}
                  className="activity-item"
                >
                  <div className={`activity-icon${isComplete ? " success" : " muted"}`}>
                    {isComplete
                      ? <CheckCircle size={10} aria-hidden="true" />
                      : <Clock size={10} aria-hidden="true" />}
                  </div>
                  <div className="activity-content">
                    <p className="line">{entry.action}</p>
                    <span className="mono report-timeline-timestamp">
                      {formatDateTime(entry.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
