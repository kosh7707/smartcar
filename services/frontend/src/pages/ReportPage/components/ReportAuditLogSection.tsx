import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

export function ReportAuditLogSection({ auditTrail }: { auditTrail: ProjectReport["auditTrail"] }) {
  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>감사 추적 ({auditTrail.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border px-4 py-0">
        {auditTrail.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</span>
              <span className="font-medium text-foreground">{entry.actor}</span>
              <span className="text-sm text-muted-foreground">{entry.action}</span>
              <span className="text-sm text-muted-foreground">
                {entry.resource} {entry.resourceId?.slice(0, 8)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
