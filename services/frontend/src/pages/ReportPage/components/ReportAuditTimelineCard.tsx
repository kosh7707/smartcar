import React from "react";
import { CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectReport } from "@aegis/shared";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditTimelineCard({
  auditTrail,
}: {
  auditTrail: ProjectReport["auditTrail"];
}) {
  const visibleEntries = auditTrail.slice(0, 5);

  return (
    <Card className="report-timeline-card">
      <CardHeader className="report-timeline-card__header">
        <CardTitle>감사 추적</CardTitle>
      </CardHeader>
      <CardContent className="report-timeline-card__body">
        {visibleEntries.length === 0 ? (
          <p className="report-timeline-card__empty">감사 이력 없음</p>
        ) : (
          <div className="report-timeline">
            {visibleEntries.map((entry, index) => {
              const isComplete = index < visibleEntries.length - 1;

              return (
                <div key={entry.id} className="report-timeline__item">
                  <div
                    className={cn(
                      "report-timeline__icon",
                      isComplete ? "report-timeline__icon--complete" : "report-timeline__icon--pending",
                    )}
                  >
                    {isComplete ? <CheckCircle size={14} /> : <Clock size={14} />}
                  </div>
                  <div className="report-timeline__copy">
                    <p className="report-timeline__action">{entry.action}</p>
                    <span className="report-timeline__time">{formatDateTime(entry.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
