import React from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface TopRule {
  ruleId: string;
  hitCount: number;
}

interface Props {
  topRules: TopRule[];
}

export const TopRulesCard: React.FC<Props> = ({ topRules }) => {
  if (topRules.length === 0) return null;

  const maxHit = Math.max(...topRules.map((r) => r.hitCount), 1);

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-5">
        <CardTitle>룰 히트 Top {topRules.length}</CardTitle>
        <div className="space-y-2">
          {topRules.map((r, i) => (
            <div key={r.ruleId} className="flex items-center gap-3 rounded-lg border border-border/70 px-4 py-3 text-sm">
              <span className="w-6 shrink-0 text-sm font-semibold text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={r.ruleId}>
                {r.ruleId}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/70">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.hitCount / maxHit) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-sm text-muted-foreground">{r.hitCount}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
