import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

interface Props {
  auditTrail: ProjectReport["auditTrail"];
}

export const ReportAuditTimeline: React.FC<Props> = ({ auditTrail }) => {
  if (auditTrail.length === 0) {
    return <div className="report-empty-line">감사 이력이 없습니다.</div>;
  }

  return (
    <div className="report-timeline">
      {auditTrail.map((entry, index) => (
        <div
          key={entry.id}
          className={`report-timeline__entry${index === 0 ? " is-recent" : ""}`}
        >
          <div className="report-timeline__row">
            <span className="report-timeline__when">
              {formatDateTime(entry.timestamp)}
            </span>
            <span className="report-timeline__actor">{entry.actor}</span>
            <span className="report-timeline__action">{entry.action}</span>
            {entry.resource ? (
              <span className="report-timeline__resource">
                {entry.resource}
                {entry.resourceId ? `/${entry.resourceId.slice(0, 8)}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};
