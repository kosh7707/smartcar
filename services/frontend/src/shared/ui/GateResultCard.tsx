import React from "react";
import type { GateResult } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "../../utils/format";

interface Props {
  gate: GateResult;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pass: { label: "통과", cls: "gate-badge--pass" },
  fail: { label: "실패", cls: "gate-badge--fail" },
  warning: { label: "경고", cls: "gate-badge--cds-support-warning" },
} as const;

export const GateResultCard: React.FC<Props> = ({ gate, compact }) => {
  const cfg = STATUS_CONFIG[gate.status];

  if (compact) {
    return (
      <Badge variant="outline" className={cfg.cls}>
        {cfg.label}
      </Badge>
    );
  }

  return (
    <Card className={cn("gate-card shadow-none", `gate-card--${gate.status}`)}>
      <CardContent className="space-y-4 p-4">
        <div className="gate-card__header flex items-start justify-between gap-3">
          <span className="gate-card__title text-sm font-semibold text-foreground">Quality Gate: {cfg.label}</span>
          <span className="gate-card__time text-xs text-muted-foreground">
            {formatDateTime(gate.evaluatedAt)}
          </span>
        </div>
        <div className="gate-card__rules space-y-2">
          {gate.rules.map((r) => (
            <div key={r.ruleId} className="gate-card__rule-row flex items-start gap-2 text-sm">
              <Badge
                variant="outline"
                className={`text-xs ${r.result === "passed" ? "gate-badge--pass" : r.result === "failed" ? "gate-badge--fail" : "gate-badge--cds-support-warning"}`}
              >
                {r.result === "passed" ? "PASS" : r.result === "failed" ? "FAIL" : "WARN"}
              </Badge>
              <span className="min-w-0 flex-1 text-muted-foreground">{r.message}</span>
            </div>
          ))}
        </div>
        {gate.override && (
          <div className="gate-card__override rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Override by {gate.override.overriddenBy}: {gate.override.reason}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
