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
    <Card className="border-border/80 bg-gradient-to-b from-card to-muted/30 shadow-none">
      <CardHeader>
        <CardTitle>감사 추적</CardTitle>
      </CardHeader>
      <CardContent>
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">감사 이력 없음</p>
        ) : (
          <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            {visibleEntries.map((entry, index) => {
              const isComplete = index < visibleEntries.length - 1;

              return (
                <div key={entry.id} className="relative flex gap-3">
                  <div
                    className={cn(
                      "relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-background",
                      isComplete
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {isComplete ? <CheckCircle size={14} /> : <Clock size={14} />}
                  </div>
                  <div className="min-w-0 space-y-1 pb-1">
                    <p className="text-sm font-medium text-foreground">{entry.action}</p>
                    <span className="text-sm text-muted-foreground">{formatDateTime(entry.timestamp)}</span>
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
