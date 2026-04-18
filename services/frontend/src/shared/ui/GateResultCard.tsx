import React from "react";
import type { GateResult } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "../../utils/format";

interface Props {
  gate: GateResult;
  compact?: boolean;
}

const STATUS_CONFIG = {
  pass: {
    label: "통과",
    badgeClass: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    cardClass: "border-l-4 border-l-emerald-500",
  },
  fail: {
    label: "실패",
    badgeClass: "border-destructive/50 bg-destructive/10 text-destructive",
    cardClass: "border-l-4 border-l-[var(--aegis-severity-critical)]",
  },
  warning: {
    label: "경고",
    badgeClass: "border-yellow-400/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200",
    cardClass: "border-l-4 border-l-[var(--aegis-severity-medium)]",
  },
} as const;

export const GateResultCard: React.FC<Props> = ({ gate, compact }) => {
  const cfg = STATUS_CONFIG[gate.status];

  if (compact) {
    return (
      <Badge variant="outline" className={cfg.badgeClass}>
        {cfg.label}
      </Badge>
    );
  }

  return (
    <Card className={`${cfg.cardClass} shadow-none`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">Quality Gate: {cfg.label}</span>
          <span className="text-xs text-muted-foreground">{formatDateTime(gate.evaluatedAt)}</span>
        </div>
        <div className="space-y-2">
          {gate.rules.map((r) => {
            const tone = r.result === "passed"
              ? STATUS_CONFIG.pass.badgeClass
              : r.result === "failed"
                ? STATUS_CONFIG.fail.badgeClass
                : STATUS_CONFIG.warning.badgeClass;
            return (
              <div key={r.ruleId} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className={`text-xs ${tone}`}>
                  {r.result === "passed" ? "PASS" : r.result === "failed" ? "FAIL" : "WARN"}
                </Badge>
                <span className="min-w-0 flex-1 text-muted-foreground">{r.message}</span>
              </div>
            );
          })}
        </div>
        {gate.override && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Override by {gate.override.overriddenBy}: {gate.override.reason}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
